import streamlit as st
import plotly.graph_objects as go

def apply_custom_style():
    """Applies the Professional Light Blue theme to the Streamlit app."""
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .block-container { padding-top: 1rem; padding-bottom: 2rem; max-width: 1550px; }
        
        .stApp {
            background: #ffffff;
            color: #0d1c29;
            font-family: 'Inter', sans-serif;
        }

        /* Hero Section (Small Version) */
        .hero {
            margin-bottom: 1.5rem; padding: 1.2rem 2rem;
            border-radius: 16px; 
            background: linear-gradient(135deg, #f0f7ff, #e6eff7);
            border: 1px solid rgba(13, 59, 102, 0.15);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.04);
        }
        .hero h1 { 
            margin: 0; 
            background: linear-gradient(90deg, #0d3b66, #00509d);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 2.2rem; font-weight: 700; line-height: 1.1; 
        }
        .hero p { margin: 0.5rem 0 0 0; color: #0d3b66; font-size: 1rem; }
        .authorline { font-size: 0.8rem; opacity: 0.8; margin-top: 0.5rem; color: #0077b6; }

        /* CAD Report Style */
        .cad-report {
            font-family: 'JetBrains Mono', 'Consolas', monospace;
            background: #f8fbff;
            border: 1px solid #0d3b66;
            border-radius: 10px;
            padding: 1.5rem;
            color: #0d3b66;
            line-height: 1.6;
            font-size: 0.9rem;
        }

        /* Metrics Styling */
        div[data-testid="stMetric"] {
            background: #ffffff;
            border: 1px solid rgba(13, 59, 102, 0.15);
            border-radius: 12px; padding: 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }

        /* Tabs Styling */
        .stTabs [data-baseweb="tab-list"] { gap: 1rem; }
        .stTabs [data-baseweb="tab"] {
            background: #f0f4f8;
            border: 1px solid #d1d9e0;
            color: #4a5568;
        }
        .stTabs [aria-selected="true"] {
            background: #0d3b66 !important;
            color: #ffffff !important;
        }

        /* Sidebar Styling */
        section[data-testid="stSidebar"] {
            background-color: #f8fafc;
            border-right: 1px solid #e2e8f0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

def plotly_base(title, x_title, y_title, theme, xlog=False, ylog=False, height=480):
    """Standardized Plotly configuration."""
    fig = go.Figure()
    fig.update_layout(
        title=dict(text=title, font=dict(size=20, color=theme["cyan"])),
        height=height,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#f8fbff",
        font=dict(color=theme["text"]),
        margin=dict(l=20, r=20, t=60, b=20),
        legend=dict(
            bgcolor="rgba(255, 255, 255, 0.8)", 
            bordercolor=theme["cyan"], 
            borderwidth=1,
            yanchor="top", y=0.99, xanchor="left", x=0.01
        ),
        hoverlabel=dict(bgcolor="#ffffff", bordercolor=theme["cyan"], font=dict(color=theme["text"])),
    )
    fig.update_xaxes(title=x_title, showgrid=True, gridcolor="rgba(0,0,0,0.1)", zeroline=False, type="log" if xlog else "linear")
    fig.update_yaxes(title=y_title, showgrid=True, gridcolor="rgba(0,0,0,0.1)", zeroline=False, type="log" if ylog else "linear")
    return fig

def render_hero(t):
    """Renders the top hero section."""
    st.markdown(
        f"""
        <div class="hero">
            <h1>{t['main_title']}</h1>
            <p>{t['subtitle']}</p>
            <div class="authorline">{t['author']}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def render_metric_row(metrics):
    """Renders a row of metrics concisely."""
    cols = st.columns(len(metrics))
    for i, (label, value) in enumerate(metrics.items()):
        cols[i].metric(label, value)

def add_line(fig, x, y, name, color, dash="solid", width=3):
    """Adds a line to a Plotly figure."""
    fig.add_trace(go.Scatter(
        x=x, y=y, name=name,
        mode='lines',
        line=dict(color=color, width=width, dash=dash),
        hovertemplate='%{y:.2f} @ %{x:.2f}<extra></extra>'
    ))

def add_generic_points(fig, pts, x_key, y_key, name, color):
    """Adds markers for a list of state points."""
    fig.add_trace(go.Scatter(
        x=[p[x_key] for p in pts],
        y=[p[y_key] for p in pts],
        name=name,
        mode='markers+text',
        text=[p["name"] for p in pts],
        textposition="top center",
        marker=dict(color=color, size=10, line=dict(color='white', width=2)),
        hovertemplate='<b>Point %{text}</b><br>' + 
                      f'{y_key}: %{{y:.2f}}<br>' + 
                      f'{x_key}: %{{x:.4f}}<extra></extra>'
    ))

def add_steam_dome(fig, x_key, y_key):
    """Adds the IAPWS-97 saturation dome to a Plotly figure."""
    from iapws import IAPWS97
    import numpy as np
    
    # Critical point approx
    T_crit = 373.946 + 273.15
    
    t_range = np.linspace(273.15 + 0.01, T_crit - 0.5, 100)
    
    def extract(s, key):
        if key == "T": return s.T - 273.15
        if key == "P": return s.P * 10.0 # MPa to bar
        if key == "s": return s.s
        if key == "h": return s.h
        if key == "v": return s.v
        return 0
            
    xf = [extract(IAPWS97(T=tk, x=0), x_key) for tk in t_range]
    yf = [extract(IAPWS97(T=tk, x=0), y_key) for tk in t_range]
    xg = [extract(IAPWS97(T=tk, x=1), x_key) for tk in t_range]
    yg = [extract(IAPWS97(T=tk, x=1), y_key) for tk in t_range]
    
    fig.add_trace(go.Scatter(x=xf, y=yf, name="Sat. Liquid", line=dict(color="rgba(0,0,0,0.3)", width=1, dash="dot"), showlegend=False))
    fig.add_trace(go.Scatter(x=xg, y=yg, name="Sat. Vapor", line=dict(color="rgba(0,0,0,0.3)", width=1, dash="dot"), showlegend=False))

def add_steam_points(fig, pts, x_key, y_key, name, color):
    """Adds markers for steam state points with detailed hover info."""
    fig.add_trace(go.Scatter(
        x=[p[x_key] for p in pts],
        y=[p[y_key] for p in pts],
        name=name,
        mode='markers+text',
        text=[p["name"] for p in pts],
        textposition="top center",
        marker=dict(color=color, size=10, line=dict(color='white', width=2)),
        hovertemplate='<b>Point %{text}</b><br>' +
                      'P: %{customdata[0]:.2f} bar<br>' +
                      'T: %{customdata[1]:.1f} °C<br>' +
                      'h: %{customdata[2]:.1f} kJ/kg<br>' +
                      's: %{customdata[3]:.3f} kJ/kgK<extra></extra>',
        customdata=[[p["P"], p["T"], p["h"], p["s"]] for p in pts]
    ))
