import customtkinter as ctk
import sys
import os

from calcolatore_acqua import WaterThermoCAD
from calcolatore_brayton import BraytonCAD
from calcolatore_otto import OttoCAD
from calcolatore_diesel import DieselCAD
from calcolatore_frigo import FrigoCAD

ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class UnifiedSuite(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Cicli Termodinamici - Suite Avanzata")
        self.geometry("1450x900")
        self.minsize(1200, 700)

        # configure layout: 1 row, 2 columns
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)

        # Costruisci Sidebar
        self.sidebar = ctk.CTkFrame(self, width=220, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(7, weight=1)

        self.logo = ctk.CTkLabel(self.sidebar, text="⚡ Cicli\nTermodinamici", font=ctk.CTkFont(size=24, weight="bold"))
        self.logo.grid(row=0, column=0, padx=20, pady=(30, 40))

        self.buttons = {}
        
        # Menu definizioni
        menu_items = [
            ("rankine", "💧 Ciclo Rankine/Acqua", self.show_rankine),
            ("brayton", "🔥 Ciclo Brayton/Gas", self.show_brayton),
            ("otto",    "⚙️ Ciclo Otto", self.show_otto),
            ("diesel",  "🛢️ Ciclo Diesel", self.show_diesel),
            ("frigo",   "❄️ Ciclo Frigorifero", self.show_frigo),
        ]

        for i, (key, text, cmd) in enumerate(menu_items):
            btn = ctk.CTkButton(self.sidebar, corner_radius=0, height=50, border_spacing=15, 
                                text=text, font=ctk.CTkFont(size=14, weight="bold"),
                                fg_color="transparent", text_color=("gray10", "gray90"), 
                                hover_color=("gray70", "gray30"), anchor="w", command=cmd)
            btn.grid(row=i+1, column=0, sticky="ew")
            self.buttons[key] = btn

        # Info & Repo
        self.info_lbl = ctk.CTkLabel(self.sidebar, text="Open Source Educational Tool\nGitHub Ready", font=ctk.CTkFont(size=11), text_color="gray50")
        self.info_lbl.grid(row=8, column=0, padx=20, pady=20, sticky="s")

        # Container principale per i frames
        self.main_container = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.main_container.grid(row=0, column=1, sticky="nsew")
        self.main_container.grid_rowconfigure(0, weight=1)
        self.main_container.grid_columnconfigure(0, weight=1)

        # Inizializzo le schermate
        self.frames = {
            "rankine": WaterThermoCAD(self.main_container),
            "brayton": BraytonCAD(self.main_container),
            "otto": OttoCAD(self.main_container),
            "diesel": DieselCAD(self.main_container),
            "frigo": FrigoCAD(self.main_container)
        }

        # Li posiziono tutti ma coperti
        for frame in self.frames.values():
            frame.grid(row=0, column=0, sticky="nsew")

        self.current_frame = None
        self.show_rankine()

    def select_button(self, name):
        # Reset colors
        for key, btn in self.buttons.items():
            btn.configure(fg_color="transparent")
        # Highlight selected
        self.buttons[name].configure(fg_color=("gray75", "gray25"))

    def show_frame(self, name):
        self.select_button(name)
        frame = self.frames[name]
        frame.tkraise()
        self.current_frame = name

    def show_rankine(self): self.show_frame("rankine")
    def show_brayton(self): self.show_frame("brayton")
    def show_otto(self): self.show_frame("otto")
    def show_diesel(self): self.show_frame("diesel")
    def show_frigo(self): self.show_frame("frigo")

if __name__ == "__main__":
    app = UnifiedSuite()
    app.mainloop()
