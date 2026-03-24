import customtkinter as ctk
import tkinter as tk
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages
import mplcursors
from tkinter.filedialog import asksaveasfilename

plt.style.use('dark_background')
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class OttoPoint:
    def __init__(self, name, T_C, P_bar, v, s=0, h=0):
        self.name = name
        self.T_C = T_C
        self.T_K = T_C + 273.15
        self.P_bar = P_bar
        self.v = v
        self.s = s
        self.h = h

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
            
            # 1->2 (isentropic compression)
            T2s_K = T1_K * (r**(k-1))
            T2_K = T1_K + (T2s_K - T1_K) / eta
            P2_bar = P1 * (T2_K / T1_K) * (v1 / v2)
            
            # 2->3 (isochoric heat addition)
            P3_bar = P2_bar * (T3_K / T2_K)
            v3 = v2
            
            # 3->4 (isentropic expansion)
            T4s_K = T3_K * ((1/r)**(k-1))
            T4_K = T3_K - eta * (T3_K - T4s_K)
            P4_bar = P3_bar * (T4_K / T3_K) * (v3 / v1)
            v4 = v1

            def entropy(T_K, P_bar): return cp * np.log(T_K/273.15) - R * np.log(P_bar/1.0)
            
            p1 = OttoPoint("1", T1_C, P1, v1, entropy(T1_K, P1))
            p2 = OttoPoint("2", T2_K-273.15, P2_bar, v2, entropy(T2_K, P2_bar))
            p2s = OttoPoint("2s", T2s_K-273.15, P1*(r**k), v2, p1.s)
            p3 = OttoPoint("3", T3_C, P3_bar, v3, entropy(T3_K, P3_bar))
            p4 = OttoPoint("4", T4_K-273.15, P4_bar, v4, entropy(T4_K, P4_bar))
            p4s = OttoPoint("4s", T4s_K-273.15, P3_bar*((1/r)**k), v4, p3.s)
            
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
        for t in ["P-v", "T-s", "h-s"]:
            ax = self.axes[t]
            ax.clear()
            ax.set_title(f"Diagramma {t}")
            
            def get_xy(p):
                if t == "P-v": return (p.v, p.P_bar)
                elif t == "h-s": return (p.s, p.h)
                else: return (p.s, p.T_C)
            
            def plot_path(pA, pB, style, color, label=""):
                if t == "P-v":
                    vv = np.linspace(pA.v, pB.v, 50)
                    if abs(pA.v - pB.v) < 1e-7: # isochoric
                        pp = np.linspace(pA.P_bar, pB.P_bar, 50)
                    else: # isentropic
                        pp = pA.P_bar * (pA.v / vv)**1.4
                    ax.plot(vv, pp, linestyle=style, color=color, label=label)
                elif t == "h-s":
                    if abs(pA.s - pB.s) < 1e-7: # isentropic
                        ax.plot([pA.s, pB.s], [pA.h, pB.h], linestyle=style, color=color, label=label)
                    else: # isochoric
                        ss = np.linspace(pA.s, pB.s, 50)
                        cp_val = pA.cp if hasattr(pA, 'cp') else 1.005
                        ds = ss - pA.s
                        ratio = np.exp(ds / cp_val)
                        hh = pA.h * ratio + (pB.h - pA.h) * (ratio - 1) / (np.exp((pB.s - pA.s) / cp_val) - 1 or 1)
                        ax.plot(ss, hh, linestyle=style, color=color, label=label)
                else: # T-s
                    if abs(pA.s - pB.s) < 1e-7: # isentropic
                        ax.plot([pA.s, pB.s], [pA.T_C, pB.T_C], linestyle=style, color=color, label=label)
                    else: # isochoric
                        ss = np.linspace(pA.s, pB.s, 50)
                        T1_K = pA.T_C + 273.15
                        ds = ss - pA.s
                        T_K = T1_K * np.exp(ds / 0.718)
                        ax.plot(ss, T_K - 273.15, linestyle=style, color=color, label=label)

            plot_path(p1, p2, "-", "orange", "Reale")
            plot_path(p2, p3, "-", "red")
            plot_path(p3, p4, "-", "cyan")
            plot_path(p4, p1, "-", "blue")
            
            plot_path(p1, p2s, "--", "gray", "Ideale (η=1)")
            plot_path(p2s, p3, "--", "gray")
            plot_path(p3, p4s, "--", "gray")
            plot_path(p4s, p1, "--", "gray")

            for p in [p1, p2, p3, p4]:
                x, y = get_xy(p)
                ax.scatter(x, y, color="white", zorder=5)
                ax.annotate(p.name, (x, y), xytext=(5,5), textcoords="offset points")
            
            ax.grid(True, alpha=0.3)
            self.canvases[t].draw()

if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1400x850")
    app.title("Test OttoCAD")
    frame = OttoCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
