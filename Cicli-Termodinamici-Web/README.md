# ThermoHub Web

Applicazione web React/Vite di **ThermoHub** per spiegare cicli termodinamici, simulare impianti fluidici e distribuire esami di stato svolti.

Stato aggiornato al **2026-03-26**.

## Obiettivo

- offrire un ambiente unico per lezione, esercitazione e ripasso
- mantenere tutto client-side nel deploy Cloudflare Pages
- includere PDF scaricabili brandizzati ThermoHub

## Route disponibili

- `/`
- `/cicli-termodinamici`
- `/rankine`
- `/brayton`
- `/otto`
- `/diesel`
- `/frigo`
- `/carnot`
- `/laboratorio-vapore`
- `/impianti-fluidici`
- `/esami-di-stato`

## Funzionalita principali

- diagrammi interattivi Plotly
- export PDF con branding ThermoHub
- proprieta reali via `coolprop-wasm`
- simulazione di cicli ideali e reali
- laboratorio vapore avanzato
- archivio esami con traccia, schema e soluzione completa

## Stack

- React 19
- Vite 8
- React Router 7
- `coolprop-wasm`
- `plotly.js`
- `jspdf`
- `html2canvas`
- Vitest
- ESLint

## Avvio locale

```powershell
npm install
npm run dev
```

## Solver fluid power professionale

Il laboratorio `impianti-fluidici` usa sempre un solver locale ThermoHub per garantire risposta immediata nel browser.
Da ora puo anche delegare il calcolo a un backend esterno piu avanzato, mantenendo fallback automatico locale se il servizio non risponde.

Per abilitare il bridge esterno imposta:

```powershell
$env:VITE_FLUID_POWER_SOLVER_URL="http://localhost:8080/api/fluid-power/solve"
$env:FLUID_POWER_SOLVER_PORT="8080"
npm run dev
```

Avvio del backend solver locale:

```powershell
npm run solver:dev
```

Oppure in un file `.env.local`:

```dotenv
VITE_FLUID_POWER_SOLVER_URL=http://localhost:8080/api/fluid-power/solve
```

Se `omc` non e nel `PATH`, puoi indicarlo esplicitamente:

```powershell
$env:OMC_EXECUTABLE="C:\\OpenModelica1.25.5-64bit\\bin\\omc.exe"
npm run solver:dev
```

Se `omc.exe` non e installato in Windows ma Docker Desktop e attivo, il solver usa in automatico l'immagine ufficiale:

```text
openmodelica/openmodelica:v1.26.3-minimal
```

Alla prima esecuzione il backend inizializza nel profilo Docker le librerie `Modelica` e `OpenHydraulics`.

### Contratto del backend

Il frontend invia una `POST` JSON con:

- `domain`
- `components`
- `connections`
- `modelica.modelName`
- `modelica.source`

Il backend puo usare queste informazioni per tradurre il circuito verso un solver esterno come OpenModelica + OpenHydraulics.

Endpoint esposti dal server locale:

- `GET /health`
- `GET /api/fluid-power/capabilities`
- `POST /api/fluid-power/solve`

Risposta attesa:

```json
{
  "snapshot": {
    "valid": true,
    "isRunning": true,
    "connectionStates": {},
    "measurements": {},
    "readings": {},
    "warnings": []
  },
  "solver": {
    "source": "external",
    "detail": "OpenModelica + OpenHydraulics"
  }
}
```

Se il backend non e configurato, va in timeout o restituisce un errore, il canvas continua a funzionare con il solver locale e mostra `Fallback locale`.

### Riferimento open source consigliato

Riferimento ufficiale verificato:

- [OpenHydraulics](https://build.openmodelica.org/Documentation/OpenHydraulics.html): libreria Modelica libera per componenti e circuiti idraulici 1D, adatta come base per una co-simulazione piu professionale.

## Script

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run test`
- `npm run lint`

## Asset e runtime

- il file WASM richiesto e `public/coolprop.wasm`
- le tracce originali degli esami sono in `public/esami/originali/`
- il deploy del repository usa la build prodotta da questa cartella

## Deploy Cloudflare Pages

Deploy consigliato: **Cloudflare Pages** con sito statico, senza backend.

Impostazioni da usare:

- `Framework preset`: `Vite`
- `Build command`: `npm run build`
- `Build output directory`: `dist`
- `Root directory`: `Cicli-Termodinamici-Web`

Note operative:

- il file [`public/_headers`](/C:/Users/andre/Desktop/ThermoHub/Cicli-Termodinamici-Web/public/_headers) aggiunge header base per la versione statica e cache lunga sugli asset compilati
- non e necessario aggiungere un catch-all `_redirects` per questo deploy Cloudflare: con questa configurazione il fallback SPA viene gestito senza quella regola, evitando il loop segnalato da Wrangler
- lo script `npm run build` pulisce `dist` prima della build, cosi Cloudflare non riutilizza file obsoleti dalla build cache
- se colleghi il repository dalla root `ThermoHub`, su Cloudflare devi indicare come root la cartella `Cicli-Termodinamici-Web`
- dopo il deploy, prova queste route direttamente dal browser:
  - `/`
  - `/impianti-fluidici`
  - `/laboratorio-vapore`
  - `/esami-di-stato`

## Documenti correlati

- [../docs/USO_WEB.md](../docs/USO_WEB.md)
- [../docs/ARCHITETTURA.md](../docs/ARCHITETTURA.md)
- [../docs/MANUTENZIONE_E_MIGLIORAMENTI.md](../docs/MANUTENZIONE_E_MIGLIORAMENTI.md)
