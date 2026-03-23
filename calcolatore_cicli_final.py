import customtkinter as ctk
import tkinter as tk
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages
import mplcursors
from tkinter.filedialog import asksaveasfilename

plt.style.use('dark_background')
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

# ─────────────────────────────────────────────────────────────────────────────
#  COSTANTI ARIA (gas ideale)
# ─────────────────────────────────────────────────────────────────────────────
R_AIR   = 0.287   # kJ/(kg·K)
CP_AIR  = 1.005   # kJ/(kg·K)
CV_AIR  = 0.718   # kJ/(kg·K)
K_AIR   = 1.4

# ─────────────────────────────────────────────────────────────────────────────
#  MOTORE DI CALCOLO
# ─────────────────────────────────────────────────────────────────────────────

class ThermoPoint:
    """Punto termodinamico generico."""
    def __init__(self, name, T_C, P_bar, v, h, s, extra=None):
        self.name = name
        self.T_C  = T_C
        self.T_K  = T_C + 273.15
        self.P_bar = P_bar
        self.v    = v
        self.h    = h
        self.s    = s
        self.extra = extra or {}

    def tooltip(self):
        lines = [
            f"Punto {self.name}",
            f"T : {self.T_C:.2f} °C",
            f"P : {self.P_bar:.4f} bar",
            f"v : {self.v:.5f} m³/kg",
            f"h : {self.h:.2f} kJ/kg",
            f"s : {self.s:.4f} kJ/(kg·K)",
        ]
        for k, val in self.extra.items():
            lines.append(f"{k} : {val}")
        return "\n".join(lines)


# ── Carnot ──────────────────────────────────────────────────────────────────
def calc_carnot(Th_C, Tl_C, P_ref=1.0, ds=0.5):
    Th = Th_C + 273.15
    Tl = Tl_C + 273.15
    s1 = 1.0
    s2 = s1 + ds
    # 1 isoterma a Th (espansione): Δs positivo
    # 1→2 isoterma calda
    # 2→3 isentropica espansione
    # 3→4 isoterma fredda (compressione)
    # 4→1 isentropica compressione
    # Per gas ideale: v = R*T/P, h = cp*T, s per riferimento
    def v_ig(T, P): return R_AIR * T / (P * 100.0)

    h1 = CV_AIR * Th  # riferimento arbitrario
    h2 = h1            # isoterma → Δh=0 gas ideale
    h3 = CV_AIR * Tl
    h4 = h3

    v1 = v_ig(Th, P_ref)
    # Espansione isoterma 1→2: P2 = P1*exp(-(s2-s1)/R_AIR)
    P2 = P_ref * np.exp(-(s2 - s1) / R_AIR)
    v2 = v_ig(Th, P2)
    # Espansione isentropica 2→3: T3=Tl
    P3 = P2 * (Tl / Th) ** (K_AIR / (K_AIR - 1))
    v3 = v_ig(Tl, P3)
    # Compressione isoterma 3→4
    s4 = s1
    P4 = P3 * np.exp((s2 - s1) / R_AIR)
    v4 = v_ig(Tl, P4)

    pts = [
        ThermoPoint("1", Th - 273.15, P_ref, v1, h1, s1),
        ThermoPoint("2", Th - 273.15, P2,    v2, h2, s2),
        ThermoPoint("3", Tl - 273.15, P3,    v3, h3, s2),
        ThermoPoint("4", Tl - 273.15, P4,    v4, h4, s1),
    ]
    Q_in  = Th * (s2 - s1)
    W_net = (Th - Tl) * (s2 - s1)
    eta   = 1.0 - Tl / Th

    segs = [
        ("1→2 Isoterma (Th)",       "1", "2", "#FF6B6B", "Calore introdotto\nQ₁ = Th·Δs"),
        ("2→3 Isentropica (esp.)",   "2", "3", "#4ECDC4", "Espansione isentropica\nΔs = 0"),
        ("3→4 Isoterma (Tl)",       "3", "4", "#45B7D1", "Calore ceduto\nQ₂ = Tl·Δs"),
        ("4→1 Isentropica (compr.)", "4", "1", "#96CEB4", "Compressione isentropica\nΔs = 0"),
    ]
    results = {
        "Q_in (kJ/kg)"   : round(Q_in, 2),
        "W_netto (kJ/kg)": round(W_net, 2),
        "η_Carnot (%)"   : round(eta * 100, 2),
        "T_high (°C)"    : Th_C,
        "T_low (°C)"     : Tl_C,
    }
    steps = [
        "── CICLO CARNOT ──────────────────────────",
        "Dati:",
        f"  T_H = {Th_C} °C  ({Th:.2f} K)",
        f"  T_L = {Tl_C} °C  ({Tl:.2f} K)",
        f"  Δs  = {ds:.3f} kJ/(kg·K)",
        "",
        "Tratto 1→2  (Isoterma calda, Th):",
        f"  Q₁ = Th · Δs = {Th:.2f} × {ds:.3f} = {Q_in:.2f} kJ/kg",
        f"  P₂ = P₁ · exp(-Δs/R) = {P_ref:.3f} · exp({-(ds/R_AIR):.3f}) = {P2:.4f} bar",
        "",
        "Tratto 2→3  (Isentropica espansione):",
        f"  P₃ = P₂·(T_L/T_H)^(k/(k-1)) = {P2:.4f}·({Tl:.2f}/{Th:.2f})^{K_AIR/(K_AIR-1):.3f} = {P3:.4f} bar",
        "",
        "Tratto 3→4  (Isoterma fredda, Tl):",
        f"  Q₂ = Tl · Δs = {Tl:.2f} × {ds:.3f} = {Tl*ds:.2f} kJ/kg",
        "",
        "Tratto 4→1  (Isentropica compressione):",
        f"  P₄ = P₁ = {P_ref:.3f} bar  (chiusura ciclo)",
        "",
        "Prestazioni:",
        f"  W_netto = Q₁ - Q₂ = {W_net:.2f} kJ/kg",
        f"  η = 1 - T_L/T_H = 1 - {Tl:.2f}/{Th:.2f} = {eta*100:.2f}%",
    ]
    return pts, segs, results, steps


# ── Otto ─────────────────────────────────────────────────────────────────────
def calc_otto(r, T1_C, P1_bar, Q_in):
    T1 = T1_C + 273.15
    P1 = P1_bar
    v1 = R_AIR * T1 / (P1 * 100.0)
    v2 = v1 / r
    # 1→2 isentropica
    T2 = T1 * r ** (K_AIR - 1)
    P2 = P1 * r ** K_AIR
    h1 = CP_AIR * T1; s1 = 0.0
    h2 = CP_AIR * T2; s2 = s1
    # 2→3 isocora
    T3 = T2 + Q_in / CV_AIR
    P3 = P2 * T3 / T2
    v3 = v2
    h3 = CP_AIR * T3; s3 = CV_AIR * np.log(T3 / T2) + s2
    # 3→4 isentropica
    T4 = T3 / r ** (K_AIR - 1)
    P4 = P3 / r ** K_AIR
    v4 = v1
    h4 = CP_AIR * T4; s4 = s3
    # 4→1 isocora
    Q_out = CV_AIR * (T4 - T1)
    W_net = Q_in - Q_out
    eta   = 1.0 - 1.0 / r ** (K_AIR - 1)

    pts = [
        ThermoPoint("1", T1-273.15, P1, v1, h1, s1),
        ThermoPoint("2", T2-273.15, P2, v2, h2, s2),
        ThermoPoint("3", T3-273.15, P3, v3, h3, s3),
        ThermoPoint("4", T4-273.15, P4, v4, h4, s4),
    ]
    segs = [
        ("1→2 Compressione isentropica", "1","2","#4ECDC4","Δs=0, v₂=v₁/r"),
        ("2→3 Combustione isocora",      "2","3","#FF6B6B","Δv=0, Q_in"),
        ("3→4 Espansione isentropica",   "3","4","#96CEB4","Δs=0, v₄=v₁"),
        ("4→1 Scarico isocoro",          "4","1","#45B7D1","Δv=0, Q_out"),
    ]
    results = {
        "T₂ (°C)": round(T2-273.15,2), "T₃ (°C)": round(T3-273.15,2), "T₄ (°C)": round(T4-273.15,2),
        "Q_in (kJ/kg)": Q_in, "Q_out (kJ/kg)": round(Q_out,2),
        "W_netto (kJ/kg)": round(W_net,2), "η_Otto (%)": round(eta*100,2),
    }
    steps = [
        "── CICLO OTTO ──────────────────────────────",
        f"  r = {r}  T₁={T1_C}°C  P₁={P1_bar} bar  Q_in={Q_in} kJ/kg",
        "",
        "Punto 1 (Aspirazione):",
        f"  v₁ = R·T₁/P₁ = {v1:.5f} m³/kg",
        "",
        "1→2  Compressione isentropica (Δs=0):",
        f"  T₂ = T₁·r^(k-1) = {T1:.2f}·{r}^{K_AIR-1} = {T2:.2f} K ({T2-273.15:.2f}°C)",
        f"  P₂ = P₁·r^k = {P1:.3f}·{r}^{K_AIR} = {P2:.3f} bar",
        f"  v₂ = v₁/r = {v2:.5f} m³/kg",
        "",
        "2→3  Combustione isocora (Δv=0):",
        f"  T₃ = T₂ + Q_in/cᵥ = {T2:.2f} + {Q_in}/{CV_AIR} = {T3:.2f} K ({T3-273.15:.2f}°C)",
        f"  P₃ = P₂·T₃/T₂ = {P2:.3f}·{T3:.2f}/{T2:.2f} = {P3:.3f} bar",
        "",
        "3→4  Espansione isentropica (Δs=0):",
        f"  T₄ = T₃/r^(k-1) = {T3:.2f}/{r}^{K_AIR-1} = {T4:.2f} K ({T4-273.15:.2f}°C)",
        f"  P₄ = {P4:.4f} bar",
        "",
        "4→1  Scarico isocoro:",
        f"  Q_out = cᵥ·(T₄-T₁) = {CV_AIR}·({T4:.2f}-{T1:.2f}) = {Q_out:.2f} kJ/kg",
        "",
        "Prestazioni:",
        f"  W_netto = Q_in - Q_out = {Q_in} - {Q_out:.2f} = {W_net:.2f} kJ/kg",
        f"  η = 1 - 1/r^(k-1) = 1 - 1/{r}^{K_AIR-1:.1f} = {eta*100:.2f}%",
    ]
    return pts, segs, results, steps


# ── Diesel ───────────────────────────────────────────────────────────────────
def calc_diesel(r, rc, T1_C, P1_bar):
    T1 = T1_C + 273.15; P1 = P1_bar
    v1 = R_AIR * T1 / (P1 * 100.0); v2 = v1 / r
    T2 = T1 * r**(K_AIR-1); P2 = P1 * r**K_AIR
    h1=CP_AIR*T1; s1=0.0
    h2=CP_AIR*T2; s2=s1
    # 2→3 isobara
    T3 = T2 * rc; v3 = v2 * rc; P3 = P2
    Q_in = CP_AIR * (T3 - T2)
    h3=CP_AIR*T3; s3=s2+CP_AIR*np.log(T3/T2)
    # 3→4 isentropica
    T4 = T3 * (v3/v1)**(K_AIR-1)
    P4 = P3 * (v3/v1)**K_AIR; v4=v1
    h4=CP_AIR*T4; s4=s3
    Q_out = CV_AIR*(T4-T1)
    W_net = Q_in - Q_out; eta = W_net/Q_in

    pts = [
        ThermoPoint("1",T1-273.15,P1,v1,h1,s1),
        ThermoPoint("2",T2-273.15,P2,v2,h2,s2),
        ThermoPoint("3",T3-273.15,P3,v3,h3,s3),
        ThermoPoint("4",T4-273.15,P4,v4,h4,s4),
    ]
    segs=[
        ("1→2 Compressione isentropica","1","2","#4ECDC4","Δs=0"),
        ("2→3 Combustione isobara",     "2","3","#FF6B6B","ΔP=0, rc=v₃/v₂"),
        ("3→4 Espansione isentropica",  "3","4","#96CEB4","Δs=0"),
        ("4→1 Scarico isocoro",         "4","1","#45B7D1","Δv=0"),
    ]
    results={"T₂(°C)":round(T2-273.15,2),"T₃(°C)":round(T3-273.15,2),"T₄(°C)":round(T4-273.15,2),
             "Q_in(kJ/kg)":round(Q_in,2),"W_netto(kJ/kg)":round(W_net,2),"η_Diesel(%)":round(eta*100,2)}
    steps=[
        "── CICLO DIESEL ────────────────────────────",
        f"  r={r}  rc={rc}  T₁={T1_C}°C  P₁={P1_bar} bar",
        "","1→2 Compressione isentropica:",
        f"  T₂={T1:.2f}·{r}^{K_AIR-1}={T2:.2f} K   P₂={P2:.3f} bar",
        "","2→3 Combustione isobara:",
        f"  T₃=T₂·rc={T2:.2f}·{rc}={T3:.2f} K   v₃={v3:.5f} m³/kg",
        f"  Q_in=cp·(T₃-T₂)={CP_AIR}·{T3-T2:.2f}={Q_in:.2f} kJ/kg",
        "","3→4 Espansione isentropica:",
        f"  T₄=T₃·(v₃/v₁)^(k-1)={T3:.2f}·{(v3/v1):.4f}^{K_AIR-1}={T4:.2f} K",
        "","Prestazioni:",
        f"  Q_out=cv·(T₄-T₁)={CV_AIR}·{T4-T1:.2f}={Q_out:.2f} kJ/kg",
        f"  W_netto={W_net:.2f} kJ/kg   η={eta*100:.2f}%",
    ]
    return pts, segs, results, steps


# ── Brayton ──────────────────────────────────────────────────────────────────
def calc_brayton(rp, T1_C, P1_bar, T3_C, eta_c=1.0, eta_t=1.0):
    T1=T1_C+273.15; P1=P1_bar; T3=T3_C+273.15
    P2=P1*rp
    # Compressore
    T2s=T1*rp**((K_AIR-1)/K_AIR)
    T2 =T1+(T2s-T1)/eta_c
    # Turbina
    P4=P1
    T4s=T3/rp**((K_AIR-1)/K_AIR)
    T4 =T3-eta_t*(T3-T4s)

    v1=R_AIR*T1/(P1*100); v2=R_AIR*T2/(P2*100)
    v3=R_AIR*T3/(P2*100); v4=R_AIR*T4/(P4*100)
    h1=CP_AIR*T1; s1=0.0
    h2=CP_AIR*T2; s2=s1+CP_AIR*np.log(T2/T1)-R_AIR*np.log(P2/P1)
    h3=CP_AIR*T3; s3=s2+CP_AIR*np.log(T3/T2)
    h4=CP_AIR*T4; s4=s3+CP_AIR*np.log(T4/T3)-R_AIR*np.log(P4/P2)

    W_c=CP_AIR*(T2-T1); W_t=CP_AIR*(T3-T4)
    Q_in=CP_AIR*(T3-T2); W_net=W_t-W_c
    eta=W_net/Q_in if Q_in>0 else 0

    pts=[
        ThermoPoint("1",T1-273.15,P1,v1,h1,s1),
        ThermoPoint("2",T2-273.15,P2,v2,h2,s2),
        ThermoPoint("3",T3-273.15,P2,v3,h3,s3),
        ThermoPoint("4",T4-273.15,P4,v4,h4,s4),
    ]
    segs=[
        ("1→2 Compressore",         "1","2","#4ECDC4","Compressione isentropica"),
        ("2→3 Camera combustione",  "2","3","#FF6B6B","Riscaldamento isobaro"),
        ("3→4 Turbina",             "3","4","#96CEB4","Espansione isentropica"),
        ("4→1 Scarico isobaro",     "4","1","#45B7D1","Raffreddamento isobaro"),
    ]
    results={"T₂(°C)":round(T2-273.15,2),"T₄(°C)":round(T4-273.15,2),
             "W_comp(kJ/kg)":round(W_c,2),"W_turb(kJ/kg)":round(W_t,2),
             "Q_in(kJ/kg)":round(Q_in,2),"W_netto(kJ/kg)":round(W_net,2),
             "η_Brayton(%)":round(eta*100,2)}
    steps=[
        "── CICLO JOULE-BRAYTON ─────────────────────",
        f"  rp={rp}  T₁={T1_C}°C  P₁={P1_bar} bar  T₃={T3_C}°C",
        f"  η_c={eta_c}  η_t={eta_t}",
        "","1→2 Compressore:",
        f"  T₂s=T₁·rp^((k-1)/k)={T1:.2f}·{rp}^{(K_AIR-1)/K_AIR:.4f}={T2s:.2f} K",
        f"  T₂=T₁+(T₂s-T₁)/η_c={T1:.2f}+{T2s-T1:.2f}/{eta_c}={T2:.2f} K ({T2-273.15:.2f}°C)",
        f"  W_c=cp·(T₂-T₁)={CP_AIR}·{T2-T1:.2f}={W_c:.2f} kJ/kg",
        "","2→3 Camera di combustione:",
        f"  Q_in=cp·(T₃-T₂)={CP_AIR}·{T3-T2:.2f}={Q_in:.2f} kJ/kg",
        "","3→4 Turbina:",
        f"  T₄s=T₃/rp^((k-1)/k)={T3:.2f}/{rp}^{(K_AIR-1)/K_AIR:.4f}={T4s:.2f} K",
        f"  T₄=T₃-η_t·(T₃-T₄s)={T3:.2f}-{eta_t}·{T3-T4s:.2f}={T4:.2f} K ({T4-273.15:.2f}°C)",
        f"  W_t=cp·(T₃-T₄)={CP_AIR}·{T3-T4:.2f}={W_t:.2f} kJ/kg",
        "","Prestazioni:",
        f"  W_netto=W_t-W_c={W_t:.2f}-{W_c:.2f}={W_net:.2f} kJ/kg",
        f"  η=W_net/Q_in={W_net:.2f}/{Q_in:.2f}={eta*100:.2f}%",
    ]
    return pts, segs, results, steps


# ── Rankine (approssimazione acqua con IAPWS se disponibile) ─────────────────
def calc_rankine(P_high_bar, P_low_bar, T_max_C, eta_t=1.0, eta_p=1.0):
    try:
        from iapws import IAPWS97
        use_iapws = True
    except ImportError:
        use_iapws = False

    if use_iapws:
        Ph = P_high_bar / 10.0  # MPa
        Pl = P_low_bar  / 10.0
        # Punto 1: liquido saturo a P_low
        st1 = IAPWS97(P=Pl, x=0)
        h1=st1.h; s1=st1.s; T1=st1.T-273.15; v1=st1.v
        # Punto 2: uscita pompa (isentropica)
        st2s = IAPWS97(P=Ph, s=s1)
        h2  = h1 + (st2s.h - h1) / eta_p
        st2 = IAPWS97(P=Ph, h=h2)
        s2=st2.s; T2=st2.T-273.15; v2=st2.v
        # Punto 3: vapore surriscaldato a P_high, T_max
        T3_K = T_max_C + 273.15
        st3 = IAPWS97(P=Ph, T=T3_K)
        h3=st3.h; s3=st3.s; T3=st3.T-273.15; v3=st3.v
        # Punto 4: uscita turbina (isentropica)
        st4s = IAPWS97(P=Pl, s=s3)
        h4  = h3 - eta_t * (h3 - st4s.h)
        st4  = IAPWS97(P=Pl, h=h4)
        s4=st4.s; T4=st4.T-273.15; v4=st4.v
        x4 = getattr(st4, 'x', None)
        extra4 = {f"x (titolo)": f"{x4:.4f}"} if x4 is not None else {}
    else:
        # Valori approssimati se iapws non è installato
        T1=45.8; P1=P_low_bar; v1=0.001010; h1=192.0; s1=0.649
        T2=T1+1.5; v2=0.001011; h2=h1+v1*(P_high_bar-P_low_bar)*100/eta_p; s2=s1
        T3=T_max_C; v3=0.035; h3=3200.0+2.0*(T_max_C-350); s3=6.6+0.002*(T_max_C-350)
        h4=h3-eta_t*(h3-2200.0); T4=T1; v4=0.050; s4=s3; extra4={}

    pts=[
        ThermoPoint("1",T1,P_low_bar,v1,h1,s1),
        ThermoPoint("2",T2,P_high_bar,v2,h2,s2),
        ThermoPoint("3",T3,P_high_bar,v3,h3,s3),
        ThermoPoint("4",T4,P_low_bar,v4,h4,s4, extra=extra4),
    ]
    W_p=h2-h1; W_t=h3-h4; Q_in=h3-h2; W_net=W_t-W_p
    eta=W_net/Q_in if Q_in>0 else 0

    segs=[
        ("1→2 Pompa (isentropica)",   "1","2","#4ECDC4","Δs≈0, liquido"),
        ("2→3 Caldaia (isobara)",     "2","3","#FF6B6B","ΔP=0, Q_in"),
        ("3→4 Turbina (isentropica)", "3","4","#96CEB4","Δs≈0"),
        ("4→1 Condensatore (isobara)","4","1","#45B7D1","ΔP=0, Q_out"),
    ]
    results={
        "h₁(kJ/kg)":round(h1,2),"h₂(kJ/kg)":round(h2,2),
        "h₃(kJ/kg)":round(h3,2),"h₄(kJ/kg)":round(h4,2),
        "W_pompa(kJ/kg)":round(W_p,2),"W_turbina(kJ/kg)":round(W_t,2),
        "Q_in(kJ/kg)":round(Q_in,2),"W_netto(kJ/kg)":round(W_net,2),
        "η_Rankine(%)":round(eta*100,2),
    }
    steps=[
        "── CICLO RANKINE ───────────────────────────",
        f"  P_high={P_high_bar} bar  P_low={P_low_bar} bar  T_max={T_max_C}°C",
        f"  η_t={eta_t}  η_p={eta_p}",
        "","Punto 1 (liquido saturo a P_low):",
        f"  h₁={h1:.2f} kJ/kg   s₁={s1:.4f} kJ/(kg·K)   T₁={T1:.2f}°C",
        "","1→2 Pompa (isentropica, Δs≈0):",
        f"  W_p = (h₂-h₁)/η_p → h₂={h2:.2f} kJ/kg",
        "","2→3 Caldaia (isobara, ΔP=0):",
        f"  Q_in = h₃-h₂ = {h3:.2f}-{h2:.2f} = {Q_in:.2f} kJ/kg",
        f"  T₃={T3:.2f}°C   h₃={h3:.2f} kJ/kg   s₃={s3:.4f} kJ/(kg·K)",
        "","3→4 Turbina (isentropica, Δs≈0):",
        f"  h₄=h₃-η_t·(h₃-h₄s) = {h4:.2f} kJ/kg",
        f"  W_t = h₃-h₄ = {W_t:.2f} kJ/kg",
        "","4→1 Condensatore:",
        f"  Q_out = h₄-h₁ = {h4-h1:.2f} kJ/kg",
        "","Prestazioni:",
        f"  W_netto = W_t - W_p = {W_t:.2f} - {W_p:.2f} = {W_net:.2f} kJ/kg",
        f"  η = W_net/Q_in = {W_net:.2f}/{Q_in:.2f} = {eta*100:.2f}%",
    ]
    return pts, segs, results, steps


# ── Ciclo Frigorifero (R134a, tabelle semplificate) ──────────────────────────
# Tabelle R134a (valori approssimati standard ASHRAE)
_R134a_T  = [-40,-30,-20,-10,  0, 10, 20, 30, 40, 50, 60]
_R134a_P  = [0.516,0.770,1.127,1.611,2.263,3.127,4.259,5.724,7.587,9.921,12.80]  # bar
_R134a_hf = [148.1,158.3,168.9,179.9,191.3,203.1,215.4,228.1,241.4,255.5,270.4] # kJ/kg
_R134a_hg = [374.0,379.8,385.6,391.3,397.0,402.6,408.1,413.4,418.5,423.2,427.5] # kJ/kg
_R134a_sf = [0.799,0.854,0.909,0.964,1.018,1.073,1.128,1.183,1.239,1.296,1.355] # kJ/kgK
_R134a_sg = [1.746,1.729,1.713,1.697,1.681,1.667,1.652,1.638,1.625,1.613,1.601] # kJ/kgK
_R134a_vf = [7.38e-4,7.47e-4,7.58e-4,7.70e-4,7.83e-4,7.98e-4,8.15e-4,8.34e-4,8.56e-4,8.83e-4,9.16e-4]
_R134a_vg = [0.3564,0.2451,0.1728,0.1243,0.0916,0.0685,0.0519,0.0399,0.0310,0.0244,0.0194]

def _r134a_sat(T_C):
    """Interpolazione proprietà R134a saturo a T_C."""
    import numpy as np
    T_arr = np.array(_R134a_T)
    i = np.searchsorted(T_arr, T_C) - 1
    i = max(0, min(i, len(_R134a_T) - 2))
    t  = (T_C - _R134a_T[i]) / (_R134a_T[i+1] - _R134a_T[i])
    def li(arr): return arr[i] + t*(arr[i+1]-arr[i])
    return {'P': li(_R134a_P), 'hf': li(_R134a_hf), 'hg': li(_R134a_hg),
            'sf': li(_R134a_sf), 'sg': li(_R134a_sg),
            'vf': li(_R134a_vf), 'vg': li(_R134a_vg)}

def _r134a_T_from_P(P_bar):
    """Temperatura di saturazione da pressione."""
    import numpy as np
    P_arr = np.array(_R134a_P)
    i = np.searchsorted(P_arr, P_bar) - 1
    i = max(0, min(i, len(_R134a_P) - 2))
    t = (P_bar - _R134a_P[i]) / (_R134a_P[i+1] - _R134a_P[i])
    return _R134a_T[i] + t*(_R134a_T[i+1] - _R134a_T[i])

def calc_frigorifico(T_evap_C, T_cond_C, eta_c=1.0, superheat=0.0):
    """Ciclo frigorifero a compressione di vapore con R134a (modello semplificato)."""
    # Punto 1: vapore saturo (o surriscaldato) all'uscita evaporatore
    sat1 = _r134a_sat(T_evap_C)
    T1_C = T_evap_C + superheat
    P1   = sat1['P']
    h1   = sat1['hg'] + 0.9 * superheat  # cp_vapor ≈ 0.9 kJ/(kg·K)
    s1   = sat1['sg'] + 0.9 * np.log((T1_C+273.15)/(T_evap_C+273.15)) if superheat > 0 else sat1['sg']
    v1   = sat1['vg'] * (T1_C+273.15)/(T_evap_C+273.15)

    # Punto 2: uscita compressore (isentropica da P1 a P2)
    sat2 = _r134a_sat(T_cond_C)
    P2   = sat2['P']
    T_sat2_C = T_cond_C
    # Temperatura dopo compressione isentropica nel vapore surriscaldato:
    # s2 = s1, P2 = P_cond; approssimazione: T2 = T_sat2 + (s1-sg2)/(cp/T_avg) ≈ T_sat2 + ΔT
    # dove ΔT = Tsat2*(s1 - sg2)*Tsat2/[0.9*R134a_hfg] (approssimazione)
    sg2 = sat2['sg']
    cp_vap = 0.9
    T_sat2_K = T_sat2_C + 273.15
    # s_superh = sg2 + cp_vap * ln(T2/T_sat2) → T2 = T_sat2*exp((s1-sg2)/cp_vap)
    T2_K  = T_sat2_K * np.exp((s1 - sg2) / cp_vap)
    T2s_C = T2_K - 273.15
    # Entalpia isentropica T2s, poi T2 reale con eta_c
    h2s = sat2['hg'] + cp_vap * (T2s_C - T_sat2_C)
    W_c_is = h2s - h1
    W_c = W_c_is / eta_c
    h2  = h1 + W_c
    T2_C = T_sat2_C + (h2 - sat2['hg']) / cp_vap
    s2   = s1  # isentropica
    v2   = sat2['vg'] * (T2_C + 273.15) / T_sat2_K

    # Punto 3: liquido saturo all'uscita condensatore
    h3 = sat2['hf']; s3 = sat2['sf']; T3_C = T_cond_C; v3 = sat2['vf']

    # Punto 4: uscita valvola di laminazione (isoentalpica h4=h3)
    h4 = h3
    # Titolo a T_evap: x4 = (h4-hf1)/(hg1-hf1)
    x4 = (h4 - sat1['hf']) / (sat1['hg'] - sat1['hf'])
    x4 = max(0.0, min(1.0, x4))
    s4 = sat1['sf'] + x4 * (sat1['sg'] - sat1['sf'])
    v4 = sat1['vf'] + x4 * (sat1['vg'] - sat1['vf'])
    T4_C = T_evap_C

    pts = [
        ThermoPoint("1", T1_C, P1, v1, h1, s1, {"x": "1.00 (sat.)"}),
        ThermoPoint("2", T2_C, P2, v2, h2, s2, {"x": "surriscald."}),
        ThermoPoint("3", T3_C, P2, v3, h3, s3, {"x": "0.00 (liq.)"}),
        ThermoPoint("4", T4_C, P1, v4, h4, s4, {f"x (titolo)": f"{x4:.3f}"}),
    ]
    Q_evap = h1 - h4   # calore assorbito
    Q_cond = h2 - h3   # calore ceduto
    COP_f  = Q_evap / W_c if W_c > 0 else 0
    COP_hp = Q_cond  / W_c if W_c > 0 else 0

    segs = [
        ("1→2 Compressore (isentropica)", "1","2","#4ECDC4","Compressione vapore"),
        ("2→3 Condensatore (isobara)",   "2","3","#FF6B6B","Condensazione a P_cond"),
        ("3→4 Valvola laminazione",      "3","4","#FFD93D","Isoentalpica h₄=h₃"),
        ("4→1 Evaporatore (isobara)",    "4","1","#45B7D1","Evaporazione a P_evap"),
    ]
    results = {
        "T₂ (°C)": round(T2_C,2), "T₄ (°C)": round(T4_C,2),
        "x₄ (titolo)": round(x4,3),
        "Q_evap (kJ/kg)": round(Q_evap,2), "Q_cond (kJ/kg)": round(Q_cond,2),
        "W_comp (kJ/kg)": round(W_c,2),
        "COP_frig": round(COP_f,3), "COP_p.calore": round(COP_hp,3),
    }
    steps = [
        "── CICLO FRIGORIFERO R134a ─────────────────",
        f"  T_evap={T_evap_C}°C  T_cond={T_cond_C}°C  η_c={eta_c}",
        "","Punto 1 (vapore saturo, evaporatore):",
        f"  P₁={P1:.3f} bar  h₁={h1:.2f} kJ/kg  s₁={s1:.4f} kJ/kgK",
        "","1→2 Compressore (isentropica, s=cost):",
        f"  P₂={P2:.3f} bar  T₂s={T2s_C:.2f}°C  h₂s={h2s:.2f} kJ/kg",
        f"  W_c=h₂-h₁=(h₂s-h₁)/η_c={W_c_is:.2f}/{eta_c}={W_c:.2f} kJ/kg",
        f"  T₂={T2_C:.2f}°C  h₂={h2:.2f} kJ/kg",
        "","2→3 Condensatore (isobara, P=cost):",
        f"  Condensazione a T_cond={T_cond_C}°C",
        f"  h₃={h3:.2f} kJ/kg (liquido saturo)  Q_cond=h₂-h₃={Q_cond:.2f} kJ/kg",
        "","3→4 Valvola di laminazione (isoentalpica):",
        f"  h₄=h₃={h4:.2f} kJ/kg  T₄={T4_C:.2f}°C  x₄={x4:.3f}",
        "","4→1 Evaporatore (isobara, P=cost):",
        f"  Q_evap=h₁-h₄={h1:.2f}-{h4:.2f}={Q_evap:.2f} kJ/kg",
        "","Prestazioni:",
        f"  COP_frigorifico  = Q_evap/W_c = {Q_evap:.2f}/{W_c:.2f} = {COP_f:.3f}",
        f"  COP_pompa calore = Q_cond/W_c = {Q_cond:.2f}/{W_c:.2f} = {COP_hp:.3f}",
    ]
    return pts, segs, results, steps

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
