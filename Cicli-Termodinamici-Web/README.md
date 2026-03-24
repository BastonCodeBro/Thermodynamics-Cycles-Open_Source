# ThermoHub - Cicli Termodinamici

Applicazione web interattiva per analizzare cicli termodinamici:

- Rankine
- Brayton-Joule
- Otto
- Diesel
- Frigorifero a compressione (R134a)
- Carnot (ideale)

## Stack

- React + Vite
- React Router
- CoolProp via `coolprop-wasm`
- Plotly (`plotly.js-dist-min`)

## Prerequisiti

- Node.js 20+ consigliato
- npm

## Avvio locale

```bash
npm install
npm run dev
```

Apri poi l'URL mostrato da Vite (di default `http://localhost:5173`).

## Script disponibili

- `npm run dev` - ambiente di sviluppo
- `npm run build` - build produzione
- `npm run preview` - anteprima build
- `npm run lint` - lint del progetto

## Note tecniche

- Il motore termodinamico viene inizializzato all'avvio tramite `ensureCoolProp()`.
- Il file wasm richiesto da CoolProp e servito da `public/coolprop.wasm`.
- I grafici usano Plotly locale con aggiornamento incrementale (`Plotly.react`) e cleanup al cambio pagina.

## Struttura principale

- `src/components/` - pagine ciclo e componenti UI
- `src/components/shared/` - layout e widget condivisi
- `src/utils/waterProps.js` - wrapper proprietà termodinamiche
- `src/utils/plotly.js` - utilità rendering/cleanup grafici

## Troubleshooting rapido

- **Errore inizializzazione CoolProp:** verifica che `public/coolprop.wasm` sia presente e raggiungibile.
- **Calcolo disabilitato:** controlla che i parametri siano numerici e fisicamente coerenti (es. `T_high > T_low`).
