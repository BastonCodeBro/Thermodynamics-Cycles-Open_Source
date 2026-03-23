# Cicli Termodinamici - Suite Didattica Avanzata

Una suite software didattica e interattiva per l'insegnamento e lo studio dei principali cicli termodinamici.
Sviluppata interamente in Python con **CustomTkinter** e **Matplotlib**, permette di visualizzare dinamicamente l'interazione tra i parametri fisici e le prestazioni (rendimenti, lavori, calori).

## 🚀 Funzionalità Principali
Il programma integra **5 moduli completi** in un'unica interfaccia unificata:
1. **💧 Ciclo Rankine (Vapore/Acqua)**: Include analisi IAPWS-IF97 completa, campana di saturazione esatta, titolo vapore e analisi macchine reali.
2. **🔥 Ciclo Brayton (Turbogas)**: Analisi di compressore, camera di combustione e turbina a gas, inclusi eccesso d'aria e back-work ratio (BWR).
3. **⚙️ Ciclo Otto (Motore a scoppio)**: Ciclo termodinamico a volume costante con grafici P-v e T-s.
4. **🛢️ Ciclo Diesel (Motore Diesel)**: Ciclo ideale e reale per motori ad accensione spontanea con grafici P-v e T-s.
5. **❄️ Ciclo Frigorifero (Pompa di Calore)**: Analisi delle prestazioni frigorifere e di riscaldamento (Coefficient of Performance - COP).

### Grafici Avanzati
*   I grafici distinguono visivamente il **Ciclo Reale (linee continue o a colori vibranti)** dal **Ciclo Ideale / di Carnot (linee tratteggiate)**.
*   Punti interattivi ai nodi delle trasformazioni (tooltip on hover per leggere Entalpia, Entropia, Temperatura, e Pressione).

## 📥 Installazione e Avvio
Per eseguire il programma sorgente è necessario **Python 3.9+**.

1. Clona il repository:
   ```bash
   git clone https://github.com/TUO_NOME_UTENTE/cicli_termodinamici.git
   cd cicli_termodinamici
   ```
2. Installa le dipendenze:
   ```bash
   pip install -r requirements.txt
   ```
3. Avvia l'applicazione principale:
   ```bash
   python cicli_termodinamici.py
   ```

## 🌐 Distribuzione agli Studenti
Trattandosi di un'applicazione desktop grafica, il modo più semplice per distribuirla agli studenti **gratuitamente** è creare un file eseguibile o fornirne il download diretto tramite le "Releases" di GitHub:

### Creare un Eseguibile per Windows (.exe)
Esegui questo comando dal terminale per pacchettizzare il programma in un singolo file eseguibile che non richiede Python installato:
```bash
pip install pyinstaller
pyinstaller --noconsole --onefile cicli_termodinamici.py
```
Troverai il file `.exe` nella cartella `dist/`. Potrai caricarlo su GitHub Releases o condividerlo (es. su Google Drive/Moodle).

### Versione Web (Sito Gratuito)
Se in futuro vorrai portare questo calcolatore *direttamente su browser*, ti consiglio di esplorare framework come **Streamlit** (hanno un hosting gratuito "Streamlit Community Cloud") o **PyScript**. L'attuale interfaccia è basata su *CustomTkinter* che gira nativamente in locale su PC.

## 📝 Licenza
Progetto rilasciato sotto licenza MIT - sentiti libero di usarlo e modificarlo per la didattica!
