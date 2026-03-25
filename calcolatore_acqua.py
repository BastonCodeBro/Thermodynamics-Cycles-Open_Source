import customtkinter as ctk
import tkinter as tk
import numpy as np
import scipy.optimize as opt
from iapws import IAPWS97
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages
import mplcursors
from tkinter.filedialog import asksaveasfilename
import os

from core.path_generator import (
    iapws_isobaric_path, iapws_isentropic_path, iapws_isenthalpic_path,
    iapws_auto_path, SimplePt,
    add_direction_arrow, _get_diagram_coords
)

plt.style.use('dark_background')
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class StatePoint:
    def __init__(self, name, state):
        self.name = name
        self.state = state
        self.P_bar = state.P * 10.0
        self.T_C = state.T - 273.15
        self.h = state.h
        self.s = state.s
        self.v = state.v
        self.x = state.x
        self.phase = state.phase

class WaterThermoCAD(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        self.grid_columnconfigure(0, weight=2) 
        self.grid_columnconfigure(1, weight=5)
        self.grid_rowconfigure(0, weight=1)

        self.properties = ["Pressione (bar)", "Temperatura (°C)", "Entalpia (kJ/kg)", "Entropia (kJ/kg·K)", "Titolo vapore (0-1)"]
        self.iso_transformations = {
            "Isobara (P cost)": "P_bar",
            "Isoterma (T cost)": "T_C",
            "Isocora (v cost)": "v",
            "Isentalpica (h cost)": "h",
            "Isentropica (s cost)": "s"
        }
        
        self.points = []
        self.components = [] # For complex cycles (bleeding/reheating)
        self.var_close_cycle = ctk.BooleanVar(value=True) # Default true!
        self.var_portata = ctk.StringVar(value="1.0")
        self.var_eta_turbina = ctk.StringVar(value="1.0")
        self.var_eta_pompa = ctk.StringVar(value="1.0")
        
        self.generate_saturation_dome()
        
        self.create_left_panel()
        self.create_plot_panel()

    def get_critical_point(self):
        return {'P': 220.64, 'T': 647.096 - 273.15, 'v': 0.003106, 'h': 2087.6, 's': 4.4120}

    def generate_saturation_dome(self):
        pressures = np.logspace(np.log10(0.001), np.log10(22.0), num=150) 
        sat_f, sat_g = {'P':[], 'T':[], 'v':[], 'h':[], 's':[]}, {'P':[], 'T':[], 'v':[], 'h':[], 's':[]}
        
        for p in pressures:
            try:
                st = IAPWS97(P=p, x=0)
                sat_f['P'].append(st.P*10.0); sat_f['T'].append(st.T-273.15); sat_f['v'].append(st.v); sat_f['h'].append(st.h); sat_f['s'].append(st.s)
            except: pass
            try:
                st = IAPWS97(P=p, x=1)
                sat_g['P'].append(st.P*10.0); sat_g['T'].append(st.T-273.15); sat_g['v'].append(st.v); sat_g['h'].append(st.h); sat_g['s'].append(st.s)
            except: pass

        cp = self.get_critical_point()
        self.dome_P = sat_f['P'] + [cp['P']] + sat_g['P'][::-1]
        self.dome_T = sat_f['T'] + [cp['T']] + sat_g['T'][::-1]
        self.dome_v = sat_f['v'] + [cp['v']] + sat_g['v'][::-1]
        self.dome_h = sat_f['h'] + [cp['h']] + sat_g['h'][::-1]
        self.dome_s = sat_f['s'] + [cp['s']] + sat_g['s'][::-1]

    def create_left_panel(self):
        self.left_scroll = ctk.CTkScrollableFrame(self)
        self.left_scroll.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        self.left_scroll.grid_columnconfigure(0, weight=1)

        f_in = ctk.CTkFrame(self.left_scroll, corner_radius=10)
        f_in.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        f_in.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(f_in, text="1. Aggiungi Punto Indipendente", font=ctk.CTkFont(weight="bold", size=15)).grid(row=0, column=0, pady=(10,5))
        
        self.var_p1, self.var_p2 = ctk.StringVar(value="Pressione (bar)"), ctk.StringVar(value="Temperatura (°C)")
        
        self.combo_p1 = ctk.CTkOptionMenu(f_in, values=self.properties, variable=self.var_p1)
        self.combo_p1.grid(row=1, column=0, padx=10, pady=2, sticky="ew")
        self.ent_v1 = ctk.CTkEntry(f_in)
        self.ent_v1.grid(row=2, column=0, padx=10, pady=(2,8), sticky="ew")

        self.combo_p2 = ctk.CTkOptionMenu(f_in, values=self.properties, variable=self.var_p2)
        self.combo_p2.grid(row=3, column=0, padx=10, pady=2, sticky="ew")
        self.ent_v2 = ctk.CTkEntry(f_in)
        self.ent_v2.grid(row=4, column=0, padx=10, pady=(2,10), sticky="ew")

        self.btn_add = ctk.CTkButton(f_in, text="Crea Punto Libero", command=self.add_point)
        self.btn_add.grid(row=5, column=0, padx=10, pady=(0,10), sticky="ew")

        f_iso = ctk.CTkFrame(self.left_scroll, corner_radius=10)
        f_iso.grid(row=1, column=0, sticky="ew", pady=(0, 10))
        f_iso.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(f_iso, text="2. Aggiungi Punto via Trasf. ISO", font=ctk.CTkFont(weight="bold", size=15)).grid(row=0, column=0, pady=(10,5))
        ctk.CTkLabel(f_iso, text="Esempio: Dal 'Punto 1', fai un'espansione \nIsentropica (S cost) fino a Pressione = X", font=ctk.CTkFont(size=11), text_color="gray60").grid(row=1, column=0, pady=(0,5))
        
        self.var_start_pt = ctk.StringVar(value="")
        self.combo_start_pt = ctk.CTkOptionMenu(f_iso, values=["Nessun Punto"], variable=self.var_start_pt)
        self.combo_start_pt.grid(row=2, column=0, padx=10, pady=2, sticky="ew")
        
        self.var_iso = ctk.StringVar(value="Isobara (P cost)")
        self.combo_iso = ctk.CTkOptionMenu(f_iso, values=list(self.iso_transformations.keys()), variable=self.var_iso)
        self.combo_iso.grid(row=3, column=0, padx=10, pady=2, sticky="ew")
        
        self.var_target_prop = ctk.StringVar(value="Pressione (bar)")
        self.combo_target_prop = ctk.CTkOptionMenu(f_iso, values=self.properties, variable=self.var_target_prop)
        self.combo_target_prop.grid(row=4, column=0, padx=10, pady=2, sticky="ew")
        
        self.ent_iso_target = ctk.CTkEntry(f_iso, placeholder_text="Valore target...")
        self.ent_iso_target.grid(row=5, column=0, padx=10, pady=(2,10), sticky="ew")
        
        self.btn_add_iso = ctk.CTkButton(f_iso, text="Crea Punto Derivato", command=self.add_iso_point)
        self.btn_add_iso.grid(row=6, column=0, padx=10, pady=(0,10), sticky="ew")

        f_report = ctk.CTkFrame(self.left_scroll, corner_radius=10, fg_color="transparent")
        f_report.grid(row=2, column=0, sticky="nsew", pady=(0, 10))
        f_report.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(f_report, text="3. Punti del Ciclo", font=ctk.CTkFont(weight="bold", size=15)).grid(row=0, column=0, pady=(10,5))
        
        self.pts_frame = ctk.CTkFrame(f_report, fg_color="transparent")
        self.pts_frame.grid(row=1, column=0, sticky="ew")
        self.pts_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkButton(f_report, text="Azzera Tutto", fg_color="#C8504B", hover_color="#913834", command=self.clear_all).grid(row=2, column=0, pady=10, padx=10, sticky="ew")
        
        f_comp = ctk.CTkFrame(self.left_scroll, corner_radius=10)
        f_comp.grid(row=3, column=0, sticky="nsew", pady=(0, 10))
        f_comp.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(f_comp, text="4. Cicli Complessi (Spillamenti / y%)", font=ctk.CTkFont(weight="bold", size=13)).grid(row=0, column=0, pady=(10,0))
        ctk.CTkLabel(f_comp, text="Definisci i componenti manualmente per masse differenziate.", font=ctk.CTkFont(size=10), text_color="gray60").grid(row=1, column=0, pady=(0,5))
        
        c_in = ctk.CTkFrame(f_comp, fg_color="transparent")
        c_in.grid(row=2, column=0, sticky="ew")
        c_in.grid_columnconfigure((0,1), weight=1)
        
        self.var_ctype = ctk.StringVar(value="Turbina")
        ctk.CTkOptionMenu(c_in, values=["Turbina", "Pompa", "Caldaia/Risurisc.", "Condensatore"], variable=self.var_ctype).grid(row=0, column=0, columnspan=2, sticky="ew", padx=10, pady=2)
        
        self.var_cin = ctk.StringVar()
        self.var_cout = ctk.StringVar()
        self.cmb_cin = ctk.CTkOptionMenu(c_in, variable=self.var_cin, values=["Nessun Punto"])
        self.cmb_cin.grid(row=1, column=0, sticky="ew", padx=(10, 5), pady=2)
        self.cmb_cout = ctk.CTkOptionMenu(c_in, variable=self.var_cout, values=["Nessun Punto"])
        self.cmb_cout.grid(row=1, column=1, sticky="ew", padx=(5, 10), pady=2)
        
        f_y = ctk.CTkFrame(c_in, fg_color="transparent")
        f_y.grid(row=2, column=0, columnspan=2, pady=2)
        ctk.CTkLabel(f_y, text="Massa 'y' (es. 0.8):", font=ctk.CTkFont(size=12)).grid(row=0, column=0, padx=5)
        self.ent_y = ctk.CTkEntry(f_y, width=60)
        self.ent_y.insert(0, "1.0")
        self.ent_y.grid(row=0, column=1, padx=5)
        
        ctk.CTkButton(f_y, text="Calcolo FWH (y)", font=ctk.CTkFont(size=10), width=90, command=self.show_spillamento_popup).grid(row=0, column=2, padx=5)
        
        ctk.CTkButton(c_in, text="Aggiungi Componente", command=self.add_component).grid(row=3, column=0, columnspan=2, sticky="ew", padx=10, pady=(10, 5))
        
        self.comp_list_frame = ctk.CTkFrame(f_comp, fg_color="gray25")
        self.comp_list_frame.grid(row=3, column=0, sticky="ew", padx=10, pady=5)
        
        f_trans = ctk.CTkFrame(self.left_scroll, corner_radius=10)
        f_trans.grid(row=4, column=0, sticky="nsew", pady=(0, 10))
        f_trans.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(f_trans, text="4. Analisi Ciclo e Rendimento", font=ctk.CTkFont(weight="bold", size=15)).grid(row=0, column=0, columnspan=2, pady=(10,5))
        
        self.chk_close = ctk.CTkCheckBox(f_trans, text="Chiudi Ciclo (Aggiunge punti se necessario)", variable=self.var_close_cycle, command=self.on_close_cycle_checked)
        self.chk_close.grid(row=1, column=0, columnspan=2, pady=(0, 5), padx=10, sticky="w")
        
        # -- Inputs Rendimento e Portata --
        f_params = ctk.CTkFrame(f_trans, fg_color="transparent")
        f_params.grid(row=2, column=0, columnspan=2, sticky="ew", padx=10, pady=(0,5))
        f_params.grid_columnconfigure((0,1), weight=1)
        
        ctk.CTkLabel(f_params, text="ṁ (kg/s):", font=ctk.CTkFont(size=12)).grid(row=0, column=0, sticky="w", pady=2)
        ctk.CTkEntry(f_params, textvariable=self.var_portata, width=80).grid(row=0, column=1, sticky="ew", pady=2)
        
        ctk.CTkLabel(f_params, text="η_is Turbina:", font=ctk.CTkFont(size=12)).grid(row=1, column=0, sticky="w", pady=2)
        ent_eta_t = ctk.CTkEntry(f_params, textvariable=self.var_eta_turbina, width=80)
        ent_eta_t.grid(row=1, column=1, sticky="ew", pady=2)
        ent_eta_t.bind("<FocusOut>", lambda e: self.update_gui())
        ent_eta_t.bind("<Return>", lambda e: self.update_gui())
        
        ctk.CTkLabel(f_params, text="η_is Pompa:", font=ctk.CTkFont(size=12)).grid(row=2, column=0, sticky="w", pady=2)
        ent_eta_p = ctk.CTkEntry(f_params, textvariable=self.var_eta_pompa, width=80)
        ent_eta_p.grid(row=2, column=1, sticky="ew", pady=2)
        ent_eta_p.bind("<FocusOut>", lambda e: self.update_gui())
        ent_eta_p.bind("<Return>", lambda e: self.update_gui())
        
        ctk.CTkButton(f_params, text="Ricalcola", command=self.update_gui, width=60).grid(row=3, column=0, columnspan=2, pady=5, sticky="ew")
        
        self.trans_frame = ctk.CTkFrame(f_trans, fg_color="transparent")
        self.trans_frame.grid(row=3, column=0, columnspan=2, sticky="ew", padx=5)
        self.trans_frame.grid_columnconfigure(0, weight=1)
        
        self.lbl_report = ctk.CTkLabel(f_trans, text="", justify="left", font=ctk.CTkFont(family="Consolas", size=11), wraplength=260)
        self.lbl_report.grid(row=4, column=0, columnspan=2, pady=10, padx=5)

        ctk.CTkButton(self.left_scroll, text="Esporta PDF Grafici", command=self.export_pdf, fg_color="#2A8C4B", hover_color="#1E6636").grid(row=4, column=0, pady=10, sticky="ew")
        self.label_error = ctk.CTkLabel(self.left_scroll, text="", text_color="#FF4C4C", wraplength=250, font=ctk.CTkFont(weight="bold"))
        self.label_error.grid(row=5, column=0, pady=5)

    def create_plot_panel(self):
        self.frame_plot = ctk.CTkFrame(self, corner_radius=15, border_width=2)
        self.frame_plot.grid(row=0, column=1, padx=(0,10), pady=10, sticky="nsew")
        self.frame_plot.grid_rowconfigure(0, weight=1)
        self.frame_plot.grid_columnconfigure(0, weight=1)

        self.tabview = ctk.CTkTabview(self.frame_plot)
        self.tabview.pack(fill="both", expand=True, padx=5, pady=5)
        
        tabs = ["Schema", "T-s", "p-v", "T-v", "h-s"]
        for t in tabs: self.tabview.add(t)

        self.figs, self.axes, self.canvases, self.scatters = {}, {}, {}, {}
        bg_col = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg_col = 'white' if ctk.get_appearance_mode() == 'Dark' else 'black'

        for tab in tabs:
            fig = Figure(figsize=(5,4), dpi=100)
            fig.patch.set_facecolor(bg_col)
            ax = fig.add_subplot(111); ax.set_facecolor(bg_col); ax.tick_params(colors=fg_col)
            ax.xaxis.label.set_color(fg_col); ax.yaxis.label.set_color(fg_col); ax.title.set_color(fg_col)
            for sp in ax.spines.values(): sp.set_color(fg_col)
            
            canvas = FigureCanvasTkAgg(fig, master=self.tabview.tab(tab))
            canvas_widget = canvas.get_tk_widget()
            canvas_widget.pack(fill="both", expand=True)

            self.figs[tab] = fig; self.axes[tab] = ax; self.canvases[tab] = canvas
            
            canvas.mpl_connect('button_press_event', lambda event, t=tab: self.on_press(event, t))
            
        self.redraw_plots()

    def on_press(self, event, tab):
        if event.button != 3: return 
        if event.inaxes != self.axes[tab]: return
        if not self.points: return
        
        min_dist = float('inf')
        closest_idx = None
        
        for i, pt in enumerate(self.points):
            px, py = self.get_xy_for_tab(pt, tab)
            ax = self.axes[tab]
            dx = (event.xdata - px) / (ax.get_xlim()[1] - ax.get_xlim()[0] + 1e-9)
            dy = (event.ydata - py) / (ax.get_ylim()[1] - ax.get_ylim()[0] + 1e-9)
            dist = dx**2 + dy**2
            if dist < min_dist:
                min_dist = dist
                closest_idx = i
                
        if min_dist < 0.05: 
            self.show_edit_popup(closest_idx)

    def show_edit_popup(self, point_idx):
        pt = self.points[point_idx]
        
        popup = ctk.CTkToplevel(self)
        popup.title(f"Modifica {pt.name}")
        popup.geometry("400x350")
        popup.grab_set() 
        popup.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(popup, text=f"Modifica Manuale: {pt.name}", font=ctk.CTkFont(weight="bold", size=16)).pack(pady=15)
        
        f1 = ctk.CTkFrame(popup, fg_color="transparent")
        f1.pack(fill="x", padx=20, pady=5)
        ctk.CTkLabel(f1, text="Nuova Pressione (bar):").pack(side="left")
        ent_p = ctk.CTkEntry(f1)
        ent_p.insert(0, f"{pt.P_bar:.4f}")
        ent_p.pack(side="right")

        f2 = ctk.CTkFrame(popup, fg_color="transparent")
        f2.pack(fill="x", padx=20, pady=5)
        ctk.CTkLabel(f2, text="Nuova Temperatura (°C):").pack(side="left")
        ent_t = ctk.CTkEntry(f2)
        ent_t.insert(0, f"{pt.T_C:.2f}")
        ent_t.pack(side="right")

        ctk.CTkLabel(popup, text="Nota: Le altre proprietà verranno ricalcolate\nforzando Pressione e Temperatura per questo popup.", text_color="gray50", font=ctk.CTkFont(size=11)).pack(pady=10)

        def save_changes():
            try:
                np_val = float(ent_p.get().replace(',','.'))
                nt_val = float(ent_t.get().replace(',','.'))
            except:
                return
                
            try:
                st = IAPWS97(P=np_val/10.0, T=nt_val+273.15)
                self.points[point_idx].state = st
                self.points[point_idx].P_bar = st.P * 10
                self.points[point_idx].T_C = st.T - 273.15
                self.points[point_idx].h = st.h
                self.points[point_idx].s = st.s
                self.points[point_idx].v = st.v
                self.update_gui()
                popup.destroy()
            except Exception as e:
                print("Stato non valido P-T", e)

        ctk.CTkButton(popup, text="Salva Modifiche", fg_color="#2A8C4B", hover_color="#1E6636", command=save_changes).pack(pady=20)

    def get_xy_for_tab(self, pt, tab):
        if tab == "T-s": return pt.s, pt.T_C
        if tab == "p-v": return pt.v, pt.P_bar
        if tab == "T-v": return pt.v, pt.T_C
        if tab == "h-s": return pt.s, pt.h
        return 0, 0

    def add_point(self):
        try:
            val1 = float(self.ent_v1.get().replace(',', '.'))
            val2 = float(self.ent_v2.get().replace(',', '.'))
        except: return
        self.create_point_from_props(self.var_p1.get(), val1, self.var_p2.get(), val2)

    def add_iso_point(self):
        if not self.points:
            self.label_error.configure(text="Errore: Devi prima avere un Punto di partenza.")
            return
            
        pt_name = self.var_start_pt.get()
        pt_start = next((p for p in self.points if p.name == pt_name), None)
        if not pt_start: return
        
        iso_type_label = self.var_iso.get()
        target_prop_label = self.var_target_prop.get()
        
        try:
            target_val = float(self.ent_iso_target.get().replace(',','.'))
        except: 
            self.label_error.configure(text="Errore: Inserisci un valore numerico valido.")
            return

        attr_name = self.iso_transformations[iso_type_label]
        costante_val = getattr(pt_start, attr_name)
        
        prop_1_mapped = ""
        val_1_mapped = 0
        if attr_name == "P_bar": prop_1_mapped = "Pressione (bar)"; val_1_mapped = costante_val
        elif attr_name == "T_C": prop_1_mapped = "Temperatura (°C)"; val_1_mapped = costante_val
        elif attr_name == "h": prop_1_mapped = "Entalpia (kJ/kg)"; val_1_mapped = costante_val
        elif attr_name == "s": prop_1_mapped = "Entropia (kJ/kg·K)"; val_1_mapped = costante_val
        elif attr_name == "v": prop_1_mapped = "Volume (m3/kg)"; val_1_mapped = costante_val

        self.create_point_from_props(prop_1_mapped, val_1_mapped, target_prop_label, target_val, pt_start=pt_start)

    def _get_iapws_robust(self, **args):
        st = IAPWS97(**args)
        if getattr(st, 'T', None) is not None and getattr(st, 'P', None) is not None:
            return st
            
        if "P" in args and "v" in args:
            P_tgt = args["P"]
            v_tgt = args["v"]
            try:
                sat_l = IAPWS97(P=P_tgt, x=0)
                sat_v = IAPWS97(P=P_tgt, x=1)
                f = lambda T: IAPWS97(P=P_tgt, T=T).v - v_tgt
                if v_tgt <= sat_l.v:
                    res = opt.root_scalar(f, bracket=[273.16, sat_l.T])
                    return IAPWS97(P=P_tgt, T=res.root)
                elif v_tgt >= sat_v.v:
                    res = opt.root_scalar(f, bracket=[sat_v.T, 2273.15])
                    return IAPWS97(P=P_tgt, T=res.root)
                else: 
                    x = (v_tgt - sat_l.v) / (sat_v.v - sat_l.v)
                    return IAPWS97(P=P_tgt, x=x)
            except Exception as e:
                pass
                
        raise ValueError("Stato termodinamico non raggiungibile o equazione non convergente.")

    def create_point_from_props(self, p1_str, val1, p2_str, val2, pt_start=None):
        if p1_str == p2_str: return
        self.label_error.configure(text="")
        
        args = {}
        for typ, val in zip((p1_str, p2_str), (val1, val2)):
            if "Pressione" in typ: args["P"] = val/10.0
            elif "Temperatura" in typ: args["T"] = val+273.15
            elif "Entalpia" in typ: args["h"] = val
            elif "Entropia" in typ: args["s"] = val
            elif "Titolo" in typ: args["x"] = val
            elif "Vol" in typ: args["v"] = val
            
        try:
            st = self._get_iapws_robust(**args)
            
            if pt_start is not None:
                class TempState:
                    def __init__(self, s):
                        self.P_bar = s.P * 10.0
                        self.T_C = s.T - 273.15
                        self.h = s.h
                        self.s = s.s
                        self.v = s.v
                        self.x = getattr(s, 'x', None)
                        self.phase = s.phase
                
                temp_pt = TempState(st)
                intersections = self.get_saturation_intersections(pt_start, temp_pt)
                
                if len(intersections) > 1:
                    if abs(pt_start.P_bar - temp_pt.P_bar) > 1e-2:
                        intersections.sort(key=lambda p: p.P_bar, reverse=(pt_start.P_bar > temp_pt.P_bar))
                    else:
                        intersections.sort(key=lambda p: p.h, reverse=(pt_start.h > temp_pt.h))
                        
                for ipt in intersections:
                    nome = f"Punto {len(self.points)+1} ({ipt.name})"
                    self.points.append(StatePoint(nome, IAPWS97(P=ipt.P_bar/10.0, x=ipt.x)))
                    
            nome = f"Punto {len(self.points)+1}"
            self.points.append(StatePoint(nome, st))
            self.var_start_pt.set(nome)
            self.update_gui()
        except Exception as e: 
            self.label_error.configure(text=f"Errore Calcolo IAPWS: Assicurati che lo stato esista! {e}")

    def on_close_cycle_checked(self):
        is_closed = self.var_close_cycle.get()
        if is_closed and len(self.points) > 1:
            pt1 = self.points[-1]
            pt2 = self.points[0]
            intersections = self.get_saturation_intersections(pt1, pt2)
            
            if intersections:
                if len(intersections) > 1:
                    if abs(pt1.P_bar - pt2.P_bar) > 1e-2:
                        intersections.sort(key=lambda p: p.P_bar, reverse=(pt1.P_bar > pt2.P_bar))
                    else:
                        intersections.sort(key=lambda p: p.h, reverse=(pt1.h > pt2.h))
                
                added = False
                for ipt in intersections:
                    nome = f"Punto {len(self.points)+1} ({ipt.name})"
                    self.points.append(StatePoint(nome, IAPWS97(P=ipt.P_bar/10.0, x=ipt.x)))
                    added = True
        self.update_gui()

    def show_spillamento_popup(self):
        if len(self.points) < 3:
            self.label_error.configure(text="Errore: Servono almeno 3 punti per un FWH.")
            return
            
        popup = ctk.CTkToplevel(self)
        popup.title("Calcolo Frazione Spillata 'y' (FWH)")
        popup.geometry("450x380")
        popup.grab_set()
        popup.grid_columnconfigure(0, weight=1)
        
        ctk.CTkLabel(popup, text="Bilancio Scambiatore a Miscela (FWH)", font=ctk.CTkFont(weight="bold", size=15)).pack(pady=10)
        ctk.CTkLabel(popup, text="h_out = y · h_spillo + (1 - y) · h_in", font=ctk.CTkFont(size=12)).pack(pady=5)
        
        n_list = [p.name for p in self.points]
        
        f1 = ctk.CTkFrame(popup, fg_color="transparent")
        f1.pack(fill="x", padx=15, pady=5)
        ctk.CTkLabel(f1, text="Punto Spillato (h_spillo):").pack(side="left")
        cmb_ext = ctk.CTkOptionMenu(f1, values=n_list)
        cmb_ext.pack(side="right")
        if len(n_list)>2: cmb_ext.set(n_list[-2])
        
        f2 = ctk.CTkFrame(popup, fg_color="transparent")
        f2.pack(fill="x", padx=15, pady=5)
        ctk.CTkLabel(f2, text="Punto Alimento In (h_in):").pack(side="left")
        cmb_in = ctk.CTkOptionMenu(f2, values=n_list)
        cmb_in.pack(side="right")
        if len(n_list)>1: cmb_in.set(n_list[-1])
        
        f3 = ctk.CTkFrame(popup, fg_color="transparent")
        f3.pack(fill="x", padx=15, pady=5)
        ctk.CTkLabel(f3, text="Punto Uscita FWH (h_out):").pack(side="left")
        cmb_out = ctk.CTkOptionMenu(f3, values=n_list)
        cmb_out.pack(side="right")
        if len(n_list)>0: cmb_out.set(n_list[0])
        
        lbl_res = ctk.CTkLabel(popup, text="", font=ctk.CTkFont(weight="bold", size=14), text_color="#00FFFF")
        lbl_res.pack(pady=10)
        
        def calc_y():
            def get_pt(name): return next((p for p in self.points if p.name == name), None)
            pt_ext = get_pt(cmb_ext.get())
            pt_in = get_pt(cmb_in.get())
            pt_out = get_pt(cmb_out.get())
            if not (pt_ext and pt_in and pt_out): return
            
            num = pt_out.h - pt_in.h
            den = pt_ext.h - pt_in.h
            if abs(den) < 1e-4:
                lbl_res.configure(text="Errore: h_spillo = h_in", text_color="red")
                return
            
            y = num / den
            if 0 <= y <= 1:
                lbl_res.configure(text=f"Frazione 'y' calcolata: {y:.4f}\n(Applicata al campo di input!)", text_color="#00FFFF")
                self.ent_y.delete(0, 'end')
                self.ent_y.insert(0, f"{y:.4f}")
            else:
                lbl_res.configure(text=f"Attenzione: y={y:.4f} fuori dal range 0-1", text_color="orange")
                self.ent_y.delete(0, 'end')
                self.ent_y.insert(0, f"{y:.4f}")
                
        ctk.CTkButton(popup, text="Calcola e Applica 'y'", command=calc_y, fg_color="#2A8C4B", hover_color="#1E6636").pack(pady=15)

    def add_component(self):
        pt1 = self.var_cin.get()
        pt2 = self.var_cout.get()
        ctype = self.var_ctype.get()
        if pt1 == pt2 or pt1 == "Nessun Punto" or pt2 == "Nessun Punto":
            self.label_error.configure(text="Errore: Seleziona due punti differenti per il componente.")
            return
            
        try:
            y_val = float(self.ent_y.get().replace(',','.'))
        except:
            self.label_error.configure(text="Errore: Frazione di massa non valida.")
            return
            
        self.components.append({
            'type': ctype,
            'in_pt': pt1,
            'out_pt': pt2,
            'y': y_val
        })
        self.update_gui()

    def remove_component(self, idx):
        if 0 <= idx < len(self.components):
            self.components.pop(idx)
            self.update_gui()

    def clear_all(self):
        self.points.clear()
        self.components.clear()
        self.update_gui()

    def delete_point_idx(self, idx):
        if 0 <= idx < len(self.points):
            self.points.pop(idx)
            self.update_gui()

    def rename_point(self, idx, new_name):
        if 0 <= idx < len(self.points):
            self.points[idx].name = new_name
            self.update_gui() 

    def move_point_up(self, idx):
        if idx > 0:
            self.points[idx-1], self.points[idx] = self.points[idx], self.points[idx-1]
            self.update_gui()

    def move_point_down(self, idx):
        if idx < len(self.points) - 1:
            self.points[idx+1], self.points[idx] = self.points[idx], self.points[idx+1]
            self.update_gui()

    def update_gui(self):
        n_list = [p.name for p in self.points]
        self.combo_start_pt.configure(values=n_list if n_list else ["Nessun Punto"])
        self.cmb_cin.configure(values=n_list if n_list else ["Nessun Punto"])
        self.cmb_cout.configure(values=n_list if n_list else ["Nessun Punto"])
        
        if n_list:
            if self.var_start_pt.get() not in n_list:
                self.var_start_pt.set(n_list[-1])
            if self.var_cin.get() not in n_list:
                self.var_cin.set(n_list[-1])
            if self.var_cout.get() not in n_list:
                self.var_cout.set(n_list[0] if len(n_list) > 1 else n_list[-1])
            
        self.rebuild_points_list()
        self.rebuild_components_list()
        self.update_transformations()
        self.redraw_plots()

    def rebuild_components_list(self):
        for widget in getattr(self, "comp_list_frame", ctk.CTkFrame(self)).winfo_children(): widget.destroy()
        if not hasattr(self, "comp_list_frame"): return
        
        for i, c in enumerate(self.components):
            rf = ctk.CTkFrame(self.comp_list_frame, fg_color="transparent")
            rf.pack(fill="x", pady=2, padx=2)
            lbl = ctk.CTkLabel(rf, text=f"{c['type']}: {c['in_pt']} -> {c['out_pt']} [y={c['y']:.2f}]", font=ctk.CTkFont(size=11))
            lbl.pack(side="left", padx=5)
            btn = ctk.CTkButton(rf, text="X", width=20, height=20, fg_color="red", command=lambda ii=i: self.remove_component(ii))
            btn.pack(side="right", padx=5)

    def rebuild_points_list(self):
        for widget in self.pts_frame.winfo_children(): widget.destroy()
        
        for i, pt in enumerate(self.points):
            row_frame = ctk.CTkFrame(self.pts_frame, fg_color="gray30")
            row_frame.pack(fill="x", pady=2, padx=2)
            
            en_name = ctk.CTkEntry(row_frame, width=150, height=25)
            en_name.insert(0, pt.name)
            en_name.bind("<FocusOut>", lambda e, ii=i, en=en_name: self.rename_point(ii, en.get()))
            en_name.bind("<Return>", lambda e, ii=i, en=en_name: self.rename_point(ii, en.get()))
            en_name.grid(row=0, column=0, padx=5, pady=5, sticky="w")
            
            lbl = ctk.CTkLabel(row_frame, text=f"P: {pt.P_bar:.2f} bar | T: {pt.T_C:.1f} °C\nh: {pt.h:.1f} kJ/kg | s: {pt.s:.3f}", font=ctk.CTkFont(size=11), justify="left")
            lbl.grid(row=0, column=1, padx=5, sticky="w")
            
            btn_del = ctk.CTkButton(row_frame, text="X", width=25, height=25, fg_color="red", hover_color="#913834", command=lambda ii=i: self.delete_point_idx(ii))
            btn_del.grid(row=0, column=2, padx=5, pady=5)
            
            btn_up = ctk.CTkButton(row_frame, text="▲", width=25, height=25, fg_color="gray50", hover_color="gray30", command=lambda ii=i: self.move_point_up(ii))
            btn_up.grid(row=0, column=3, padx=2, pady=5)
            
            btn_down = ctk.CTkButton(row_frame, text="▼", width=25, height=25, fg_color="gray50", hover_color="gray30", command=lambda ii=i: self.move_point_down(ii))
            btn_down.grid(row=0, column=4, padx=2, pady=5)

    def update_transformations(self):
        for w in self.trans_frame.winfo_children(): w.destroy()
        
        try:
            m_dot = float(self.var_portata.get().replace(',','.'))
        except: m_dot = 1.0
        try:
            eta_t = min(max(float(self.var_eta_turbina.get().replace(',','.')), 0.01), 1.0)
        except: eta_t = 1.0
        try:
            eta_p = min(max(float(self.var_eta_pompa.get().replace(',','.')), 0.01), 1.0)
        except: eta_p = 1.0
        
        W_t_ideal = W_t_real = 0.0
        W_p_ideal = W_p_real = 0.0
        Q1 = Q2 = 0.0
        n = len(self.points)
        
        if n < 2:
            self.lbl_report.configure(text="Necessita di almeno 2 punti")
            return
        
        is_closed = self.var_close_cycle.get()
        is_manual = len(self.components) > 0
        
        def get_pt(name): return next((p for p in self.points if p.name == name), None)
        
        if is_manual:
            for comp in self.components:
                pt1 = get_pt(comp['in_pt'])
                pt2 = get_pt(comp['out_pt'])
                if not pt1 or not pt2: continue
                
                dh = pt2.h - pt1.h
                ds = pt2.s - pt1.s
                dp = pt2.P_bar - pt1.P_bar
                y = comp['y']
                
                note_real = ""
                if comp['type'] == "Turbina": # Espansione, assume dh_ideal = dh
                    dh_ideal = dh
                    dh_real = dh_ideal * eta_t
                    tipo = f"Turbina (y={y})"
                    W_t_ideal += -dh_ideal * y
                    W_t_real += -dh_real * y
                    note_real = f"  → Reale: Δh={dh_real:+.1f} [η_is={eta_t:.2f}]"
                elif comp['type'] == "Pompa":
                    dh_ideal = dh
                    dh_real = dh_ideal / eta_p
                    tipo = f"Pompa (y={y})"
                    W_p_ideal += dh_ideal * y
                    W_p_real += dh_real * y
                    note_real = f"  → Reale: Δh={dh_real:+.1f} [η_is={eta_p:.2f}]"
                elif comp['type'] == "Caldaia/Risurisc.":
                    tipo = f"Caldaia/Risur. (y={y})"
                    Q1 += dh * y
                elif comp['type'] == "Condensatore":
                    tipo = f"Condensatore (y={y})"
                    Q2 += abs(dh) * y
                else:
                    tipo = f"Misto (y={y})"
                    if dh > 0: Q1 += dh * y
                    else: Q2 += abs(dh) * y
                    
                frame = ctk.CTkFrame(self.trans_frame)
                frame.pack(fill="x", pady=2)
                txt_color = "black" if ctk.get_appearance_mode() != "Dark" else "white"
                ctk.CTkLabel(frame, text=f"{pt1.name} ➞ {pt2.name}", font=ctk.CTkFont(weight="bold", size=13)).pack(anchor="w", padx=5)
                detail_text = f"{tipo} | Δh:{dh:+.1f} kJ/kg (tot: {dh*y:+.1f})"
                if note_real: detail_text += f"\n{note_real}"
                ctk.CTkLabel(frame, text=detail_text, font=ctk.CTkFont(size=11), text_color=txt_color, justify="left").pack(anchor="w", padx=15)
        else:
            segments = n if is_closed else n - 1
            for i in range(segments):
                pt1 = self.points[i]
                pt2 = self.points[(i+1)%n]
                
                dh = pt2.h - pt1.h
                dp = pt2.P_bar - pt1.P_bar
                ds = pt2.s - pt1.s
                
                is_isobaric = abs(dp) < 1e-2 
                is_isentropic = abs(ds) < 2e-2
                is_isenthalpic = abs(dh) < 1e-1
                
                tipo = "Generica"
                dh_real = dh
                note_real = ""
                
                if is_isenthalpic and dp < 0:
                    tipo = "Laminazione ISO-H"
                elif (is_isentropic or (dp < 0 and ds >= 0)) and dh < 0:
                    # Expansion: turbine
                    dh_ideal = dh
                    dh_real = dh_ideal * eta_t
                    tipo = "Espansione ISO-S (Turbina)"
                    W_t_ideal += -dh_ideal
                    W_t_real += -dh_real
                    note_real = f"  → Reale: Δh_real={dh_real:+.1f} kJ/kg  [η_is={eta_t:.2f}]"
                elif dp > 0 and dh > 0:
                    # Compression: pump
                    dh_ideal = dh
                    dh_real = dh_ideal / eta_p
                    tipo = "Compressione Pompa"
                    W_p_ideal += dh_ideal
                    W_p_real += dh_real
                    note_real = f"  → Reale: Δh_real={dh_real:+.1f} kJ/kg  [η_is={eta_p:.2f}]"
                elif is_isobaric and dh > 0:
                    tipo = "Riscald. Isobara (Caldaia)"
                    Q1 += dh
                elif is_isobaric and dh < 0:
                    tipo = "Raffredd. Isobara (Condensatore)"
                    Q2 += abs(dh)
                else:
                    if dh > 0: Q1 += dh
                    else: Q2 += abs(dh)
                    
                frame = ctk.CTkFrame(self.trans_frame)
                frame.pack(fill="x", pady=2)
                txt_color = "black" if ctk.get_appearance_mode() != "Dark" else "white"
                ctk.CTkLabel(frame, text=f"{pt1.name} ➞ {pt2.name}", font=ctk.CTkFont(weight="bold", size=13)).pack(anchor="w", padx=5)
                detail_text = f"Tipo: {tipo}\nΔh: {dh:+.1f} kJ/kg | Δs: {ds:+.3f} | ΔP: {dp:+.1f} bar"
                if note_real:
                    detail_text += f"\n{note_real}"
                ctk.CTkLabel(frame, text=detail_text, font=ctk.CTkFont(size=11), text_color=txt_color, justify="left").pack(anchor="w", padx=15)

        W_net_ideal = W_t_ideal - W_p_ideal
        W_net_real  = W_t_real  - W_p_real
        eta_ideal = (W_net_ideal / Q1 * 100) if Q1 > 0 else 0.0
        eta_real  = (W_net_real  / Q1 * 100) if Q1 > 0 else 0.0
        
        P_t_ideal  = W_t_ideal * m_dot
        P_t_real   = W_t_real  * m_dot
        P_p_ideal  = W_p_ideal * m_dot
        P_p_real   = W_p_real  * m_dot
        P_net_ideal = W_net_ideal * m_dot
        P_net_real  = W_net_real  * m_dot
        Q_dot1     = Q1 * m_dot
        Q_dot2     = Q2 * m_dot
        
        self.cycle_results = {
            'W_t': W_t_real, 'P_t': P_t_real,
            'W_p': W_p_real, 'P_p': P_p_real,
            'Q1': Q1, 'Q_dot1': Q_dot1,
            'Q2': Q2, 'Q_dot2': Q_dot2,
            'eta': eta_real
        }
        
        # Dati aggiuntivi
        bwr_ideal = (W_p_ideal / W_t_ideal * 100) if W_t_ideal > 0 else 0.0
        bwr_real  = (W_p_real  / W_t_real  * 100) if W_t_real  > 0 else 0.0
        # Titolo x in uscita turbina (se disponibile)
        x_turb = None
        if len(self.points) >= 2:
            # Cerca punto a pressione minima con s massima (uscita turbina)
            pmin_bar = min(p.P_bar for p in self.points)
            cands = [p for p in self.points if p.P_bar < pmin_bar * 1.1]
            if cands:
                pt_out_turb = max(cands, key=lambda p: p.s)
                x_turb = getattr(pt_out_turb, 'x', None)
        # T_Carnot e eta_Carnot (temperature massima e minima del ciclo)
        T_max_C = max(p.T_C for p in self.points) if self.points else 0
        T_min_C = min(p.T_C for p in self.points) if self.points else 0
        T_max_K = T_max_C + 273.15
        T_min_K = T_min_C + 273.15
        eta_carnot = (1 - T_min_K / T_max_K) * 100 if T_max_K > T_min_K else 0

        sep = "─" * 32
        x_str = f"{x_turb:.3f}" if x_turb is not None and 0 <= x_turb <= 1 else ("Surriscaldato" if x_turb is None else "–")
        report = (
            f"{sep}\n"
            f"  ṁ = {m_dot:.2f} kg/s\n"
            f"{sep}\n"
            f"  CICLO IDEALE (η_is = 1)\n"
            f"  W_turbina  = {W_t_ideal:>8.2f} kJ/kg\n"
            f"  W_pompa    = {W_p_ideal:>8.2f} kJ/kg\n"
            f"  W_netto    = {W_net_ideal:>8.2f} kJ/kg  ({P_net_ideal:.1f} kW)\n"
            f"  Q₁ (caldaia) = {Q1:>6.2f} kJ/kg  ({Q_dot1:.1f} kW)\n"
            f"  Q₂ (cond.)   = {Q2:>6.2f} kJ/kg  ({Q_dot2:.1f} kW)\n"
            f"  BWR          = {bwr_ideal:>6.2f}%\n"
            f"  η_ciclo    = {eta_ideal:.2f}%\n"
            f"{sep}\n"
            f"  CICLO REALE (η_t={eta_t:.2f}, η_p={eta_p:.2f})\n"
            f"  W_turbina  = {W_t_real:>8.2f} kJ/kg\n"
            f"  W_pompa    = {W_p_real:>8.2f} kJ/kg\n"
            f"  W_netto    = {W_net_real:>8.2f} kJ/kg  ({P_net_real:.1f} kW)\n"
            f"  BWR reale    = {bwr_real:>6.2f}%\n"
            f"  η_ciclo    = {eta_real:.2f}%\n"
            f"{sep}\n"
            f"  DATI AGGIUNTIVI\n"
            f"  x uscita turbina = {x_str}\n"
            f"  T_max / T_min  = {T_max_C:.1f} / {T_min_C:.1f} °C\n"
            f"  η_Carnot (limite) = {eta_carnot:.2f}%\n"
            f"  Degrado da Carnot = {(eta_carnot-eta_real):.2f} pp\n"
            f"{sep}"
        )
        self.lbl_report.configure(text=report)

    def generate_path(self, pt1, pt2, num_points=50):
        """
        Generate a thermodynamically correct path between two state points.
        Uses IAPWS-97 via path_generator for physically accurate curves,
        including proper saturation dome crossings for isobaric processes.
        """
        dp = pt2.P_bar - pt1.P_bar
        ds = pt2.s - pt1.s
        dh = pt2.h - pt1.h

        is_isobaric = abs(dp) < 1e-2
        is_isentropic = abs(ds) < 2e-2
        is_isenthalpic = abs(dh) < 1e-1

        try:
            if is_isobaric:
                path = iapws_isobaric_path(pt1.P_bar, pt1.h, pt2.h, num_points)
            elif is_isentropic:
                result = iapws_isentropic_path(pt1.s, pt1.P_bar, pt2.P_bar, num_points)
                if result is None:
                    return [pt1, pt2]
                path = result
            elif is_isenthalpic:
                result = iapws_isenthalpic_path(pt1.h, pt1.P_bar, pt2.P_bar, num_points)
                if result is None:
                    return [pt1, pt2]
                path = result
            else:
                path = iapws_auto_path(pt1, pt2, num_points)

            if path is None or len(path['P']) < 2:
                return [pt1, pt2]

            # Convert dict-based path to SimplePt list for backward compat
            class _SimplePt:
                def __init__(self, P_bar, T_C, h, s, v):
                    self.P_bar = P_bar
                    self.T_C = T_C
                    self.h = h
                    self.s = s
                    self.v = v
                    self.x = None
                    self.phase = None

            n = len(path['P'])
            return [_SimplePt(path['P'][i], path['T'][i], path['h'][i],
                              path['s'][i], path['v'][i]) for i in range(n)]
        except Exception:
            return [pt1, pt2]

    def get_saturation_intersections(self, pt1, pt2):
        dp = pt2.P_bar - pt1.P_bar
        ds = pt2.s - pt1.s
        dh = pt2.h - pt1.h
        dv = pt2.v - pt1.v
        
        is_isobaric = abs(dp) < 1e-2
        is_isentropic = abs(ds) < 2e-2
        is_isenthalpic = abs(dh) < 1e-1
        is_isochoric = abs(dv) < 1e-6
        
        P_min = min(pt1.P_bar, pt2.P_bar) / 10.0
        P_max = max(pt1.P_bar, pt2.P_bar) / 10.0
        
        intersections = []
        
        try:
            if is_isobaric:
                if P_min < 22.06:
                    sat_l = IAPWS97(P=P_min, x=0)
                    sat_v = IAPWS97(P=P_min, x=1)
                    if min(pt1.h, pt2.h) <= sat_l.h <= max(pt1.h, pt2.h): intersections.append(sat_l)
                    if min(pt1.h, pt2.h) <= sat_v.h <= max(pt1.h, pt2.h): intersections.append(sat_v)
            else:
                if P_max > P_min:
                    P_s_max = min(P_max, 22.06)
                    P_s_min = max(P_min, 0.000612)
                    
                    if P_s_max > P_s_min:
                        def target_prop(P):
                            if is_isentropic: return pt1.s
                            if is_isenthalpic: return pt1.h
                            if is_isochoric: return pt1.v
                            t = (P * 10.0 - pt1.P_bar) / (pt2.P_bar - pt1.P_bar)
                            return pt1.h + t * (pt2.h - pt1.h)

                        def f_v(P): return getattr(IAPWS97(P=P, x=1), 's' if is_isentropic else ('v' if is_isochoric else 'h')) - target_prop(P)
                        def f_l(P): return getattr(IAPWS97(P=P, x=0), 's' if is_isentropic else ('v' if is_isochoric else 'h')) - target_prop(P)

                        for f, is_vap in [(f_v, True), (f_l, False)]:
                            try:
                                v_min, v_max = f(P_s_min), f(P_s_max)
                                if v_min * v_max <= 0:
                                    res = opt.root_scalar(f, bracket=[P_s_min, P_s_max])
                                    if res.converged: intersections.append(IAPWS97(P=res.root, x=1 if is_vap else 0))
                                else:
                                    r = opt.fsolve(f, (P_s_min+P_s_max)/2)[0]
                                    if P_s_min - 1e-4 <= r <= P_s_max + 1e-4:
                                        intersections.append(IAPWS97(P=r, x=1 if is_vap else 0))
                            except: pass
        except: pass
        
        class SimplePt:
            def __init__(self, st, name):
                self.name = name
                self.P_bar = st.P * 10.0
                self.T_C = st.T - 273.15
                self.h = st.h
                self.s = st.s
                self.v = st.v
                self.x = st.x
                self.phase = st.phase
        
        unique_pts = []
        for st in intersections:
            if not any(abs(existing.P_bar - st.P*10)<1e-2 and existing.x == st.x for existing in unique_pts):
                unique_pts.append(SimplePt(st, "Int. Liq. Sat" if st.x==0 else "Int. Vap. Sat"))
        return unique_pts

    def redraw_plots(self):
        bg_col = '#242424' if ctk.get_appearance_mode() == 'Dark' else '#ebebeb'
        fg_col = 'white' if ctk.get_appearance_mode() == 'Dark' else 'black'

        for tab_name in ["Schema", "T-s", "p-v", "T-v", "h-s"]:
            ax = self.axes[tab_name]
            ax.clear()
            ax.set_facecolor(bg_col); ax.tick_params(colors=fg_col); ax.title.set_color(fg_col)
            
            if tab_name == "Schema":
                self.draw_schematic(ax, bg_col, fg_col)
                self.canvases[tab_name].draw()
                continue
                
            ax.xaxis.label.set_color(fg_col); ax.yaxis.label.set_color(fg_col)

            n_dome = len(self.dome_s)
            mid = n_dome // 2  # indice approssimativo del punto critico
            if tab_name == "T-s":
                ax.fill(self.dome_s, self.dome_T, color='#1a3a4a', alpha=0.35, zorder=0)
                ax.plot(self.dome_s, self.dome_T, color='#50c8e8', linewidth=2.2, label='Campana saturazione', zorder=1)
                ax.annotate('x=0', (self.dome_s[0], self.dome_T[0]), fontsize=8, color='#50c8e8', xytext=(8,4), textcoords='offset points')
                ax.annotate('x=1', (self.dome_s[-1], self.dome_T[-1]), fontsize=8, color='#50c8e8', xytext=(-30,4), textcoords='offset points')
                cp = self.get_critical_point()
                ax.scatter([cp['s']], [cp['T']], s=60, color='#ff9944', zorder=6, label='Punto critico')
                ax.annotate('Pc', (cp['s'], cp['T']), fontsize=8, color='#ff9944', xytext=(4,4), textcoords='offset points')
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("T (°C)")
            elif tab_name == "p-v":
                ax.fill(self.dome_v, self.dome_P, color='#1a3a4a', alpha=0.35, zorder=0)
                ax.plot(self.dome_v, self.dome_P, color='#50c8e8', linewidth=2.2, label='Campana saturazione', zorder=1)
                ax.set_xlabel("v (m³/kg)"); ax.set_ylabel("P (bar)")
                ax.set_yscale('log'); ax.set_xscale('log')
            elif tab_name == "T-v":
                ax.fill(self.dome_v, self.dome_T, color='#1a3a4a', alpha=0.35, zorder=0)
                ax.plot(self.dome_v, self.dome_T, color='#50c8e8', linewidth=2.2, label='Campana saturazione', zorder=1)
                ax.set_xlabel("v (m³/kg)"); ax.set_ylabel("T (°C)")
                ax.set_xscale('log')
            elif tab_name == "h-s":
                ax.fill(self.dome_s, self.dome_h, color='#1a3a4a', alpha=0.35, zorder=0)
                ax.plot(self.dome_s, self.dome_h, color='#50c8e8', linewidth=2.2, label='Campana saturazione', zorder=1)
                cp = self.get_critical_point()
                ax.scatter([cp['s']], [cp['h']], s=60, color='#ff9944', zorder=6)
                ax.annotate('Pc', (cp['s'], cp['h']), fontsize=8, color='#ff9944', xytext=(4,4), textcoords='offset points')
                ax.set_xlabel("s (kJ/kg·K)"); ax.set_ylabel("h (kJ/kg)")

            if self.points:
                xs_scatter, ys_scatter = [], []
                pts_for_hover = []
                for pt in self.points:
                    x, y = self.get_xy_for_tab(pt, tab_name)
                    xs_scatter.append(x); ys_scatter.append(y)
                    pts_for_hover.append(pt)
                    ax.annotate(f"{pt.name}", (x, y), textcoords="offset points", xytext=(5,5), ha='left', color='white', weight='bold')

                if len(self.points) > 1:
                    is_closed = self.var_close_cycle.get()
                    is_manual = len(self.components) > 0
                    
                    try:
                        eta_t = min(max(float(self.var_eta_turbina.get().replace(',','.')), 0.01), 1.0)
                        eta_p = min(max(float(self.var_eta_pompa.get().replace(',','.')), 0.01), 1.0)
                    except:
                        eta_t = eta_p = 1.0
                    
                    def get_pt(name): return next((p for p in self.points if p.name == name), None)
                    
                    segments_list = []
                    if is_manual:
                        for comp in self.components:
                            pt1 = get_pt(comp['in_pt'])
                            pt2 = get_pt(comp['out_pt'])
                            if pt1 and pt2:
                                segments_list.append((pt1, pt2, comp['type']))
                    else:
                        n_segs = len(self.points) if is_closed else len(self.points) - 1
                        for i in range(n_segs):
                            segments_list.append((self.points[i], self.points[(i+1)%len(self.points)], None))
                            
                    try:
                        eta_t_plot = min(max(float(self.var_eta_turbina.get().replace(',','.')), 0.01), 1.0)
                        eta_p_plot = min(max(float(self.var_eta_pompa.get().replace(',','.')), 0.01), 1.0)
                    except:
                        eta_t_plot = eta_p_plot = 1.0

                    for pt1, pt2, ctype in segments_list:
                        path_pts = self.generate_path(pt1, pt2, num_points=50)
                        
                        path_x, path_y = [], []
                        for pp in path_pts:
                            px, py = self.get_xy_for_tab(pp, tab_name)
                            path_x.append(px); path_y.append(py)
                            
                        # Ciclo ideale — sempre tratteggiato
                        ideal_color = '#60aaff'
                        ax.plot(path_x, path_y, color=ideal_color, linestyle='--', linewidth=1.8, alpha=0.75, label='Ideale (η=1)' if pt1 == segments_list[0][0] else '')

                        # Direction arrow on ideal path (clockwise for power cycle)
                        if len(path_x) > 2:
                            add_direction_arrow(ax, np.array(path_x), np.array(path_y),
                                                color=ideal_color, size=10, position=0.4)
                        
                        dh = pt2.h - pt1.h
                        dp = pt2.P_bar - pt1.P_bar
                        ds = pt2.s - pt1.s
                        
                        if ctype:
                            is_expansion = ctype == "Turbina"
                            is_pump = ctype == "Pompa"
                            comp_label = ctype
                        else:
                            is_isobaric = abs(dp) < 1e-2
                            is_isentropic = abs(ds) < 2e-2
                            is_isenthalpic = abs(dh) < 1e-1
                            is_expansion = (is_isentropic or (dp < 0 and ds >= 0)) and dh < 0
                            is_pump = dp > 0 and dh > 0
                            
                            comp_label = ""
                            if is_isenthalpic and dp < 0: comp_label = "Valvola"
                            elif is_expansion: comp_label = "Turbina"
                            elif is_pump: comp_label = "Pompa"
                            elif is_isobaric and dh > 0: comp_label = "Caldaia"
                            elif is_isobaric and dh < 0: comp_label = "Condensatore"

                        if comp_label:
                            x1, y1 = self.get_xy_for_tab(pt1, tab_name)
                            x2, y2 = self.get_xy_for_tab(pt2, tab_name)
                            if tab_name in ["p-v", "T-v"]:
                                mx = np.exp((np.log(max(x1, 1e-9)) + np.log(max(x2, 1e-9))) / 2)
                            else: mx = (x1 + x2) / 2
                                
                            if tab_name == "p-v":
                                my = np.exp((np.log(max(y1, 1e-9)) + np.log(max(y2, 1e-9))) / 2)
                            else: my = (y1 + y2) / 2
                                
                            ax.annotate(comp_label, (mx, my), textcoords="offset points", xytext=(0, 6), ha='center', color='#00FFFF', fontsize=10, style='italic', weight='bold', bbox=dict(boxstyle="round,pad=0.1", fc=bg_col, ec="none", alpha=0.7))
                        
                        def _make_real_pt(P_bar, h_val):
                            try:
                                st = IAPWS97(P=P_bar / 10.0, h=h_val)
                                rp = type('RealPt', (), {})()
                                rp.P_bar=st.P*10; rp.T_C=st.T-273.15; rp.h=st.h
                                rp.s=st.s; rp.v=st.v; rp.x=st.x; rp.phase=st.phase
                                return rp
                            except: return None
                        
                        # Ciclo reale — sempre solido (anche se eta=1, sovrapposto al tratteggiato)
                        if is_expansion:
                            h_real_end = pt1.h + dh * eta_t_plot
                            rp = _make_real_pt(pt2.P_bar, h_real_end)
                            if rp:
                                rx1, ry1 = self.get_xy_for_tab(pt1, tab_name)
                                rx2, ry2 = self.get_xy_for_tab(rp, tab_name)
                                ax.plot([rx1, rx2], [ry1, ry2], color='#ff5555', linestyle='-', linewidth=2.5, alpha=0.95, label='Reale turbina')
                                ax.scatter([rx2], [ry2], s=60, c='#ff5555', edgecolors='#cc0000', zorder=5)
                                # Direction arrow for real turbine
                                add_direction_arrow(ax, np.array([rx1, rx2]), np.array([ry1, ry2]),
                                                    color='#ff5555', size=10, position=0.5)
                                if abs(eta_t_plot - 1.0) > 1e-3:
                                    ax.annotate(f"{pt2.name}' (reale)", (rx2, ry2), textcoords="offset points",
                                                xytext=(6, -12), ha='left', color='#ff5555', weight='bold', fontsize=8,
                                                bbox=dict(boxstyle="round,pad=0.15", fc=bg_col, ec='none', alpha=0.8))
                                    # linea isobara da pt2' a pt2 (chiusura grafica)
                                    ret_path = self.generate_path(rp, pt2, num_points=20)
                                    rt_x = [self.get_xy_for_tab(rpp, tab_name)[0] for rpp in ret_path]
                                    rt_y = [self.get_xy_for_tab(rpp, tab_name)[1] for rpp in ret_path]
                                    ax.plot(rt_x, rt_y, color='#ff5555', linestyle=':', linewidth=1.4, alpha=0.55)
                        elif is_pump:
                            h_real_end = pt1.h + dh / eta_p_plot
                            rp = _make_real_pt(pt2.P_bar, h_real_end)
                            if rp:
                                rx1, ry1 = self.get_xy_for_tab(pt1, tab_name)
                                rx2, ry2 = self.get_xy_for_tab(rp, tab_name)
                                ax.plot([rx1, rx2], [ry1, ry2], color='#ffaa33', linestyle='-', linewidth=2.5, alpha=0.95, label='Reale pompa')
                                ax.scatter([rx2], [ry2], s=60, c='#ffaa33', edgecolors='#cc7700', zorder=5)
                                # Direction arrow for real pump
                                add_direction_arrow(ax, np.array([rx1, rx2]), np.array([ry1, ry2]),
                                                    color='#ffaa33', size=10, position=0.5)
                                if abs(eta_p_plot - 1.0) > 1e-3:
                                    ax.annotate(f"{pt2.name}' (reale)", (rx2, ry2), textcoords="offset points",
                                                xytext=(6, -12), ha='left', color='#ffaa33', weight='bold', fontsize=8,
                                                bbox=dict(boxstyle="round,pad=0.15", fc=bg_col, ec='none', alpha=0.8))
                                    ret_path = self.generate_path(rp, pt2, num_points=20)
                                    rt_x = [self.get_xy_for_tab(rpp, tab_name)[0] for rpp in ret_path]
                                    rt_y = [self.get_xy_for_tab(rpp, tab_name)[1] for rpp in ret_path]
                                    ax.plot(rt_x, rt_y, color='#ffaa33', linestyle=':', linewidth=1.4, alpha=0.55)
                
                scatter = ax.scatter(xs_scatter, ys_scatter, s=80, c='#ffe066', edgecolors='#cc3300', linewidths=1.5, zorder=7)
                self.scatters[tab_name] = scatter
                
                cursor = mplcursors.cursor(scatter, hover=True)
                @cursor.connect("add")
                def on_add(sel, pts=pts_for_hover, sct=scatter):
                    idx = sel.index
                    pt = pts[idx]
                    val_x = pt.x
                    str_x = pt.phase if val_x is None else (f'{val_x:.3f}' if 0 < val_x < 1 else ('Liq. Sat.' if val_x <= 0 else 'Vap. Sat.'))
                    sel.annotation.set_text(
                        f"{pt.name}\n"
                        f"P : {pt.P_bar:.3f} bar\n"
                        f"T : {pt.T_C:.2f} °C\n"
                        f"h : {pt.h:.2f} kJ/kg\n"
                        f"s : {pt.s:.4f} kJ/kg·K\n"
                        f"v : {pt.v:.5e} m³/kg\n"
                        f"Fase: {str_x}"
                    )
                    sel.annotation.get_bbox_patch().set_facecolor('#0d1117')
                    sel.annotation.get_bbox_patch().set_alpha(0.95)
                    sel.annotation.set_color('#e6edf3')
                    sel.annotation.set_fontsize(10)

                # Legenda sinottica
                from matplotlib.lines import Line2D
                legend_elements = [
                    Line2D([0],[0], color='#60aaff', linestyle='--', linewidth=1.8, label='Ciclo Ideale (η=1)'),
                    Line2D([0],[0], color='#ff5555', linestyle='-',  linewidth=2.5, label='Espansione Reale'),
                    Line2D([0],[0], color='#ffaa33', linestyle='-',  linewidth=2.5, label='Compressione Reale'),
                    Line2D([0],[0], color='#50c8e8', linestyle='-',  linewidth=2.2, label='Campana saturazione'),
                ]
                ax.legend(handles=legend_elements, fontsize=8, loc='best',
                          facecolor='#161b22', labelcolor='#e6edf3', framealpha=0.88)

            ax.grid(True, linestyle='--', alpha=0.25, color='gray')
            self.canvases[tab_name].draw()
        
    def export_pdf(self):
        fps = asksaveasfilename(defaultextension=".pdf", filetypes=[("PDF Document", "*.pdf")])
        if fps:
            with PdfPages(fps) as pdf:
                for f in self.figs.values(): pdf.savefig(f, facecolor=f.get_facecolor())

    def draw_schematic(self, ax, bg_col, fg_col):
        import matplotlib.patches as patches
        import numpy as np
        
        ax.clear()
        ax.set_facecolor(bg_col)
        ax.axis('off')
        ax.set_xlim(0, 10.5)
        ax.set_ylim(-2, 11)
        ax.set_title("Schema Impianto (Ciclo Rankine a 4 stazioni principali)", color=fg_col, weight='bold', fontsize=16)
        
        # Colors that look nice in dark or light mode
        red_c = '#ff4d4d' if bg_col == '#242424' else '#e60000'
        blue_c = '#4da6ff' if bg_col == '#242424' else '#0066cc'
        orange_c = '#ffb347' if bg_col == '#242424' else '#e68a00'
        cyan_c = '#00ffff' if bg_col == '#242424' else '#009999'
        
        line_hot = red_c
        line_cold = blue_c
        
        # --- SHAPES ---
        # Caldaia (Boiler)
        boiler = patches.Rectangle((1.5, 3.5), 2.5, 4.5, fill=True, color='#2c1e1e' if bg_col=='#242424' else '#ffebe6', ec=red_c, lw=2.5)
        ax.add_patch(boiler)
        ax.plot([1.5, 4], [4.5, 4.5], color=red_c, lw=2)
        for i in range(1, 6):
            if 1.5 + i*0.4 < 4:
                ax.plot([1.5 + i*0.4, 1.5 + i*0.4], [3.5, 4.5], color=red_c, lw=2)
        ax.text(2.75, 4.0, "caldaia", color=red_c, ha='center', va='center', fontsize=13, weight='bold')

        # Turbina (Turbine)
        t_verts = [(6.5, 7.5), (7.8, 6.8), (7.8, 4.2), (6.5, 3.5)]
        turbine = patches.Polygon(t_verts, fill=True, color='#2f2214' if bg_col=='#242424' else '#fff3e6', ec=orange_c, lw=2.5)
        ax.add_patch(turbine)
        ax.text(7.15, 8.2, "turbina", color=orange_c, ha='center', fontsize=13, weight='bold')
        
        # Generatore e albero
        ax.plot([7.8, 9.3], [5.5, 5.5], color=fg_col, linestyle='-.', lw=1.5)
        gen = patches.Circle((9.3, 5.5), 0.5, fill=True, color='#1e1e1e' if bg_col=='#242424' else '#f0f0f0', ec=fg_col, lw=2)
        ax.add_patch(gen)
        x_sine = np.linspace(9.0, 9.6, 50)
        y_sine = 5.5 + 0.25 * np.sin(np.pi * (x_sine - 9.0) / 0.3)
        ax.plot(x_sine, y_sine, color=fg_col, lw=1.5)
        
        # Condensatore (Condenser)
        cond = patches.Circle((7.15, 1.5), 0.8, fill=True, color='#1a2433' if bg_col=='#242424' else '#e6f0ff', ec=blue_c, lw=2.5)
        ax.add_patch(cond)
        ax.plot([6.55, 6.85, 7.15, 7.45, 7.75], [1.3, 1.7, 1.3, 1.7, 1.3], color=blue_c, lw=2)
        ax.add_patch(patches.Rectangle((6.75, 0.3), 0.8, 0.4, fill=False, lw=2, color=blue_c))
        ax.plot([7.15, 7.15], [0.7, 0.3], color=blue_c, lw=2) # drain pipe
        ax.text(8.8, 1.5, "condensatore", color=blue_c, ha='center', va='center', fontsize=13, weight='bold')

        # Pompa (Pump)
        pump = patches.Circle((4, 0.5), 0.5, fill=True, color='#1a3333' if bg_col=='#242424' else '#e6ffff', ec=cyan_c, lw=2.5)
        ax.add_patch(pump)
        ax.plot([4, 4], [0.5, 0.0], color=cyan_c, lw=2)
        ax.text(4, 1.5, "pompa", color=cyan_c, ha='center', fontsize=13, weight='bold')

        # --- CONNECTIONS ---
        # Pompa -> Caldaia (Punto 2)
        ax.plot([3.5, 2.75], [0.5, 0.5], color=cyan_c, lw=2)
        ax.plot([2.75, 2.75], [0.5, 3.5], color=cyan_c, lw=2)
        ax.annotate("", xy=(2.75, 2.0), xytext=(2.75, 0.5), arrowprops=dict(arrowstyle="->", color=cyan_c, lw=2, shrinkA=0, shrinkB=0))
        
        # Caldaia -> Turbina (Punto 3)
        ax.plot([2.75, 2.75], [8.0, 9.5], color=line_hot, lw=2.5)
        ax.plot([2.75, 6.5], [9.5, 9.5], color=line_hot, lw=2.5)
        ax.plot([6.5, 6.5], [9.5, 7.5], color=line_hot, lw=2.5)
        ax.annotate("", xy=(4.6, 9.5), xytext=(4.5, 9.5), arrowprops=dict(arrowstyle="->", color=line_hot, lw=2.5, shrinkA=0, shrinkB=0))

        # Turbina -> Condensatore (Punto 4)
        ax.plot([7.15, 7.15], [5.5, 2.3], color=orange_c, lw=2)
        ax.annotate("", xy=(7.15, 3.5), xytext=(7.15, 4.0), arrowprops=dict(arrowstyle="->", color=orange_c, lw=2, shrinkA=0, shrinkB=0))
        
        # Condensatore -> Pompa (Punto 1)
        ax.plot([7.15, 7.15], [0.3, -0.5], color=line_cold, lw=2)
        ax.plot([7.15, 4.5], [-0.5, -0.5], color=line_cold, lw=2)
        ax.plot([4.5, 4.5], [-0.5, 0.5], color=line_cold, lw=2)
        ax.annotate("", xy=(5.5, -0.5), xytext=(6, -0.5), arrowprops=dict(arrowstyle="->", color=line_cold, lw=2, shrinkA=0, shrinkB=0))

        if not self.points: return
        
        # ROBUST MAPPING ALGORITHM for the 4 fundamental points
        pts_map = {"caldaia_out": None, "turbina_out": None, "condensatore_out": None, "pompa_out": None}
        
        # 3. Caldaia_out: Punto con Max Entalpia
        pmax_h = max(self.points, key=lambda p: p.h)
        pts_map["caldaia_out"] = pmax_h
        
        # 1. Condensatore_out: Punto con Min Entalpia
        pmin_h = min(self.points, key=lambda p: p.h)
        pts_map["condensatore_out"] = pmin_h
        
        # 2. Pompa_out: P massima e tra quelli S minima (liquido subraffreddato/saturo in alta pressione)
        pmax_P = max(self.points, key=lambda p: p.P_bar).P_bar
        pts_high_p = [p for p in self.points if p.P_bar > pmax_P * 0.9]
        if pts_high_p:
            pts_map["pompa_out"] = min(pts_high_p, key=lambda p: p.s)
            
        # 4. Turbina_out: P minima e tra quelli S massima (vapore di scarico al condensatore)
        pmin_P = min(self.points, key=lambda p: p.P_bar).P_bar
        pts_low_p = [p for p in self.points if p.P_bar < pmin_P * 1.1]
        if pts_low_p:
            pts_map["turbina_out"] = max(pts_low_p, key=lambda p: p.s)

        # Coordinate in cui mostrare i punti dinamici associati ai componenti
        pos_map = {
            "condensatore_out": (5.5, -1.3, "1", line_cold),
            "pompa_out":       (1.5,  2.0, "2", cyan_c),
            "caldaia_out":     (4.6, 10.3, "3", line_hot),
            "turbina_out":     (8.3,  4.0, "4", orange_c)
        }
        
        for key, pt in pts_map.items():
            if pt is not None:
                px, py, lbl, ec_col = pos_map[key]
                short_name = pt.name.split('(')[0].strip() if '(' in pt.name else pt.name
                testo = f"Pt: {lbl} [{short_name}]\n{pt.P_bar:.2f} bar\n{pt.T_C:.1f} °C"
                ax.text(px, py, testo, color=fg_col, fontsize=9.5, weight='bold', ha='center', va='center',
                        bbox=dict(boxstyle="round4,pad=0.5", fc='#2b2b2b' if bg_col=='#242424' else '#fcfcfc', ec=ec_col, lw=2.5, alpha=0.9))

        # Testi informativi di Calori e Lavori
        if hasattr(self, 'cycle_results') and self.cycle_results:
            res = self.cycle_results
            
            # Caldaia text
            if res['Q1'] > 0:
                ax.text(1.2, 5.75, f"Calore \nQ1: {res['Q1']:.1f} kJ/kg\nPotenza: {res['Q_dot1']:.1f} kW", 
                        color=red_c, fontsize=10, ha='right', va='center', weight='bold')
            
            # Condensatore text
            if res['Q2'] > 0:
                ax.text(8.2, 0.6, f"Calore \nQ2: {res['Q2']:.1f} kJ/kg\nPotenza: {res['Q_dot2']:.1f} kW", 
                        color=blue_c, fontsize=10, ha='left', va='center', weight='bold')
                
            # Turbina
            if res['W_t'] > 0:
                ax.text(8.0, 7.5, f"Lavoro \nL_t: {res['W_t']:.1f} kJ/kg\nPotenza: {res['P_t']:.1f} kW", 
                        color=orange_c, fontsize=10, ha='left', va='center', weight='bold')
                
            # Pompa
            if res['W_p'] > 0:
                ax.text(4.0, -1.0, f"Lavoro \nL_p: {res['W_p']:.1f} kJ/kg\nPotenza: {res['P_p']:.1f} kW", 
                        color=cyan_c, fontsize=10, ha='center', va='top', weight='bold')
                        
            # Rendimento al centro
            if res['eta'] > 0:
                ax.text(5.0, 5.5, f"η_ciclo: {res['eta']:.2f}%", color=fg_col, fontsize=13, weight='bold', 
                        ha='center', va='center', bbox=dict(boxstyle="round,pad=0.3", fc=bg_col, ec=fg_col, alpha=0.8, lw=1.5))

if __name__ == "__main__":
    app = ctk.CTk()
    app.geometry("1400x850")
    app.title("Test WaterThermoCAD")
    frame = WaterThermoCAD(app)
    frame.pack(fill="both", expand=True)
    app.mainloop()
