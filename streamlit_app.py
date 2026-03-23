import streamlit as st
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from iapws import IAPWS97
from streamlit_javascript import st_javascript

st.set_page_config(page_title="TermoWeb UI", page_icon="⚡", layout="wide")
plt.style.use('dark_background')

# --- CUSTOM CSS FOR HEADER ---
st.markdown("""
    <style>
    .reportview-container .main .block-container {
        padding-top: 1rem;
        padding-bottom: 0rem;
    }
    .stApp {
        background-color: #0e1117;
    }
    h1 {
        margin-top: -60px;
        color: #00d4ff;
        text-shadow: 0 0 10px rgba(0,212,255,0.5);
    }
    .subtitle {
        color: #88c0d0;
        font-size: 1.2rem;
        margin-bottom: 2rem;
    }
    </style>
    """, unsafe_allow_html=True)

# --- i18n ---
def get_browser_lang():
    try:
        lang = st_javascript("window.navigator.language;")
        if lang:
            return "it" if lang.lower().startswith("it") else "en"
    except:
        pass
    return "en" # Fallback per sicurezza

blang = get_browser_lang()
if "app_lang" not in st.session_state:
    st.session_state["app_lang"] = blang if blang else "en"

st.sidebar.header("🌍 Language / Lingua")
lang_choice = st.sidebar.radio(
    "", 
    options=["English (en)", "Italiano (it)"], 
    index=1 if st.session_state["app_lang"] == "it" else 0
)
lang = "it" if "Italiano" in lang_choice else "en"
st.session_state["app_lang"] = lang

dict_t = {
    "en": {
        "main_title": "⚡ Thermodynamic Cycles - Web Suite",
        "subtitle": "Educational Web Application for Ideal and Real Thermodynamic Cycles.",
        "author": "Created by **Prof. Ing. Andrea Viola** | For educational purposes only.",
        "sidebar_head": "⚙️ Settings",
        "select_cycle": "Select Cycle:",
        "inputs": "Input Parameters",
        "results": "Results",
        "plots": "Diagrams & Schematics",
        "net_work": "Net Work",
        "efficiency": "Thermal Efficiency",
        "heat_in": "Heat In (Qin)",
        "heat_out": "Heat Out (Qout)",
        "pmax": "Max Pressure",
        "comp_ratio": "Compression Ratio (r)",
        "k_exp": "k Exponent",
        "eta_is": "Isentropic η",
        "ideal": "Ideal",
        "real": "Real",
        "bwr": "BWR",
        "p_evap": "Evap Pressure (bar)",
        "p_cond": "Cond Pressure (bar)",
        "t_max": "Max Temp (°C)",
    },
    "it": {
        "main_title": "⚡ Cicli Termodinamici - Suite Web",
        "subtitle": "Applicazione didattica per l'analisi dei cicli termodinamici ideali e reali.",
        "author": "Creato dal **Prof. Ing. Andrea Viola** | Esclusivamente per scopi didattici.",
        "sidebar_head": "⚙️ Impostazioni",
        "select_cycle": "Seleziona il Ciclo:",
        "inputs": "Parametri di Input",
        "results": "Risultati Principali",
        "plots": "Diagrammi e Schema Impianto",
        "net_work": "Lavoro Netto",
        "efficiency": "Rendimento Termico",
        "heat_in": "Calore In (Qin)",
        "heat_out": "Calore Out (Qout)",
        "pmax": "Pressione Max",
        "comp_ratio": "Rapp. Compressione (r)",
        "k_exp": "Esponente k",
        "eta_is": "η isentropico",
        "ideal": "Ideale",
        "real": "Reale",
        "bwr": "BWR (L_comp/L_turb)",
        "p_evap": "P Evaporatore (bar)",
        "p_cond": "P Condensatore (bar)",
        "t_max": "Temp. Max Surrisc. (°C)",
        "thermocad": "🛠️ ThermoCAD (Ciclo Libero)",
        "add_pt": "Aggiungi Punto",
        "clear": "Azzera Ciclo",
    }
}
t = dict_t[lang]

# --- MAIN HEADER ---
st.markdown(f"<h1>{t['main_title']}</h1>", unsafe_allow_html=True)
st.markdown(f"<p class='subtitle'>{t['subtitle']}</p>", unsafe_allow_html=True)
st.markdown(f"*{t['author']}*")
st.divider()

# --- SIDEBAR (INPUT) ---
st.sidebar.header(t["sidebar_head"])
c_list = [
    "💧 Rankine (Vapore/Water)",
    "🔥 Brayton (Gas Turb.)",
    "⚙️ Otto",
    "🛢️ Diesel",
    "❄️ Frigorifero (Refrigeration)",
    "🛠️ ThermoCAD (Custom)"
]
ciclo = st.sidebar.radio(t["select_cycle"], c_list)

# --- SESSION STATE FOR THERMOCAD ---
if "cad_points" not in st.session_state:
    st.session_state["cad_points"] = []
if "cad_components" not in st.session_state:
    st.session_state["cad_components"] = []

def get_iapws_robust(**args):
    try:
        return IAPWS97(**args)
    except:
        return None


# --- HELPERS SCHEMATICS ---
def draw_rankine_schema(p1, p2, p3, p4, t):
    fig_s, ax = plt.subplots(figsize=(6, 5))
    ax.set_facecolor('#1e1e1e')
    ax.axis('off')
    ax.set_xlim(0, 10.5)
    ax.set_ylim(-2, 11)
    
    red_c, blue_c, orange_c, cyan_c = '#ff4d4d', '#4da6ff', '#ffb347', '#00ffff'
    fg = 'white'
    
    boiler = patches.Rectangle((1.5, 3.5), 2.5, 4.5, fill=True, color='#2c1e1e', ec=red_c, lw=2)
    ax.add_patch(boiler)
    ax.text(2.75, 5.75, "Boiler\nCaldaia", color=red_c, ha='center', va='center', weight='bold')

    # Turbine (trapezoid)
    turbine = patches.Polygon([(6.5, 7.5), (7.8, 6.8), (7.8, 4.2), (6.5, 3.5)], fill=True, color='#2f2214', ec=orange_c, lw=2)
    ax.add_patch(turbine)
    ax.text(7.15, 8.2, "Turbine", color=orange_c, ha='center', weight='bold')

    cond = patches.Circle((7.15, 1.5), 0.8, fill=True, color='#1a2433', ec=blue_c, lw=2)
    ax.add_patch(cond)
    ax.text(8.8, 1.5, "Condenser", color=blue_c, ha='center', va='center', weight='bold')

    pump = patches.Circle((4, 0.5), 0.5, fill=True, color='#1a3333', ec=cyan_c, lw=2)
    ax.add_patch(pump)
    ax.text(4, 1.5, "Pump", color=cyan_c, ha='center', weight='bold')

    # Pipes & Points
    ax.plot([3.5, 2.75, 2.75], [0.5, 0.5, 3.5], color=cyan_c, lw=2) # 1->2
    ax.plot([2.75, 2.75, 6.5, 6.5], [8.0, 9.5, 9.5, 7.5], color=red_c, lw=2) # 2->3
    ax.plot([7.15, 7.15], [5.5, 2.3], color=orange_c, lw=2) # 3->4
    ax.plot([6.35, 4.5, 4.5, 4.0], [1.5, 1.5, 0.5, 0.5], color=blue_c, lw=2) # 4->1

    def annot(x, y, lbl, p):
        txt = f"[{lbl}]\nP:{p.P*10:.2f}\nT:{p.T-273.15:.1f}"
        ax.text(x, y, txt, color=fg, fontsize=7, bbox=dict(boxstyle="round,pad=0.2", fc='#1e1e1e', ec=fg, alpha=0.7))

    annot(4.5, 0.5, "1", p1)
    annot(2.75, 2.0, "2", p2)
    annot(4.5, 9.7, "3", p3)
    annot(7.3, 3.5, "4", p4)
    
    return fig_s

def draw_brayton_schema(p1, p2r, p3, p4r, t):
    fig_s, ax = plt.subplots(figsize=(6, 5))
    ax.set_facecolor('#1e1e1e')
    ax.axis('off')
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    fg = 'white'

    ax.plot([0.3, 0.9], [0.4, 0.4], color='gray', linewidth=4, zorder=1)
    ax.text(0.6, 0.35, "SHAFT / ALBERO", color='white', weight='bold', ha='center', fontsize=9)

    ax.plot([0.35, 0.35, 0.45], [0.5, 0.8, 0.8], color='#555555', linewidth=10, zorder=1)
    ax.plot([0.55, 0.65, 0.65], [0.8, 0.8, 0.5], color='#555555', linewidth=10, zorder=1)

    comp = patches.Polygon([[0.2, 0.3], [0.2, 0.7], [0.4, 0.6], [0.4, 0.4]], closed=True, color='#2196F3', zorder=2)
    ax.add_patch(comp)
    ax.text(0.3, 0.5, "COMPR", color='white', weight='bold', ha='center', va='center', rotation=90)

    turb = patches.Polygon([[0.6, 0.4], [0.6, 0.6], [0.8, 0.7], [0.8, 0.3]], closed=True, color='#4CAF50', zorder=2)
    ax.add_patch(turb)
    ax.text(0.7, 0.5, "TURBINE", color='white', weight='bold', ha='center', va='center', rotation=-90)

    cc = patches.Rectangle((0.4, 0.7), 0.2, 0.2, color='#FFCA28', zorder=2)
    ax.add_patch(cc)
    ax.text(0.5, 0.8, "COMBUSTION", color='black', weight='bold', ha='center', va='center')
    
    def annot(x, y, lbl, p):
        txt = f"{lbl}\nP:{p['P']:.1f}\nT:{p['T']:.0f}"
        ax.text(x, y, txt, color=fg, fontsize=7, bbox=dict(boxstyle="round,pad=0.2", fc='#1e1e1e', ec=fg, alpha=0.7))

    annot(0.1, 0.5, "1", p1)
    annot(0.35, 0.9, "2", p2r)
    annot(0.65, 0.9, "3", p3)
    annot(0.9, 0.5, "4", p4r)
    
    return fig_s

def draw_otto_diesel_schema(is_diesel=False):
    fig_s, ax = plt.subplots(figsize=(6, 4))
    ax.set_facecolor('#1e1e1e')
    ax.axis('off')
    # Simple piston/cylinder representation
    ax.add_patch(patches.Rectangle((0.3, 0.2), 0.4, 0.6, fill=False, color='white', lw=3))
    piston_y = 0.3 if is_diesel else 0.4
    ax.add_patch(patches.Rectangle((0.3, piston_y), 0.4, 0.1, color='gray'))
    ax.plot([0.5, 0.5], [piston_y, 0.05], color='gray', lw=5)
    ax.text(0.5, 0.9, "Diesel Cycle" if is_diesel else "Otto Cycle", color='white', ha='center', weight='bold')
    return fig_s



# =====================================================================
# RANKINE
# =====================================================================
if "Rankine" in ciclo:
    st.header("💧 Rankine / Hirsch (Steam Cycle)")
    
    st.sidebar.subheader(t["inputs"])
    p_evap = st.sidebar.number_input(t["p_evap"], value=50.0)
    p_cond = st.sidebar.number_input(t["p_cond"], value=0.08)
    t_max = st.sidebar.number_input(t["t_max"], value=400.0)
    eta_p = st.sidebar.number_input("η Pompa/Pump", value=0.85)
    eta_t = st.sidebar.number_input("η Turbina/Turb", value=0.85)

    try:
        pt1 = IAPWS97(P=p_cond/10, x=0)
        h1 = pt1.h; s1 = pt1.s; T1 = pt1.T - 273.15
        
        pt2s = IAPWS97(P=p_evap/10, s=s1)
        l_p = (pt2s.h - h1) / eta_p
        h2 = h1 + l_p
        pt2 = IAPWS97(P=p_evap/10, h=h2)
        T2 = pt2.T - 273.15; s2 = pt2.s

        sat_vap = IAPWS97(P=p_evap/10, x=1)
        T_sat = sat_vap.T - 273.15
        if t_max < T_sat:
            pt3 = sat_vap; T3 = T_sat
        else:
            pt3 = IAPWS97(P=p_evap/10, T=t_max+273.15)
            T3 = t_max
        h3 = pt3.h; s3 = pt3.s

        pt4s = IAPWS97(P=p_cond/10, s=s3)
        l_t = (h3 - pt4s.h) * eta_t
        h4 = h3 - l_t
        pt4 = IAPWS97(P=p_cond/10, h=h4)
        T4 = pt4.T - 273.15; s4 = pt4.s

        q_in = h3 - h2
        l_net = l_t - l_p
        eta_ciclo = (l_net / q_in) * 100 if q_in > 0 else 0

        # UI LAYOUT
        col_res, col_plot, col_schema = st.columns([1, 1.5, 1.5])
        
        with col_res:
            st.subheader(t["results"])
            st.metric(t["net_work"], f"{l_net:.1f} kJ/kg")
            st.metric(t["efficiency"], f"{eta_ciclo:.2f} %")
            st.write(f"**L_turb:** {l_t:.1f} kJ/kg")
            st.write(f"**L_pump:** {l_p:.1f} kJ/kg")
            st.write(f"**{t['heat_in']}:** {q_in:.1f} kJ/kg")

        with col_plot:
            st.subheader(t["plots"])
            tab_ts, tab_pv, tab_hs = st.tabs(["T-s", "P-v", "h-s"])
            
            # --- T-s ---
            with tab_ts:
                fig, ax = plt.subplots(figsize=(6, 5))
                ax.set_title("T-s Diagram")
                ss_f, ss_g, tt_sat = [], [], []
                for tc in np.linspace(0.1, 373.9, 100):
                    try:
                        s_l = IAPWS97(T=tc+273.15, x=0).s; s_v = IAPWS97(T=tc+273.15, x=1).s
                        ss_f.append(s_l); ss_g.append(s_v); tt_sat.append(tc)
                    except: pass
                ax.fill_betweenx(tt_sat, ss_f, ss_g, color='#1a3a4a', alpha=0.3)
                ax.plot(ss_f, tt_sat, color='#50c8e8', lw=1.2); ax.plot(ss_g, tt_sat, color='#50c8e8', lw=1.2)
                ax.plot([s1, s2, pt2s.s, s3, s3, s1], [T1, T2, pt2s.T-273.15, T3, pt4s.T-273.15, T1], '--', color='gray', label=t["ideal"])
                ax.plot([s1, s2], [T1, T2], '-', color='orange', label="Pump")
                ax.plot([s2, s3], [T2, T3], '-', color='red', label="Boiler")
                ax.plot([s3, s4], [T3, T4], '-', color='cyan', label="Turbine")
                ax.plot([s4, s1], [T4, T1], '-', color='blue', label="Condenser")
                ax.legend(fontsize=7); st.pyplot(fig)

            # --- P-v ---
            with tab_pv:
                fig, ax = plt.subplots(figsize=(6, 5))
                ax.set_title("P-v Diagram")
                vv_f, vv_g, tt_v = [], [], []
                for tc in np.linspace(0.1, 373.9, 100):
                    try:
                        v_l = IAPWS97(T=tc+273.15, x=0).v; v_v = IAPWS97(T=tc+273.15, x=1).v
                        vv_f.append(v_l); vv_g.append(v_v); tt_v.append(IAPWS97(T=tc+273.15, x=0).P*10)
                    except: pass
                ax.fill_betweenx(tt_v, vv_f, vv_g, color='#1a3a4a', alpha=0.3)
                ax.plot(vv_f, tt_v, color='#50c8e8', lw=1.2); ax.plot(vv_g, tt_v, color='#50c8e8', lw=1.2)
                ax.set_xscale('log'); ax.set_yscale('log')
                ax.plot([pt1.v, pt2.v, pt3.v, pt4.v, pt1.v], [p_cond, p_evap, p_evap, p_cond, p_cond], '-', color='cyan', label=t['real'])
                st.pyplot(fig)
            
            with tab_hs:
                fig, ax = plt.subplots(figsize=(6, 5))
                ax.set_title("Mollier (h-s) Diagram")
                ax.plot(ss_f, [IAPWS97(T=tc+273.15, x=0).h for tc in tt_sat], color='#50c8e8')
                ax.plot(ss_g, [IAPWS97(T=tc+273.15, x=1).h for tc in tt_sat], color='#50c8e8')
                ax.plot([s1, s2, s3, s4, s1], [h1, h2, h3, h4, h1], '-', color='red', label=t['real'])
                st.pyplot(fig)

        with col_schema:
            st.subheader("Schema / Plant Layout")
            st.pyplot(draw_rankine_schema(pt1, pt2, pt3, pt4, t))
            
    except Exception as e:
        st.error(f"Error IAPWS: {e}")

# =====================================================================
# BRAYTON
# =====================================================================
elif "Brayton" in ciclo:
    st.header("🔥 Brayton (Gas Turbine)")
    
    st.sidebar.subheader(t["inputs"])
    P1 = st.sidebar.number_input("P1 (bar)", value=1.0)
    P2 = st.sidebar.number_input("P2 (bar)", value=12.0)
    T1 = st.sidebar.number_input("T1 Min (°C)", value=15.0)
    T3 = st.sidebar.number_input(t["t_max"], value=1100.0)
    eta_c = st.sidebar.number_input("η Compr.", value=0.85)
    eta_t = st.sidebar.number_input("η Turb.", value=0.88)

    cp = 1.005; k = 1.4
    beta_c = P2 / P1
    T1_K = T1 + 273.15; T3_K = T3 + 273.15
    
    T2s_K = T1_K * (beta_c**((k-1)/k))
    T2_K = T1_K + (T2s_K - T1_K) / eta_c
    T4s_K = T3_K / (beta_c**((k-1)/k))
    T4_K = T3_K - eta_t * (T3_K - T4s_K)

    l_c = cp * (T2_K - T1_K)
    l_t = cp * (T3_K - T4_K)
    l_net = l_t - l_c
    q_in = cp * (T3_K - T2_K)
    eta_ciclo = (l_net / q_in) * 100 if q_in > 0 else 0
    bwr = (l_c / l_t) * 100 if l_t > 0 else 0

    col_res, col_plot, col_schema = st.columns([1, 1.5, 1.5])
    with col_res:
        st.subheader(t["results"])
        st.metric(t["net_work"], f"{l_net:.1f} kJ/kg")
        st.metric(t["efficiency"], f"{eta_ciclo:.2f} %")
        st.write(f"**β Ratio:** {beta_c:.2f}")
        st.write(f"**{t['bwr']}:** {bwr:.1f} %")
        st.write(f"**{t['heat_in']}:** {q_in:.1f} kJ/kg")

    with col_plot:
        st.subheader(t["plots"])
        tab_ts, tab_pv, tab_hs = st.tabs(["T-s", "P-v", "h-s"])
        with tab_ts:
            fig, ax = plt.subplots(figsize=(6, 5))
            ax.set_title("T-s Diagram")
            def entropy(T_K, P_b): return cp * np.log(T_K/273.15) - 0.287 * np.log(P_b/1.0)
            s1 = entropy(T1_K, P1); s2 = entropy(T2_K, P2); s3 = entropy(T3_K, P2); s4 = entropy(T4_K, P1)
            T2s_C, T4s_C = T2s_K-273.15, T4s_K-273.15
            ax.plot([s1, s1, s3, s3, s1], [T1, T2s_C, T3, T4s_C, T1], '--', color='gray', label=t["ideal"])
            ax.plot([s1, s2], [T1, T2_K-273.15], '-', color='orange', label="Compr")
            ax.plot([s2, s3], [T2_K-273.15, T3], '-', color='red', label="Combust.")
            ax.plot([s3, s4], [T3, T4_K-273.15], '-', color='cyan', label="Turbine")
            ax.plot([s4, s1], [T4_K-273.15, T1], '-', color='blue', label="Exhaust")
            ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
            ax.legend(loc="upper left"); st.pyplot(fig)
        
        with tab_pv:
            fig, ax = plt.subplots(figsize=(6, 5))
            ax.set_title("P-v Diagram")
            v1 = 0.287 * T1_K / (P1*100); v2 = 0.287 * T2_K / (P2*100)
            v3 = 0.287 * T3_K / (P2*100); v4 = 0.287 * T4_K / (P1*100)
            ax.plot([v1, v2, v3, v4, v1], [P1, P2, P2, P1, P1], '-o', color='cyan')
            ax.set_xlabel("v (m³/kg)"); ax.set_ylabel("P (bar)")
            st.pyplot(fig)

        with tab_hs:
            fig, ax = plt.subplots(figsize=(6, 5))
            ax.set_title("h-s Diagram")
            h1 = cp*T1_K; h2 = cp*T2_K; h3 = cp*T3_K; h4 = cp*T4_K
            ax.plot([s1, s2, s3, s4, s1], [h1, h2, h3, h4, h1], '-o', color='red')
            ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("h (kJ/kg)")
            st.pyplot(fig)

    with col_schema:
        st.subheader("Schema / Plant Layout")
        p1d = {'P':P1, 'T':T1}; p2d = {'P':P2, 'T':T2_K-273.15}
        p3d = {'P':P2, 'T':T3}; p4d = {'P':P1, 'T':T4_K-273.15}
        st.pyplot(draw_brayton_schema(p1d, p2d, p3d, p4d, t))

# =====================================================================
# OTTO
# =====================================================================
elif "Otto" in ciclo:
    st.header("⚙️ Otto (Spark Ignition)")
    
    st.sidebar.subheader(t["inputs"])
    P1 = st.sidebar.number_input("P1 (bar)", value=1.0)
    T1 = st.sidebar.number_input("T1 (°C)", value=20.0)
    r = st.sidebar.number_input(t["comp_ratio"], value=9.0)
    T3 = st.sidebar.number_input(t["t_max"], value=1200.0)
    k = st.sidebar.number_input(t["k_exp"], value=1.4)
    cv = st.sidebar.number_input("cv (kJ/kgK)", value=0.718)
    eta = st.sidebar.number_input(t["eta_is"], value=0.85)

    R_gas = cv * (k - 1); cp = cv * k
    T1_K = T1 + 273.15; T3_K = T3 + 273.15
    v1 = (R_gas * T1_K) / (P1 * 100); v2 = v1 / r
    T2s_K = T1_K * (r**(k-1)); T2_K = T1_K + (T2s_K - T1_K) / eta
    P2_bar = P1 * (T2_K / T1_K) * (v1 / v2)
    P3_bar = P2_bar * (T3_K / T2_K); v3 = v2
    T4s_K = T3_K * ((1/r)**(k-1)); T4_K = T3_K - eta * (T3_K - T4s_K)
    P4_bar = P3_bar * (T4_K / T3_K) * (v3 / v1)

    qin = cv * (T3_K - T2_K)
    qout = cv * (T4_K - T1_K)
    wnet = qin - qout
    thermal_eta = (wnet / qin) * 100 if qin > 0 else 0

    col_res, col_plot, col_schema = st.columns([1, 1.5, 1.5])
    with col_res:
        st.subheader(t["results"])
        st.metric(t["net_work"], f"{wnet:.1f} kJ/kg")
        st.metric(t["efficiency"], f"{thermal_eta:.2f} %")
        st.write(f"**{t['pmax']}:** {P3_bar:.2f} bar")

    with col_plot:
        tab_pv, tab_ts = st.tabs(["P-v", "T-s"])
        with tab_pv:
            st.subheader("P-v Diagram")
            fig, ax = plt.subplots(figsize=(6, 5))
            v_c = np.linspace(v2, v1, 50)
            ax.plot(v_c, P1*(v1/v_c)**k, '--', color='gray', label=t["ideal"])
            ax.plot(v_c, P3_bar*(v3/v_c)**k, '--', color='gray')
            ax.plot(v_c, P1*(v1/v_c)**1.35, '-', color='orange', label=t["real"])
            ax.plot([v2, v2], [P1*(v1/v2)**1.35, P3_bar], '-', color='red')
            ax.plot(v_c, P3_bar*(v3/v_c)**1.35, '-', color='cyan')
            ax.plot([v1, v1], [P3_bar*(v3/v1)**1.35, P1], '-', color='blue')
            ax.set_xlabel("v (m³/kg)"); ax.set_ylabel("P (bar)")
            ax.legend(); st.pyplot(fig)
        
        with tab_ts:
            st.subheader("T-s Diagram")
            fig, ax = plt.subplots(figsize=(6, 5))
            def s_otto(T_K, v): return cv * np.log(T_K/273.15) + R_gas * np.log(v/v1)
            ss1 = s_otto(T1_K, v1); ss2 = s_otto(T2_K, v2); ss3 = s_otto(T3_K, v3); ss4 = s_otto(T4_K, v1)
            ax.plot([ss1, ss2, ss3, ss4, ss1], [T1, T2_K-273.15, T3, T4_K-273.15, T1], '-o', color='cyan')
            ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
            st.pyplot(fig)
    
    with col_schema:
        st.subheader("Schema")
        st.pyplot(draw_otto_diesel_schema(False))


# =====================================================================
# DIESEL
# =====================================================================
elif "Diesel" in ciclo:
    st.header("🛢️ Diesel (Compression Ignition)")
    
    st.sidebar.subheader(t["inputs"])
    P1 = st.sidebar.number_input("P1 (bar)", value=1.0)
    T1 = st.sidebar.number_input("T1 (°C)", value=20.0)
    r = st.sidebar.number_input(t["comp_ratio"], value=18.0)
    rc = st.sidebar.number_input("Injection Ratio (rc)", value=2.0)
    k = st.sidebar.number_input(t["k_exp"], value=1.4)
    cv = st.sidebar.number_input("cv (kJ/kgK)", value=0.718)
    eta = st.sidebar.number_input(t["eta_is"], value=0.85)

    R_gas = cv * (k - 1); cp = cv * k
    T1_K = T1 + 273.15
    v1 = (R_gas * T1_K) / (P1 * 100); v2 = v1 / r
    T2s_K = T1_K * (r**(k-1)); T2_K = T1_K + (T2s_K - T1_K) / eta
    P2_bar = P1 * (T2_K / T1_K) * (v1 / v2); P3_bar = P2_bar
    v3 = v2 * rc; T3_K = T2_K * rc
    T4s_K = T3_K * ((v3/v1)**(k-1)); T4_K = T3_K - eta * (T3_K - T4s_K)
    P4_bar = P3_bar * (T4_K / T3_K) * (v3 / v1)

    qin = cp * (T3_K - T2_K); qout = cv * (T4_K - T1_K)
    wnet = qin - qout
    thermal_eta = (wnet / qin) * 100 if qin > 0 else 0

    col_res, col_plot, col_schema = st.columns([1, 1.5, 1.5])
    with col_res:
        st.subheader(t["results"])
        st.metric(t["net_work"], f"{wnet:.1f} kJ/kg")
        st.metric(t["efficiency"], f"{thermal_eta:.2f} %")
        st.write(f"**{t['pmax']}:** {P3_bar:.2f} bar")

    with col_plot:
        tab_pv, tab_ts = st.tabs(["P-v", "T-s"])
        with tab_pv:
            st.subheader("P-v Diagram")
            fig, ax = plt.subplots(figsize=(6, 5))
            v_c = np.linspace(v2, v1, 50); v_e = np.linspace(v3, v1, 50)
            ax.plot(v_c, P1*(v1/v_c)**k, '--', color='gray', label=t["ideal"])
            ax.plot(v_c, P1*(v1/v_c)**1.35, '-', color='orange', label=t["real"])
            ax.plot([v2, v3], [P3_bar, P3_bar], '-', color='red')
            ax.plot(v_e, P3_bar*(v3/v_e)**1.35, '-', color='cyan')
            ax.plot([v1, v1], [P3_bar*(v3/v1)**1.35, P1], '-', color='blue')
            ax.set_xlabel("v (m³/kg)"); ax.set_ylabel("P (bar)")
            ax.legend(); st.pyplot(fig)
        
        with tab_ts:
            st.subheader("T-s Diagram")
            fig, ax = plt.subplots(figsize=(6, 5))
            def s_diesel(T_K, v): return cv * np.log(T_K/273.15) + R_gas * np.log(v/v1)
            ss1 = s_diesel(T1_K, v1); ss2 = s_diesel(T2_K, v2); ss3 = s_diesel(T3_K, v3); ss4 = s_diesel(T4_K, v1)
            ax.plot([ss1, ss2, ss3, ss4, ss1], [T1, T2_K-273.15, T3, T4_K-273.15, T1], '-o', color='gold')
            ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
            st.pyplot(fig)
    
    with col_schema:
        st.subheader("Schema")
        st.pyplot(draw_otto_diesel_schema(True))


# =====================================================================
# FRIGORIFERO
# =====================================================================
elif "Frigorifero" in ciclo:
    st.header("❄️ Frigorifero / Pompa di calore (Heat Pump)")
    
    st.sidebar.subheader(t["inputs"])
    Te = st.sidebar.number_input("T Evap (°C)", value=-10.0)
    Tc = st.sidebar.number_input("T Cond (°C)", value=35.0)
    eta = st.sidebar.number_input("η Compressor", value=0.8)

    # Fake properties approximate
    Pe = 10**((Te+100)/70); hg_e = 400 + 0.5 * Te
    Pc = 10**((Tc+100)/70); hf_c = 200 + 1.2 * Tc
    h1 = hg_e + 0.8 * 5.0
    h2 = h1 + ((h1 - 200)*0.5 * (Pc/Pe - 1)) / eta
    h3 = hf_c - 1.2 * 2.0; h4 = h3
    qe = h1 - h4; wc = h2 - h1; qc = h2 - h3

    col_res, col_plot = st.columns([1, 2])
    with col_res:
        st.subheader(t["results"])
        st.metric("COP Freddo (Cooling)", f"{qe/wc:.2f}")
        st.metric("COP Caldo (Heating)", f"{qc/wc:.2f}")

    with col_plot:
        st.subheader(t["plots"])
        tab_ph, tab_ts = st.tabs(["P-h", "T-s"])
        with tab_ph:
            fig, ax = plt.subplots(figsize=(6, 4))
            ax.set_yscale('log')
            Tt = np.linspace(-40, 60, 50)
            ax.plot(np.concatenate([200 + 1.2*Tt, (400 + 0.5*Tt)[::-1]]), 
                    np.concatenate([10**((Tt+100)/70), 10**((Tt+100)/70)[::-1]]), color="gray", alpha=0.5)
            ax.plot([h1, h2, h3, h4, h1], [Pe, Pc, Pc, Pe, Pe], color="cyan", lw=2, marker='o', label="Cycle")
            ax.set_xlabel("h (kJ/kg)"); ax.set_ylabel("P (bar)")
            ax.legend(); st.pyplot(fig)
        
        with tab_ts:
            fig, ax = plt.subplots(figsize=(6, 4))
            # Rough s calculation
            s1 = 1.0 + 0.005 * Te; s2 = s1 + 0.002 * (Pc/Pe); s3 = s2 - 0.003 * (Pc-Pe); s4 = s3
            ax.plot([s1, s2, s3, s4, s1], [Te, Tc, Tc, Te, Te], color="cyan", lw=2, marker='o')
            ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
            st.pyplot(fig)


# =====================================================================
# THERMOCAD (CUSTOM CYCLE)
# =====================================================================
elif "ThermoCAD" in ciclo:
    st.header("🛠️ ThermoCAD - Build your own Cycle (Water/Steam)")
    st.info("Aggiungi punti indipendenti o trasformazioni per costruire il tuo impianto.")

    with st.sidebar:
        st.divider()
        st.subheader("➕ Add New Point")
        p_mode = st.selectbox("Method", ["P-T", "P-x", "P-s", "P-h", "T-x", "T-s"])
        c1, c2 = st.columns(2)
        v1 = c1.number_input("Val 1", value=1.0, format="%.4f")
        v2 = c2.number_input("Val 2", value=20.0, format="%.4f")
        
        if st.button("Add Point"):
            args = {}
            if p_mode == "P-T": args = {"P": v1/10, "T": v2+273.15}
            elif p_mode == "P-x": args = {"P": v1/10, "x": v2}
            elif p_mode == "P-s": args = {"P": v1/10, "s": v2}
            elif p_mode == "P-h": args = {"P": v1/10, "h": v2}
            elif p_mode == "T-x": args = {"T": v1+273.15, "x": v2}
            elif p_mode == "T-s": args = {"T": v1+273.15, "s": v2}
            
            st_pt = get_iapws_robust(**args)
            if st_pt:
                st.session_state["cad_points"].append({
                    "name": f"P{len(st.session_state['cad_points'])+1}",
                    "P": st_pt.P*10, "T": st_pt.T-273.15, 
                    "h": st_pt.h, "s": st_pt.s, "x": st_pt.x, "v": st_pt.v
                })
                st.rerun()
            else:
                st.error("Invalid State")

        st.subheader("🔄 Iso-Transformation")
        if st.session_state["cad_points"]:
            last_pt = st.session_state["cad_points"][-1]
            st.write(f"From: **{last_pt['name']}**")
            iso_type = st.selectbox("Iso-type", ["Isobara (P cost)", "Isoterma (T cost)", "Isentropica (s cost)", "Isentalpica (h cost)"])
            target_prop = st.selectbox("Target Prop", ["Pressione (bar)", "Temperatura (°C)", "Entropia (kJ/kg·K)", "Entalpia (kJ/kg)", "Titolo (x)"])
            target_val = st.number_input("Target Value", value=1.0, format="%.4f", key="iso_target")
            
            if st.button("Add Derived Point"):
                args = {}
                if "P" in iso_type: args["P"] = last_pt["P"]/10
                elif "T" in iso_type: args["T"] = last_pt["T"]+273.15
                elif "s" in iso_type: args["s"] = last_pt["s"]
                elif "h" in iso_type: args["h"] = last_pt["h"]
                
                if "Pressione" in target_prop: args["P"] = target_val/10
                elif "Temperatura" in target_prop: args["T"] = target_val+273.15
                elif "Entropia" in target_prop: args["s"] = target_val
                elif "Entalpia" in target_prop: args["h"] = target_val
                elif "Titolo" in target_prop: args["x"] = target_val
                
                st_pt = get_iapws_robust(**args)
                if st_pt:
                    st.session_state["cad_points"].append({
                        "name": f"P{len(st.session_state['cad_points'])+1}",
                        "P": st_pt.P*10, "T": st_pt.T-273.15, 
                        "h": st_pt.h, "s": st_pt.s, "x": st_pt.x, "v": st_pt.v
                    })
                    st.rerun()
                else:
                    st.error("Transformation failed.")
        
        if st.button("Remove Last Point"):
            if st.session_state["cad_points"]:
                st.session_state["cad_points"].pop()
                st.rerun()

        if st.button("Clear Cycle", type="primary"):
            st.session_state["cad_points"] = []
            st.rerun()

    # Main Display
    if st.session_state["cad_points"]:
        col_list, col_diag = st.columns([1, 1.5])
        
        with col_list:
            st.subheader("📋 Points List")
            import pandas as pd
            df = pd.DataFrame(st.session_state["cad_points"])
            st.dataframe(df[["name", "P", "T", "h", "s", "x"]], use_container_width=True)
            
            st.subheader("⚙️ Cycle Stats")
            # Simple stats for closed cycle if pts > 2
            if len(st.session_state["cad_points"]) > 2:
                pts = st.session_state["cad_points"]
                q_in = 0; l_net = 0
                for i in range(len(pts)-1):
                    dh = pts[i+1]["h"] - pts[i]["h"]
                    if dh > 0: q_in += dh
                    l_net -= dh # sum of -dh is net work if closed correctly
                # add final closing if desired, but here we just show segment sums
                st.write(f"Total Heating (Qin): {q_in:.1f} kJ/kg")
        
        with col_diag:
            st.subheader("📈 Diagrams")
            t1, t2 = st.tabs(["T-s", "h-s"])
            pts = st.session_state["cad_points"]
            ss = [p["s"] for p in pts]; tt = [p["T"] for p in pts]; hh = [p["h"] for p in pts]
            
            with t1:
                fig, ax = plt.subplots(figsize=(6, 5))
                # Dome
                sf, sg, t_sat = [], [], []
                for tc in np.linspace(0.1, 373, 50):
                    try:
                        sf.append(IAPWS97(T=tc+273.15, x=0).s)
                        sg.append(IAPWS97(T=tc+273.15, x=1).s)
                        t_sat.append(tc)
                    except: pass
                ax.plot(sf, t_sat, color='#50c8e8', alpha=0.5); ax.plot(sg, t_sat, color='#50c8e8', alpha=0.5)
                ax.plot(ss, tt, 'o-', color='cyan', lw=2)
                for p in pts: ax.annotate(p["name"], (p["s"], p["T"]), color='white', fontsize=9)
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
                st.pyplot(fig)
            
            with t2:
                fig, ax = plt.subplots(figsize=(6, 5))
                ax.plot(ss, hh, 'o-', color='red', lw=2)
                for p in pts: ax.annotate(p["name"], (p["s"], p["h"]), color='white', fontsize=9)
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("h (kJ/kg)")
                st.pyplot(fig)
    else:
        st.write("Aggiungi dei punti dalla barra laterale per iniziare la costruzione del ciclo.")
