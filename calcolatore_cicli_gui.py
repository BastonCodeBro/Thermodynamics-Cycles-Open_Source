
# ═════════════════════════════════════════════════════════════════════════════
#  INTERPOLAZIONI TERMODINAMICHE (fisica corretta per gas ideale)
# ═════════════════════════════════════════════════════════════════════════════

def _isentropic(p1, p2, n=80):
    """P·vᵏ = cost  →  curva corretta in T-v e P-v."""
    vs = np.exp(np.linspace(np.log(p1.v), np.log(p2.v), n))
    res = []
    for v in vs:
        ratio = p1.v / v
        P   = p1.P_bar * ratio**K_AIR
        T_K = p1.T_K  * ratio**(K_AIR - 1)
        h   = p1.h + CP_AIR * (T_K - p1.T_K)
        res.append({'T_C': T_K-273.15, 'P_bar': P, 'v': v, 'h': h, 's': p1.s})
    return res

def _isothermal(p1, p2, n=80):
    """P·v = cost  (gas ideale isoterma)."""
    vs = np.exp(np.linspace(np.log(p1.v), np.log(p2.v), n))
    res = []
    for v in vs:
        P = p1.P_bar * p1.v / v
        s = p1.s + R_AIR * np.log(v / p1.v)
        res.append({'T_C': p1.T_C, 'P_bar': P, 'v': v, 'h': p1.h, 's': s})
    return res

def _isochoric(p1, p2, n=80):
    """v = cost  (curva in T-s e P-v verticale)."""
    Ts = np.linspace(p1.T_K, p2.T_K, n)
    res = []
    for T_K in Ts:
        P = p1.P_bar * T_K / p1.T_K
        s = p1.s + CV_AIR * np.log(T_K / p1.T_K)
        h = p1.h + CP_AIR * (T_K - p1.T_K)
        res.append({'T_C': T_K-273.15, 'P_bar': P, 'v': p1.v, 'h': h, 's': s})
    return res

def _isobaric(p1, p2, n=80):
    """P = cost  (curva in T-s e h-s)."""
    Ts = np.linspace(p1.T_K, p2.T_K, n)
    res = []
    for T_K in Ts:
        v = R_AIR * T_K / (p1.P_bar * 100)
        s = p1.s + CP_AIR * np.log(T_K / p1.T_K)
        h = p1.h + CP_AIR * (T_K - p1.T_K)
        res.append({'T_C': T_K-273.15, 'P_bar': p1.P_bar, 'v': v, 'h': h, 's': s})
    return res

def _isenthalpic(p1, p2, n=80):
    """h = cost  (laminazione)."""
    res = []
    for t in np.linspace(0, 1, n):
        res.append({'T_C':   p1.T_C   + t*(p2.T_C   - p1.T_C),
                    'P_bar': p1.P_bar + t*(p2.P_bar  - p1.P_bar),
                    'v':     p1.v     + t*(p2.v      - p1.v),
                    'h':     p1.h,
                    's':     p1.s     + t*(p2.s      - p1.s)})
    return res

def _linear(p1, p2, n=80):
    res = []
    for t in np.linspace(0, 1, n):
        res.append({'T_C':   p1.T_C   + t*(p2.T_C   - p1.T_C),
                    'P_bar': p1.P_bar + t*(p2.P_bar  - p1.P_bar),
                    'v':     p1.v     + t*(p2.v      - p1.v),
                    'h':     p1.h     + t*(p2.h      - p1.h),
                    's':     p1.s     + t*(p2.s      - p1.s)})
    return res

def _get_path(label, p1, p2):
    """Sceglie la funzione di interpolazione corretta dal nome del segmento."""
    l = label.lower()
    if 'isentrop' in l or 'compressore' in l and 'iső' not in l:
        # Per ciclo frigo la compressione è isentropica ma nel vapore
        if abs(p1.s - p2.s) < 0.01:          # s quasi costante
            return _isentropic(p1, p2)
        else:
            return _linear(p1, p2)            # evita log(neg) per casi misti
    if 'isoter' in l:        return _isothermal(p1, p2)
    if 'isocor' in l or 'scarico isocor' in l or 'combustione isocor' in l:
        return _isochoric(p1, p2)
    if 'isobar' in l or 'caldaia' in l or 'condensator' in l or 'evaporator' in l or 'camera' in l or 'riscaldament' in l or 'raffreddament' in l or 'combustione isobar' in l:
        return _isobaric(p1, p2)
    if 'laminazione' in l or 'isoental' in l or 'valvola' in l:
        return _isenthalpic(p1, p2)
    # Fallback: prova isentropica se Δs≈0
    if abs(p1.s - p2.s) < 0.05 and p1.v > 0 and p2.v > 0:
        return _isentropic(p1, p2)
    return _linear(p1, p2)

def _xy(d, tab):
    if tab=="T-s": return d['s'],   d['T_C']
    if tab=="P-v": return d['v'],   d['P_bar']
    if tab=="T-v": return d['v'],   d['T_C']
    if tab=="h-s": return d['s'],   d['h']
    return 0, 0

def _pt_xy(pt, tab):
    if tab=="T-s": return pt.s,   pt.T_C
    if tab=="P-v": return pt.v,   pt.P_bar
    if tab=="T-v": return pt.v,   pt.T_C
    if tab=="h-s": return pt.s,   pt.h
    return 0, 0

AXIS_LABELS = {
    "T-s": ("s  [kJ/(kg·K)]", "T  [°C]",    "Diagramma T–s"),
    "P-v": ("v  [m³/kg]",     "P  [bar]",   "Diagramma P–v"),
    "T-v": ("v  [m³/kg]",     "T  [°C]",    "Diagramma T–v"),
    "h-s": ("s  [kJ/(kg·K)]", "h  [kJ/kg]", "Diagramma h–s  (Mollier)"),
}

# ═════════════════════════════════════════════════════════════════════════════
#  SCHEMI IMPIANTO  (SVG-like con matplotlib patches)
# ═════════════════════════════════════════════════════════════════════════════
def draw_schema(ax, cycle_name, pts, bg, fg):
    ax.clear(); ax.set_facecolor(bg); ax.axis('off')
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    pmap = {p.name: p for p in pts}

    # ── helper locali ────────────────────────────────────────────────────────
    def box(cx, cy, w, h, cl, txt, fs=10):
        ax.add_patch(mpatches.FancyBboxPatch(
            (cx-w/2, cy-h/2), w, h,
            boxstyle="round,pad=0.015", fc=cl, ec='white', lw=1.5, zorder=3))
        ax.text(cx, cy, txt, ha='center', va='center', color='white',
                fontweight='bold', fontsize=fs, zorder=4)

    def wire(x1, y1, x2, y2, cl='white', ls='-'):
        ax.plot([x1, x2], [y1, y2], color=cl, lw=2, ls=ls, zorder=2)

    def arr(x1, y1, x2, y2, cl='white'):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
            arrowprops=dict(arrowstyle='->', color=cl, lw=2), zorder=5)

    def pt_lbl(x, y, pt, side='right'):
        ax.scatter([x], [y], s=55, color='#FFEE44', zorder=7,
                   edgecolors='#CC2200', lw=1.2)
        ox = 0.012 if side == 'right' else -0.012
        ha = 'left' if side == 'right' else 'right'
        ax.annotate(pt.tooltip(), (x, y), xytext=(x+ox, y+0.005),
            ha=ha, va='bottom', fontsize=6.0, color=fg, zorder=8,
            bbox=dict(fc='#0D1117', ec='#38bdf8', alpha=0.90,
                      boxstyle='round,pad=0.3'))

    # ── SCHEMI ───────────────────────────────────────────────────────────────
    if cycle_name in ("Otto", "Diesel"):
        # ---- Motore a pistone ----
        # Blocco motore (cilindro)
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.28, 0.22), 0.44, 0.60, boxstyle="round,pad=0.01",
            fc='#1e3a5f', ec='#4fc3f7', lw=2.5, zorder=2))
        # Camera di combustione (top)
        ax.add_patch(mpatches.Rectangle(
            (0.29, 0.74), 0.42, 0.07, fc='#c0392b', ec='white', lw=1, zorder=3))
        ax.text(0.50, 0.775, "CAMERA DI COMBUSTIONE",
                ha='center', color='white', fontsize=8, fontweight='bold', zorder=4)
        # Guidavigola / parete cilindro
        for side in [0.29, 0.69]:
            ax.add_patch(mpatches.Rectangle(
                (side, 0.32), 0.02, 0.42, fc='#455a64', ec='none', zorder=3))
        # Pistone
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.31, 0.44), 0.38, 0.08, boxstyle="round,pad=0.005",
            fc='#78909c', ec='white', lw=1.5, zorder=5))
        ax.text(0.50, 0.479, "PISTONE", ha='center', color='white',
                fontsize=10, fontweight='bold', zorder=6)
        # Anello di tenuta
        for yr in [0.44, 0.47]:
            ax.add_patch(mpatches.Rectangle((0.31, yr), 0.38, 0.005,
                         fc='#b0bec5', ec='none', zorder=6))
        # Biella
        wire(0.50, 0.44, 0.50, 0.28)
        # Manovella
        ax.add_patch(mpatches.Circle((0.50, 0.24), 0.055,
            fc='#546e7a', ec='#b0bec5', lw=2, zorder=5))
        ax.text(0.50, 0.24, "MGT", ha='center', va='center',
                color='white', fontsize=8, fontweight='bold', zorder=6)
        # Albero motore
        wire(0.50, 0.185, 0.50, 0.10, cl='#b0bec5')
        ax.text(0.50, 0.07, "ALBERO MOTORE", ha='center',
                color='#b0bec5', fontsize=9)
        # Valvola aspirazione (sinistra)
        box(0.14, 0.72, 0.13, 0.05, '#1565c0', "Asp.", fs=9)
        arr(0.205, 0.72, 0.29, 0.72)
        ax.text(0.14, 0.78, "Aria+carb.", ha='center', color='#81d4fa', fontsize=7.5)
        # Valvola scarico (destra)
        box(0.86, 0.72, 0.13, 0.05, '#b71c1c', "Scar.", fs=9)
        arr(0.71, 0.72, 0.795, 0.72)
        ax.text(0.86, 0.78, "Gas bruciati", ha='center', color='#ef9a9a', fontsize=7.5)
        # Indicazione ciclo
        tipo = "Isocora (2→3 e 4→1)" if cycle_name=="Otto" else "Isobara (2→3)"
        ax.text(0.50, 0.04, f"Ciclo {cycle_name}  —  Scambio termico: {tipo}",
                ha='center', color='#4fc3f7', fontsize=9.5, fontweight='bold')
        # Punti ciclo
        pos = [("1",0.50,0.45,"left"), ("2",0.33,0.67,"right"),
               ("3",0.67,0.67,"left"), ("4",0.50,0.63,"left")]
        for pname, px, py, side in pos:
            if pname in pmap: pt_lbl(px, py, pmap[pname], side)

    elif cycle_name == "Carnot":
        # ---- Macchina di Carnot astratta ----
        # Sorgente calda (top)
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.15, 0.78), 0.70, 0.14, boxstyle="round,pad=0.01",
            fc='#c62828', ec='#ffcdd2', lw=2, zorder=3))
        ax.text(0.50, 0.85, f"SORGENTE CALDA  (T\u2095)", ha='center',
                color='white', fontsize=11, fontweight='bold', zorder=4)
        # Pozzo freddo (bottom)
        ax.add_patch(mpatches.FancyBboxPatch(
            (0.15, 0.08), 0.70, 0.14, boxstyle="round,pad=0.01",
            fc='#0277bd', ec='#b3e5fc', lw=2, zorder=3))
        ax.text(0.50, 0.15, f"POZZO FREDDO  (T\u2097)", ha='center',
                color='white', fontsize=11, fontweight='bold', zorder=4)
        # Macchina ciclica (centro)
        ax.add_patch(mpatches.Circle((0.50, 0.50), 0.12,
            fc='#1b5e20', ec='#a5d6a7', lw=2, zorder=3))
        ax.text(0.50, 0.50, "M\nCICLICA", ha='center', va='center',
                color='white', fontsize=9, fontweight='bold', zorder=4)
        # Frecce calore
        arr(0.50, 0.78, 0.50, 0.62, cl='#ef9a9a')
        ax.text(0.56, 0.70, "Q₁\n(calore\nentrata)", ha='left',
                color='#ef9a9a', fontsize=9, fontweight='bold')
        arr(0.50, 0.38, 0.50, 0.22, cl='#81d4fa')
        ax.text(0.56, 0.30, "Q₂\n(calore\nuscita)", ha='left',
                color='#81d4fa', fontsize=9, fontweight='bold')
        # Lavoro esterno
        arr(0.62, 0.50, 0.85, 0.50, cl='#a5d6a7')
        ax.text(0.87, 0.50, "W\nnet", ha='left', va='center',
                color='#a5d6a7', fontsize=10, fontweight='bold')
        # Equazione
        ax.text(0.50, 0.02, "η = 1 − T₁/T_H   |   W = Q₁ − Q₂",
                ha='center', color='cyan', fontsize=10, fontweight='bold')
        # Punti
        pos = [("1",0.38,0.78,"right"),("2",0.62,0.78,"left"),
               ("3",0.62,0.22,"left"),("4",0.38,0.22,"right")]
        for pname, px, py, side in pos:
            if pname in pmap: pt_lbl(px, py, pmap[pname], side)

    elif cycle_name == "Rankine":
        # ---- Impianto a vapore ----
        box(0.50, 0.88, 0.32, 0.14, '#c0392b', "CALDAIA\n(Generatore di vapore)")
        box(0.88, 0.50, 0.16, 0.22, '#1abc9c', "TURBINA\n(espansore)")
        box(0.50, 0.12, 0.32, 0.14, '#1565c0', "CONDENSATORE")
        box(0.12, 0.50, 0.16, 0.14, '#8e44ad', "POMPA")
        # Vapore surriscaldato: caldaia → turbina (top-right)
        wire(0.66, 0.88, 0.88, 0.88)
        arr(0.88, 0.88, 0.88, 0.61)
        ax.text(0.77, 0.92, "vapore surriscaldato", ha='center', color='#ef9a9a', fontsize=7.5)
        # Espanso turbina → condensatore (right-bottom)
        wire(0.88, 0.39, 0.88, 0.12)
        arr(0.88, 0.12, 0.66, 0.12)
        ax.text(0.77, 0.08, "vapore bagnato/umido", ha='center', color='#81d4fa', fontsize=7.5)
        # Liquido condensatore → pompa (bottom-left)
        wire(0.34, 0.12, 0.12, 0.12)
        arr(0.12, 0.12, 0.12, 0.43)
        ax.text(0.23, 0.08, "liquido saturo", ha='center', color='#ce93d8', fontsize=7.5)
        # Pompa → caldaia (left-top)
        wire(0.12, 0.57, 0.12, 0.88)
        arr(0.12, 0.88, 0.34, 0.88)
        ax.text(0.23, 0.92, "liquido\ncompresso", ha='center', color='#ce93d8', fontsize=7.5)
        # Label punti
        pos = [("1",0.34,0.12,"right"),("2",0.34,0.88,"right"),
               ("3",0.66,0.88,"left"), ("4",0.66,0.12,"left")]
        for pname, px, py, side in pos:
            if pname in pmap: pt_lbl(px, py, pmap[pname], side)
        ax.text(0.50, 0.50, "Ciclo Rankine\n(H₂O — IAPWS 97)", ha='center',
                color='#4fc3f7', fontsize=10, fontweight='bold', va='center')

    elif cycle_name == "Brayton":
        # ---- Turbina a gas ----
        # Compressore (trapezio sinistro)
        comp_pts = np.array([[0.04,0.36],[0.04,0.64],[0.22,0.58],[0.22,0.42]])
        ax.add_patch(mpatches.Polygon(comp_pts, fc='#1565c0', ec='white', lw=1.5, zorder=3))
        ax.text(0.13, 0.50, "COMP.", ha='center', color='white', fontweight='bold', fontsize=9, zorder=4)
        # Camera combustione
        box(0.50, 0.50, 0.28, 0.26, '#c0392b', "CAMERA DI\nCOMBUSTIONE", fs=9)
        # Turbina (trapezio destro, specchiato)
        turb_pts = np.array([[0.78,0.42],[0.78,0.58],[0.96,0.64],[0.96,0.36]])
        ax.add_patch(mpatches.Polygon(turb_pts, fc='#1abc9c', ec='white', lw=1.5, zorder=3))
        ax.text(0.87, 0.50, "TURB.", ha='center', color='white', fontweight='bold', fontsize=9, zorder=4)
        # Albero motore (tratteggiato sotto)
        wire(0.13, 0.36, 0.87, 0.36, cl='#b0bec5', ls='--')
        ax.text(0.50, 0.31, "ALBERO MOTORE  (W_turb − W_comp)", ha='center',
                color='#b0bec5', fontsize=8.5)
        # Flusso aria (sinistra → compressore → camera → turbina → uscita)
        arr(0.00, 0.50, 0.04, 0.50); ax.text(-0.01, 0.54, "ARIA\n1", ha='left', color=fg, fontsize=8.5, fontweight='bold')
        arr(0.22, 0.50, 0.36, 0.50); ax.text(0.29, 0.55, "2", ha='center', color=fg, fontsize=9, fontweight='bold')
        arr(0.64, 0.50, 0.78, 0.50); ax.text(0.71, 0.55, "3", ha='center', color=fg, fontsize=9, fontweight='bold')
        arr(0.96, 0.50, 1.00, 0.50); ax.text(1.01, 0.54, "GAS\n4", ha='left', color=fg, fontsize=8.5, fontweight='bold')
        # Combustibile
        arr(0.50, 0.93, 0.50, 0.63)
        ax.text(0.50, 0.96, "COMBUSTIBILE", ha='center', color='#e74c3c', fontsize=8.5, fontweight='bold')
        # Punti ciclo
        pos = [("1",0.03,0.50,"right"),("2",0.29,0.50,"right"),
               ("3",0.71,0.50,"left"),("4",0.97,0.50,"left")]
        for pname, px, py, side in pos:
            if pname in pmap: pt_lbl(px, py, pmap[pname], side)

    elif cycle_name == "Frigorifico":
        # ---- Impianto frigorifero a compressione di vapore ----
        box(0.50, 0.88, 0.30, 0.14, '#c0392b', "CONDENSATORE\n(cede calore)")
        box(0.88, 0.50, 0.16, 0.22, '#1565c0', "COMPRESSORE")
        box(0.50, 0.12, 0.30, 0.14, '#2980b9', "EVAPORATORE\n(assorbe calore)")
        box(0.12, 0.50, 0.16, 0.14, '#e67e22', "VALVOLA DI\nLAMINAZ.")
        # Collegamento: condensatore → valvola (top → left)
        wire(0.35, 0.88, 0.12, 0.88)
        arr(0.12, 0.88, 0.12, 0.57)
        ax.text(0.05, 0.73, "liq.\nsat.", ha='center', color='#ef9a9a', fontsize=7.5)
        # Valvola → evaporatore (left → bottom)
        wire(0.12, 0.43, 0.12, 0.12)
        arr(0.12, 0.12, 0.35, 0.12)
        ax.text(0.05, 0.27, "mix\nfrig.", ha='center', color='#81d4fa', fontsize=7.5)
        # Evaporatore → compressore (bottom → right)
        wire(0.65, 0.12, 0.88, 0.12)
        arr(0.88, 0.12, 0.88, 0.39)
        ax.text(0.95, 0.27, "vap.\nsat.", ha='center', color='#81d4fa', fontsize=7.5)
        # Compressore → condensatore (right → top)
        wire(0.88, 0.61, 0.88, 0.88)
        arr(0.88, 0.88, 0.65, 0.88)
        ax.text(0.95, 0.73, "vap.\nsurrisc.", ha='center', color='#ef9a9a', fontsize=7.5)
        # Frecce calore ambiente
        ax.annotate('', xy=(0.50, 1.00), xytext=(0.50, 0.95),
            arrowprops=dict(arrowstyle='->', color='#ef9a9a', lw=2), zorder=5)
        ax.text(0.50, 1.01, "Q_cond → ambiente caldo", ha='center',
                color='#ef9a9a', fontsize=8, fontweight='bold')
        ax.annotate('', xy=(0.50, 0.19), xytext=(0.50, 0.07),
            arrowprops=dict(arrowstyle='->', color='#81d4fa', lw=2), zorder=5)
        ax.text(0.50, 0.04, "Q_evap ← ambiente freddo", ha='center',
                color='#81d4fa', fontsize=8, fontweight='bold')
        # Punti ciclo
        pos = [("1",0.65,0.12,"left"),("2",0.65,0.88,"left"),
               ("3",0.35,0.88,"right"),("4",0.35,0.12,"right")]
        for pname, px, py, side in pos:
            if pname in pmap: pt_lbl(px, py, pmap[pname], side)
        ax.text(0.50, 0.50, "Ciclo Frigorifero\n(R134a)", ha='center',
                color='#4fc3f7', fontsize=10, fontweight='bold', va='center')

    ax.text(0.50, -0.02, f"Schema impianto — Ciclo {cycle_name}",
            ha='center', va='top', color='gray', fontsize=8.5, style='italic')


# ═════════════════════════════════════════════════════════════════════════════
#  PARAMETRI DEFAULT
# ═════════════════════════════════════════════════════════════════════════════
CYCLES = ["Carnot", "Otto", "Diesel", "Rankine", "Brayton", "Frigorifico"]

CYCLE_DEFAULTS = {
    "Carnot":    [("T alta Th (°C)",       "Th_C",      400.0),
                  ("T bassa Tl (°C)",       "Tl_C",       30.0),
                  ("P riferim. (bar)",       "P_ref",       1.0),
                  ("Δs (kJ/kg·K)",           "ds",          0.5)],
    "Otto":      [("Rapporto compr. r",     "r",           9.0),
                  ("T₁ aspir. (°C)",        "T1_C",       25.0),
                  ("P₁ aspir. (bar)",       "P1_bar",      1.0),
                  ("Q_in (kJ/kg)",           "Q_in",      800.0)],
    "Diesel":    [("Rapporto compr. r",     "r",          18.0),
                  ("Rapporto intro. rc",     "rc",          2.0),
                  ("T₁ (°C)",               "T1_C",       25.0),
                  ("P₁ (bar)",              "P1_bar",      1.0)],
    "Rankine":   [("P caldaia (bar)",       "P_high_bar", 50.0),
                  ("P condensatore (bar)",   "P_low_bar",   0.1),
                  ("T max vapore (°C)",      "T_max_C",   400.0),
                  ("η turbina (0–1)",        "eta_t",       1.0),
                  ("η pompa (0–1)",          "eta_p",       1.0)],
    "Brayton":   [("Rapporto pressioni rp", "rp",          8.0),
                  ("T₁ (°C)",               "T1_C",       15.0),
                  ("P₁ (bar)",              "P1_bar",      1.0),
                  ("T₃ max (°C)",           "T3_C",     1000.0),
                  ("η compressore",         "eta_c",       1.0),
                  ("η turbina",             "eta_t",       1.0)],
    "Frigorifico":[("T evaporatore (°C)",   "T_evap_C",  -15.0),
                   ("T condensatore (°C)",  "T_cond_C",   40.0),
                   ("η compressore (0–1)",  "eta_c",       1.0),
                   ("Surriscaldamento (K)", "superheat",   0.0)],
}


# ═════════════════════════════════════════════════════════════════════════════
#  APPLICAZIONE PRINCIPALE
# ═════════════════════════════════════════════════════════════════════════════
class CicliCAD(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("CAD Termodinamico – Cicli Carnot/Otto/Diesel/Rankine/Brayton/Frigorifico")
        self.geometry("1450x880")
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

    # ── PANNELLO SINISTRO ────────────────────────────────────────────────────
    def _build_left(self):
        self.left = ctk.CTkScrollableFrame(self)
        self.left.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.left.grid_columnconfigure(0, weight=1)
        r = 0
        ctk.CTkLabel(self.left, text="⚙  Termodinamica dei Cicli",
                     font=ctk.CTkFont(family="Helvetica", weight="bold", size=18)
                     ).grid(row=r, column=0, pady=(10,2)); r+=1
        ctk.CTkLabel(self.left, text="Carnot · Otto · Diesel · Rankine · Brayton · Frigorifico",
                     font=ctk.CTkFont(size=10), text_color="gray60"
                     ).grid(row=r, column=0, pady=(0,8)); r+=1
        ctk.CTkLabel(self.left, text="Seleziona Ciclo:",
                     font=ctk.CTkFont(weight="bold")
                     ).grid(row=r, column=0, sticky="w", padx=10); r+=1
        self._cycle_var = ctk.StringVar(value=self._current_cycle)
        ctk.CTkSegmentedButton(
            self.left, values=CYCLES, variable=self._cycle_var,
            command=self._on_cycle_change,
            font=ctk.CTkFont(weight="bold", size=11)
        ).grid(row=r, column=0, padx=10, pady=(0,10), sticky="ew"); r+=1
        self._param_frame = ctk.CTkFrame(self.left, corner_radius=8, fg_color="transparent")
        self._param_frame.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r+=1
        self._build_param_widgets()
        ctk.CTkButton(self.left, text="▶  Calcola Ciclo",
                      font=ctk.CTkFont(weight="bold", size=14),
                      fg_color="#2A6CBF", hover_color="#1A4C8F",
                      command=self._compute
                      ).grid(row=r, column=0, padx=10, pady=(12,4), sticky="ew"); r+=1
        ctk.CTkButton(self.left, text="↺  Ripristina Default",
                      fg_color="gray40", hover_color="gray25",
                      command=self._load_defaults
                      ).grid(row=r, column=0, padx=10, pady=4, sticky="ew"); r+=1
        ctk.CTkButton(self.left, text="📄  Esporta PDF (con passaggi)",
                      fg_color="#2A8C4B", hover_color="#1E6636",
                      command=self._export_pdf
                      ).grid(row=r, column=0, padx=10, pady=4, sticky="ew"); r+=1
        self._lbl_err = ctk.CTkLabel(self.left, text="", text_color="#FF4C4C",
                                     wraplength=290, font=ctk.CTkFont(weight="bold"))
        self._lbl_err.grid(row=r, column=0, pady=5); r+=1
        ctk.CTkLabel(self.left, text="Risultati:", font=ctk.CTkFont(weight="bold", size=13)
                     ).grid(row=r, column=0, sticky="w", padx=10); r+=1
        self._res_box = ctk.CTkTextbox(self.left, height=200,
                                        font=ctk.CTkFont(family="Consolas", size=11),
                                        state="disabled", wrap="none")
        self._res_box.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r+=1
        ctk.CTkLabel(self.left, text="Passaggi di calcolo:", font=ctk.CTkFont(weight="bold", size=13)
                     ).grid(row=r, column=0, sticky="w", padx=10); r+=1
        self._steps_box = ctk.CTkTextbox(self.left, height=400,
                                          font=ctk.CTkFont(family="Consolas", size=10),
                                          state="disabled", wrap="none")
        self._steps_box.grid(row=r, column=0, padx=5, pady=5, sticky="ew"); r+=1

    def _build_param_widgets(self):
        for w in self._param_frame.winfo_children(): w.destroy()
        self._entries.clear()
        defs = CYCLE_DEFAULTS[self._current_cycle]
        is_dark = ctk.get_appearance_mode() == "Dark"
        sec = ctk.CTkFrame(self._param_frame, corner_radius=8,
                           fg_color="#1E1E2E" if is_dark else "#E8EAF6")
        sec.pack(fill="x", padx=0, pady=2)
        ctk.CTkLabel(sec, text=f"  Parametri – {self._current_cycle}",
                     font=ctk.CTkFont(weight="bold", size=13)
                     ).pack(anchor="w", padx=8, pady=(6,2))
        for (label, key, default) in defs:
            row = ctk.CTkFrame(sec, fg_color="transparent")
            row.pack(fill="x", padx=8, pady=2)
            row.columnconfigure(0, weight=1); row.columnconfigure(1, weight=0)
            ctk.CTkLabel(row, text=label, font=ctk.CTkFont(size=12), anchor="w"
                        ).grid(row=0, column=0, sticky="w")
            ent = ctk.CTkEntry(row, width=100)
            ent.insert(0, str(default))
            ent.grid(row=0, column=1, padx=(4,0))
            self._entries[key] = ent

    def _on_cycle_change(self, val):
        self._current_cycle = val
        self._build_param_widgets()
        self._compute()

    def _load_defaults(self):
        for (label, key, default) in CYCLE_DEFAULTS[self._current_cycle]:
            if key in self._entries:
                e = self._entries[key]; e.delete(0,"end"); e.insert(0, str(default))
        self._compute()

    def _get(self, key):
        return float(self._entries[key].get().replace(",","."))

    # ── PANNELLO DESTRO ──────────────────────────────────────────────────────
    def _build_right(self):
        right = ctk.CTkFrame(self, corner_radius=15, border_width=2)
        right.grid(row=0, column=1, padx=(0,10), pady=10, sticky="nsew")
        right.grid_rowconfigure(0, weight=1); right.grid_columnconfigure(0, weight=1)
        self._tabview = ctk.CTkTabview(right)
        self._tabview.pack(fill="both", expand=True, padx=5, pady=5)
        self._tabs = ["Schema", "T-s", "P-v", "T-v", "h-s"]
        for t in self._tabs: self._tabview.add(t)
        self._figs = {}; self._axes = {}; self._canvases = {}
        bg = '#1a1a2e' if ctk.get_appearance_mode()=='Dark' else '#f5f5f5'
        fg = 'white'   if ctk.get_appearance_mode()=='Dark' else 'black'
        for tab in self._tabs:
            fig = Figure(figsize=(5,4), dpi=100)
            fig.patch.set_facecolor(bg)
            ax = fig.add_subplot(111); ax.set_facecolor(bg)
            if tab != "Schema":
                ax.tick_params(colors=fg); ax.xaxis.label.set_color(fg)
                ax.yaxis.label.set_color(fg); ax.title.set_color(fg)
                for sp in ax.spines.values(): sp.set_color('#555')
            canvas = FigureCanvasTkAgg(fig, master=self._tabview.tab(tab))
            canvas.get_tk_widget().pack(fill="both", expand=True)
            self._figs[tab]=fig; self._axes[tab]=ax; self._canvases[tab]=canvas

    # ── CALCOLO ──────────────────────────────────────────────────────────────
    def _compute(self):
        self._lbl_err.configure(text="")
        try:
            c = self._current_cycle
            if   c=="Carnot":     pts,segs,res,steps = calc_carnot(self._get("Th_C"),self._get("Tl_C"),self._get("P_ref"),self._get("ds"))
            elif c=="Otto":       pts,segs,res,steps = calc_otto(self._get("r"),self._get("T1_C"),self._get("P1_bar"),self._get("Q_in"))
            elif c=="Diesel":     pts,segs,res,steps = calc_diesel(self._get("r"),self._get("rc"),self._get("T1_C"),self._get("P1_bar"))
            elif c=="Rankine":    pts,segs,res,steps = calc_rankine(self._get("P_high_bar"),self._get("P_low_bar"),self._get("T_max_C"),self._get("eta_t"),self._get("eta_p"))
            elif c=="Brayton":    pts,segs,res,steps = calc_brayton(self._get("rp"),self._get("T1_C"),self._get("P1_bar"),self._get("T3_C"),self._get("eta_c"),self._get("eta_t"))
            elif c=="Frigorifico":pts,segs,res,steps = calc_frigorifico(self._get("T_evap_C"),self._get("T_cond_C"),self._get("eta_c"),self._get("superheat"))
            else: return
            self._points=pts; self._segs=segs
            self._update_textboxes(res,steps)
            self._redraw()
        except Exception as ex:
            import traceback; traceback.print_exc()
            self._lbl_err.configure(text=f"Errore: {ex}")

    def _update_textboxes(self, res, steps):
        self._res_box.configure(state="normal")
        self._res_box.delete("0.0","end")
        self._res_box.insert("end","RISULTATI\n"+"─"*32+"\n")
        for k,v in res.items(): self._res_box.insert("end",f"  {k:<28}{v}\n")
        self._res_box.configure(state="disabled")
        self._steps_box.configure(state="normal")
        self._steps_box.delete("0.0","end")
        self._steps_box.insert("end","\n".join(steps))
        self._steps_box.configure(state="disabled")

    # ── RIDISEGNO ────────────────────────────────────────────────────────────
    def _redraw(self):
        for cur in self._cursors:
            try: cur.remove()
            except: pass
        self._cursors.clear()
        bg = '#1a1a2e' if ctk.get_appearance_mode()=='Dark' else '#f5f5f5'
        fg = 'white'   if ctk.get_appearance_mode()=='Dark' else 'black'
        for tab in self._tabs:
            ax = self._axes[tab]; ax.clear(); ax.set_facecolor(bg)
            if tab=="Schema":
                try: draw_schema(ax, self._current_cycle, self._points, bg, fg)
                except Exception as e: ax.text(0.5,0.5,f"Schema error:\n{e}",ha='center',color='red',transform=ax.transAxes)
                self._canvases[tab].draw(); continue
            xlabel,ylabel,title = AXIS_LABELS[tab]
            ax.set_xlabel(xlabel); ax.set_ylabel(ylabel)
            ax.set_title(f"{title} – Ciclo {self._current_cycle}", color=fg, pad=8)
            ax.tick_params(colors=fg)
            for sp in ax.spines.values(): sp.set_color('#555')
            ax.xaxis.label.set_color(fg); ax.yaxis.label.set_color(fg)
            ax.grid(True, linestyle='--', alpha=0.20, color='gray')
            if not self._points: self._canvases[tab].draw(); continue
            pmap = {p.name: p for p in self._points}
            for (label,n1,n2,color,note) in self._segs:
                p1=pmap.get(n1); p2=pmap.get(n2)
                if not (p1 and p2): continue
                try: path = _get_path(label, p1, p2)
                except: path = _linear(p1, p2)
                xs=[_xy(d,tab)[0] for d in path]; ys=[_xy(d,tab)[1] for d in path]
                ax.plot(xs,ys,color=color,linewidth=2.5,label=label,zorder=4)
            xs_all=[_pt_xy(p,tab)[0] for p in self._points]
            ys_all=[_pt_xy(p,tab)[1] for p in self._points]
            sc=ax.scatter(xs_all,ys_all,s=110,c='#FFEE44',edgecolors='#CC2200',linewidths=1.5,zorder=8)
            offsets=[(6,6),(-28,6),(6,-14),(-28,-14)]
            for i,pt in enumerate(self._points):
                x,y=_pt_xy(pt,tab); ox,oy=offsets[i%len(offsets)]
                ax.annotate(pt.name,(x,y),textcoords="offset points",xytext=(ox,oy),
                    color='white',fontsize=11,fontweight='bold',
                    bbox=dict(boxstyle='round,pad=0.18',fc='#1A1A2E' if bg=='#1a1a2e' else '#F0F4FF',alpha=0.8,lw=0))
            pts_list=list(self._points)
            cur=mplcursors.cursor(sc,hover=True)
            @cur.connect("add")
            def _(sel,_pts=pts_list):
                pt=_pts[sel.index]
                sel.annotation.set_text(pt.tooltip())
                sel.annotation.get_bbox_patch().set_facecolor('#0D0D1E')
                sel.annotation.get_bbox_patch().set_alpha(0.95)
                sel.annotation.set_color('white'); sel.annotation.set_fontsize(9)
            self._cursors.append(cur)
            leg=ax.legend(fontsize=8,loc="best",
                facecolor='#1A1A2E' if bg=='#1a1a2e' else '#EEF0FF',
                labelcolor=fg,framealpha=0.85)
            self._canvases[tab].draw()

    # ── PDF ──────────────────────────────────────────────────────────────────
    def _export_pdf(self):
        fp = asksaveasfilename(defaultextension=".pdf",
                               filetypes=[("PDF","*.pdf")],
                               title="Salva PDF Analisi Ciclo")
        if not fp: return
        try:
            with PdfPages(fp) as pdf:
                fig_all,axes_all = plt.subplots(2,2,figsize=(14,10))
                fig_all.patch.set_facecolor('#0f172a')
                fig_all.suptitle(f"Ciclo {self._current_cycle} – Diagrammi Termodinamici",
                                 fontsize=16,fontweight='bold',color='white')
                tab_list=["T-s","P-v","T-v","h-s"]
                for idx,tab in enumerate(tab_list):
                    ar=axes_all[idx//2][idx%2]
                    ar.set_facecolor('#1e293b')
                    for sp in ar.spines.values(): sp.set_color('gray')
                    ar.tick_params(colors='white')
                    ar.xaxis.label.set_color('white'); ar.yaxis.label.set_color('white')
                    ar.title.set_color('white')
                    ar.grid(True,linestyle='--',alpha=0.20,color='gray')
                    xl,yl,tit=AXIS_LABELS[tab]
                    ar.set_xlabel(xl); ar.set_ylabel(yl); ar.set_title(tit)
                    pmap2={p.name:p for p in self._points}
                    for (label,n1,n2,color,note) in self._segs:
                        p1=pmap2.get(n1); p2=pmap2.get(n2)
                        if not (p1 and p2): continue
                        try: path=_get_path(label,p1,p2)
                        except: path=_linear(p1,p2)
                        xs=[_xy(d,tab)[0] for d in path]; ys=[_xy(d,tab)[1] for d in path]
                        ar.plot(xs,ys,color=color,lw=2,label=label)
                    for pt in self._points:
                        x2,y2=_pt_xy(pt,tab)
                        ar.scatter([x2],[y2],s=80,c='#FFEE44',edgecolors='#CC2200',zorder=5)
                        ar.annotate(pt.name,(x2,y2),xytext=(4,4),textcoords='offset points',
                                    fontsize=9,fontweight='bold',color='white')
                    ar.legend(fontsize=7,facecolor='#1A1A2E',labelcolor='white')
                fig_all.tight_layout(rect=[0,0,1,0.96])
                pdf.savefig(fig_all,facecolor=fig_all.get_facecolor()); plt.close(fig_all)
                fig2=plt.figure(figsize=(11,8))
                fig2.patch.set_facecolor('#0f172a')
                ax2=fig2.add_axes([0,0,1,1]); ax2.axis('off'); ax2.set_facecolor('#0f172a')
                ax2.text(0.50,0.97,f"Analisi Ciclo {self._current_cycle} – Coordinate e Passaggi",
                         ha='center',va='top',fontsize=14,fontweight='bold',color='white',transform=ax2.transAxes)
                col_labels=["Pnt","T (°C)","P (bar)","v (m³/kg)","h (kJ/kg)","s (kJ/kgK)"]
                rows=[[pt.name,f"{pt.T_C:.2f}",f"{pt.P_bar:.4f}",
                       f"{pt.v:.5f}",f"{pt.h:.2f}",f"{pt.s:.4f}"] for pt in self._points]
                tbl=ax2.table(cellText=rows,colLabels=col_labels,
                              loc='upper center',cellLoc='center',bbox=[0.02,0.73,0.96,0.22])
                tbl.auto_set_font_size(False); tbl.set_fontsize(9)
                for (row,col),cell in tbl.get_celld().items():
                    cell.set_facecolor('#1e293b' if row>0 else '#0ea5e9')
                    cell.set_text_props(color='white'); cell.set_edgecolor('gray')
                steps_txt=self._steps_box.get("0.0","end")
                ax2.text(0.01,0.70,steps_txt,transform=ax2.transAxes,fontsize=8,va='top',
                         family='monospace',color='#94a3b8',
                         bbox=dict(fc='#1e293b',ec='#334155',alpha=0.9))
                pdf.savefig(fig2,facecolor=fig2.get_facecolor()); plt.close(fig2)
            self._lbl_err.configure(text="✓ PDF salvato con successo!", text_color="#4CAF50")
        except Exception as ex:
            self._lbl_err.configure(text=f"Errore PDF: {ex}")


# ═════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = CicliCAD()
    app.mainloop()
