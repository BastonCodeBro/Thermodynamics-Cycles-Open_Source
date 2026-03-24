# Thermodynamic Cycles - Web Suite ⚡ / Cicli Termodinamici

*Creato dal **Prof. Ing. Andrea Viola** | Created by **Prof. Ing. Andrea Viola***
*Per scopi didattici | For educational purposes only*

---

## 🇬🇧 English

An interactive educational web application for teaching and studying ideal and real thermodynamic cycles.

### Features
- **💧 Rankine Cycle (Steam/Water)**: IAPWS-IF97 analysis, saturation dome, vapor quality
- **🔥 Brayton Cycle (Gas Turbine)**: Compressor, combustion, turbine, BWR analysis
- **⚙️ Otto Cycle**: Spark ignition engine with P-v/T-s diagrams
- **🛢️ Diesel Cycle**: Compression ignition engine with P-v/T-s diagrams  
- **❄️ Refrigeration Cycle**: R134a with COP analysis (evaporation/condensation)
- **🔄 Carnot Cycle**: Ideal cycle comparison with efficiency calculation
- **🎨 Air Laboratory**: Free-form construction of complex cycles with multi-phase support

### Advanced Features
- **Parametric Analysis**: Sweep parameter (e.g., compression ratio r) vs efficiency
- **Cycle Comparison**: Overlay multiple cycles on T-s diagram
- **Export**: PDF reports + CSV data + PNG charts
- **i18n**: Automatic English/Italian translation based on browser language

### Installation
```bash
git clone https://github.com/TUO_NOME_UTENTE/cicli_termodinamici.git
cd cicli_termodinamici
pip install -r requirements.txt
streamlit run streamlit_app.py
```

### Deploy
Deploy to [Streamlit Community Cloud](https://share.streamlit.io/) by selecting `streamlit_app.py` as the main file.

---

## 🇮🇹 Italiano

Suite software didattica e interattiva per l'insegnamento e lo studio dei cicli termodinamici.

### Funzionalità
- **💧 Ciclo Rankine (Acqua/Vapore)**: Analisi IAPWS-IF97, cupola di saturazione
- **🔥 Ciclo Brayton (Turbina a Gas)**: Compressore, combustione, turbina, BWR
- **⚙️ Ciclo Otto**: Motore ad accensione comandata con diagrammi P-v/T-s
- **🛢️ Ciclo Diesel**: Motore ad accensione per compressione
- **❄️ Ciclo Frigorifero**: R134a con analisi COP
- **🔄 Ciclo Carnot**: Ciclo ideale con confronto rendimento
- **🎨 Laboratorio Aria**: Costruzione libera di cicli complessi

### Funzionalità Avanzate
- **Analisi Parametrica**: Sweep parametri (es. r vs η)
- **Confronto Cicli**: Sovrapponi più cicli su diagramma T-s
- **Esportazione**: Report PDF + dati CSV + immagini PNG
- **i18n**: Traduzione automatica italiano/inglese

### Installazione
```bash
git clone https://github.com/TUO_NOME_UTENTE/cicli_termodinamici.git
cd cicli_termodinamici
pip install -r requirements.txt
streamlit run streamlit_app.py
```

### Deploy
Esegui il deploy su [Streamlit Community Cloud](https://share.streamlit.io/) selezionando `streamlit_app.py` come file principale.

---

## 📂 Struttura del Progetto / Project Structure

```
├── streamlit_app.py          # Web App principale / Main Web App
├── calcolatore_*.py          # Moduli desktop / Desktop modules
├── cicli_termodinamici.py     # Launcher desktop unificato
├── core/                      # Core thermodynamics
│   ├── thermo.py             # GasPoint, Steam, R134a tables
│   └── cycles/               # Cycle calculations
│       ├── otto.py
│       ├── diesel.py
│       ├── brayton.py
│       ├── frigo.py
│       └── carnot.py
├── components/                # UI components
├── config/                    # Theme configuration
├── translations/              # i18n JSON files
├── requirements.txt           # Dipendenze / Dependencies
└── README.md
```

---

## 📝 Licenza / License
Progetto rilasciato sotto licenza MIT - sentiti libero di usarlo e modificarlo per la didattica!
