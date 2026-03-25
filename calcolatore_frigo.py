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
    r134a_isobaric_path, r134a_isenthalpic_path,
    add_direction_arrow, _get_diagram_coords
)
from core.thermo import r134a_sat, r134a_T_from_P

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

def _r134a_compressor_path(p1, p2, n=80):
    """
    Compressor path for R134a: from low-P superheated vapor (point 1)
    to high-P superheated vapor (point 2).  s increases (real) or stays
    constant (ideal).  We approximate with a polytropic interpolation
    in T-s space using cp_vap.
    """
    cp_vap = 0.9  # kJ/(kg·K) approx for R134a vapor
    s_arr = np.linspace(p1.s, p2.s, n)
    P_arr = np.linspace(p1.P_bar, p2.P_bar, n)
    T_arr = np.linspace(p1.T_C, p2.T_C, n)
    h_arr = np.linspace(p1.h, p2.h, n)

    # Approximate v with ideal gas-like scaling
    T_K_mid = (p1.T_C + p2.T_C) / 2 + 273.15
    sat_c = r134a_sat(r134a_T_from_P(p2.P_bar))
    v_arr = np.linspace(p1.v, p2.v, n)

    return {'P': P_arr, 'v': v_arr, 'T': T_arr, 's': s_arr, 'h': h_arr}


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
            Te = float(self.entries["Te"].get()); Tc = float(self.entries["Tc"].get())
            eta = float(self.entries["eta_is"].get()); m_dot = float(self.entries["m_dot"].get())
            dt_sub = float(self.entries["subcooling"].get()); dt_sup = float(self.entries["superheat"].get())
            
            sat_e = r134a_sat(Te)
            sat_c = r134a_sat(Tc)
            
            Pe = sat_e['P']
            Pc = sat_c['P']
            cp_vap = 0.9
            
            # Point 1: superheated vapor at evaporator exit
            T1 = Te + dt_sup
            h1 = sat_e['hg'] + cp_vap * dt_sup
            s1 = sat_e['sg'] + cp_vap * np.log((T1 + 273.15) / (Te + 273.15)) if dt_sup > 0 else sat_e['sg']
            v1 = sat_e['vg'] * (T1 + 273.15) / (Te + 273.15)
            
            # Point 2: compressor exit (isentropic -> real)
            sg2 = sat_c['sg']
            T2s_K = (Tc + 273.15) * np.exp((s1 - sg2) / cp_vap)
            h2s = sat_c['hg'] + cp_vap * (T2s_K - 273.15 - Tc)
            W_c_is = h2s - h1
            W_c = W_c_is / eta if eta > 0 else W_c_is
            h2 = h1 + W_c
            T2 = Tc + (h2 - sat_c['hg']) / cp_vap
            s2 = s1 + (h2 - h1) / ((T2 + Tc) / 2 + 273.15)
            v2 = sat_c['vg'] * (T2 + 273.15) / (Tc + 273.15)
            
            # Point 3: condenser exit (subcooled liquid)
            h3 = sat_c['hf'] - 1.2 * dt_sub
            s3 = sat_c['sf'] - 0.004 * dt_sub
            T3 = Tc - dt_sub
            v3 = sat_c['vf']
            
            # Point 4: after throttle (isenthalpic)
            h4 = h3
            x4 = (h4 - sat_e['hf']) / (sat_e['hg'] - sat_e['hf']) if (sat_e['hg'] - sat_e['hf']) > 0 else 0
            x4 = max(0.0, min(1.0, x4))
            s4 = sat_e['sf'] + x4 * (sat_e['sg'] - sat_e['sf'])
            v4 = sat_e['vf'] + x4 * (sat_e['vg'] - sat_e['vf'])
            T4 = Te

            p1 = FrigoPoint("1", T1, Pe, h1, s1, v1)
            p2 = FrigoPoint("2", T2, Pc, h2, s2, v2)
            p3 = FrigoPoint("3", T3, Pc, h3, s3, v3)
            p4 = FrigoPoint("4", T4, Pe, h4, s4, v4)

            self.points = [p1, p2, p3, p4]
            
            Q_evap = h1 - h4
            Q_cond = h2 - h3
            COP_f = Q_evap / W_c if W_c > 0 else 0
            COP_hp = Q_cond / W_c if W_c > 0 else 0
            
            # Saturation dome data
            dome_T = np.linspace(-40, 60, 80)
            dome_sat = [r134a_sat(t) for t in dome_T]
            dome_hf = [s['hf'] for s in dome_sat]
            dome_hg = [s['hg'] for s in dome_sat]
            dome_Pf = [s['P'] for s in dome_sat]
            dome_sf = [s['sf'] for s in dome_sat]
            dome_sg = [s['sg'] for s in dome_sat]

            self.dome = {
                "T": dome_T.tolist(), "hf": dome_hf, "hg": dome_hg,
                "Pf": dome_Pf, "sf": dome_sf, "sg": dome_sg,
            }

            res = (f"--- RISULTATI CICLO FRIGO ---\n"
                   f"Pot. Frigorifera: {Q_evap*m_dot:.2f} kW\n"
                   f"Pot. Termica: {Q_cond*m_dot:.2f} kW\n"
                   f"Pot. Compressore: {W_c*m_dot:.2f} kW\n\n"
                   f"COP Freddo: {COP_f:.2f}\n"
                   f"COP Caldo: {COP_hp:.2f}\n\n"
                   f"Pe: {Pe:.2f} bar\n"
                   f"Pc: {Pc:.2f} bar\n"
                   f"x4: {x4:.3f}")
            self.results_box.delete("1.0", "end"); self.results_box.insert("end", res)
            self._draw()
        except Exception as e: print(e)

    def _draw(self):
        p1, p2, p3, p4 = self.points
        dome = self.dome if hasattr(self, 'dome') else None

        for t in ["P-h", "T-s"]:
            ax = self.axes[t]
            ax.clear()
            ax.set_title(f"Diagramma {t}")

            # ── Draw saturation dome ──
            if dome:
                T_dome = np.array(dome["T"])
                if t == "P-h":
                    hh_f = np.array(dome["hf"])
                    hh_g = np.array(dome["hg"])
                    PP = np.array(dome["Pf"])
                    ax.plot(np.concatenate([hh_f, hh_g[::-1]]),
                            np.concatenate([PP, PP[::-1]]),
                            color="gray", alpha=0.5, linewidth=2, label="Saturazione")
                    ax.set_yscale('log')
                else:
                    ss_f = np.array(dome["sf"])
                    ss_g = np.array(dome["sg"])
                    ax.plot(np.concatenate([ss_f, ss_g[::-1]]),
                            np.concatenate([T_dome, T_dome[::-1]]),
                            color="gray", alpha=0.5, linewidth=2, label="Saturazione")

            # ── Generate paths using path_generator ──
            # 1→2: Compressor (approximated linear in T-s space)
            path_12 = _r134a_compressor_path(p1, p2, n=60)

            # 2→3: Condenser (isobaric, crosses dome from superheated to subcooled)
            path_23 = r134a_isobaric_path(p3.P_bar, p2.s, p3.s, n=80)

            # 3→4: Throttling valve (isenthalpic)
            path_34 = r134a_isenthalpic_path(p3.h, p3.P_bar, p4.P_bar, n=80)

            # 4→1: Evaporator (isobaric, crosses dome from two-phase to superheated)
            path_41 = r134a_isobaric_path(p1.P_bar, p4.s, p1.s, n=80)

            all_paths = [
                (path_12, "cyan",    "-", 2.5, "Compressione"),
                (path_23, "red",     "-", 2.5, "Condensazione"),
                (path_34, "yellow",  "-", 2.5, "Valvola (isoentalpica)"),
                (path_41, "blue",    "-", 2.5, "Evaporazione"),
            ]

            for path, col, sty, lw, lbl in all_paths:
                if path is None:
                    continue
                if t == "P-h":
                    xs, ys = path['h'], path['P']
                else:
                    xs, ys = path['s'], path['T']
                ax.plot(xs, ys, color=col, linestyle=sty, linewidth=lw, label=lbl)
                if len(xs) > 2:
                    add_direction_arrow(ax, xs, ys, color=col, size=12, position=0.5)

            # ── Scatter state points ──
            for p in self.points:
                if t == "P-h":
                    x, y = p.h, p.P_bar
                else:
                    x, y = p.s, p.T_C
                ax.scatter(x, y, color="white", zorder=5, s=60)
                ax.annotate(p.name, (x, y), xytext=(5, 5), textcoords="offset points",
                            color="white", fontweight="bold")

            # ── Labels ──
            if t == "P-h":
                ax.set_xlabel("h (kJ/kg)")
                ax.set_ylabel("P (bar)")
            else:
                ax.set_xlabel("s (kJ/(kg·K))")
                ax.set_ylabel("T (°C)")

            ax.grid(True, alpha=0.3)
            ax.legend(fontsize=8, loc="best", facecolor='#1A1A2E', labelcolor='white', framealpha=0.85)
            self.canvases[t].draw()

if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1400x850")
    app.title("Test FrigoCAD")
    frame = FrigoCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
