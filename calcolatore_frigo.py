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

class FrigoPoint:
    def __init__(self, name, T_C, P_bar, h, s, v=0):
        self.name = name
        self.T_C = T_C
        self.P_bar = P_bar
        self.h = h
        self.s = s
        self.v = v

class FrigoCAD(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=5)
        self.grid_rowconfigure(0, weight=1)

        self.defaults = {
            "Te": -10.0, "Tc": 35.0, "eta_is": 0.8, "m_dot": 0.1,
            "subcooling": 2.0, "superheat": 5.0
        }
        
        self.points = []
        self._build_left_panel()
        self._build_plot_panel()
        self._compute()

    def _build_left_panel(self):
        self.left_scroll = ctk.CTkScrollableFrame(self)
        self.left_scroll.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        self.left_scroll.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(self.left_scroll, text="❄ Ciclo Frigorifero", font=ctk.CTkFont(weight="bold", size=20)).pack(pady=10)
        
        self.entries = {}
        for k, v in self.defaults.items():
            f = ctk.CTkFrame(self.left_scroll, fg_color="transparent")
            f.pack(fill="x", padx=10, pady=2)
            lbl_map = {"Te": "T Evaporazione (°C)", "Tc": "T Condensazione (°C)", "eta_is": "η_is Compressore", "m_dot": "Portata ṁ (kg/s)", "subcooling": "Sottoraffreddamento (K)", "superheat": "Surriscaldamento (K)"}
            ctk.CTkLabel(f, text=lbl_map.get(k, k), width=180, anchor="w").pack(side="left")
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
        for t in ["P-h", "T-s"]: self.tabview.add(t)
        
        self.figs, self.axes, self.canvases = {}, {}, {}
        for t in ["P-h", "T-s"]:
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
            # Semplificazione: Proprietà fittizie simili a R134a
            Te = float(self.entries["Te"].get()); Tc = float(self.entries["Tc"].get())
            eta = float(self.entries["eta_is"].get()); m_dot = float(self.entries["m_dot"].get())
            dt_sub = float(self.entries["subcooling"].get()); dt_sup = float(self.entries["superheat"].get())
            
            # Funzioni lineari approssimative per h e s (modello giocattolo)
            def get_sat_props(T_C):
                P = 10**((T_C+100)/70) # bar
                hf = 200 + 1.2 * T_C; hg = 400 + 0.5 * T_C
                sf = 1.0 + 0.004 * T_C; sg = 1.7 - 0.001 * T_C
                return P, hf, hg, sf, sg

            Pe, hf_e, hg_e, sf_e, sg_e = get_sat_props(Te)
            Pc, hf_c, hg_c, sf_c, sg_c = get_sat_props(Tc)
            
            # Point 1: Compressor Inlet (superheated)
            h1 = hg_e + 0.8 * dt_sup
            s1 = sg_e + 0.003 * dt_sup
            p1 = FrigoPoint("1", Te + dt_sup, Pe, h1, s1)
            
            # Point 2: Compressor Outlet
            # s2s = s1
            h2s = h1 + (h1-hf_e)*0.5 * (Pc/Pe - 1) # approx
            h2 = h1 + (h2s - h1) / eta
            # T2 approx
            T2 = Tc + (h2 - hg_c) / 1.0
            p2 = FrigoPoint("2", T2, Pc, h2, s1 + (h2-h1)/(T2+273)) # approx
            
            # Point 3: Condenser Outlet (subcooled)
            h3 = hf_c - 1.2 * dt_sub
            T3 = Tc - dt_sub
            p3 = FrigoPoint("3", T3, Pc, h3, sf_c - 0.004 * dt_sub)
            
            # Point 4: Evaporator Inlet (iso-enthalpic valve)
            h4 = h3
            p4 = FrigoPoint("4", Te, Pe, h4, p3.s + 0.05)
            
            self.points = [p1, p2, p3, p4]
            
            qe = h1 - h4
            wc = h2 - h1
            qc = h2 - h3
            cop_frigo = qe / wc
            cop_pompa = qc / wc
            
            res = f"--- RISULTATI CICLO FRIGO ---\nPot. Frigorifera: {qe*m_dot:.2f} kW\nPot. Termica: {qc*m_dot:.2f} kW\nPot. Compressore: {wc*m_dot:.2f} kW\n\nCOP Freddo: {cop_frigo:.2f}\nCOP Caldo: {cop_pompa:.2f}\n\nPe: {Pe:.2f} bar\nPc: {Pc:.2f} bar"
            self.results_box.delete("1.0", "end"); self.results_box.insert("end", res)
            self._draw()
        except Exception as e: print(e)

    def _draw(self):
        p1, p2, p3, p4 = self.points
        for t in ["P-h", "T-s"]:
            ax = self.axes[t]
            ax.clear()
            ax.set_title(f"Diagramma {t}")
            
            # Dome approx
            Tt = np.linspace(-40, 60, 50)
            hh_f = 200 + 1.2 * Tt; hh_g = 400 + 0.5 * Tt
            ss_f = 1.0 + 0.004 * Tt; ss_g = 1.7 - 0.001 * Tt
            PP = 10**((Tt+100)/70)
            
            if t == "P-h":
                ax.plot(np.concatenate([hh_f, hh_g[::-1]]), np.concatenate([PP, PP[::-1]]), color="gray", alpha=0.5)
                ax.set_yscale('log')
                def get_xy(p): return (p.h, p.P_bar)
            else:
                ax.plot(np.concatenate([ss_f, ss_g[::-1]]), np.concatenate([Tt, Tt[::-1]]), color="gray", alpha=0.5)
                def get_xy(p): return (p.s, p.T_C)

            pts = [p1, p2, p3, p4, p1]
            xs = [get_xy(p)[0] for p in pts]
            ys = [get_xy(p)[1] for p in pts]
            ax.plot(xs, ys, color="cyan", linewidth=2)
            
            # Labels
            for p in self.points:
                x, y = get_xy(p)
                ax.scatter(x, y, color="white", zorder=5)
                ax.annotate(p.name, (x, y), xytext=(5,5), textcoords="offset points")
            
            ax.grid(True, alpha=0.3)
            self.canvases[t].draw()

if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1400x850")
    app.title("Test FrigoCAD")
    frame = FrigoCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
