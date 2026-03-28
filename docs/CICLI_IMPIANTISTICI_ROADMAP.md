# Roadmap Cicli Impiantistici

Documento aggiornato al **2026-03-28**.

## Obiettivo

Portare ThermoHub da simulatore didattico browser-side a piattaforma **completa, professionale e impiantistica** per:

- cicli a gas
- cicli a combustione
- cicli acqua-vapore
- cicli frigoriferi e pompe di calore
- cicli combinati
- varianti rigenerative, reheat, recuperative e multistadio

Il traguardo finale non e solo un sito web piu ricco, ma una base tecnica condivisa per:

- **sito web pubblico**
- **app desktop per PC**
- **solver professionale esterno**
- **diagrammi e schemi tecnici coerenti**

## Stato attuale letto dal repository

Il progetto oggi mostra due linee evolutive diverse:

1. **Frontend cicli termodinamici**
   - React/Vite
   - calcolo locale in JavaScript
   - `coolprop-wasm` per acqua, vapore e refrigerazione
   - solver dedicati per gas ideali in [idealGas.js](C:/Users/andre/Desktop/ThermoHub/Cicli-Termodinamici-Web/src/utils/idealGas.js)
   - solver locale Rankine in [rankineCycles.js](C:/Users/andre/Desktop/ThermoHub/Cicli-Termodinamici-Web/src/utils/rankineCycles.js)

2. **Evoluzione verso solver esterni**
   - bridge OpenModelica gia avviato in [openModelicaBridge.js](C:/Users/andre/Desktop/ThermoHub/Cicli-Termodinamici-Web/solver/openModelicaBridge.js)
   - adapter frontend/backend per fluid power gia presente in [fluidPowerProfessionalAdapter.js](C:/Users/andre/Desktop/ThermoHub/Cicli-Termodinamici-Web/src/utils/fluidPowerProfessionalAdapter.js)

Questa seconda direzione e quella giusta anche per i cicli termodinamici.

## Tesi architetturale

Per arrivare a livello impiantistico vero, il frontend non deve piu essere il motore numerico principale.

### Assetto target

1. **Frontend React**
   - input, preset, UI, PDF, confronto stati, schemi, grafici
   - fallback locale per uso didattico offline o rapido

2. **Bridge solver**
   - contratto stabile tra UI e backend
   - fallback automatico locale se il solver esterno non risponde
   - stesso modello usato sul web e nell app desktop

3. **Backend Python termo-fluidico**
   - proprietà termodinamiche reali
   - reti di componenti
   - bilanci di massa, energia ed exergia
   - off-design dove serve

4. **Libreria schemi impiantistici**
   - componenti standardizzati
   - porte e connessioni vere
   - numerazione stati coerente fra schema e diagrammi

## Stack consigliata

### Livello 1: base professionale

- **CoolProp**: proprietà termofisiche e refrigeranti
- **TESPy**: reti termo-fluidiche stazionarie e componenti impiantistici
- **fluprodia**: diagrammi `T-s`, `h-s`, `p-h`, `p-v` professionali
- **React Flow**: canvas tecnico a nodi per schemi impiantistici
- **engineering-symbols**: simboli SVG coerenti invece di SVG disegnati ad hoc

### Livello 2: profondità ingegneristica

- **Cantera**: combustione reale, composizione fumi, miscele reagenti
- **ExerPy**: exergia ed eventuale exergoeconomia
- **ThermoPack**: miscele ed EOS piu avanzate quando CoolProp non basta

### Livello 3: dinamica e impianti avanzati

- **ThermoPower**
- **ThermoCycle**
- **ThermofluidStream**
- **DWSIM** come riferimento o integrazione per flowsheet piu completi

## Copertura funzionale desiderata

### Gas ideali e turbine a gas

- Brayton semplice
- Brayton rigenerativo
- intercooling
- reheat
- recuperativo reale
- ciclo combinato gas-vapore

### Motori a combustione interna

- Otto
- Diesel
- Duale
- Atkinson
- Miller
- versioni con rendimento isoentropico e perdite termiche

### Acqua-vapore

- Rankine semplice
- Rankine-Hirn
- reheat
- rigenerativo aperto e chiuso
- spillamenti multipli
- condensatore reale
- pompa multistadio
- HRSG e ciclo combinato

### Frigoriferi e pompe di calore

- compressione di vapore
- pompa di calore
- Carnot inverso
- cicli con surriscaldamento e sottoraffreddamento
- compressione multistadio
- economizzatore / flash tank
- CO2 transcritica in una fase successiva

### Combustione e chimica

- combustore con aria reale
- eccesso d aria
- PCI/PCS
- fumi e composizione prodotti
- rapporto aria-combustibile

### Analisi avanzate

- bilancio energetico completo
- bilancio exergetico
- rendimenti isentropici, meccanici, elettrici
- perdite di pressione sui componenti
- qualità del vapore
- pinch e recupero termico
- mappe parametriche e off-design

## Livelli di fedelta

Ogni simulatore dovrebbe poter esporre tre livelli.

### 1. Didattico

- pochi input
- formule leggibili
- solver locale o backend semplificato
- risposta istantanea

### 2. Tecnico

- rendimenti reali
- perdite di carico
- componenti con efficienze e vincoli
- diagrammi reali generati dal backend

### 3. Impiantistico

- rete di componenti completa
- combustione reale se richiesta
- recuperi termici multipli
- exergia
- diagnostica di convergenza

## Roadmap per fasi

## Fase A - Stabilizzazione contratto cicli

Obiettivo: allineare frontend e backend prima di cambiare il motore.

- introdurre un adapter per cicli analogo a quello fluid power
- definire payload e risposta standard
- mantenere il fallback ai solver JS esistenti
- normalizzare il formato dei risultati per tutti i cicli

## Fase B - Backend termodinamico stazionario

Obiettivo: coprire in modo serio la maggior parte dei cicli.

- backend Python separato
- `CoolProp + TESPy`
- endpoint per solve ciclo
- endpoint per diagrammi professionali
- endpoint capabilities
- supporto iniziale per gas, Rankine, refrigerazione, combinato

## Fase C - Diagrammi e schemi professionali

Obiettivo: rendere la UI degna del motore numerico.

- generare i diagrammi da backend con `fluprodia`
- usare numerazione stati unica fra schema e grafici
- migrare gli schemi da SVG custom a componenti tecnici riusabili
- introdurre porte, flussi, gruppi macchina e scambiatori veri

## Fase D - Combustione, exergia e miscele

Obiettivo: superare il livello solo didattico.

- integrazione `Cantera` dove serve
- integrazione `ExerPy`
- modelli combustore e gas reali
- gestione miscele avanzate e combustibili

## Fase E - Desktop professionale

Obiettivo: avere la stessa piattaforma su web e PC.

- app desktop che riusa la UI React
- backend solver locale Python o bridge locale
- modalita offline
- export di report tecnici
- cache dei casi studio e dei risultati

## Requisiti per dire "completissimo"

ThermoHub sara davvero completissimo quando avra:

- un catalogo unificato di cicli e varianti
- una sola numerazione stati tra schema, tabella e diagramma
- componenti impiantistici realistici
- solver professionale esterno con fallback locale
- supporto per fluidi e miscele reali
- diagrammi generati su base termodinamica affidabile
- bilanci energetici ed exergetici
- modalita web e desktop coerenti

## Cosa fare subito nel progetto

Ordine consigliato:

1. definire il contratto solver dei cicli
2. introdurre l adapter frontend/backend per i cicli
3. mantenere i solver locali solo come fallback
4. costruire un backend Python con `TESPy + CoolProp`
5. sostituire i diagrammi custom con diagrammi professionali backend-driven
6. rifare gli schemi con una libreria di simboli tecnici

## Nota operativa

Questa roadmap non tocca la sezione fluid power. Usa pero la stessa lezione architetturale che il progetto sta gia adottando li: **frontend interattivo + bridge + solver professionale esterno + fallback locale**.
