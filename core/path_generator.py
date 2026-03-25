"""
core/path_generator.py — Thermodynamic Process Path Generator

Generates physically correct curves for P-v, T-s, and h-s diagrams
for ideal gas and real-fluid thermodynamic processes.

Process types:
  - isentropic  (s = const, P*v^k = const for ideal gas)
  - isochoric   (v = const)
  - isobaric    (P = const)
  - isothermal  (T = const)
  - isenthalpic (h = const, throttling valve)
  - polytropic  (P*v^n = const, generalised)

Each generator function returns a dict with keys:
  'P'  : numpy array of pressures  [bar]
  'v'  : numpy array of specific volumes  [m^3/kg]
  'T'  : numpy array of temperatures  [°C]
  's'  : numpy array of entropies  [kJ/(kg·K)]
  'h'  : numpy array of enthalpies  [kJ/kg]
"""
import numpy as np

# ─────────────────────────────────────────────────────────────
#  Helpers to extract scalar properties from GasPoint or dict
# ─────────────────────────────────────────────────────────────

def _props(pt):
    """Extract (P_bar, T_K, v, h, s, cp, k, R) from a GasPoint-like object or dict."""
    if hasattr(pt, 'P_bar'):
        P   = pt.P_bar
        T_K = pt.T_K
        v   = pt.v
        h   = pt.h
        s   = pt.s
        cp  = getattr(pt, 'cp', 1.005)
        k   = getattr(pt, 'k', 1.4)
        R   = getattr(pt, 'R', 0.287)
    else:
        P   = pt["P"]
        T_K = pt["T"] + 273.15
        v   = pt["v"]
        h   = pt["h"]
        s   = pt["s"]
        cp  = pt.get("cp", 1.005)
        k   = pt.get("k", 1.4)
        R   = pt.get("R", 0.287)
    return P, T_K, v, h, s, cp, k, R


def _result(P_arr, T_K_arr, v_arr, h_arr, s_arr):
    """Pack arrays into a result dict (T in °C)."""
    return {
        'P': np.asarray(P_arr, dtype=float),
        'v': np.asarray(v_arr, dtype=float),
        'T': np.asarray(T_K_arr, dtype=float) - 273.15,
        'h': np.asarray(h_arr, dtype=float),
        's': np.asarray(s_arr, dtype=float),
    }


# ═════════════════════════════════════════════════════════════
#  IDEAL GAS PROCESS PATHS
# ═════════════════════════════════════════════════════════════

def isentropic_path(pt1, pt2, n=100):
    """
    Isentropic process for an ideal gas:  P * v^k = const.

    In P-v plane:  P = P1 * (v1 / v)^k       (curve, power law)
    In T-s plane:  vertical line  (s = const)
    In h-s plane:  vertical line  (s = const)
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    v_arr = np.linspace(v1, v2, n)
    P_arr = P1 * (v1 / v_arr) ** k
    T_K_arr = P_arr * v_arr * 100.0 / R       # ideal gas law: T = P*v*100/R  (P in bar→kPa)
    h_arr = h1 + cp * (T_K_arr - T1_K)
    s_arr = np.full(n, s1)                     # s = const

    # Force exact endpoints
    P_arr[0], P_arr[-1] = P1, P2
    T_K_arr[0], T_K_arr[-1] = T1_K, T2_K
    h_arr[0], h_arr[-1] = h1, h2
    return _result(P_arr, T_K_arr, v_arr, h_arr, s_arr)


def isochoric_path(pt1, pt2, n=100):
    """
    Isochoric process (v = const) for an ideal gas.

    In P-v plane:  vertical line  (v = const)
    In T-s plane:  T = T1 * exp( (s - s1) / cv )   with cv = cp - R
                   Equivalently:  s = s1 + cv * ln(T/T1)
    In h-s plane:  h = h1 + cp * (T - T1)  combined with T(s) above.
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    cv = cp - R

    s_arr = np.linspace(s1, s2, n)
    v_arr = np.full(n, v1)
    T_K_arr = T1_K * np.exp((s_arr - s1) / cv)
    h_arr = h1 + cp * (T_K_arr - T1_K)
    P_arr = R * T_K_arr * 100.0 / v1   # P in bar:  P = R*T_K / (v*100) → P = R*T_K/(v1*100)... 
    # Actually: P [kPa] = R [kJ/(kg·K)] * T [K] / v [m^3/kg],  P [bar] = P [kPa] / 100
    # So P = R * T_K / v / 100  ... wait, no. R*T_K/v is in kPa, divide by 100 for bar? No.
    # P [kPa] = R * T_K / v.  P [bar] = P [kPa] / 100.  So P [bar] = R * T_K / v / 100.
    # But v is in m^3/kg.  R is in kJ/(kg·K).  R*T_K gives kJ/kg.  R*T_K/v gives kPa.
    # P_bar = R * T_K / (v * 100)  ... no, P_bar = (R*T_K/v) / 100.
    # Hmm: P [bar] = P [Pa] / 1e5.  P [kPa] = P [Pa] / 1e3.  So P [bar] = P [kPa] / 100.
    # R [kJ/(kg·K)] * T [K] / v [m^3/kg] = [kPa].  So P_bar = R*T_K/(v*100).
    # But thermo.py uses: self.v = (self.R * self.T_K) / (P_bar * 100) 
    # → P_bar = R * T_K / (v * 100).  That's what I have.  OK.

    # Force exact endpoints
    P_arr = R * T_K_arr / (v1 * 100.0)
    P_arr[0], P_arr[-1] = P1, P2
    T_K_arr[0], T_K_arr[-1] = T1_K, T2_K
    h_arr[0], h_arr[-1] = h1, h2
    return _result(P_arr, T_K_arr, v_arr, h_arr, s_arr)


def isobaric_path(pt1, pt2, n=100):
    """
    Isobaric process (P = const) for an ideal gas.

    In P-v plane:  horizontal line  (P = const)
    In T-s plane:  T = T1 * exp( (s - s1) / cp )
                   Equivalently:  s = s1 + cp * ln(T/T1)
    In h-s plane:  h = h1 + cp * (T - T1)  combined with T(s).
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    s_arr = np.linspace(s1, s2, n)
    P_arr = np.full(n, P1)
    T_K_arr = T1_K * np.exp((s_arr - s1) / cp)
    h_arr = h1 + cp * (T_K_arr - T1_K)
    v_arr = R * T_K_arr / (P1 * 100.0)

    # Force exact endpoints
    P_arr[0], P_arr[-1] = P1, P2
    T_K_arr[0], T_K_arr[-1] = T1_K, T2_K
    h_arr[0], h_arr[-1] = h1, h2
    v_arr[0], v_arr[-1] = v1, v2
    return _result(P_arr, T_K_arr, v_arr, h_arr, s_arr)


def isothermal_path(pt1, pt2, n=100):
    """
    Isothermal process for an ideal gas:  P * v = const.

    In P-v plane:  P = P1 * v1 / v   (hyperbola)
    In T-s plane:  horizontal line  (T = const)
    In h-s plane:  h = const for ideal gas with constant cp.
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    v_arr = np.linspace(v1, v2, n)
    P_arr = P1 * v1 / v_arr
    T_K_arr = np.full(n, T1_K)
    h_arr = np.full(n, h1)
    s_arr = s1 + R * np.log(v_arr / v1)

    # Force exact endpoints
    P_arr[0], P_arr[-1] = P1, P2
    s_arr[0], s_arr[-1] = s1, s2
    return _result(P_arr, T_K_arr, v_arr, h_arr, s_arr)


def polytropic_path(pt1, pt2, n_exp=None, n=100):
    """
    Generalised polytropic process:  P * v^n = const.

    If n_exp is None, the exponent is inferred from the endpoints:
        n = ln(P1/P2) / ln(v2/v1)

    Curve shapes are identical to isentropic_path but with n instead of k.
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    if n_exp is None:
        if abs(v2 - v1) > 1e-15 and abs(P1 - P2) > 1e-15:
            n_exp = np.log(P1 / P2) / np.log(v2 / v1)
        elif abs(v2 - v1) < 1e-15:
            n_exp = np.inf   # isochoric
        else:
            n_exp = 0.0      # isobaric

    if np.isinf(n_exp):
        return isochoric_path(pt1, pt2, n)
    if abs(n_exp) < 1e-12:
        return isobaric_path(pt1, pt2, n)

    v_arr = np.linspace(v1, v2, n)
    P_arr = P1 * (v1 / v_arr) ** n_exp
    T_K_arr = P_arr * v_arr * 100.0 / R
    cv = cp - R
    # For polytropic: ds = cv * ln(T2/T1) + R * ln(v2/v1) — but we interpolate linearly in s
    # s(s) via the polytropic relation:
    # s(T, v) = s_ref + cv * ln(T/T_ref) + R * ln(v/v_ref)
    s_arr = s1 + cv * np.log(T_K_arr / T1_K) + R * np.log(v_arr / v1)
    h_arr = h1 + cp * (T_K_arr - T1_K)

    # Force exact endpoints
    P_arr[0], P_arr[-1] = P1, P2
    T_K_arr[0], T_K_arr[-1] = T1_K, T2_K
    h_arr[0], h_arr[-1] = h1, h2
    return _result(P_arr, T_K_arr, v_arr, h_arr, s_arr)


# ═════════════════════════════════════════════════════════════
#  AUTO-DETECTION FOR IDEAL GAS CYCLES
# ═════════════════════════════════════════════════════════════

def auto_ideal_gas_path(pt1, pt2, n=100):
    """
    Automatically detect the process type between two ideal-gas state
    points and return the correct path.

    Detection logic (with tolerances):
      |v2 - v1| / v1 < 0.1%  → isochoric
      |P2 - P1| / P1 < 0.1%  → isobaric
      |s2 - s1| < 1e-4       → isentropic
      otherwise              → polytropic (inferred exponent)
    """
    P1, T1_K, v1, h1, s1, cp, k, R = _props(pt1)
    P2, T2_K, v2, h2, s2, _,   _, _  = _props(pt2)

    dv_rel = abs(v2 - v1) / max(abs(v1), 1e-15)
    dp_rel = abs(P2 - P1) / max(abs(P1), 1e-15)
    ds_abs = abs(s2 - s1)

    if dv_rel < 1e-3:
        return isochoric_path(pt1, pt2, n)
    elif dp_rel < 1e-3:
        return isobaric_path(pt1, pt2, n)
    elif ds_abs < 1e-3:
        return isentropic_path(pt1, pt2, n)
    else:
        return polytropic_path(pt1, pt2, n_exp=None, n=n)


# ═════════════════════════════════════════════════════════════
#  REAL FLUID PATHS (IAPWS-97 for water, generic tables)
# ═════════════════════════════════════════════════════════════

class SimplePt:
    """Lightweight state point from an IAPWS97 or similar state object."""
    def __init__(self, st):
        self.P_bar = st.P * 10.0
        self.T_C   = st.T - 273.15
        self.h     = st.h
        self.s     = st.s
        self.v     = st.v
        self.x     = st.x
        self.phase = getattr(st, 'phase', None)


def iapws_isobaric_path(P_bar, h1, h2, n=100):
    """
    Isobaric path for water/steam using IAPWS-97.
    Follows constant pressure from h1 to h2, naturally crossing
    the saturation dome (the horizontal two-phase segment).

    Returns dict with 'P', 'v', 'T', 's', 'h' arrays.
    """
    from iapws import IAPWS97
    h_arr = np.linspace(h1, h2, n)
    P_MPa = P_bar / 10.0
    states = []
    for h_val in h_arr:
        try:
            st = IAPWS97(P=P_MPa, h=h_val)
            states.append(st)
        except Exception:
            states.append(None)

    valid = [(i, st) for i, st in enumerate(states) if st is not None]
    if len(valid) < 2:
        # Fallback: linear interpolation
        return _linear_fallback_path(h1, h2, P_bar, n)

    idx_arr = np.array([v[0] for v in valid])
    P_out   = np.array([v[1].P * 10.0 for v in valid])
    T_out   = np.array([v[1].T - 273.15 for v in valid])
    s_out   = np.array([v[1].s for v in valid])
    v_out   = np.array([v[1].v for v in valid])
    h_out   = np.array([v[1].h for v in valid])

    return {'P': P_out, 'v': v_out, 'T': T_out, 's': s_out, 'h': h_out}


def iapws_isentropic_path(s_const, P1_bar, P2_bar, n=100):
    """
    Isentropic path for water/steam using IAPWS-97.
    Follows constant entropy from P1 to P2.
    """
    from iapws import IAPWS97
    if P1_bar > 0 and P2_bar > 0:
        P_arr = np.geomspace(P1_bar, P2_bar, n)
    else:
        P_arr = np.linspace(P1_bar, P2_bar, n)

    states = []
    for p in P_arr:
        try:
            st = IAPWS97(P=p / 10.0, s=s_const)
            states.append(st)
        except Exception:
            states.append(None)

    valid = [(i, st) for i, st in enumerate(states) if st is not None]
    if len(valid) < 2:
        return None

    P_out = np.array([v[1].P * 10.0 for v in valid])
    T_out = np.array([v[1].T - 273.15 for v in valid])
    s_out = np.array([v[1].s for v in valid])
    v_out = np.array([v[1].v for v in valid])
    h_out = np.array([v[1].h for v in valid])

    return {'P': P_out, 'v': v_out, 'T': T_out, 's': s_out, 'h': h_out}


def iapws_isenthalpic_path(h_const, P1_bar, P2_bar, n=100):
    """
    Isenthalpic path for water/steam using IAPWS-97 (throttling valve).
    Follows constant enthalpy from P1 to P2.
    """
    from iapws import IAPWS97
    P_arr = np.linspace(P1_bar, P2_bar, n)

    states = []
    for p in P_arr:
        try:
            st = IAPWS97(P=p / 10.0, h=h_const)
            states.append(st)
        except Exception:
            states.append(None)

    valid = [(i, st) for i, st in enumerate(states) if st is not None]
    if len(valid) < 2:
        return None

    P_out = np.array([v[1].P * 10.0 for v in valid])
    T_out = np.array([v[1].T - 273.15 for v in valid])
    s_out = np.array([v[1].s for v in valid])
    v_out = np.array([v[1].v for v in valid])
    h_out = np.array([v[1].h for v in valid])

    return {'P': P_out, 'v': v_out, 'T': T_out, 's': s_out, 'h': h_out}


def iapws_auto_path(pt1, pt2, n=100):
    """
    Auto-detect process type for IAPWS-97 water/steam and return the
    correct path through the saturation dome.

    pt1, pt2: StatePoint-like objects with P_bar, h, s attributes.
    """
    dp = pt2.P_bar - pt1.P_bar
    ds = pt2.s - pt1.s
    dh = pt2.h - pt1.h

    is_isobaric   = abs(dp) < 1e-2
    is_isentropic = abs(ds) < 2e-2
    is_isenthalpic = abs(dh) < 1e-1

    if is_isobaric:
        return iapws_isobaric_path(pt1.P_bar, pt1.h, pt2.h, n)
    elif is_isentropic:
        return iapws_isentropic_path(pt1.s, pt1.P_bar, pt2.P_bar, n)
    elif is_isenthalpic:
        return iapws_isenthalpic_path(pt1.h, pt1.P_bar, pt2.P_bar, n)
    else:
        # Generic: linear interpolation in P-h
        return iapws_isobaric_path(pt1.P_bar, pt1.h, pt2.h, n) if abs(dp) < 1e-2 else _iapws_generic_path(pt1, pt2, n)


def _iapws_generic_path(pt1, pt2, n=100):
    """Fallback: interpolate linearly in P-h space using IAPWS."""
    from iapws import IAPWS97
    P_arr = np.linspace(pt1.P_bar, pt2.P_bar, n)
    h_arr = np.linspace(pt1.h, pt2.h, n)
    states = []
    for p, h in zip(P_arr, h_arr):
        try:
            st = IAPWS97(P=p / 10.0, h=h)
            states.append(st)
        except Exception:
            states.append(None)

    valid = [(i, st) for i, st in enumerate(states) if st is not None]
    if len(valid) < 2:
        return _linear_fallback_path(pt1.h, pt2.h, pt1.P_bar, n)

    P_out = np.array([v[1].P * 10.0 for v in valid])
    T_out = np.array([v[1].T - 273.15 for v in valid])
    s_out = np.array([v[1].s for v in valid])
    v_out = np.array([v[1].v for v in valid])
    h_out = np.array([v[1].h for v in valid])

    return {'P': P_out, 'v': v_out, 'T': T_out, 's': s_out, 'h': h_out}


def _linear_fallback_path(h1, h2, P_bar, n):
    """Simple linear fallback when IAPWS fails."""
    return {
        'P': np.full(n, P_bar),
        'v': np.full(n, np.nan),
        'T': np.full(n, np.nan),
        's': np.full(n, np.nan),
        'h': np.linspace(h1, h2, n),
    }


# ═════════════════════════════════════════════════════════════
#  SATURATION DOME PHASE CATCHER  (R134a tabulated)
# ═════════════════════════════════════════════════════════════

def r134a_isobaric_path(P_bar, s_start, s_end, n=100):
    """
    Isobaric path for R134a using interpolated saturation tables.

    If the entropy range crosses the saturation dome (sf < s < sg at
    this pressure), a horizontal (isothermal) segment is inserted
    representing the two-phase region.

    Returns dict with 'P', 'T', 's', 'h', 'v' arrays.
    """
    from core.thermo import r134a_T_from_P, r134a_sat

    T_sat = r134a_T_from_P(P_bar)
    sat = r134a_sat(T_sat)
    sf, sg = sat['sf'], sat['sg']
    hf, hg = sat['hf'], sat['hg']
    vf, vg = sat['vf'], sat['vg']

    # Determine if path crosses the dome
    crosses_dome = (s_start < sf < s_end) or (s_start > sg > s_end) or \
                   (sf <= s_start <= sg) or (sf <= s_end <= sg)

    if not crosses_dome:
        # Fully superheated or subcooled — approximate with linear T(s)
        s_arr = np.linspace(s_start, s_end, n)
        T_arr = np.full(n, T_sat)  # approximate: T ~ const at constant P for small ranges
        # Better: use cp_vap approximation
        cp_vap = 0.9
        if s_end > s_start:
            T_arr = T_sat * np.exp((s_arr - s_start) / cp_vap)
        else:
            T_arr = T_sat * np.exp((s_arr - s_start) / 1.2)  # cp_liq approx
        h_arr = np.linspace(
            _r134a_h_at_s(P_bar, s_start, sat),
            _r134a_h_at_s(P_bar, s_end, sat),
            n
        )
        v_arr = np.linspace(
            _r134a_v_at_s(P_bar, s_start, sat),
            _r134a_v_at_s(P_bar, s_end, sat),
            n
        )
        return {'P': np.full(n, P_bar), 'v': v_arr, 'T': T_arr, 's': s_arr, 'h': h_arr}

    # Path crosses dome — build three segments
    segments_s, segments_T, segments_h, segments_v = [], [], [], []

    n_seg = n // 3

    # Segment 1: subcooled / superheated to saturation boundary
    if s_start < sf:
        # Subcooled liquid entering dome
        s1 = np.linspace(s_start, sf, n_seg)
        T1 = np.full(n_seg, T_sat)
        h1 = np.linspace(_r134a_h_at_s(P_bar, s_start, sat), hf, n_seg)
        v1 = np.linspace(_r134a_v_at_s(P_bar, s_start, sat), vf, n_seg)
    elif s_start > sg:
        # Superheated vapor entering dome
        s1 = np.linspace(s_start, sg, n_seg)
        T1 = np.linspace(_r134a_T_at_s(P_bar, s_start, sat), T_sat, n_seg)
        h1 = np.linspace(_r134a_h_at_s(P_bar, s_start, sat), hg, n_seg)
        v1 = np.linspace(_r134a_v_at_s(P_bar, s_start, sat), vg, n_seg)
    else:
        # Starting inside dome
        x0 = max(0, min(1, (s_start - sf) / (sg - sf)))
        s1 = np.array([s_start])
        T1 = np.array([T_sat])
        h1 = np.array([hf + x0 * (hg - hf)])
        v1 = np.array([vf + x0 * (vg - vf)])

    segments_s.append(s1); segments_T.append(T1); segments_h.append(h1); segments_v.append(v1)

    # Segment 2: inside dome (horizontal, isothermal)
    s_dome_in = max(sf, min(sg, s_start))
    s_dome_out = max(sf, min(sg, s_end))
    s2 = np.linspace(s_dome_in, s_dome_out, n_seg)
    x2 = (s2 - sf) / (sg - sf)
    T2 = np.full(n_seg, T_sat)
    h2 = hf + x2 * (hg - hf)
    v2 = vf + x2 * (vg - vf)

    segments_s.append(s2); segments_T.append(T2); segments_h.append(h2); segments_v.append(v2)

    # Segment 3: leaving dome to superheated / subcooled
    if s_end > sg:
        s3 = np.linspace(sg, s_end, n_seg)
        T3 = np.linspace(T_sat, _r134a_T_at_s(P_bar, s_end, sat), n_seg)
        h3 = np.linspace(hg, _r134a_h_at_s(P_bar, s_end, sat), n_seg)
        v3 = np.linspace(vg, _r134a_v_at_s(P_bar, s_end, sat), n_seg)
    elif s_end < sf:
        s3 = np.linspace(sf, s_end, n_seg)
        T3 = np.full(n_seg, T_sat)
        h3 = np.linspace(hf, _r134a_h_at_s(P_bar, s_end, sat), n_seg)
        v3 = np.linspace(vf, _r134a_v_at_s(P_bar, s_end, sat), n_seg)
    else:
        x_end = max(0, min(1, (s_end - sf) / (sg - sf)))
        s3 = np.array([s_end])
        T3 = np.array([T_sat])
        h3 = np.array([hf + x_end * (hg - hf)])
        v3 = np.array([vf + x_end * (vg - vf)])

    segments_s.append(s3); segments_T.append(T3); segments_h.append(h3); segments_v.append(v3)

    return {
        'P': np.full(n, P_bar),
        'v': np.concatenate(segments_v)[:n],
        'T': np.concatenate(segments_T)[:n],
        's': np.concatenate(segments_s)[:n],
        'h': np.concatenate(segments_h)[:n],
    }


def r134a_isenthalpic_path(h_const, P_start, P_end, n=100):
    """
    Isenthalpic throttling path for R134a.
    For the refrigeration cycle expansion valve.
    h = const, P varies from P_start to P_end.
    """
    from core.thermo import r134a_T_from_P, r134a_sat

    P_arr = np.linspace(P_start, P_end, n)
    s_arr = np.zeros(n)
    T_arr = np.zeros(n)

    for i, p in enumerate(P_arr):
        T_sat = r134a_T_from_P(p)
        sat = r134a_sat(T_sat)
        hf, hg = sat['hf'], sat['hg']
        sf, sg = sat['sf'], sat['sg']

        if h_const <= hf:
            # Subcooled liquid
            s_arr[i] = sf - 0.004 * (hf - h_const) / 1.2
            T_arr[i] = T_sat - (hf - h_const) / 1.2
        elif h_const >= hg:
            # Superheated vapor
            s_arr[i] = sg + 0.003 * (h_const - hg) / 0.9
            T_arr[i] = T_sat + (h_const - hg) / 0.9
        else:
            # Two-phase
            x = (h_const - hf) / (hg - hf)
            s_arr[i] = sf + x * (sg - sf)
            T_arr[i] = T_sat

    return {
        'P': P_arr,
        'v': np.full(n, np.nan),
        'T': T_arr,
        's': s_arr,
        'h': np.full(n, h_const),
    }


def _r134a_h_at_s(P_bar, s_val, sat):
    """Approximate h at given entropy for R134a at a given pressure."""
    sf, sg = sat['sf'], sat['sg']
    hf, hg = sat['hf'], sat['hg']
    if s_val <= sf:
        return hf - 1.2 * (sf - s_val) / 0.004 if s_val < sf else hf
    elif s_val >= sg:
        return hg + 0.9 * (s_val - sg) / 0.003 if s_val > sg else hg
    else:
        x = (s_val - sf) / (sg - sf)
        return hf + x * (hg - hf)


def _r134a_v_at_s(P_bar, s_val, sat):
    """Approximate v at given entropy for R134a at a given pressure."""
    sf, sg = sat['sf'], sat['sg']
    vf, vg = sat['vf'], sat['vg']
    if s_val <= sf:
        return vf
    elif s_val >= sg:
        return vg
    else:
        x = (s_val - sf) / (sg - sf)
        return vf + x * (vg - vf)


def _r134a_T_at_s(P_bar, s_val, sat):
    """Approximate T at given entropy for R134a at a given pressure."""
    from core.thermo import r134a_T_from_P
    sf, sg = sat['sf'], sat['sg']
    T_sat = r134a_T_from_P(P_bar)
    if sf <= s_val <= sg:
        return T_sat
    elif s_val > sg:
        return T_sat + (s_val - sg) * 300  # rough T(s) for superheated
    else:
        return T_sat - (sf - s_val) * 250  # rough T(s) for subcooled


# ═════════════════════════════════════════════════════════════
#  DIRECTION ARROW UTILITY
# ═════════════════════════════════════════════════════════════

def add_direction_arrow(ax, x_arr, y_arr, color='white', size=14, position=0.5,
                        arrowstyle='->', linewidth=1.5):
    """
    Add a direction arrow along a plotted path.

    Parameters:
        ax         : matplotlib Axes
        x_arr, y_arr : arrays of the path coordinates
        color      : arrow color
        size       : arrow head size
        position   : fraction along the path (0=start, 1=end, 0.5=midpoint)
        arrowstyle : matplotlib arrow style
        linewidth  : arrow line width
    """
    n = len(x_arr)
    if n < 2:
        return

    idx = int(position * (n - 1))
    idx = max(1, min(idx, n - 2))

    # Arrow direction from local tangent
    dx = x_arr[idx + 1] - x_arr[idx - 1]
    dy = y_arr[idx + 1] - y_arr[idx - 1]

    # Use log scale if axis is log-scaled
    if ax.get_xscale() == 'log':
        cx = np.exp((np.log(max(x_arr[idx - 1], 1e-30)) + np.log(max(x_arr[idx + 1], 1e-30))) / 2)
    else:
        cx = (x_arr[idx - 1] + x_arr[idx + 1]) / 2

    if ax.get_yscale() == 'log':
        cy = np.exp((np.log(max(y_arr[idx - 1], 1e-30)) + np.log(max(y_arr[idx + 1], 1e-30))) / 2)
    else:
        cy = (y_arr[idx - 1] + y_arr[idx + 1]) / 2

    # Scale arrow length relative to data range
    ax.annotate('', xy=(cx + dx * 0.3, cy + dy * 0.3),
                xytext=(cx - dx * 0.3, cy - dy * 0.3),
                arrowprops=dict(arrowstyle=arrowstyle, color=color,
                                lw=linewidth, mutation_scale=size))


def add_cycle_arrows(ax, paths, colors=None, positions=None, size=14):
    """
    Add direction arrows to each segment of a cycle.

    Parameters:
        ax        : matplotlib Axes
        paths     : list of path dicts (each with 'P', 'v', 'T', 's', 'h')
        colors    : list of colors (one per path), or None for white
        positions : list of fractional positions (0-1), or None for 0.5
        size      : arrow head size
    """
    if colors is None:
        colors = ['white'] * len(paths)
    if positions is None:
        positions = [0.5] * len(paths)

    for path, col, pos in zip(paths, colors, positions):
        # Determine which coordinates to use based on what the axes show
        # We need to know which diagram we're in.  The caller should provide
        # x_key and y_key or we can try to detect it.
        # For now, we pass the full path and the axes will project.
        pass  # This is handled by the calcolatore-level add_arrow calls


def _get_diagram_coords(path, diagram_type):
    """
    Extract (x, y) arrays from a path dict for a specific diagram type.

    diagram_type: 'P-v', 'T-s', 'h-s', 'T-P', 'T-v', 'P-h'
    """
    if diagram_type == "P-v":
        return path['v'], path['P']
    elif diagram_type == "T-s":
        return path['s'], path['T']
    elif diagram_type == "h-s":
        return path['s'], path['h']
    elif diagram_type == "T-P":
        return path['P'], path['T']
    elif diagram_type == "T-v":
        return path['v'], path['T']
    elif diagram_type == "P-h":
        return path['h'], path['P']
    else:
        return path['s'], path['T']
