"""Ciclo Joule-Brayton — turbina a gas."""
import numpy as np
from core.thermo import GasPoint, CP_AIR, K_AIR, R_AIR


def calc_brayton(P1_bar: float, T1_C: float, P2_bar: float, T3_C: float,
                 cp_a: float = 1.005, k_a: float = 1.4,
                 eta_comp: float = 1.0, eta_turb: float = 1.0):
    """
    Calcola il ciclo Brayton ideale/reale.
    
    Returns:
        pts_real: lista GasPoint ciclo reale (chiusa)
        pts_ideal: lista GasPoint ciclo ideale (chiusa)
        results: dict risultati
    """
    T1k = T1_C + 273.15
    T3k = T3_C + 273.15
    R_g = cp_a * (k_a - 1)
    ratio_p = P2_bar / P1_bar

    T2sk = T1k * (ratio_p ** ((k_a - 1) / k_a))
    T2rk = T1k + (T2sk - T1k) / eta_comp

    P4_bar = P1_bar
    T4sk = T3k * ((P4_bar / P2_bar) ** ((k_a - 1) / k_a))
    T4rk = T3k - eta_turb * (T3k - T4sk)

    ref = {"T_ref_C": T1_C, "P_ref_bar": P1_bar}
    gp1 = GasPoint("1", T1_C, P1_bar, cp_a, k_a, R=R_g)
    gp2 = GasPoint("2s", T2sk - 273.15, P2_bar, cp_a, k_a, R=R_g, h_ref=gp1.h, s_ref=gp1.s, **ref)
    gp2r = GasPoint("2'", T2rk - 273.15, P2_bar, cp_a, k_a, R=R_g, h_ref=gp1.h, s_ref=gp1.s, **ref)
    gp3 = GasPoint("3", T3_C, P2_bar, cp_a, k_a, R=R_g, h_ref=gp2r.h, s_ref=gp2r.s,
                   T_ref_C=T2rk - 273.15, P_ref_bar=P2_bar)
    gp4 = GasPoint("4s", T4sk - 273.15, P4_bar, cp_a, k_a, R=R_g, h_ref=gp3.h, s_ref=gp3.s,
                   T_ref_C=T3_C, P_ref_bar=P2_bar)
    gp4r = GasPoint("4'", T4rk - 273.15, P4_bar, cp_a, k_a, R=R_g, h_ref=gp3.h, s_ref=gp3.s,
                    T_ref_C=T3_C, P_ref_bar=P2_bar)

    w_c = cp_a * (T2rk - T1k)
    w_t = cp_a * (T3k - T4rk)
    q_in = cp_a * (T3k - T2rk)
    w_net = w_t - w_c
    eta_cycle = 100.0 * w_net / q_in if q_in > 0 else 0
    bwr = 100.0 * w_c / w_t if w_t > 0 else 0

    results = {
        "w_net": w_net, "w_c": w_c, "w_t": w_t, "q_in": q_in,
        "eta": eta_cycle, "bwr": bwr,
        "T2r": T2rk - 273.15, "T4r": T4rk - 273.15,
    }
    return [gp1, gp2r, gp3, gp4r, gp1], [gp1, gp2, gp3, gp4, gp1], results
