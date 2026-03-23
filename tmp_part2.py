
# ─────────────────────────────────────────────────────────────────────────────
#  UTILITY PER I GRAFICI
# ─────────────────────────────────────────────────────────────────────────────
def _interpolate_seg(p1, p2, n=80):
    res = []
    for t in np.linspace(0, 1, n):
        res.append({'T_C': p1.T_C+t*(p2.T_C-p1.T_C), 'P_bar': p1.P_bar+t*(p2.P_bar-p1.P_bar),
                    'v': p1.v+t*(p2.v-p1.v), 'h': p1.h+t*(p2.h-p1.h), 's': p1.s+t*(p2.s-p1.s)})
    return res

def _interp_isentropic(p1, p2, n=80):
    res = []
    for t in np.linspace(0, 1, n):
        lP = np.log(p1.P_bar)+t*(np.log(p2.P_bar)-np.log(p1.P_bar))
        lv = np.log(p1.v)+t*(np.log(p2.v)-np.log(p1.v))
        P = np.exp(lP); v = np.exp(lv)
        T = max(P*v*100.0/R_AIR - 273.15, -273.0)
        h = p1.h+t*(p2.h-p1.h); s = p1.s+t*(p2.s-p1.s)
        res.append({'T_C': T, 'P_bar': P, 'v': v, 'h': h, 's': s})
    return res

def _xy_for_tab(d, tab):
    if tab=="T-s": return d['s'], d['T_C']
    if tab=="P-v": return d['v'], d['P_bar']
    if tab=="T-v": return d['v'], d['T_C']
    if tab=="h-s": return d['s'], d['h']
    return 0, 0

def _pt_xy(pt, tab):
    if tab=="T-s": return pt.s, pt.T_C
    if tab=="P-v": return pt.v, pt.P_bar
    if tab=="T-v": return pt.v, pt.T_C
    if tab=="h-s": return pt.s, pt.h
    return 0, 0

AXIS_LABELS = {
    "T-s": ("s  [kJ/(kg·K)]", "T  [°C]",   "Diagramma T–s"),
    "P-v": ("v  [m³/kg]",     "P  [bar]",   "Diagramma P–v"),
    "T-v": ("v  [m³/kg]",     "T  [°C]",    "Diagramma T–v"),
    "h-s": ("s  [kJ/(kg·K)]", "h  [kJ/kg]", "Diagramma h–s  (Mollier)"),
}

# ─────────────────────────────────────────────────────────────────────────────
#  SCHEMA IMPIANTO
# ─────────────────────────────────────────────────────────────────────────────
def draw_schema(ax, cycle_name, pts, bg, fg):
    ax.clear(); ax.set_facecolor(bg); ax.axis('off')
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)

    def box(cx, cy, w, h, cl, txt, fs=11):
        ax.add_patch(mpatches.FancyBboxPatch((cx-w/2, cy-h/2), w, h,
            boxstyle="round,pad=0.01", fc=cl, ec='white', lw=1.5, zorder=3))
        ax.text(cx, cy, txt, ha='center', va='center', color='white',
                fontweight='bold', fontsize=fs, zorder=4)

    def arr(x1, y1, x2, y2):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(arrowstyle='->', color='white', lw=2), zorder=5)

    def wire(xs, ys):
        ax.plot(xs, ys, color='white', lw=2, zorder=2)

    def pt_label(x, y, pt, ha='left', va='top'):
        ax.scatter([x], [y], s=60, color='#FFEE44', zorder=7, edgecolors='#CC2200', lw=1.2)
        txt = pt.tooltip()
        ax.annotate(txt, (x, y), xytext=(x+0.01, y-0.01), ha=ha, va=va,
            fontsize=6.5, color=fg, zorder=8,
            bbox=dict(fc='#0D1117', ec='#38bdf8', alpha=0.92, boxstyle='round,pad=0.3'))

    pmap = {p.name: p for p in pts}

    if cycle_name in ("Otto", "Diesel", "Carnot"):
        # Cilindro
        ax.add_patch(mpatches.FancyBboxPatch((0.30, 0.25), 0.40, 0.55,
            boxstyle="round,pad=0.01", fc='#1e3a5f', ec='#4fc3f7', lw=2, zorder=2))
        ax.text(0.50, 0.73, "CILINDRO", ha='center', color='#4fc3f7',
                fontweight='bold', fontsize=12, zorder=4)
        # Camera di combustione (top)
        ax.add_patch(mpatches.FancyBboxPatch((0.30, 0.72), 0.40, 0.08,
            boxstyle="round,pad=0.01", fc='#c0392b', ec='white', lw=1, zorder=3))
        ax.text(0.50, 0.76, "CAMERA COMBUST.", ha='center', color='white',
                fontsize=9, fontweight='bold', zorder=4)
        # Pistone
        ax.add_patch(mpatches.FancyBboxPatch((0.31, 0.42), 0.38, 0.07,
            boxstyle="round,pad=0.01", fc='#607d8b', ec='white', lw=1.5, zorder=5))
        ax.text(0.50, 0.455, "PISTONE", ha='center', color='white',
                fontsize=10, fontweight='bold', zorder=6)
        # Biella e manovella
        wire([0.50, 0.50], [0.42, 0.27])
        ax.add_patch(mpatches.Circle((0.50, 0.25), 0.04, fc='#546e7a', ec='white', lw=1.5, zorder=5))
        ax.text(0.50, 0.18, "MANOVELLA", ha='center', color=fg, fontsize=9)
        # Valvole
        box(0.22, 0.68, 0.10, 0.05, '#1565c0', "Asp.", fs=9)
        box(0.78, 0.68, 0.11, 0.05, '#b71c1c', "Scar.", fs=9)
        arr(0.27, 0.68, 0.30, 0.68)
        arr(0.70, 0.68, 0.73, 0.68)
        tipo = "Isocora" if cycle_name == "Otto" else ("Isobara" if cycle_name == "Diesel" else "Isoterme+Isentropiche")
        ax.text(0.50, 0.07, f"Ciclo {cycle_name}  —  Scambio termico {tipo}",
                ha='center', color='#4fc3f7', fontsize=10, fontweight='bold')
        # Punti termodinamici
        pos_pts = [("1", 0.50, 0.40), ("2", 0.32, 0.64), ("3", 0.68, 0.64), ("4", 0.50, 0.60)]
        for pname, px, py in pos_pts:
            if pname in pmap:
                pt_label(px, py, pmap[pname])

    elif cycle_name == "Rankine":
        box(0.50, 0.84, 0.26, 0.14, '#c0392b', "CALDAIA\n(Boiler)", fs=10)
        box(0.85, 0.50, 0.16, 0.18, '#1abc9c', "TURBINA", fs=10)
        box(0.50, 0.16, 0.26, 0.14, '#2980b9', "CONDENSATORE", fs=10)
        box(0.15, 0.50, 0.16, 0.12, '#8e44ad', "POMPA", fs=10)
        wire([0.63, 0.77]); wire([0.63, 0.77], [0.84, 0.84]); arr(0.77, 0.84, 0.85, 0.59)
        wire([0.85, 0.77], [0.41, 0.16]); arr(0.77, 0.16, 0.63, 0.16)
        wire([0.37, 0.23], [0.16, 0.16]); arr(0.23, 0.16, 0.15, 0.44)
        wire([0.15, 0.23], [0.56, 0.84]); arr(0.23, 0.84, 0.37, 0.84)
        lab = [("1", 0.38, 0.16, 'right', 'top'), ("2", 0.38, 0.84, 'right', 'bottom'),
               ("3", 0.78, 0.84, 'left', 'bottom'), ("4", 0.78, 0.16, 'left', 'top')]
        for pname, px, py, ha, va in lab:
            if pname in pmap:
                pt_label(px, py, pmap[pname], ha=ha, va=va)
        ax.text(0.50, 0.50, "Ciclo Rankine\n(vapore acqua)", ha='center',
                color='#4fc3f7', fontsize=11, fontweight='bold', va='center')

    elif cycle_name == "Brayton":
        box(0.14, 0.50, 0.16, 0.30, '#1565c0', "COMPRESSORE", fs=9)
        box(0.50, 0.50, 0.24, 0.24, '#c0392b', "CAMERA DI\nCOMBUSTIONE", fs=9)
        box(0.86, 0.50, 0.16, 0.30, '#1abc9c', "TURBINA", fs=9)
        ax.plot([0.14, 0.86], [0.32, 0.32], ls='--', color='gray', lw=1.5, zorder=2)
        ax.text(0.50, 0.29, "ALBERO MOTORE", ha='center', color='gray', fontsize=9)
        arr(0.00, 0.50, 0.06, 0.50)
        ax.text(0.03, 0.54, "ARIA", ha='center', color=fg, fontsize=9, fontweight='bold')
        arr(0.22, 0.50, 0.38, 0.50)
        arr(0.62, 0.50, 0.78, 0.50)
        arr(0.94, 0.50, 1.00, 0.50)
        ax.text(0.97, 0.54, "ESAUSTI", ha='center', color=fg, fontsize=9, fontweight='bold')
        arr(0.50, 0.91, 0.50, 0.62)
        ax.text(0.50, 0.95, "COMBUSTIBILE", ha='center', color='#e74c3c', fontsize=9, fontweight='bold')
        lab = [("1", 0.04, 0.50), ("2", 0.37, 0.50), ("3", 0.63, 0.50), ("4", 0.96, 0.50)]
        for pname, px, py in lab:
            if pname in pmap:
                pt_label(px, py, pmap[pname])

    ax.text(0.50, 0.01, f"Schema impianto – Ciclo {cycle_name}",
            ha='center', va='bottom', color='gray', fontsize=8.5, style='italic')


# ─────────────────────────────────────────────────────────────────────────────
#  PARAMETRI DEFAULT + NOMI
# ─────────────────────────────────────────────────────────────────────────────
CYCLES = ["Carnot", "Otto", "Diesel", "Rankine", "Brayton"]

CYCLE_DEFAULTS = {
    "Carnot":  [("T alta Th (°C)",        "Th_C",       400.0),
                ("T bassa Tl (°C)",        "Tl_C",        30.0),
                ("P riferim. (bar)",        "P_ref",        1.0),
                ("Δs  (kJ/kg·K)",           "ds",           0.5)],
    "Otto":    [("Rapporto compr. r",       "r",            9.0),
                ("T₁ aspir. (°C)",          "T1_C",        25.0),
                ("P₁ aspir. (bar)",         "P1_bar",       1.0),
                ("Q_in (kJ/kg)",            "Q_in",       800.0)],
    "Diesel":  [("Rapporto compr. r",       "r",           18.0),
                ("Rapporto intro. rc",       "rc",           2.0),
                ("T₁ (°C)",                 "T1_C",        25.0),
                ("P₁ (bar)",                "P1_bar",       1.0)],
    "Rankine": [("P caldaia (bar)",         "P_high_bar",  50.0),
                ("P condensatore (bar)",     "P_low_bar",    0.1),
                ("T max vapore (°C)",        "T_max_C",    400.0),
                ("η turbina (0–1)",          "eta_t",        1.0),
                ("η pompa (0–1)",            "eta_p",        1.0)],
    "Brayton": [("Rapporto pressioni rp",   "rp",           8.0),
                ("T₁ (°C)",                 "T1_C",        15.0),
                ("P₁ (bar)",                "P1_bar",       1.0),
                ("T₃ max (°C)",             "T3_C",      1000.0),
                ("η compressore",           "eta_c",        1.0),
                ("η turbina",               "eta_t",        1.0)],
}


# ─────────────────────────────────────────────────────────────────────────────
#  APPLICAZIONE PRINCIPALE
# ─────────────────────────────────────────────────────────────────────────────
class CicliCAD(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("CAD Termodinamico – Cicli Carnot / Otto / Diesel / Rankine / Brayton")
        self.geometry("1400x860")
        self.resizable(True, True)
        self.grid_columnconfigure(0, weight=2)
        self.grid_columnconfigure(1, weight=5)
        self.grid_rowconfigure(0, weight=1)

        self._current_cycle = "Otto"
        self._entries: dict = {}
        self._points:  list = []
        self._segs:    list = []
        self._cursors: list = []

        self._build_left()
        self._build_right()
        self._compute()

    # ░░ PANNELLO SINISTRO ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    def _build_left(self):
        self.left = ctk.CTkScrollableFrame(self)
        self.left.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.left.grid_columnconfigure(0, weight=1)
        r = 0

        ctk.CTkLabel(self.left, text="⚙  Termodinamica dei Cicli",
                     font=ctk.CTkFont(family="Helvetica", weight="bold", size=18)
                     ).grid(row=r, column=0, pady=(10, 2)); r += 1
        ctk.CTkLabel(self.left, text="Carnot · Otto · Diesel · Rankine · Brayton",
                     font=ctk.CTkFont(size=11), text_color="gray60"
                     ).grid(row=r, column=0, pady=(0, 10)); r += 1

        # Selezione ciclo
        ctk.CTkLabel(self.left, text="Seleziona Ciclo:",
                     font=ctk.CTkFont(weight="bold")
                     ).grid(row=r, column=0, sticky="w", padx=10); r += 1
        self._cycle_var = ctk.StringVar(value=self._current_cycle)
        ctk.CTkSegmentedButton(
            self.left, values=CYCLES,
            variable=self._cycle_var,
            command=self._on_cycle_change,
            font=ctk.CTkFont(weight="bold")
        ).grid(row=r, column=0, padx=10, pady=(0, 10), sticky="ew"); r += 1

        # Frame parametri (dinamico)
        self._param_frame = ctk.CTkFrame(self.left, corner_radius=8, fg_color="transparent")
        self._param_frame.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r += 1
        self._build_param_widgets()

        # Pulsanti
        ctk.CTkButton(self.left, text="▶  Calcola Ciclo",
                      font=ctk.CTkFont(weight="bold", size=14),
                      fg_color="#2A6CBF", hover_color="#1A4C8F",
                      command=self._compute
                      ).grid(row=r, column=0, padx=10, pady=(12, 4), sticky="ew"); r += 1
        ctk.CTkButton(self.left, text="↺  Ripristina Default",
                      fg_color="gray40", hover_color="gray25",
                      command=self._load_defaults
                      ).grid(row=r, column=0, padx=10, pady=4, sticky="ew"); r += 1
        ctk.CTkButton(self.left, text="📄  Esporta PDF (con passaggi)",
                      fg_color="#2A8C4B", hover_color="#1E6636",
                      command=self._export_pdf
                      ).grid(row=r, column=0, padx=10, pady=4, sticky="ew"); r += 1

        self._lbl_err = ctk.CTkLabel(self.left, text="", text_color="#FF4C4C",
                                     wraplength=290, font=ctk.CTkFont(weight="bold"))
        self._lbl_err.grid(row=r, column=0, pady=5); r += 1

        ctk.CTkLabel(self.left, text="Risultati:", font=ctk.CTkFont(weight="bold", size=13)
                     ).grid(row=r, column=0, sticky="w", padx=10); r += 1
        self._res_box = ctk.CTkTextbox(self.left, height=200,
                                        font=ctk.CTkFont(family="Consolas", size=11),
                                        state="disabled", wrap="none")
        self._res_box.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r += 1

        ctk.CTkLabel(self.left, text="Passaggi di calcolo:", font=ctk.CTkFont(weight="bold", size=13)
                     ).grid(row=r, column=0, sticky="w", padx=10); r += 1
        self._steps_box = ctk.CTkTextbox(self.left, height=400,
                                          font=ctk.CTkFont(family="Consolas", size=10),
                                          state="disabled", wrap="none")
        self._steps_box.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r += 1

    def _build_param_widgets(self):
        for w in self._param_frame.winfo_children():
            w.destroy()
        self._entries.clear()
        defs = CYCLE_DEFAULTS[self._current_cycle]

        is_dark = ctk.get_appearance_mode() == "Dark"
        sec = ctk.CTkFrame(self._param_frame, corner_radius=8,
                           fg_color="#1E1E2E" if is_dark else "#E8EAF6")
        sec.pack(fill="x", padx=0, pady=2)
        ctk.CTkLabel(sec, text=f"  Parametri – {self._current_cycle}",
                     font=ctk.CTkFont(weight="bold", size=13)
                     ).pack(anchor="w", padx=8, pady=(6, 2))

        for (label, key, default) in defs:
            row = ctk.CTkFrame(sec, fg_color="transparent")
            row.pack(fill="x", padx=8, pady=2)
            row.columnconfigure(0, weight=1); row.columnconfigure(1, weight=0)
            ctk.CTkLabel(row, text=label, font=ctk.CTkFont(size=12), anchor="w"
                        ).grid(row=0, column=0, sticky="w")
            ent = ctk.CTkEntry(row, width=100)
            ent.insert(0, str(default))
            ent.grid(row=0, column=1, padx=(4, 0))
            self._entries[key] = ent

    def _on_cycle_change(self, val):
        self._current_cycle = val
        self._build_param_widgets()
        self._compute()

    def _load_defaults(self):
        for (label, key, default) in CYCLE_DEFAULTS[self._current_cycle]:
            if key in self._entries:
                e = self._entries[key]; e.delete(0, "end"); e.insert(0, str(default))
        self._compute()

    def _get(self, key):
        return float(self._entries[key].get().replace(",", "."))

    # ░░ PANNELLO DESTRO ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    def _build_right(self):
        right = ctk.CTkFrame(self, corner_radius=15, border_width=2)
        right.grid(row=0, column=1, padx=(0, 10), pady=10, sticky="nsew")
        right.grid_rowconfigure(0, weight=1); right.grid_columnconfigure(0, weight=1)
        self._tabview = ctk.CTkTabview(right)
        self._tabview.pack(fill="both", expand=True, padx=5, pady=5)
        self._tabs = ["Schema", "T-s", "P-v", "T-v", "h-s"]
        for t in self._tabs: self._tabview.add(t)
        self._figs = {}; self._axes = {}; self._canvases = {}
        bg = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg = 'white'   if ctk.get_appearance_mode() == 'Dark' else 'black'
        for tab in self._tabs:
            fig = Figure(figsize=(5, 4), dpi=100)
            fig.patch.set_facecolor(bg)
            ax = fig.add_subplot(111); ax.set_facecolor(bg)
            if tab != "Schema":
                ax.tick_params(colors=fg); ax.xaxis.label.set_color(fg)
                ax.yaxis.label.set_color(fg); ax.title.set_color(fg)
                for sp in ax.spines.values(): sp.set_color(fg)
            canvas = FigureCanvasTkAgg(fig, master=self._tabview.tab(tab))
            canvas.get_tk_widget().pack(fill="both", expand=True)
            self._figs[tab] = fig; self._axes[tab] = ax; self._canvases[tab] = canvas

    # ░░ CALCOLO ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    def _compute(self):
        self._lbl_err.configure(text="")
        try:
            c = self._current_cycle
            if c == "Carnot":
                pts, segs, res, steps = calc_carnot(
                    self._get("Th_C"), self._get("Tl_C"),
                    self._get("P_ref"), self._get("ds"))
            elif c == "Otto":
                pts, segs, res, steps = calc_otto(
                    self._get("r"), self._get("T1_C"),
                    self._get("P1_bar"), self._get("Q_in"))
            elif c == "Diesel":
                pts, segs, res, steps = calc_diesel(
                    self._get("r"), self._get("rc"),
                    self._get("T1_C"), self._get("P1_bar"))
            elif c == "Rankine":
                pts, segs, res, steps = calc_rankine(
                    self._get("P_high_bar"), self._get("P_low_bar"),
                    self._get("T_max_C"), self._get("eta_t"), self._get("eta_p"))
            elif c == "Brayton":
                pts, segs, res, steps = calc_brayton(
                    self._get("rp"), self._get("T1_C"), self._get("P1_bar"),
                    self._get("T3_C"), self._get("eta_c"), self._get("eta_t"))
            else:
                return
            self._points = pts; self._segs = segs
            self._update_textboxes(res, steps)
            self._redraw()
        except Exception as ex:
            self._lbl_err.configure(text=f"Errore: {ex}")

    def _update_textboxes(self, res, steps):
        self._res_box.configure(state="normal")
        self._res_box.delete("0.0", "end")
        self._res_box.insert("end", "RISULTATI\n" + "─" * 32 + "\n")
        for k, v in res.items():
            self._res_box.insert("end", f"  {k:<28}{v}\n")
        self._res_box.configure(state="disabled")

        self._steps_box.configure(state="normal")
        self._steps_box.delete("0.0", "end")
        self._steps_box.insert("end", "\n".join(steps))
        self._steps_box.configure(state="disabled")

    # ░░ RIDISEGNO GRAFICI ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    def _redraw(self):
        for cur in self._cursors:
            try: cur.remove()
            except: pass
        self._cursors.clear()

        bg = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg = 'white'   if ctk.get_appearance_mode() == 'Dark' else 'black'

        for tab in self._tabs:
            ax = self._axes[tab]
            ax.clear(); ax.set_facecolor(bg)
            if tab == "Schema":
                draw_schema(ax, self._current_cycle, self._points, bg, fg)
                self._canvases[tab].draw()
                continue

            xlabel, ylabel, title = AXIS_LABELS[tab]
            ax.set_xlabel(xlabel); ax.set_ylabel(ylabel)
            ax.set_title(f"{title} – Ciclo {self._current_cycle}", color=fg)
            ax.tick_params(colors=fg)
            for sp in ax.spines.values(): sp.set_color(fg)
            ax.xaxis.label.set_color(fg); ax.yaxis.label.set_color(fg)
            ax.grid(True, linestyle='--', alpha=0.25, color='gray')

            if not self._points:
                self._canvases[tab].draw(); continue

            pmap = {p.name: p for p in self._points}

            # --- Segmenti ---
            for (label, n1, n2, color, note) in self._segs:
                p1 = pmap.get(n1); p2 = pmap.get(n2)
                if not (p1 and p2): continue
                if "entrop" in label.lower():
                    path = _interp_isentropic(p1, p2)
                else:
                    path = _interpolate_seg(p1, p2)
                xs = [_xy_for_tab(d, tab)[0] for d in path]
                ys = [_xy_for_tab(d, tab)[1] for d in path]
                ax.plot(xs, ys, color=color, linewidth=2.5, label=label, zorder=4)

            # --- Punti scatter ---
            xs_all = [_pt_xy(p, tab)[0] for p in self._points]
            ys_all = [_pt_xy(p, tab)[1] for p in self._points]
            sc = ax.scatter(xs_all, ys_all, s=110, c='#FFEE44',
                            edgecolors='#CC2200', linewidths=1.5, zorder=8)

            # --- Annotazioni etichette ---
            offsets = [(6, 6), (-28, 6), (6, -14), (-28, -14)]
            for i, pt in enumerate(self._points):
                x, y = _pt_xy(pt, tab)
                ox, oy = offsets[i % len(offsets)]
                ax.annotate(
                    pt.name, (x, y),
                    textcoords="offset points", xytext=(ox, oy),
                    color='white', fontsize=11, fontweight='bold',
                    bbox=dict(boxstyle='round,pad=0.18',
                              fc='#1A1A2E' if bg == '#242424' else '#F0F4FF',
                              alpha=0.8, lw=0))

            # --- Tooltip hover (mplcursors) ---
            points_list = list(self._points)
            cur = mplcursors.cursor(sc, hover=True)

            @cur.connect("add")
            def _(sel, _pts=points_list):
                pt = _pts[sel.index]
                sel.annotation.set_text(pt.tooltip())
                sel.annotation.get_bbox_patch().set_facecolor('#0D0D1E')
                sel.annotation.get_bbox_patch().set_alpha(0.95)
                sel.annotation.set_color('white')
                sel.annotation.set_fontsize(9)

            self._cursors.append(cur)

            # --- Legenda ---
            leg = ax.legend(fontsize=8, loc="best",
                            facecolor='#1A1A2E' if bg == '#242424' else '#EEF0FF',
                            labelcolor=fg, framealpha=0.85)
            if leg and leg.get_title():
                leg.get_title().set_color(fg)
            self._canvases[tab].draw()

    # ░░ ESPORTA PDF ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    def _export_pdf(self):
        fp = asksaveasfilename(defaultextension=".pdf",
                               filetypes=[("PDF", "*.pdf")],
                               title="Salva PDF Analisi Ciclo")
        if not fp: return
        try:
            with PdfPages(fp) as pdf:
                # ── Pagina 1: i 4 diagrammi ──────────────────────────────────
                fig_all, axes_all = plt.subplots(2, 2, figsize=(14, 10))
                fig_all.patch.set_facecolor('#0f172a')
                fig_all.suptitle(f"Ciclo {self._current_cycle} – Diagrammi Termodinamici",
                                 fontsize=16, fontweight='bold', color='white')
                tab_list = ["T-s", "P-v", "T-v", "h-s"]
                for idx, tab in enumerate(tab_list):
                    ar = axes_all[idx // 2][idx % 2]
                    ar.set_facecolor('#1e293b')
                    for sp in ar.spines.values(): sp.set_color('gray')
                    ar.tick_params(colors='white')
                    ar.xaxis.label.set_color('white'); ar.yaxis.label.set_color('white')
                    ar.title.set_color('white')
                    ar.grid(True, linestyle='--', alpha=0.25, color='gray')
                    xlabel, ylabel, title = AXIS_LABELS[tab]
                    ar.set_xlabel(xlabel); ar.set_ylabel(ylabel); ar.set_title(title)
                    pmap2 = {p.name: p for p in self._points}
                    for (label, n1, n2, color, note) in self._segs:
                        p1=pmap2.get(n1); p2=pmap2.get(n2)
                        if not (p1 and p2): continue
                        if "entrop" in label.lower(): path=_interp_isentropic(p1, p2)
                        else: path=_interpolate_seg(p1, p2)
                        xs=[_xy_for_tab(d, tab)[0] for d in path]
                        ys=[_xy_for_tab(d, tab)[1] for d in path]
                        ar.plot(xs, ys, color=color, lw=2, label=label)
                    for i2, pt in enumerate(self._points):
                        x2, y2 = _pt_xy(pt, tab)
                        ar.scatter([x2], [y2], s=80, c='#FFEE44', edgecolors='#CC2200', zorder=5)
                        ar.annotate(pt.name, (x2, y2), xytext=(4, 4),
                                    textcoords='offset points', fontsize=9,
                                    fontweight='bold', color='white')
                    ar.legend(fontsize=7, facecolor='#1A1A2E', labelcolor='white')
                fig_all.tight_layout(rect=[0, 0, 1, 0.96])
                pdf.savefig(fig_all, facecolor=fig_all.get_facecolor())
                plt.close(fig_all)

                # ── Pagina 2: Tabella coordinate + Passaggi ───────────────────
                fig2 = plt.figure(figsize=(11, 8))
                fig2.patch.set_facecolor('#0f172a')
                ax2 = fig2.add_axes([0, 0, 1, 1]); ax2.axis('off')
                ax2.set_facecolor('#0f172a')

                # Titolo
                ax2.text(0.50, 0.97, f"Analisi Ciclo {self._current_cycle} – Coordinate e Passaggi",
                         ha='center', va='top', fontsize=14, fontweight='bold', color='white',
                         transform=ax2.transAxes)

                # Tabella stati
                col_labels = ["Pnt", "T (°C)", "P (bar)", "v (m³/kg)", "h (kJ/kg)", "s (kJ/kgK)"]
                rows = [[pt.name, f"{pt.T_C:.2f}", f"{pt.P_bar:.4f}",
                         f"{pt.v:.5f}", f"{pt.h:.2f}", f"{pt.s:.4f}"]
                        for pt in self._points]
                tbl = ax2.table(cellText=rows, colLabels=col_labels,
                                loc='upper center', cellLoc='center',
                                bbox=[0.02, 0.73, 0.96, 0.22])
                tbl.auto_set_font_size(False); tbl.set_fontsize(9)
                for (row, col), cell in tbl.get_celld().items():
                    cell.set_facecolor('#1e293b' if row > 0 else '#0ea5e9')
                    cell.set_text_props(color='white')
                    cell.set_edgecolor('gray')

                # Passaggi
                steps_txt = self._steps_box.get("0.0", "end")
                ax2.text(0.01, 0.70, steps_txt, transform=ax2.transAxes,
                         fontsize=8, va='top', family='monospace', color='#94a3b8',
                         bbox=dict(fc='#1e293b', ec='#334155', alpha=0.9))

                pdf.savefig(fig2, facecolor=fig2.get_facecolor())
                plt.close(fig2)

            self._lbl_err.configure(text=f"✓ PDF salvato con successo!", text_color="#4CAF50")
        except Exception as ex:
            self._lbl_err.configure(text=f"Errore PDF: {ex}")


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = CicliCAD()
    app.mainloop()
