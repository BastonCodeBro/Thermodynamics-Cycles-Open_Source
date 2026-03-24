"""Ciclo Carnot ideale."""
import numpy as np
from core.thermo import GasPoint, R_AIR, CP_AIR, CV_AIR, K_AIR


def calc_carnot(Th_C: float, Tl_C: float, P_ref: float = 1.0, ds: float = 0.5):
    """
    Calcola il ciclo Carnot ideale su gas ideale.

    Returns:
        pts: lista di GasPoint (chiusa, 5 elementi)
        results: dict risultati
    """
    Th = Th_C + 273.15
    Tl = Tl_C + 273.15

    def v_ig(T, P):
        return R_AIR * T / (P * 100.0)

    s1 = 1.0
    s2 = s1 + ds

    v1 = v_ig(Th, P_ref)
    P2 = P_ref * np.exp(-(s2 - s1) / R_AIR)
    v2 = v_ig(Th, P2)
    P3 = P2 * (Tl / Th) ** (K_AIR / (K_AIR - 1))
    v3 = v_ig(Tl, P3)
    P4 = P3 * np.exp((s2 - s1) / R_AIR)
    v4 = v_ig(Tl, P4)

    gp1 = GasPoint("1", Th_C, P_ref, CP_AIR, K_AIR, R=R_AIR)
    gp2 = GasPoint("2", Th_C, P2, CP_AIR, K_AIR, R=R_AIR,
                   h_ref=gp1.h, s_ref=s1, T_ref_C=Th_C, P_ref_bar=P_ref)
    gp3 = GasPoint("3", Tl_C, P3, CP_AIR, K_AIR, R=R_AIR,
                   h_ref=gp2.h, s_ref=s2, T_ref_C=Th_C, P_ref_bar=P2)
    gp4 = GasPoint("4", Tl_C, P4, CP_AIR, K_AIR, R=R_AIR,
                   h_ref=gp3.h, s_ref=s1, T_ref_C=Tl_C, P_ref_bar=P3)

    Q_in = Th * ds
    Q_out = Tl * ds
    W_net = Q_in - Q_out
    eta = 1.0 - Tl / Th

    results = {
        "Q_in": Q_in, "Q_out": Q_out, "w_net": W_net,
        "eta": eta * 100, "Th": Th_C, "Tl": Tl_C, "ds": ds,
    }
    return [gp1, gp2, gp3, gp4, gp1], results
