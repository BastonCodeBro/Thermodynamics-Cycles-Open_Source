"""Ciclo Otto — motore a accensione comandata."""
import numpy as np
from core.thermo import GasPoint, K_AIR


def calc_otto(P1_bar: float, T1_C: float, r: float, T3_C: float,
              k: float = 1.4, cv: float = 0.718, eta: float = 0.85):
    """
    Calcola il ciclo Otto reale con rendimento isentropico.
    
    Returns:
        pts: lista di GasPoint (chiusa, 5 elementi)
        results: dict con risultati chiave
    """
    R = cv * (k - 1)
    cp = cv * k
    T1k = T1_C + 273.15
    T3k = T3_C + 273.15

    v1 = R * T1k / (P1_bar * 100)
    v2 = v1 / r

    T2sk = T1k * (r ** (k - 1))
    T2k = T1k + (T2sk - T1k) / eta
    P2 = P1_bar * (T2k / T1k) * (v1 / v2)

    P3 = P2 * (T3k / T2k)

    T4sk = T3k * ((1 / r) ** (k - 1))
    T4k = T3k - eta * (T3k - T4sk)
    P4 = P3 * (T4k / T3k) * (v2 / v1)

    ref = {"T_ref_C": T1_C, "P_ref_bar": P1_bar}
    p1 = GasPoint("1", T1_C, P1_bar, cp, k, R=R)
    p2 = GasPoint("2", T2k - 273.15, P2, cp, k, R=R, h_ref=p1.h, s_ref=p1.s, **ref)
    p3 = GasPoint("3", T3_C, P3, cp, k, R=R, h_ref=p1.h, s_ref=p1.s, **ref)
    p4 = GasPoint("4", T4k - 273.15, P4, cp, k, R=R, h_ref=p1.h, s_ref=p1.s, **ref)

    q_in = cv * (T3k - T2k)
    q_out = cv * (T4k - T1k)
    w_net = q_in - q_out
    eta_cycle = 100.0 * w_net / q_in if q_in > 0 else 0

    results = {
        "w_net": w_net, "q_in": q_in, "q_out": q_out,
        "eta": eta_cycle, "P_max": P3, "T_max": T3_C,
    }
    return [p1, p2, p3, p4, p1], results
