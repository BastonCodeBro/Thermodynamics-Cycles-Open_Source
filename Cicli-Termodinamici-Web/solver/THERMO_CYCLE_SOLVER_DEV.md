# Thermo Cycle Solver Dev

Documento operativo aggiornato al **2026-03-28**.

## Avvio locale

Da `Cicli-Termodinamici-Web/`:

```powershell
node .\solver\thermo-cycle-solver-server.mjs
```

Porta di default:

- `8090`

Per cambiare porta:

```powershell
$env:THERMO_CYCLE_SOLVER_PORT="8091"
node .\solver\thermo-cycle-solver-server.mjs
```

## Endpoint

- `GET /health`
- `GET /api/thermo/capabilities`
- `POST /api/thermo/solve-cycle`

## Collegamento frontend

Nel frontend imposta:

```powershell
$env:VITE_THERMO_CYCLE_SOLVER_URL="http://localhost:8090/api/thermo/solve-cycle"
```

Oppure in `.env.local`:

```dotenv
VITE_THERMO_CYCLE_SOLVER_URL=http://localhost:8090/api/thermo/solve-cycle
```

## Stato attuale

Il bridge locale oggi copre:

- cicli ideali a gas
- Rankine
- refrigerazione a compressione di vapore
- ciclo combinato semplificato

Il server e pensato come base evolutiva verso un backend Python con:

- TESPy
- CoolProp
- fluprodia
- Cantera
- ExerPy

## Nota

Questo server non sostituisce ancora il backend impiantistico finale. Serve a stabilizzare l interfaccia frontend/backend e a togliere la logica numerica piu pesante dal solo browser.
