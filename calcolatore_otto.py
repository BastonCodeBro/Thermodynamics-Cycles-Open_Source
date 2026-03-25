import customtkinter as ctk
import tkinter as tk
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages
import mplcursors
from tkinter.filedialog import asksaveasfilename

from core.path_generator import (
    isentropic_path, isochoric_path, polytropic_path,
    add_direction_arrow, _get_diagram_coords
)

plt.style.use('dark_background')
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class OttoPoint:
    def __init__(self, name, T_C, P_bar, v, s=0, h=0, cp=1.005, k=1.4, R=0.287):
        self.name = name
        self.T_C = T_C
        self.T_K = T_C + 273.15
        self.P_bar = P_bar
        self.v = v
        self.s = s
        self.h = h
        self.cp = cp
        self.k = k
        self.R = R

class OttoCAD(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=5)
        self.grid_rowconfigure(0, weight=1)

        self.defaults = {
            "P1": 1.0, "T1": 20.0, "r": 9.0, "T3": 1200.0,
            "k": 1.4, "cv": 0.718, "eta_is": 0.85
        }
        
        self.points = []
        self._build_left_panel()
        self._build_plot_panel()
        self._compute()

    def _build_left_panel(self):
        self.left_scroll = ctk.CTkScrollableFrame(self)
        self.left_scroll.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        self.left_scroll.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.left_scroll, text="⚙ Ciclo Otto", font=ctk.CTkFont(weight="bold", size=20)).pack(pady=10)
        
        self.entries = {}
        for k, v in self.defaults.items():
            f = ctk.CTkFrame(self.left_scroll, fg_color="transparent")
            f.pack(fill="x", padx=10, pady=2)
            lbl_map = {"P1": "P1 (bar)", "T1": "T1 (°C)", "r": "Rapp. Compressione (r)", "T3": "T3 (°C - max)", "k": "Esponente k", "cv": "cv (kJ/kgK)", "eta_is": "η_is (compr/esp)"}
            ctk.CTkLabel(f, text=lbl_map.get(k, k), width=150, anchor="w").pack(side="left")
            ent = ctk.CTkEntry(f, width=100)
            ent.insert(0, str(v))
            ent.pack(side="right")
            self.entries[k] = ent

        ctk.CTkButton(self.left_scroll, text="Calcola", command=self._compute, fg_color="#2A6CBF").pack(pady=20, padx=10, fill="x")
        self.results_box = ctk.CTkTextbox(self.left_scroll, height=400, font=("Consolas", 12))
        self.results_box.pack(pady=10, padx=10, fill="x")

    def _build_plot_panel(self):
        self.frame_plot = ctk.CTkFrame(self, corner_radius=15, border_width=2)
        self.frame_plot.grid(row=0, column=1, padx=(0,10), pady=10, sticky="nsew")
        self.tabview = ctk.CTkTabview(self.frame_plot)
        self.tabview.pack(fill="both", expand=True, padx=5, pady=5)
        for t in ["P-v", "T-s", "h-s"]: self.tabview.add(t)
        
        self.figs, self.axes, self.canvases = {}, {}, {}
        for t in ["P-v", "T-s", "h-s"]:
            fig = Figure(figsize=(5,4), dpi=100, facecolor='#242424')
            ax = fig.add_subplot(111, facecolor='#242424')
            ax.tick_params(colors='white')
            for sp in ax.spines.values(): sp.set_color('white')
            ax.xaxis.label.set_color('white'); ax.yaxis.label.set_color('white')
            canvas = FigureCanvasTkAgg(fig, master=self.tabview.tab(t))
            canvas.get_tk_widget().pack(fill="both", expand=True)
            self.figs[t], self.axes[t], self.canvases[t] = fig, ax, canvas

    def _compute(self):
        try:
            P1 = float(self.entries["P1"].get())
            T1_C = float(self.entries["T1"].get())
            r = float(self.entries["r"].get())
            T3_C = float(self.entries["T3"].get())
            k = float(self.entries["k"].get())
            cv = float(self.entries["cv"].get())
            eta = float(self.entries["eta_is"].get())
            R = cv * (k - 1)
            cp = cv * k
            T1_K = T1_C + 273.15
            T3_K = T3_C + 273.15
            v1 = (R * T1_K) / (P1 * 100)
            v2 = v1 / r
            
            # 1->2 (isentropic compression, real with eta)
            T2s_K = T1_K * (r**(k-1))
            T2_K = T1_K + (T2s_K - T1_K) / eta
            P2_bar = P1 * (T2_K / T1_K) * (v1 / v2)
            
            # 2->3 (isochoric heat addition)
            P3_bar = P2_bar * (T3_K / T2_K)
            v3 = v2
            
            # 3->4 (isentropic expansion, real with eta)
            T4s_K = T3_K * ((1/r)**(k-1))
            T4_K = T3_K - eta * (T3_K - T4s_K)
            P4_bar = P3_bar * (T4_K / T3_K) * (v3 / v1)
            v4 = v1

            def entropy(T_K, P_bar): return cp * np.log(T_K/273.15) - R * np.log(P_bar/1.0)
            
            p1 = OttoPoint("1", T1_C, P1, v1, entropy(T1_K, P1), cp=cp, k=k, R=R)
            p2 = OttoPoint("2", T2_K-273.15, P2_bar, v2, entropy(T2_K, P2_bar), cp=cp, k=k, R=R)
            p2s = OttoPoint("2s", T2s_K-273.15, P1*(r**k), v2, p1.s, cp=cp, k=k, R=R)
            p3 = OttoPoint("3", T3_C, P3_bar, v3, entropy(T3_K, P3_bar), cp=cp, k=k, R=R)
            p4 = OttoPoint("4", T4_K-273.15, P4_bar, v4, entropy(T4_K, P4_bar), cp=cp, k=k, R=R)
            p4s = OttoPoint("4s", T4s_K-273.15, P3_bar*((1/r)**k), v4, p3.s, cp=cp, k=k, R=R)
            
            self.points = [p1, p2, p3, p4, p2s, p4s]
            
            qin = cv * (T3_K - T2_K)
            qout = cv * (T4_K - T1_K)
            wnet = qin - qout
            thermal_eta = (wnet / qin) * 100
            
            res = f"--- RISULTATI OTTO ---\nQin: {qin:.1f} kJ/kg\nQout: {qout:.1f} kJ/kg\nWnet: {wnet:.1f} kJ/kg\nη_termico: {thermal_eta:.2f}%\n\nPmax: {P3_bar:.2f} bar\nTmax: {T3_C:.1f} °C"
            self.results_box.delete("1.0", "end"); self.results_box.insert("end", res)
            self._draw()
        except Exception as e: print(e)

    def _draw(self):
        p1, p2, p3, p4, p2s, p4s = self.points
        diagram_map = {"P-v": "P-v", "T-s": "T-s", "h-s": "h-s"}

        for t in ["P-v", "T-s", "h-s"]:
            ax = self.axes[t]
            ax.clear()
            ax.set_title(f"Diagramma {t}")

            def get_xy(p):
                if t == "P-v": return (p.v, p.P_bar)
                elif t == "h-s": return (p.s, p.h)
                else: return (p.s, p.T_C)

            # ── Cycle segment definitions: (start, end, process_type, color, style, label) ──
            # Real cycle: 1→2 polytropic(compression), 2→3 isochoric, 3→4 polytropic(expansion), 4→1 isochoric
            real_segments = [
                (p1, p2, "polytropic", "orange", "-",  "Reale"),
                (p2, p3, "isochoric",  "red",    "-",  ""),
                (p3, p4, "polytropic", "cyan",   "-",  ""),
                (p4, p1, "isochoric",  "blue",   "-",  ""),
            ]
            # Ideal cycle: 1→2s isentropic, 2s→3 isochoric, 3→4s isentropic, 4s→1 isochoric
            ideal_segments = [
                (p1,  p2s, "isentropic", "gray", "--", "Ideale (η=1)"),
                (p2s, p3,  "isochoric",  "gray", "--", ""),
                (p3,  p4s, "isentropic", "gray", "--", ""),
                (p4s, p1,  "isochoric",  "gray", "--", ""),
            ]

            # ── Draw ideal cycle (dashed, behind) ──
            for pA, pB, proc, col, sty, lbl in ideal_segments:
                path = self._gen_path(pA, pB, proc, n=80)
                x, y = _get_diagram_coords(path, t)
                ax.plot(x, y, linestyle=sty, color=col, linewidth=1.5, alpha=0.5, label=lbl if lbl else None)

            # ── Draw real cycle (solid, on top) ──
            real_paths = []
            for pA, pB, proc, col, sty, lbl in real_segments:
                path = self._gen_path(pA, pB, proc, n=80)
                real_paths.append((path, col))
                x, y = _get_diagram_coords(path, t)
                ax.plot(x, y, linestyle=sty, color=col, linewidth=2.5, alpha=0.95, label=lbl if lbl else None)

            # ── Direction arrows (clockwise for power cycle) ──
            for path, col in real_paths:
                x, y = _get_diagram_coords(path, t)
                if len(x) > 2:
                    add_direction_arrow(ax, x, y, color=col, size=12, position=0.5)

            # ── Scatter state points ──
            for p in [p1, p2, p3, p4]:
                x, y = get_xy(p)
                ax.scatter(x, y, color="white", zorder=5)
                ax.annotate(p.name, (x, y), xytext=(5,5), textcoords="offset points")

            ax.grid(True, alpha=0.3)
            ax.legend(fontsize=8, loc="best", facecolor='#1A1A2E', labelcolor='white', framealpha=0.85)
            self.canvases[t].draw()

    @staticmethod
    def _gen_path(pA, pB, process, n=80):
        """Generate path arrays between two OttoPoints using path_generator."""
        if process == "isentropic":
            return isentropic_path(pA, pB, n)
        elif process == "isochoric":
            return isochoric_path(pA, pB, n)
        elif process == "polytropic":
            # For real (non-isentropic) compression/expansion: infer exponent
            return polytropic_path(pA, pB, n_exp=None, n=n)
        else:
            return polytropic_path(pA, pB, n_exp=None, n=n)

if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1400x850")
    app.title("Test OttoCAD")
    frame = OttoCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
