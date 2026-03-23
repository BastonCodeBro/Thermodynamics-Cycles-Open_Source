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
