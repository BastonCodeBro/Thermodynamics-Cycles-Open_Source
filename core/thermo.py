import numpy as np
from iapws import IAPWS97

# ---------------------------------------------------------
# AIR CONSTANTS (IDEAL GAS)
# ---------------------------------------------------------
R_AIR   = 0.287   # kJ/(kg·K)
CP_AIR  = 1.005   # kJ/(kg·K)
CV_AIR  = 0.718   # kJ/(kg·K)
K_AIR   = 1.4

# ---------------------------------------------------------
# R134a SATURATION TABLES (ASHRAE APPROX)
# ---------------------------------------------------------
_R134a_T  = [-40, -30, -20, -10,  0,  10,  20,  30,  40,  50,  60]
_R134a_P  = [0.516, 0.770, 1.127, 1.611, 2.263, 3.127, 4.259, 5.724, 7.587, 9.921, 12.80]
_R134a_hf = [148.1, 158.3, 168.9, 179.9, 191.3, 203.1, 215.4, 228.1, 241.4, 255.5, 270.4]
_R134a_hg = [374.0, 379.8, 385.6, 391.3, 397.0, 402.6, 408.1, 413.4, 418.5, 423.2, 427.5]
_R134a_sf = [0.799, 0.854, 0.909, 0.964, 1.018, 1.073, 1.128, 1.183, 1.239, 1.296, 1.355]
_R134a_sg = [1.746, 1.729, 1.713, 1.697, 1.681, 1.667, 1.652, 1.638, 1.625, 1.613, 1.601]
_R134a_vf = [7.38e-4, 7.47e-4, 7.58e-4, 7.70e-4, 7.83e-4, 7.98e-4, 8.15e-4, 8.34e-4, 8.56e-4, 8.83e-4, 9.16e-4]
_R134a_vg = [0.3564, 0.2451, 0.1728, 0.1243, 0.0916, 0.0685, 0.0519, 0.0399, 0.0310, 0.0244, 0.0194]

def r134a_sat(T_C):
    """Interpolazione lineare proprietà R134a saturo a T_C."""
    T_arr = np.array(_R134a_T)
    i = np.searchsorted(T_arr, T_C) - 1
    i = max(0, min(i, len(_R134a_T) - 2))
    t = (T_C - _R134a_T[i]) / (_R134a_T[i + 1] - _R134a_T[i])
    def li(arr):
        return arr[i] + t * (arr[i + 1] - arr[i])
    return {'P': li(_R134a_P), 'hf': li(_R134a_hf), 'hg': li(_R134a_hg),
            'sf': li(_R134a_sf), 'sg': li(_R134a_sg),
            'vf': li(_R134a_vf), 'vg': li(_R134a_vg)}

def r134a_T_from_P(P_bar):
    """Temperatura di saturazione da pressione per R134a."""
    P_arr = np.array(_R134a_P)
    i = np.searchsorted(P_arr, P_bar) - 1
    i = max(0, min(i, len(_R134a_P) - 2))
    t = (P_bar - _R134a_P[i]) / (_R134a_P[i + 1] - _R134a_P[i])
    return _R134a_T[i] + t * (_R134a_T[i + 1] - _R134a_T[i])

# ---------------------------------------------------------
# STEAM & WATER CORE (IAPWS-97 BASED)
# ---------------------------------------------------------

def get_iapws_robust(**args):
    """Robust IAPWS-97 state calculator."""
    try:
        state = IAPWS97(**args)
        if getattr(state, 'T', None) is not None and getattr(state, 'P', None) is not None:
            return state
        return None
    except Exception:
        return None

def steam_point_to_dict(name, state):
    """Converts IAPWS97 state to a standardized dictionary."""
    return {
        "name": name,
        "P": state.P * 10.0, # MPa to bar
        "T": state.T - 273.15, # K to C
        "h": state.h,
        "s": state.s,
        "v": state.v,
        "x": state.x if state.x is not None else (0 if state.phase == 0 else 1)
    }

# ---------------------------------------------------------
# GAS CORE (IDEAL & POLYTROPIC)
# ---------------------------------------------------------

class GasPoint:
    """Represents a thermodynamic state for an ideal gas."""
    def __init__(self, name, T_C, P_bar, cp, k, R=0.287, h_ref=0.0, s_ref=0.0, T_ref_C=0.0, P_ref_bar=1.0):
        self.name = name
        self.T_C = T_C
        self.T_K = T_C + 273.15
        self.P_bar = P_bar
        self.cp = cp          # kJ/(kg·K)
        self.k = k            # Isentropic exponent
        self.R = R            # Gas constant kJ/(kg·K)
        
        # Enthalpy and Entropy relative to reference
        T_ref_K = T_ref_C + 273.15
        self.h = h_ref + cp * (T_C - T_ref_C)
        self.s = s_ref + cp * np.log(self.T_K / T_ref_K) - self.R * np.log(P_bar / P_ref_bar)
        self.v = (self.R * self.T_K) / (P_bar * 100) # m³/kg

    def to_dict(self):
        return {
            "name": self.name,
            "P": self.P_bar,
            "T": self.T_C,
            "h": self.h,
            "s": self.s,
            "v": self.v
        }

def get_polytropic_path(pt1, pt2, n=100):
    """
    Generates n intermediate points for a physically correct path
    using a generalized polytropic model.
    """
    pts = []
    t_vals = np.linspace(0, 1, n)
    
    # Check if they are GasPoints or dicts
    p1 = pt1 if hasattr(pt1, 'P_bar') else pt1
    p2 = pt2 if hasattr(pt2, 'P_bar') else pt2
    
    p1_P, p1_T_K, p1_v, p1_h, p1_s = (p1.P_bar, p1.T_K, p1.v, p1.h, p1.s) if hasattr(pt1, 'P_bar') else (p1["P"], p1["T"]+273.15, p1["v"], p1["h"], p1["s"])
    p2_P, p2_T_K, p2_v, p2_h, p2_s = (p2.P_bar, p2.T_K, p2.v, p2.h, p2.s) if hasattr(pt2, 'P_bar') else (p2["P"], p2["T"]+273.15, p2["v"], p2["h"], p2["s"])

    for t in t_vals:
        # P, T, v interpolated in log scale
        P_k = p1_P * ((p2_P / p1_P) ** t) if p1_P != p2_P else p1_P
        T_K_k = p1_T_K * ((p2_T_K / p1_T_K) ** t) if p1_T_K != p2_T_K else p1_T_K
        v_k = p1_v * ((p2_v / p1_v) ** t) if p1_v != p2_v else p1_v
        
        # Enthalpy is linear with T
        if p1_T_K != p2_T_K:
            h_k = p1_h + (T_K_k - p1_T_K) / (p2_T_K - p1_T_K) * (p2_h - p1_h)
        else:
            h_k = p1_h + t * (p2_h - p1_h)
            
        # Entropy is linear with t for polytropic processes
        s_k = p1_s + t * (p2_s - p1_s)
        
        pts.append({"P": P_k, "T": T_K_k - 273.15, "h": h_k, "s": s_k, "v": v_k})
        
    return pts
