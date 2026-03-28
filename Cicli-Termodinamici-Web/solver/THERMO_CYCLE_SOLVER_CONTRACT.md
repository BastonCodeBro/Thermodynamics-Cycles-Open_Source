# Thermo Cycle Solver Contract

Documento aggiornato al **2026-03-28**.

## Scopo

Definire il contratto tra il frontend ThermoHub e un solver professionale esterno per i cicli termodinamici.

Il contratto deve permettere:

- uso didattico con fallback locale
- uso tecnico con solver backend
- crescita futura verso livello impiantistico

## Endpoint minimi

### Health

- `GET /health`

Risposta attesa:

```json
{
  "ok": true,
  "service": "thermohub-thermo-cycle-solver"
}
```

### Capabilities

- `GET /api/thermo/capabilities`

Risposta attesa:

```json
{
  "engines": ["tespy", "coolprop", "fluprodia"],
  "cycleFamilies": ["ideal-gas", "steam", "refrigeration", "combined", "combustion"],
  "fluids": ["Water", "R134a", "R245fa", "Air"],
  "features": {
    "exergy": true,
    "combustion": false,
    "offDesign": false,
    "pressureLosses": true,
    "diagramRendering": true
  }
}
```

### Solve cycle

- `POST /api/thermo/solve-cycle`

## Payload richiesto

```json
{
  "adapter": "thermohub-thermo-cycle-bridge",
  "generatedAt": "2026-03-28T10:00:00.000Z",
  "cycle": {
    "id": "rankine",
    "variant": "reheat",
    "family": "steam",
    "mode": "technical"
  },
  "workingFluid": {
    "primary": "Water",
    "secondary": null
  },
  "inputs": {
    "p_high": 120,
    "p_low": 0.08,
    "t_max": 520,
    "p_reheat": 25,
    "t_reheat": 500,
    "eta_t": 0.88,
    "eta_p": 0.82,
    "mass_flow": 8
  },
  "outputsRequested": {
    "diagrams": ["ts", "hs", "pv", "schematic"],
    "includeStateTable": true,
    "includeEnergyBalance": true,
    "includeExergy": false,
    "includePaths": true
  },
  "solverPreferences": {
    "engine": "auto",
    "diagramEngine": "auto",
    "accuracyLevel": "technical",
    "allowPressureLosses": true,
    "allowOffDesign": false,
    "allowCombustionChemistry": false
  },
  "localReference": {
    "available": true,
    "shape": {
      "points": 6,
      "stats": ["wt", "wp", "q_in", "q_out", "eta", "power"]
    }
  }
}
```

## Risposta attesa

```json
{
  "result": {
    "points": [],
    "idealPoints": [],
    "actualPoints": [],
    "actualPaths": [],
    "idealPaths": [],
    "lossPaths": [],
    "stats": {},
    "dome": null,
    "diagramData": {
      "ts": null,
      "hs": null,
      "pv": null,
      "ph": null
    },
    "stateTable": []
  },
  "solver": {
    "source": "external",
    "engine": "tespy",
    "diagramEngine": "fluprodia",
    "detail": "TESPy + CoolProp",
    "warnings": [],
    "convergence": {
      "success": true,
      "iterations": 12
    }
  }
}
```

## Compatibilita col frontend attuale

Il frontend oggi usa forme dati diverse a seconda della famiglia:

- gas ideali: `points`, `idealPoints`, `stats`
- Brayton: `realPoints`, `idealPoints`, `stats`
- Rankine: `actualPoints`, `idealPoints`, `actualPaths`, `stats`, `dome`
- combinato: `brayton`, `rankine`, `stats`

Il backend deve quindi:

1. poter restituire il formato nativo della famiglia
2. oppure restituire un `result` normalizzato che il frontend possa adattare

## Convenzioni dati

### Unita

- `p`: bar
- `t`: degC
- `h`: kJ/kg
- `s`: kJ/(kg K)
- `v`: m^3/kg
- `power`: kW se riferita a portata massica reale

### Stato termodinamico

Ogni stato deve usare dove possibile:

```json
{
  "name": "1",
  "p": 1.013,
  "t": 25,
  "h": 104.8,
  "s": 0.367,
  "v": 0.001
}
```

## Cicli da coprire nel backend

### Famiglia ideal-gas

- `otto`
- `diesel`
- `dual`
- `brayton`
- `brayton` variant `regenerative`
- `carnot`
- `carnot` mode `reverse`

### Famiglia steam

- `rankine`
- `rankine` variant `hirn`
- `rankine` variant `reheat`
- `rankine` variant `regenerative`

### Famiglia refrigeration

- `vapor-compression`
- `vapor-compression` mode `heat-pump`
- `reverse-carnot`

### Famiglia combined

- `combined`

### Famiglia combustion

- `combustor`
- `gas-turbine-real`

## Requisiti professionali del solver

- diagnostica convergenza
- warning leggibili per vincoli violati
- gestione fluidi non disponibili
- supporto a rendimenti reali e perdite di carico
- fallback esplicito se una feature non e supportata

## Estensioni future

- `POST /api/thermo/plot-diagram`
- `POST /api/thermo/exergy`
- `POST /api/thermo/off-design`
- `POST /api/thermo/batch`

## Nota progettuale

Questo contratto e stato pensato per seguire la stessa filosofia gia presente nella parte fluid power: interfaccia frontend stabile, solver esterno evolvibile, fallback locale sempre disponibile.
