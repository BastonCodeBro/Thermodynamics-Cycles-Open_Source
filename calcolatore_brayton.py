import customtkinter as ctk
import tkinter as tk
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages
import mplcursors
from tkinter.filedialog import asksaveasfilename
import matplotlib.patches as mpatches

plt.style.use('dark_background')
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

# ─────────────────────────────────────────────
#  Punto termodinamico gas ideale per ciclo Brayton
# ─────────────────────────────────────────────
class BraytonPoint:
    """Rappresenta uno stato termodinamico in un ciclo Brayton a gas ideale."""
    def __init__(self, name, T_C, P_bar, cp, k, h_ref=0.0, s_ref=0.0, T_ref_C=0.0, P_ref_bar=1.0):
        self.name = name
        self.T_C = T_C
        self.T_K = T_C + 273.15
        self.P_bar = P_bar
        self.cp = cp          # kJ/(kg·K)
        self.k = k            # esponente isoentropica
        self.R = cp * (1 - 1/k) if k > 1 else 0.287  # kJ/(kg·K)
        # Entalpia specifica relativa al punto di riferimento
        self.h = h_ref + cp * (T_C - T_ref_C)
        # Entropia specifica relativa al punto di riferimento
        T_ref_K = T_ref_C + 273.15
        self.s = s_ref + cp * np.log(self.T_K / T_ref_K) - self.R * np.log(P_bar / P_ref_bar)
        self.v = (self.R * self.T_K) / (P_bar * 100)  # m³/kg  (P in kPa → *100)

    def __repr__(self):
        return (f"{self.name}: T={self.T_C:.2f}°C  P={self.P_bar:.3f}bar  "
                f"h={self.h:.2f}kJ/kg  s={self.s:.4f}kJ/kgK")


def isentropic_T2(T1_K, P1, P2, k):
    """Temperatura a fine processo isentropico ideale."""
    return T1_K * (P2 / P1) ** ((k - 1) / k)


# ─────────────────────────────────────────────
#  Applicazione principale
# ─────────────────────────────────────────────
class BraytonCAD(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)

        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=5)
        self.grid_rowconfigure(0, weight=1)

        # ── Parametri di default (esercizio allegato) ──────────────────────
        self.defaults = {
            "m_dot":       50.0,    # kg/s
            "P1":          1.0,     # bar  aspirazione
            "T1":          15.0,    # °C   aspirazione
            "P2":          16.0,    # bar  dopo compressore
            "T3":          900.0,   # °C   ingresso turbina
            "P4":          1.1,     # bar  scarico turbina
            "Hi":          42000.0, # kJ/kg PCI combustibile
            "a0":          14.7,    # kg_aria/kg_comb (rapporto stechiometrico)
            # ── Compressore (aria)
            "ka":          1.386,
            "cpa":         1.025,   # kJ/kg·K
            "eta_ic":      0.889,   # rend. isentropico compressore
            "eta_m":       0.99,    # rend. meccanico
            # ── Camera di combustione
            "eta_cc":      0.99,    # rend. termico CC
            "cpg_comb":    1.173,   # kJ/kg·K (fase combustione)
            # ── Turbina (gas)
            "kg":          1.339,
            "cpg_esp":     1.13,    # kJ/kg·K (fase espansione)
            "eta_it":      0.91,    # rend. isentropico turbina
        }

        self.points = []           # lista BraytonPoint usata per i grafici
        self.results = {}          # dizionario risultati numerici

        self._build_left_panel()
        self._build_plot_panel()

        # Carica i valori di default e calcola subito
        self._load_defaults()
        self._compute()

    # ══════════════════════════════════════════
    #  PANNELLO SINISTRO
    # ══════════════════════════════════════════
    def _build_left_panel(self):
        self.left_scroll = ctk.CTkScrollableFrame(self)
        self.left_scroll.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        self.left_scroll.grid_columnconfigure(0, weight=1)

        row = 0

        # ── Titolo ────────────────────────────────────────────────────────
        ctk.CTkLabel(
            self.left_scroll,
            text="⚙ Ciclo Brayton – Turbogas",
            font=ctk.CTkFont(weight="bold", size=17)
        ).grid(row=row, column=0, pady=(10, 5)); row += 1

        ctk.CTkLabel(
            self.left_scroll,
            text="Impianto a ciclo aperto con aria e gas combusti",
            font=ctk.CTkFont(size=12),
            text_color="gray60"
        ).grid(row=row, column=0, pady=(0, 10)); row += 1

        # ── Sezione: Dati Impianto ─────────────────────────────────────────
        row = self._section_frame(row, "🏭 Dati Impianto")
        row, self.ent_m_dot   = self._param_row(row, "Portata aria ṁa (kg/s)",        "m_dot")
        row, self.ent_P1      = self._param_row(row, "P₁ – Pressione aspirazione (bar)", "P1")
        row, self.ent_T1      = self._param_row(row, "T₁ – Temperatura aspirazione (°C)", "T1")
        row, self.ent_P2      = self._param_row(row, "P₂ – Pressione dopo compressore (bar)", "P2")
        row, self.ent_T3      = self._param_row(row, "T₃ – Temp. ingresso turbina (°C)", "T3")
        row, self.ent_P4      = self._param_row(row, "P₄ – Contropressione scarico (bar)", "P4")
        row, self.ent_Hi      = self._param_row(row, "Hᵢ – PCI combustibile (kJ/kg)", "Hi")
        row, self.ent_a0      = self._param_row(row, "a₀ – Rapporto stechiometrico (kg/kg)", "a0")

        # ── Sezione: Compressore ───────────────────────────────────────────
        row = self._section_frame(row, "🔵 Compressore (Aria)")
        row, self.ent_ka      = self._param_row(row, "kₐ – Esponente isoentropica aria",   "ka")
        row, self.ent_cpa     = self._param_row(row, "cpₐ – Calore spec. aria (kJ/kg·K)",  "cpa")
        row, self.ent_eta_ic  = self._param_row(row, "ηᵢc – Rend. isentropico compressore","eta_ic")
        row, self.ent_eta_m   = self._param_row(row, "ηₘ – Rendimento meccanico",          "eta_m")

        # ── Sezione: Camera di Combustione ────────────────────────────────
        row = self._section_frame(row, "🔴 Camera di Combustione")
        row, self.ent_eta_cc    = self._param_row(row, "ηcc – Rend. termico CC",                "eta_cc")
        row, self.ent_cpg_comb  = self._param_row(row, "cpg_comb – Calore spec. gas comb. (kJ/kg·K)", "cpg_comb")

        # ── Sezione: Turbina ───────────────────────────────────────────────
        row = self._section_frame(row, "🟢 Turbina (Gas)")
        row, self.ent_kg       = self._param_row(row, "kg – Esponente isoentropica gas",        "kg")
        row, self.ent_cpg_esp  = self._param_row(row, "cpg_esp – Calore spec. gas esp. (kJ/kg·K)", "cpg_esp")
        row, self.ent_eta_it   = self._param_row(row, "ηᵢt – Rend. isentropico turbina",        "eta_it")

        # ── Pulsanti ──────────────────────────────────────────────────────
        ctk.CTkButton(
            self.left_scroll, text="▶  Calcola Ciclo",
            font=ctk.CTkFont(weight="bold", size=14),
            fg_color="#2A6CBF", hover_color="#1A4C8F",
            command=self._compute
        ).grid(row=row, column=0, padx=10, pady=(12, 4), sticky="ew"); row += 1

        ctk.CTkButton(
            self.left_scroll, text="↺  Ripristina Default",
            fg_color="gray40", hover_color="gray25",
            command=self._load_defaults
        ).grid(row=row, column=0, padx=10, pady=4, sticky="ew"); row += 1

        ctk.CTkButton(
            self.left_scroll, text="📄  Esporta PDF",
            fg_color="#2A8C4B", hover_color="#1E6636",
            command=self._export_pdf
        ).grid(row=row, column=0, padx=10, pady=4, sticky="ew"); row += 1

        self.label_error = ctk.CTkLabel(
            self.left_scroll, text="", text_color="#FF4C4C",
            wraplength=280, font=ctk.CTkFont(weight="bold")
        )
        self.label_error.grid(row=row, column=0, pady=5); row += 1

        # ── Box Risultati ─────────────────────────────────────────────────
        self.results_box = ctk.CTkTextbox(
            self.left_scroll, height=380, font=ctk.CTkFont(family="Consolas", size=12),
            state="disabled", wrap="none"
        )
        self.results_box.grid(row=row, column=0, padx=5, pady=10, sticky="ew"); row += 1

    def _section_frame(self, row, title):
        f = ctk.CTkFrame(self.left_scroll, corner_radius=8, fg_color="#1E1E2E" if ctk.get_appearance_mode() == "Dark" else "#E8EAF6")
        f.grid(row=row, column=0, sticky="ew", padx=5, pady=(8, 2))
        f.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(f, text=title, font=ctk.CTkFont(weight="bold", size=13)).pack(anchor="w", padx=10, pady=(6, 2))
        return row + 1

    def _param_row(self, row, label, key):
        f = ctk.CTkFrame(self.left_scroll, fg_color="transparent")
        f.grid(row=row, column=0, sticky="ew", padx=10, pady=1)
        f.grid_columnconfigure(0, weight=1)
        f.grid_columnconfigure(1, weight=0)
        ctk.CTkLabel(f, text=label, font=ctk.CTkFont(size=12), anchor="w").grid(row=0, column=0, sticky="w")
        ent = ctk.CTkEntry(f, width=100)
        ent.insert(0, str(self.defaults[key]))
        ent.grid(row=0, column=1, padx=(5, 0))
        return row + 1, ent

    def _load_defaults(self):
        pairs = [
            (self.ent_m_dot,   "m_dot"),
            (self.ent_P1,      "P1"),
            (self.ent_T1,      "T1"),
            (self.ent_P2,      "P2"),
            (self.ent_T3,      "T3"),
            (self.ent_P4,      "P4"),
            (self.ent_Hi,      "Hi"),
            (self.ent_a0,      "a0"),
            (self.ent_ka,      "ka"),
            (self.ent_cpa,     "cpa"),
            (self.ent_eta_ic,  "eta_ic"),
            (self.ent_eta_m,   "eta_m"),
            (self.ent_eta_cc,  "eta_cc"),
            (self.ent_cpg_comb,"cpg_comb"),
            (self.ent_kg,      "kg"),
            (self.ent_cpg_esp, "cpg_esp"),
            (self.ent_eta_it,  "eta_it"),
        ]
        for ent, key in pairs:
            ent.delete(0, "end")
            ent.insert(0, str(self.defaults[key]))

    # ══════════════════════════════════════════
    #  CALCOLO DEL CICLO
    # ══════════════════════════════════════════
    def _get_float(self, ent):
        return float(ent.get().replace(",", "."))

    def _compute(self):
        self.label_error.configure(text="")
        try:
            # ── Leggi parametri ───────────────────────────────────────────
            m_dot      = self._get_float(self.ent_m_dot)
            P1         = self._get_float(self.ent_P1)
            T1_C       = self._get_float(self.ent_T1)
            P2         = self._get_float(self.ent_P2)
            T3_C       = self._get_float(self.ent_T3)
            P4         = self._get_float(self.ent_P4)
            Hi         = self._get_float(self.ent_Hi)
            a0         = self._get_float(self.ent_a0)
            ka         = self._get_float(self.ent_ka)
            cpa        = self._get_float(self.ent_cpa)
            eta_ic     = self._get_float(self.ent_eta_ic)
            eta_m      = self._get_float(self.ent_eta_m)
            eta_cc     = self._get_float(self.ent_eta_cc)
            cpg_comb   = self._get_float(self.ent_cpg_comb)
            kg         = self._get_float(self.ent_kg)
            cpg_esp    = self._get_float(self.ent_cpg_esp)
            eta_it     = self._get_float(self.ent_eta_it)

            T1_K = T1_C + 273.15
            T3_K = T3_C + 273.15

            # ════════════════════════════════════════════
            #  A. FASE DI COMPRESSIONE
            # ════════════════════════════════════════════
            # A1 – Temperature teorica e reale
            T2_K  = isentropic_T2(T1_K, P1, P2, ka)   # ideale
            T2_C  = T2_K - 273.15
            T2r_K = T1_K + (T2_K - T1_K) / eta_ic     # reale
            T2r_C = T2r_K - 273.15

            # A2 – Lavori unitari
            l_tc = cpa * (T2_K - T1_K)                 # teorico [kJ/kg]
            l_ic = cpa * (T2r_K - T1_K)                # reale (interno) [kJ/kg]

            # A3 – Potenze
            P_tc = m_dot * l_tc                         # teorica [kW]
            P_ic = m_dot * l_ic                         # interna [kW]
            P_ac = P_ic / eta_m                         # reale all'asse [kW]

            # ════════════════════════════════════════════
            #  B. CAMERA DI COMBUSTIONE
            # ════════════════════════════════════════════
            # B4 – Portata combustibile
            # Bilancio energetico: m_dot * cpg_comb * (T3-T2r) = G_c * eta_cc * Hi
            G_c  = m_dot * cpg_comb * (T3_K - T2r_K) / (eta_cc * Hi)  # kg/s

            # B5 – Eccesso d'aria
            # rapporto aria/combustibile reale = m_dot / G_c
            ac_real = m_dot / G_c
            e = (ac_real / a0 - 1) * 100  # %

            # ════════════════════════════════════════════
            #  C. FASE DI ESPANSIONE
            # ════════════════════════════════════════════
            # C6 – Temperature teorica e reale
            T4_K  = isentropic_T2(T3_K, P2, P4, kg)   # ideale
            T4_C  = T4_K - 273.15
            T4r_K = T3_K - eta_it * (T3_K - T4_K)     # reale
            T4r_C = T4r_K - 273.15

            # C7 – Lavori unitari (riferiti alla portata di gas = m_dot + G_c)
            l_tT  = cpg_esp * (T3_K - T4_K)            # teorico [kJ/kg]
            l_iT  = cpg_esp * (T3_K - T4r_K)           # reale interno [kJ/kg]

            # C8 – Potenze (portata gas totale)
            m_gas = m_dot + G_c
            P_tT  = m_gas * l_tT                        # teorica [kW]
            P_iT  = m_gas * l_iT                        # interna [kW]
            P_e_lorda = P_iT * eta_m                    # effettiva lorda [kW]

            # ════════════════════════════════════════════
            #  D. PRESTAZIONI GLOBALI
            # ════════════════════════════════════════════
            # D9 – Potenza effettiva netta
            P_e_netta = P_e_lorda - P_ac                # [kW]

            # D10 – Rendimento termico effettivo
            Q_in = G_c * eta_cc * Hi                    # calore introdotto [kW]
            eta_te = (P_e_netta / Q_in) * 100           # %

            # D11 – Consumo specifico
            C_c = G_c / (P_e_netta / 1000.0)            # kg/kWh  (P in MW → *1000)
            # Nota: P_e_netta in kW → /1000 → MW; G_c in kg/s → *3600 kg/h
            C_c_kgkWh = (G_c * 3600) / P_e_netta       # [kg/kWh]

            # ── Salva risultati ────────────────────────────────────────────
            self.results = dict(
                P1=P1, T1_C=T1_C, P2=P2, T3_C=T3_C, P4=P4,
                T2_C=T2_C, T2r_C=T2r_C,
                T4_C=T4_C, T4r_C=T4r_C,
                l_tc=l_tc, l_ic=l_ic,
                P_tc=P_tc, P_ic=P_ic, P_ac=P_ac,
                G_c=G_c, e=e,
                l_tT=l_tT, l_iT=l_iT,
                P_tT=P_tT, P_iT=P_iT, P_e_lorda=P_e_lorda,
                P_e_netta=P_e_netta, Q_in=Q_in,
                eta_te=eta_te, C_c_kgkWh=C_c_kgkWh,
                # per i grafici
                cpa=cpa, ka=ka, cpg_esp=cpg_esp, kg=kg,
                m_dot=m_dot, m_gas=m_gas
            )

            # ── Componi punti del ciclo per i grafici ─────────────────────
            r = self.results
            # Punto 1 – aspirazione (punto di riferimento per h e s)
            p1 = BraytonPoint("1 – Aspirazione",       r["T1_C"],  P1,  cpa, ka,   h_ref=0,     s_ref=0,     T_ref_C=r["T1_C"],  P_ref_bar=P1)
            # Punto 2 ideale – fine compressione isoentropica
            p2 = BraytonPoint("2 – Compr. Ideale",     r["T2_C"],  P2,  cpa, ka,   h_ref=p1.h,  s_ref=p1.s,  T_ref_C=r["T1_C"],  P_ref_bar=P1)
            # Punto 2' reale – fine compressione reale
            p2r = BraytonPoint("2′ – Compr. Reale",    r["T2r_C"], P2,  cpa, ka,   h_ref=p1.h,  s_ref=p1.s,  T_ref_C=r["T1_C"],  P_ref_bar=P1)
            # Punto 3 – fine combustione / ingresso turbina
            p3 = BraytonPoint("3 – Ingresso Turbina",  r["T3_C"],  P2,  cpg_esp, kg, h_ref=p2r.h, s_ref=p2r.s, T_ref_C=r["T2r_C"], P_ref_bar=P2)
            # Punto 4 ideale – fine espansione isoentropica
            p4 = BraytonPoint("4 – Esp. Ideale",       r["T4_C"],  P4,  cpg_esp, kg, h_ref=p3.h,  s_ref=p3.s,  T_ref_C=r["T3_C"],  P_ref_bar=P2)
            # Punto 4' reale – fine espansione reale
            p4r = BraytonPoint("4′ – Esp. Reale",      r["T4r_C"], P4,  cpg_esp, kg, h_ref=p3.h,  s_ref=p3.s,  T_ref_C=r["T3_C"],  P_ref_bar=P2)

            self.points = [p1, p2, p2r, p3, p4, p4r]

            self._update_results_box()
            self._redraw_plots()

        except ZeroDivisionError:
            self.label_error.configure(text="Errore: divisione per zero – controlla i parametri.")
        except ValueError as ve:
            self.label_error.configure(text=f"Errore nei dati: {ve}")
        except Exception as ex:
            self.label_error.configure(text=f"Errore: {ex}")

    def _update_results_box(self):
            # Dati extra per Brayton
            beta = r['P2'] / r['P1']
            bwr_ideal = (r['l_tc'] / (r['l_tT'] * (r['m_gas']/r['m_dot']))) * 100 if r['l_tT'] > 0 else 0
            bwr_real = (r['l_ic'] / (r['l_iT'] * (r['m_gas']/r['m_dot']))) * 100 if r['l_iT'] > 0 else 0
            T_max_K = r['T3_C'] + 273.15
            T_min_K = r['T1_C'] + 273.15
            eta_carnot = (1 - T_min_K / T_max_K) * 100 if T_max_K > T_min_K else 0

            lines = [
                "═══════════════════════════════════════════",
                "  RISULTATI CICLO BRAYTON – TURBOGAS",
                "═══════════════════════════════════════════",
                "",
                f"  Rapporto di pressione β: {beta:.2f}",
                "",
                "── A. COMPRESSIONE ─────────────────────────",
                f"  T₂  teorica (ideale)  : {r['T2_C']:>9.2f}  °C",
                f"  T₂′ reale             : {r['T2r_C']:>9.2f}  °C",
                f"  l_tc teorico          : {r['l_tc']:>9.2f}  kJ/kg",
                f"  l_ic reale (interno)  : {r['l_ic']:>9.2f}  kJ/kg",
                f"  P_tc pot. teorica     : {r['P_tc']/1000:>9.3f}  MW",
                f"  P_ic pot. interna     : {r['P_ic']/1000:>9.3f}  MW",
                f"  P_ac pot. asse comp.  : {r['P_ac']/1000:>9.3f}  MW",
                "",
                "── B. CAMERA DI COMBUSTIONE ─────────────────",
                f"  G_c portata comb.     : {r['G_c']:>9.4f}  kg/s",
                f"  Eccesso d'aria (e)    : {r['e']:>9.2f}  %",
                "",
                "── C. ESPANSIONE ────────────────────────────",
                f"  T₄  teorica (ideale)  : {r['T4_C']:>9.2f}  °C",
                f"  T₄′ reale             : {r['T4r_C']:>9.2f}  °C",
                f"  l_tT teorico          : {r['l_tT']:>9.2f}  kJ/kg",
                f"  l_iT reale (interno)  : {r['l_iT']:>9.2f}  kJ/kg",
                f"  P_tT pot. teorica     : {r['P_tT']/1000:>9.3f}  MW",
                f"  P_iT pot. interna     : {r['P_iT']/1000:>9.3f}  MW",
                f"  P_e* pot. eff. lorda  : {r['P_e_lorda']/1000:>9.3f}  MW",
                "",
                "── D. PRESTAZIONI GLOBALI ────────────────────",
                f"  P_e  pot. netta       : {r['P_e_netta']/1000:>9.3f}  MW",
                f"  Q_in calore introdotto: {r['Q_in']/1000:>9.3f}  MW",
                f"  BWR (Back Work Ratio) : {bwr_real:>9.2f}  %",
                f"  η_te rend. eff.       : {r['eta_te']:>9.2f}  %",
                f"  η_Carnot (limite)     : {eta_carnot:>9.2f}  %",
                f"  C_c  cons. spec.      : {r['C_c_kgkWh']:>9.5f}  kg/kWh",
                "═══════════════════════════════════════════",
            ]
        text = "\n".join(lines)
        self.results_box.configure(state="normal")
        self.results_box.delete("0.0", "end")
        self.results_box.insert("end", text)
        self.results_box.configure(state="disabled")

    # ══════════════════════════════════════════
    #  PANNELLO GRAFICO (destra)
    # ══════════════════════════════════════════
    def _build_plot_panel(self):
        frame_plot = ctk.CTkFrame(self, corner_radius=15, border_width=2)
        frame_plot.grid(row=0, column=1, padx=(0, 10), pady=10, sticky="nsew")
        frame_plot.grid_rowconfigure(0, weight=1)
        frame_plot.grid_columnconfigure(0, weight=1)

        self.tabview = ctk.CTkTabview(frame_plot)
        self.tabview.pack(fill="both", expand=True, padx=5, pady=5)

        self.tabs = ["Schema", "T-s", "T-P", "h-s", "P-v"]
        for t in self.tabs:
            self.tabview.add(t)

        self.figs, self.axes, self.canvases = {}, {}, {}
        bg_col = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg_col = 'white'   if ctk.get_appearance_mode() == 'Dark' else 'black'

        for tab in self.tabs:
            fig = Figure(figsize=(5, 4), dpi=100)
            fig.patch.set_facecolor(bg_col)
            ax = fig.add_subplot(111)
            ax.set_facecolor(bg_col)
            
            if tab == "Schema":
                ax.axis('off')
            else:
                ax.tick_params(colors=fg_col)
                ax.xaxis.label.set_color(fg_col)
                ax.yaxis.label.set_color(fg_col)
                ax.title.set_color(fg_col)
                for sp in ax.spines.values():
                    sp.set_color(fg_col)

            canvas = FigureCanvasTkAgg(fig, master=self.tabview.tab(tab))
            canvas.get_tk_widget().pack(fill="both", expand=True)

            self.figs[tab]    = fig
            self.axes[tab]    = ax
            self.canvases[tab] = canvas

    def _get_xy(self, pt: BraytonPoint, tab: str):
        if tab == "T-s":  return pt.s,   pt.T_C
        if tab == "T-P":  return pt.P_bar, pt.T_C
        if tab == "h-s":  return pt.s,   pt.h
        if tab == "P-v":  return pt.v,   pt.P_bar
        return 0, 0

    def _path_between(self, pt1: BraytonPoint, pt2: BraytonPoint, n=80):
        """
        Genera n punti intermedi per disegnare il percorso termodinamico.
        Utilizza un'interpolazione logaritmica (modello politropico generalizzato) 
        per garantire curve chiuse in tutti i diagrammi e andamenti fisicamente
        corretti (es. curve in P-v invece di linee dritte).
        """
        pts = []
        t_vals = np.linspace(0, 1, n)
        
        for t in t_vals:
            # P, T, v interpolati in scala logaritmica (esatto per gas ideali politropici)
            P_k = pt1.P_bar * ((pt2.P_bar / pt1.P_bar) ** t)
            T_K_k = pt1.T_K * ((pt2.T_K / pt1.T_K) ** t)
            v_k = pt1.v * ((pt2.v / pt1.v) ** t)
            
            # h è lineare con T
            if pt1.T_K != pt2.T_K:
                h_k = pt1.h + (T_K_k - pt1.T_K) / (pt2.T_K - pt1.T_K) * (pt2.h - pt1.h)
            else:
                h_k = pt1.h + t * (pt2.h - pt1.h)
                
            # s è lineare con il parametro t in caso di isobare o trasformazioni politropiche
            s_k = pt1.s + t * (pt2.s - pt1.s)
            
            pts.append(dict(T_C=T_K_k - 273.15, T_K=T_K_k, P_bar=P_k, h=h_k, s=s_k, v=v_k))
            
        return pts

    def _pt_xy(self, d: dict, tab: str):
        if tab == "T-s":  return d["s"],   d["T_C"]
        if tab == "T-P":  return d["P_bar"], d["T_C"]
        if tab == "h-s":  return d["s"],   d["h"]
        if tab == "P-v":  return d["v"],   d["P_bar"]
        return 0, 0

    # ─────────────────────────────────────────────────────────────────────
    #  Ciclo: definizione segmenti ideale e reale
    # ─────────────────────────────────────────────────────────────────────
    def _get_cycles(self):
        """
        Restituisce due liste di segmenti:
          ideal_segs  – ciclo ideale  (tratti trattegiati)
          real_segs   – ciclo reale   (tratti pieni)
        Ogni elemento: (pt_start, pt_end, colore, stile, label)

        La chiusura del ciclo (scarico) è inclusa esplicitamente in entrambi,
        collegando l'ultimo punto al punto 1.
        """
        if len(self.points) < 6:
            return [], []
        p1, p2, p2r, p3, p4, p4r = self.points

        # ── Ciclo ideale: 1→2→3→4→1 ──────────────────────────────────
        ideal_segs = [
            (p1,  p2,  "#6699FF", "--", "Compressione ideale"),
            (p2,  p3,  "#FFCC44", "--", "Combustione ideale"),
            (p3,  p4,  "#44DDAA", "--", "Espansione ideale"),
            (p4,  p1,  "#CC88FF", "--", "Scarico ideale (chiusura)"),
        ]

        # ── Ciclo reale: 1→2'→3→4'→1 ────────────────────────────────
        real_segs = [
            (p1,   p2r, "#3377EE", "-",  "Compressione reale"),
            (p2r,  p3,  "#FF8800", "-",  "Combustione"),
            (p3,   p4r, "#00CC88", "-",  "Espansione reale"),
            (p4r,  p1,  "#AA44FF", "-",  "Scarico reale (chiusura)"),
        ]
        return ideal_segs, real_segs

    # ─────────────────────────────────────────────────────────────────────
    #  Ridisegno completo dei 4 diagrammi
    # ─────────────────────────────────────────────────────────────────────
    def _draw_schema(self, ax, bg_col, fg_col):
        ax.clear()
        ax.set_facecolor(bg_col)
        ax.axis('off')
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)

        # Draw Shaft (Albero Motore)
        ax.plot([0.3, 0.9], [0.4, 0.4], color='gray', linewidth=6, zorder=1)
        ax.text(0.5, 0.35, "ALBERO MOTORE", color=fg_col, fontweight='bold', ha='center', fontsize=10)

        # Draw pipes (Tubazioni) - connecting comp -> cc -> turb
        # Comp (x=0.35, y=0.5) to CC (x=0.4, y=0.75)
        ax.plot([0.35, 0.35], [0.5, 0.8], color='#555555', linewidth=16, zorder=1)
        ax.plot([0.35, 0.45], [0.8, 0.8], color='#555555', linewidth=16, zorder=1)
        # CC (x=0.55, y=0.75) to Turb (x=0.65, y=0.5)
        ax.plot([0.55, 0.65], [0.8, 0.8], color='#555555', linewidth=16, zorder=1)
        ax.plot([0.65, 0.65], [0.8, 0.5], color='#555555', linewidth=16, zorder=1)

        # Draw Compressor (Blue Trapezoid)
        comp_poly = mpatches.Polygon([[0.2, 0.3], [0.2, 0.7], [0.4, 0.6], [0.4, 0.4]], closed=True, color='#2196F3', zorder=2)
        ax.add_patch(comp_poly)
        ax.text(0.3, 0.5, "COMPRESSORE", color='white', fontweight='bold', ha='center', va='center', rotation=90, fontsize=11)

        # Draw Turbina (Green Trapezoid)
        turb_poly = mpatches.Polygon([[0.6, 0.4], [0.6, 0.6], [0.8, 0.7], [0.8, 0.3]], closed=True, color='#4CAF50', zorder=2)
        ax.add_patch(turb_poly)
        ax.text(0.7, 0.5, "TURBINA", color='white', fontweight='bold', ha='center', va='center', rotation=-90, fontsize=11)

        # Draw Combustion Chamber (Yellow Rectangle)
        cc_rect = mpatches.Rectangle((0.4, 0.7), 0.2, 0.2, color='#FFCA28', zorder=2)
        ax.add_patch(cc_rect)
        ax.text(0.5, 0.8, "CAMERA DI\nCOMBUSTIONE", color='black', fontweight='bold', ha='center', va='center', fontsize=10)

        # ARIA (flow arrows into compressor)
        ax.annotate("ARIA", xy=(0.18, 0.5), xytext=(0.02, 0.5), color=fg_col, fontweight='bold', fontsize=11,
                    arrowprops=dict(facecolor='#64B5F6', edgecolor='none', width=4, headwidth=10))

        # COMBUSTIBILE (flow arrow into CC)
        ax.annotate("COMBUSTIBILE", xy=(0.5, 0.9), xytext=(0.5, 1.05), color=fg_col, fontweight='bold', ha='center', fontsize=11,
                    arrowprops=dict(facecolor='#F44336', edgecolor='none', width=6, headwidth=14))

        # Add Cycle Points with their current values
        if self.results and len(self.points) >= 6:
            r = self.results
            p1, p2, p2r, p3, p4, p4r = self.points
            
            def put_point(x, y, label, pt, ha='center', va='center'):
                text = f"Punto {label}\nT: {pt.T_C:.1f} °C\nP: {pt.P_bar:.2f} bar\nh: {pt.h:.1f} kJ/kg\nv: {pt.v:.3f} m³/kg"
                ax.text(x, y, text, color=fg_col, fontsize=8, ha=ha, va=va, zorder=5,
                        bbox=dict(facecolor='#1E1E2E' if bg_col=='#242424' else '#FFFFFF', alpha=0.9, edgecolor=fg_col, boxstyle='round,pad=0.4'))
                ax.scatter(x, y, s=40, color='red', zorder=6)

            # Punto 1: before Compressor
            put_point(0.12, 0.35, "1", p1, ha='right')

            # Punto 2 (Ideal and Real): between Compressor and CC
            put_point(0.32, 0.88, "2", p2, ha='right')
            put_point(0.32, 0.68, "2'", p2r, ha='right')

            # Punto 3: between CC and Turbine
            put_point(0.68, 0.88, "3", p3, ha='left')

            # Punto 4 (Ideal and Real): after Turbine
            ax.annotate("", xy=(0.98, 0.5), xytext=(0.82, 0.5),
                        arrowprops=dict(facecolor='#9E9E9E', edgecolor='none', width=4, headwidth=10))
            ax.text(0.9, 0.58, "SCARICO", color=fg_col, fontweight='bold', ha='center', fontsize=10)
            put_point(0.88, 0.35, "4", p4, ha='left')
            put_point(0.88, 0.15, "4'", p4r, ha='left')

            # Add Annotations for Works, Powers and Heats
            # Compressor Work/Power
            text_comp = f"Lavoro (reale): {r['l_ic']:.1f} kJ/kg\nPotenza assorb.: {r['P_ic']/1000:.2f} MW"
            ax.text(0.3, 0.18, text_comp, color='#64B5F6', fontsize=9, ha='center', va='top', fontweight='bold',
                    bbox=dict(facecolor=bg_col, alpha=0.7, edgecolor='none', pad=0))
            
            # Turbine Work/Power
            text_turb = f"Lavoro (reale): {r['l_iT']:.1f} kJ/kg\nPotenza prod.: {r['P_iT']/1000:.2f} MW"
            ax.text(0.7, 0.18, text_turb, color='#81C784', fontsize=9, ha='center', va='top', fontweight='bold',
                    bbox=dict(facecolor=bg_col, alpha=0.7, edgecolor='none', pad=0))
            
            # Heat CC
            text_cc = f"Calore (Qin): {r['Q_in']/1000:.2f} MW"
            ax.text(0.5, 0.65, text_cc, color='#FFCA28', fontsize=9, ha='center', va='top', fontweight='bold',
                    bbox=dict(facecolor=bg_col, alpha=0.7, edgecolor='none', pad=0))
            
            # Global
            text_glob = f"Potenza Netta: {r['P_e_netta']/1000:.2f} MW   |   Rendimento: {r['eta_te']:.1f}%"
            ax.text(0.5, 0.05, text_glob, color='white', fontsize=10, ha='center', va='bottom', fontweight='bold',
                    bbox=dict(facecolor='#333333', alpha=0.9, edgecolor='white', boxstyle='round,pad=0.3'))

    def _redraw_plots(self):
        bg_col = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg_col = 'white'   if ctk.get_appearance_mode() == 'Dark' else 'black'
        ann_col = 'white'  if ctk.get_appearance_mode() == 'Dark' else '#111111'

        for tab in self.tabs:
            ax = self.axes[tab]
            ax.clear()
            ax.set_facecolor(bg_col)
            ax.tick_params(colors=fg_col)
            ax.title.set_color(fg_col)
            ax.xaxis.label.set_color(fg_col)
            ax.yaxis.label.set_color(fg_col)
            for sp in ax.spines.values():
                sp.set_color(fg_col)

            # ── Etichette assi ─────────────────────────────────────────
            if tab == "Schema":
                self._draw_schema(ax, bg_col, fg_col)
                self.canvases[tab].draw()
                continue
            elif tab == "T-s":
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
                ax.set_title("Diagramma T-s – Ciclo Brayton", color=fg_col)
            elif tab == "T-P":
                ax.set_xlabel("P (bar)");      ax.set_ylabel("T (°C)")
                ax.set_title("Diagramma T-P – Ciclo Brayton", color=fg_col)
            elif tab == "h-s":
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("h (kJ/kg)")
                ax.set_title("Diagramma h-s (Mollier gas) – Ciclo Brayton", color=fg_col)
            elif tab == "P-v":
                ax.set_xlabel("v (m³/kg)");    ax.set_ylabel("P (bar)")
                ax.set_title("Diagramma P-v – Ciclo Brayton", color=fg_col)

            if not self.points:
                self.canvases[tab].draw()
                continue

            ideal_segs, real_segs = self._get_cycles()

            # ── 1. Disegna ciclo ideale (tratteggiato, semitrasparente) ─
            for (pt1, pt2, color, style, label) in ideal_segs:
                path = self._path_between(pt1, pt2)
                xs = [self._pt_xy(d, tab)[0] for d in path]
                ys = [self._pt_xy(d, tab)[1] for d in path]
                ax.plot(xs, ys, color=color, linestyle=style,
                        linewidth=1.8, alpha=0.55, label=label)

            # ── 2. Disegna ciclo reale (pieno, più visibile) ────────────
            for (pt1, pt2, color, style, label) in real_segs:
                path = self._path_between(pt1, pt2)
                xs = [self._pt_xy(d, tab)[0] for d in path]
                ys = [self._pt_xy(d, tab)[1] for d in path]
                ax.plot(xs, ys, color=color, linestyle=style,
                        linewidth=2.5, alpha=0.95, label=label)

            # ── 3. Punti: tutti e 6 univoci ─────────────────────────────
            # Ordine: p1, p2(ideale), p2r(reale), p3, p4(ideale), p4r(reale)
            all_pts   = self.points  # [p1, p2, p2r, p3, p4, p4r]
            real_pts  = [all_pts[0], all_pts[2], all_pts[3], all_pts[5]]  # 1,2',3,4'
            ideal_pts = [all_pts[1], all_pts[4]]                           # 2,4 (solo quelli esclusivamente ideali)

            xs_r = [self._get_xy(p, tab)[0] for p in real_pts]
            ys_r = [self._get_xy(p, tab)[1] for p in real_pts]
            xs_i = [self._get_xy(p, tab)[0] for p in ideal_pts]
            ys_i = [self._get_xy(p, tab)[1] for p in ideal_pts]

            scatter_real  = ax.scatter(xs_r, ys_r, s=100, c='#FFEE44',
                                       edgecolors='#CC2200', linewidths=1.5,
                                       zorder=7, label="Punti ciclo reale")
            scatter_ideal = ax.scatter(xs_i, ys_i, s=60,  c='#AABBFF',
                                       edgecolors='#2244BB', linewidths=1.2,
                                       zorder=6, alpha=0.8, label="Punti ciclo ideale")

            # ── 4. Annotazioni – una per punto, senza duplicati ─────────
            # Offset alternati per evitare sovrapposizioni
            offsets = {
                all_pts[0]: ( 6,  6),   # 1 – Aspirazione
                all_pts[1]: (-30, 8),   # 2 ideale (sopra e sinistra di 2')
                all_pts[2]: ( 6,  6),   # 2' reale
                all_pts[3]: ( 6,  6),   # 3
                all_pts[4]: ( 6, -14),  # 4 ideale (sotto 4')
                all_pts[5]: ( 6,  6),   # 4' reale
            }
            for pt in all_pts:
                x, y = self._get_xy(pt, tab)
                lbl  = pt.name.split(" – ")[0]   # es. "1", "2", "2′", …
                ox, oy = offsets.get(pt, (6, 6))
                ax.annotate(lbl, (x, y),
                            textcoords="offset points", xytext=(ox, oy),
                            ha='left', va='bottom',
                            color=ann_col, fontsize=10, fontweight='bold',
                            bbox=dict(boxstyle='round,pad=0.15',
                                      fc='#1A1A2E' if bg_col == '#242424' else '#F0F4FF',
                                      alpha=0.7, lw=0))

            # ── 5. Tooltip hover su TUTTI i punti ──────────────────────
            def _make_cursor(scatter_obj, pts_list):
                cur = mplcursors.cursor(scatter_obj, hover=True)
                @cur.connect("add")
                def _(sel, _pts=pts_list):
                    pt = _pts[sel.index]
                    sel.annotation.set_text(
                        f"{pt.name}\n"
                        f"T : {pt.T_C:.2f} °C\n"
                        f"P : {pt.P_bar:.3f} bar\n"
                        f"h : {pt.h:.2f} kJ/kg\n"
                        f"s : {pt.s:.4f} kJ/kg·K\n"
                        f"v : {pt.v:.6f} m³/kg"
                    )
                    sel.annotation.get_bbox_patch().set_facecolor('#0D0D1E')
                    sel.annotation.get_bbox_patch().set_alpha(0.93)
                    sel.annotation.set_color('white')
                    sel.annotation.set_fontsize(10)

            _make_cursor(scatter_real,  real_pts)
            _make_cursor(scatter_ideal, ideal_pts)

            # ── 6. Legenda e griglia ────────────────────────────────────
            leg = ax.legend(fontsize=8, loc="best",
                            facecolor='#1A1A2E' if bg_col == '#242424' else '#EEF0FF',
                            labelcolor=fg_col, framealpha=0.85,
                            title="Ciclo Brayton",
                            title_fontsize=8)
            if leg.get_title(): leg.get_title().set_color(fg_col)
            ax.grid(True, linestyle='--', alpha=0.3, color='gray')
            self.canvases[tab].draw()

    # ══════════════════════════════════════════
    #  ESPORTA PDF
    # ══════════════════════════════════════════
    def _export_pdf(self):
        fps = asksaveasfilename(
            defaultextension=".pdf",
            filetypes=[("PDF Document", "*.pdf")],
            title="Salva PDF Ciclo Brayton"
        )
        if fps:
            with PdfPages(fps) as pdf:
                for f in self.figs.values():
                    pdf.savefig(f, facecolor=f.get_facecolor())


# ─────────────────────────────────────────────
if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1440x870")
    app.title("Test BraytonCAD")
    frame = BraytonCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
