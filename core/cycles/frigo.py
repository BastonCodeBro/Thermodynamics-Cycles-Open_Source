"""Ciclo frigorifero a compressione di vapore — R134a con tabelle."""
import numpy as np
from core.thermo import r134a_sat


def calc_frigorifico(T_evap_C: float, T_cond_C: float,
                     eta_c: float = 1.0, superheat: float = 0.0,
                     subcooling: float = 0.0, m_dot: float = 0.5):
    """
    Ciclo frigorifero R134a con tabelle interpolate.
    
    Returns:
        pts: lista di dict (4 punti chiusi)
        results: dict risultati
    """
    sat_e = r134a_sat(T_evap_C)
    sat_c = r134a_sat(T_cond_C)

    Pe = sat_e['P']
    Pc = sat_c['P']
    cp_vap = 0.9  # kJ/(kg·K) approssimato per R134a vapore

    # Punto 1: vapore saturo + surriscaldamento
    T1 = T_evap_C + superheat
    h1 = sat_e['hg'] + cp_vap * superheat
    s1 = sat_e['sg'] + cp_vap * np.log((T1 + 273.15) / (T_evap_C + 273.15)) if superheat > 0 else sat_e['sg']
    v1 = sat_e['vg'] * (T1 + 273.15) / (T_evap_C + 273.15)

    # Punto 2: uscita compressore (isentropica → reale)
    sg2 = sat_c['sg']
    T2s_K = (T_cond_C + 273.15) * np.exp((s1 - sg2) / cp_vap)
    h2s = sat_c['hg'] + cp_vap * (T2s_K - 273.15 - T_cond_C)
    W_c_is = h2s - h1
    W_c = W_c_is / eta_c if eta_c > 0 else W_c_is
    h2 = h1 + W_c
    T2 = T_cond_C + (h2 - sat_c['hg']) / cp_vap
    s2 = s1 + (h2 - h1) / ((T2 + T_cond_C) / 2 + 273.15)  # approx
    v2 = sat_c['vg'] * (T2 + 273.15) / (T_cond_C + 273.15)

    # Punto 3: liquido saturo + sottoraffreddamento
    h3 = sat_c['hf'] - 1.2 * subcooling
    s3 = sat_c['sf'] - 0.004 * subcooling
    T3 = T_cond_C - subcooling
    v3 = sat_c['vf']

    # Punto 4: dopo valvola (isoentalpica)
    h4 = h3
    x4 = (h4 - sat_e['hf']) / (sat_e['hg'] - sat_e['hf']) if (sat_e['hg'] - sat_e['hf']) > 0 else 0
    x4 = max(0.0, min(1.0, x4))
    s4 = sat_e['sf'] + x4 * (sat_e['sg'] - sat_e['sf'])
    v4 = sat_e['vf'] + x4 * (sat_e['vg'] - sat_e['vf'])
    T4 = T_evap_C

    pts = [
        {"name": "1", "P": Pe, "T": T1, "h": h1, "s": s1, "v": v1, "x": "sat.vap"},
        {"name": "2", "P": Pc, "T": T2, "h": h2, "s": s2, "v": v2, "x": "surris."},
        {"name": "3", "P": Pc, "T": T3, "h": h3, "s": s3, "v": v3, "x": "sat.liq"},
        {"name": "4", "P": Pe, "T": T4, "h": h4, "s": s4, "v": v4, "x": f"{x4:.3f}"},
        {"name": "1", "P": Pe, "T": T1, "h": h1, "s": s1, "v": v1, "x": "sat.vap"},
    ]

    Q_evap = h1 - h4
    Q_cond = h2 - h3
    COP_f = Q_evap / W_c if W_c > 0 else 0
    COP_hp = Q_cond / W_c if W_c > 0 else 0

    # Dati campana saturazione
    dome_T = np.linspace(-40, 60, 80)
    dome_sat = [r134a_sat(t) for t in dome_T]
    dome_hf = [s['hf'] for s in dome_sat]
    dome_hg = [s['hg'] for s in dome_sat]
    dome_Pf = [s['P'] for s in dome_sat]
    dome_sf = [s['sf'] for s in dome_sat]
    dome_sg = [s['sg'] for s in dome_sat]

    results = {
        "COP_f": COP_f, "COP_hp": COP_hp,
        "Q_evap": Q_evap, "Q_cond": Q_cond, "W_c": W_c,
        "Q_evap_kW": Q_evap * m_dot, "Q_cond_kW": Q_cond * m_dot, "W_c_kW": W_c * m_dot,
        "Pe": Pe, "Pc": Pc, "x4": x4,
        "dome": {
            "T": dome_T.tolist(), "hf": dome_hf, "hg": dome_hg,
            "Pf": dome_Pf, "sf": dome_sf, "sg": dome_sg,
        }
    }
    return pts, results
