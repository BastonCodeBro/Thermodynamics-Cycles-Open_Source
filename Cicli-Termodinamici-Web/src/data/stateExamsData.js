export const stateExams = [
  {
    id: 'a056-ord25',
    code: 'A056',
    year: 2025,
    shortTitle: 'A056 Ordinaria 2025',
    headline: 'Nave da carico con motore diesel 2T a corsa extra lunga',
    sourcePdf: '/esami/originali/A056_ORD25.pdf',
    trace: [
      'Una moderna nave da carico e propulsa da un motore diesel a 2 tempi a corsa extra lunga che imprime 15 nodi. Dati noti: alesaggio 840 mm, 6 cilindri, regime 80 giri/min.',
      'Richieste di prima parte: potenza utilizzabile per la propulsione, portata di vapore prodotta dalla caldaia a gas di scarico, consumo di combustibile per miglio, capacita dei depositi HFO per un autonomia di 15.000 miglia.',
      'La traccia chiede inoltre lo schema dell impianto di produzione del vapore ausiliario con caldaia a gas di scarico.',
    ],
    assumptions: [
      'Rapporto corsa/alesaggio S/D = 3,8, quindi S = 3,20 m.',
      'Pressione media effettiva pme = 21 bar, coerente con un moderno diesel lento a corsa extra lunga.',
      'Consumo specifico di combustibile bsfc = 168 g/kWh e PCI HFO = 42.700 kJ/kg.',
      'Gas di scarico disponibili per il recupero: 4,9 kg per kWh prodotto, temperatura 320 C in ingresso alla caldaia e 180 C in uscita, rendimento di recupero 80%.',
      'Densita HFO media 960 kg/m3 e margine operativo del 15% sui depositi.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Potenza disponibile all asse',
          body: [
            'Il volume spazzato da un cilindro vale Vc = pi/4 · D^2 · S = pi/4 · 0,84^2 · 3,20 = 1,774 m3.',
            'Il volume totale spazzato e Vtot = 6 · 1,774 = 10,65 m3. Essendo un due tempi, ogni giro corrisponde a un ciclo utile, quindi con n = 80/60 = 1,333 s^-1 la potenza efficace risulta P = pme · Vtot · n.',
            'Sostituendo i valori si ottiene P = 2,1·10^6 · 10,65 · 1,333 = 29,8 MW, che rappresenta la potenza utilizzabile per la propulsione.',
          ],
        },
        {
          title: '2. Produzione di vapore con caldaia a gas di scarico',
          body: [
            'La portata dei gas di scarico si stima come m_g = 4,9 · P = 4,9 · 29.792 = 145.983 kg/h.',
            'Il calore recuperabile vale Q = eta · m_g · cp · DeltaT = 0,80 · 145.983 · 1,08 · (320 - 180) = 17,66 GJ/h.',
            'Assumendo produzione di vapore saturo a circa 8 bar da acqua alimento preriscaldata, il salto entalpico utile e circa 2.330 kJ/kg. La portata di vapore e quindi m_v = 17.660.000 / 2.330 = 7.580 kg/h, cioe circa 7,6 t/h.',
          ],
        },
        {
          title: '3. Consumo di combustibile per miglio',
          body: [
            'Il consumo orario vale Ch = bsfc · P = 0,168 · 29.792 = 5.005 kg/h.',
            'Alla velocita di 15 nodi la nave percorre 15 miglia in un ora, quindi il consumo per miglio e c_nm = 5.005 / 15 = 333,7 kg/nm.',
          ],
        },
        {
          title: '4. Capacita dei depositi di HFO',
          body: [
            'Per 15.000 miglia a 15 nodi il tempo di navigazione e 15.000 / 15 = 1.000 h.',
            'Il combustibile netto richiesto e m_f = 5.005 · 1.000 = 5.005.149 kg, cioe circa 5.005 t.',
            'Il volume netto e V = m / rho = 5.005.149 / 960 = 5.214 m3. Con un margine del 15% il volume di progetto diventa circa 5.996 m3.',
          ],
        },
      ],
      results: [
        { label: 'Potenza utile di propulsione', value: '29,8 MW' },
        { label: 'Produzione di vapore', value: '7,6 t/h' },
        { label: 'Consumo per miglio', value: '333,7 kg/nm' },
        { label: 'Depositi HFO di progetto', value: 'circa 6.000 m3' },
      ],
      schematic: [
        'Serbatoio acqua alimento -> pompa alimento -> economizzatore/calderina a gas di scarico -> drum vapore.',
        'Dal drum: linea vapore ai servizi ausiliari, valvola di sicurezza, spurghi, ritorni condensa e degasatore.',
        'I gas di scarico del main engine attraversano la caldaia a recupero prima del camino.',
      ],
    },
    selectedQuestions: [
      {
        code: 'B',
        title: 'Sistema di raffreddamento e tecnica bore-cooling',
        points: [
          'Il raffreddamento del moderno diesel lento e organizzato in due circuiti distinti: LT per aria di sovralimentazione, lubrificante e ausiliari, HT per camicie, testate e zone termicamente piu gravose.',
          'Nel bore-cooling l acqua non raffredda genericamente il blocco, ma scorre in fori ottenuti molto vicino alla camera di combustione, soprattutto attorno alla sede valvola o alla parte alta della canna.',
          'Il vantaggio principale e la riduzione del gradiente termico locale: si limita la temperatura del cielo pistone e della fascia superiore della canna, si riduce il rischio di cricche e si migliora la lubrificazione del primo tratto.',
          'Dal punto di vista costruttivo servono passaggi calibrati, buona qualita dell acqua trattata, controllo della pressione del circuito e allarmi di temperatura per evitare ebollizione locale.',
        ],
      },
      {
        code: 'C',
        title: 'Sovralimentazione di un moderno diesel due tempi',
        points: [
          'Il sistema piu comune e la turbina a gas di scarico con compressore centrifugo calettato sullo stesso albero: i gas in uscita dal motore cedono energia alla turbina, che aziona il compressore di lavaggio.',
          'L aria compressa viene poi raffreddata nell aftercooler e inviata al ricevitore d aria, da cui ogni cilindro preleva la portata necessaria nelle fasi di lavaggio e riempimento.',
          'Ai bassi carichi il sistema deve garantire sufficiente pressione di scavenging; per questo si adottano geometrie ottimizzate, turbo in parallelo o dispositivi ausiliari di supporto al transitorio.',
          'Lo schema funzionale minimo e: cilindri -> collettore scarico -> turbina -> camino, mentre sul lato aria si ha filtro -> compressore -> refrigeratore aria -> air receiver -> luci di travaso.',
        ],
      },
    ],
  },
  {
    id: 'a056-ord24',
    code: 'A056',
    year: 2024,
    shortTitle: 'A056 Ordinaria 2024',
    headline: 'Propulsione COGAG su nave militare',
    sourcePdf: '/esami/originali/A056_ORD24.pdf',
    trace: [
      'Nave militare con propulsione turbo-riduttrice COGAG composta da quattro turbine a gas, potenza complessiva 78 MW, velocita massima 25 nodi.',
      'Dati noti: dislocamento 30.000 t, autonomia 8.000 miglia a 15 nodi, consumo orario di combustibile 19.000 kg/h.',
      'Richieste: consumo specifico, rendimento termico effettivo, velocita di media e minima forza, combustibile necessario per 8.000 miglia e schema dell apparato propulsivo.',
    ],
    assumptions: [
      'Le quattro turbine sono identiche e lavorano a piena potenza in massima forza.',
      'PCI del combustibile navale per turbine a gas assunto pari a 43.000 kJ/kg.',
      'Legge di similitudine della propulsione P proporzionale a V^3.',
      'Per la navigazione economica a 15 nodi il consumo viene scalato dalla massima forza con la stessa legge cubica.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Consumo specifico alla massima forza',
          body: [
            'Assumendo che i 19.000 kg/h si riferiscano al funzionamento in massima forza, il consumo specifico risulta bsfc = 19.000 / 78.000 = 0,244 kg/kWh, cioe 244 g/kWh.',
          ],
        },
        {
          title: '2. Rendimento termico effettivo',
          body: [
            'Il rendimento si ottiene da eta = 3600 / (bsfc · PCI) = 3600 / (0,244 · 43.000) = 0,344.',
            'Il rendimento termico effettivo dell impianto vale quindi circa 34,4%, coerente con una turbina a gas navale semplice senza recupero.',
          ],
        },
        {
          title: '3. Velocita con due turbine e con una turbina',
          body: [
            'Con due turbine attive la potenza disponibile e il 50% della massima: V_media = 25 · (0,5)^(1/3) = 19,8 nodi.',
            'Con una sola turbina attiva si ha il 25% della potenza: V_min = 25 · (0,25)^(1/3) = 15,7 nodi.',
          ],
        },
        {
          title: '4. Carico di combustibile per 8.000 miglia a 15 nodi',
          body: [
            'Il consumo economico a 15 nodi si stima con la legge cubica: Ch_15 = 19.000 · (15/25)^3 = 4.104 kg/h.',
            'Il tempo di traversata e t = 8.000 / 15 = 533,3 h. Il carico richiesto e quindi m = 4.104 · 533,3 = 2.188.800 kg, cioe circa 2.189 t di combustibile.',
          ],
        },
      ],
      results: [
        { label: 'Consumo specifico', value: '244 g/kWh' },
        { label: 'Rendimento termico effettivo', value: '34,4%' },
        { label: 'Velocita media forza', value: '19,8 kn' },
        { label: 'Velocita minima forza', value: '15,7 kn' },
        { label: 'Combustibile per 8.000 miglia', value: 'circa 2.189 t' },
      ],
      schematic: [
        'Coppia di turbine di crociera + coppia di turbine di boost, innestate tramite frizioni su riduttore principale.',
        'Dal riduttore la potenza viene trasferita alla linea d asse con cuscinetti, reggispinta, asse intermedio, astuccio e elica.',
        'A monte delle turbine: presa aria, compressore, camera di combustione, turbina, scarico e sistemi ausiliari di avviamento e lubrificazione.',
      ],
    },
    selectedQuestions: [
      {
        code: 'A',
        title: 'Produzione di acqua distillata a bordo',
        points: [
          'Una soluzione molto diffusa e il distillatore sottovuoto che sfrutta l acqua di camicia o il vapore ausiliario come sorgente termica.',
          'L acqua di mare entra nel condensatore-evaporatore, viene preriscaldata e successivamente vaporizzata in condizioni di bassa pressione, cosi da bollire a temperatura contenuta.',
          'Il vapore separato dalle gocce saline attraversa un demister, condensa su superfici raffreddate dalla stessa acqua di mare di alimento e viene inviato al serbatoio del distillato dopo controllo di salinita.',
          'Il vuoto e mantenuto da eiettore o pompa e l impianto richiede spurgo salamoia, salinometro, allarme deviazione e corretto dosaggio antincrostante.',
        ],
      },
      {
        code: 'D',
        title: 'Impianto fisso a CO2 in sala macchine',
        points: [
          'Il sistema a CO2 e un impianto fisso total flooding: la bomboliera e ubicata in locale dedicato, con collettore, valvole di scarica, linea pilota e distribuzione verso il locale protetto.',
          'Prima dell attivazione si arrestano ventilazione, macchinari non indispensabili e alimentazione combustibile, quindi si evacua il personale e si chiudono aperture e serrande.',
          'La scarica avviene in modo rapido per portare la concentrazione di ossigeno sotto il limite di mantenimento della combustione. Per questo lo spazio deve essere ben stagno e correttamente compartimentato.',
          'Il sistema richiede dispositivi di sicurezza, ritardo di scarica, comandi protetti, cartellonistica, esercitazioni periodiche e rispetto dei requisiti SOLAS e FSS Code.',
        ],
      },
    ],
  },
  {
    id: 'a056-ord23',
    code: 'A056',
    year: 2023,
    shortTitle: 'A056 Ordinaria 2023',
    headline: 'Petroliera con doppio diesel lento e pompe di carico',
    sourcePdf: '/esami/originali/A056_ORD23.pdf',
    trace: [
      'Petroliera monoelica con due motori diesel due tempi a corsa super lunga. Ogni motore ha 12 cilindri, 650 kW per cilindro a 150 rpm e pme pari a 12 bar.',
      'Ogni cisterna di carico contiene 1.000 m3 di greggio; le operazioni di scarico usano due pompe centrifughe con prevalenza 100 m e tubazioni da 300 mm. Una cisterna va scaricata in un ora.',
      'La traccia richiede dimensionamento del motore, rendimento, consumo orario, cassa HFO giornaliera, potenza delle pompe e velocita del greggio nelle tubazioni.',
    ],
    assumptions: [
      'Rapporto corsa/alesaggio S/D = 4, tipico di motore super long stroke.',
      'Consumo specifico bsfc = 172 g/kWh, PCI HFO = 42.700 kJ/kg.',
      'Le due pompe operano in parallelo durante lo scarico di una cisterna, quindi ciascuna eroga meta della portata totale.',
      'Densita del greggio 900 kg/m3; rendimento complessivo di pompa e trasmissione 75%.',
      'Densita HFO nel service tank giornaliero 960 kg/m3 e riserva del 10%.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Dimensionamento di ciascun motore',
          body: [
            'La potenza di ogni motore e P = 12 · 650 = 7.800 kW. Essendo un due tempi, Vtot = P / (pme · n) = 7,8·10^6 / (1,2·10^6 · 2,5) = 2,60 m3.',
            'Il volume per cilindro e quindi 0,2167 m3. Ponendo S = 4D si ha Vc = pi/4 · D^2 · 4D = pi · D^3, da cui D = (Vc/pi)^(1/3) = 0,410 m e S = 1,640 m.',
          ],
        },
        {
          title: '2. Rendimento e consumo di combustibile',
          body: [
            'Il rendimento termico effettivo vale eta = 3600 / (0,172 · 42.700) = 0,490, cioe 49,0%.',
            'La potenza totale installata e 15.600 kW, quindi il consumo orario globale e Ch = 0,172 · 15.600 = 2.683 kg/h.',
            'Per il service tank giornaliero si calcola m24 = 24 · 2.683 = 64.397 kg. Convertendo in volume e aggiungendo il 10% di riserva si ottiene Vg = 73,8 m3.',
          ],
        },
        {
          title: '3. Pompe di carico e velocita del greggio',
          body: [
            'Per scaricare 1.000 m3 in un ora serve una portata totale Q = 1.000/3.600 = 0,2778 m3/s. Con due pompe in parallelo, ogni pompa lavora a 0,1389 m3/s.',
            'La potenza effettiva di ciascuna pompa e P = rho g Q H / eta = 900 · 9,81 · 0,1389 · 100 / 0,75 = 163,5 kW.',
            'La velocita del greggio nella tubazione principale da 300 mm e v = Q / A = 0,2778 / (pi · 0,30^2 / 4) = 3,93 m/s.',
          ],
        },
      ],
      results: [
        { label: 'Alesaggio motore', value: '410 mm' },
        { label: 'Corsa motore', value: '1.640 mm' },
        { label: 'Rendimento termico effettivo', value: '49,0%' },
        { label: 'Consumo orario totale', value: '2.683 kg/h' },
        { label: 'Cassa HFO giornaliera', value: 'circa 74 m3' },
        { label: 'Potenza di ciascuna pompa', value: '163,5 kW' },
        { label: 'Velocita del greggio in linea', value: '3,93 m/s' },
      ],
      schematic: [
        'Propulsione: motori principali -> riduttore/accoppiamento -> linea d asse -> elica monoelica.',
        'Movimentazione carico: cisterna -> linea aspirazione -> pompe centrifughe -> collettore di mandata -> manifold -> terra.',
      ],
    },
    selectedQuestions: [
      {
        code: 'A',
        title: 'Impianto di timoneria elettroidraulico',
        points: [
          'L energia primaria e elettrica: due elettropompe alimentano il circuito idraulico che comanda uno o piu attuatori collegati alla barra o al quadrante del timone.',
          'L impianto minimo comprende serbatoio olio, filtri, pompe, valvole di ritegno, valvole limitatrici, distributore di governo, tubazioni di mandata/ritorno, attuatori e gruppo di emergenza.',
          'Il telemotore invia il comando al servodistributore che sposta il flusso verso una camera dell attuatore e scarica l altra, ottenendo la rotazione del timone. Il feedback meccanico o elettrico arresta il moto al raggiungimento dell angolo ordinato.',
          'Per sicurezza navale si prevedono ridondanza delle pompe, by-pass, possibilita di comando locale, allarmi bassa pressione e rispetto dei tempi massimi di brandeggio prescritti dalle regole di classifica.',
        ],
      },
      {
        code: 'B',
        title: 'Impianto frigorifero a compressione di vapore',
        points: [
          'I quattro organi essenziali sono compressore, condensatore, valvola di laminazione ed evaporatore. Il fluido frigorigeno evapora assorbendo calore e condensa cedendolo all esterno.',
          'Sul diagramma pressione-entalpia il ciclo si legge cosi: 1-2 compressione quasi isentropica, 2-3 condensazione isobara, 3-4 laminazione isoentalpica, 4-1 evaporazione isobara.',
          'Nei circuiti navali si aggiungono separatore di liquido, filtro deidratatore, visore, pressostati, valvola solenoide, regolazione termostatica e dispositivi di sicurezza per alta e bassa pressione.',
          'Dal punto di vista didattico conviene evidenziare che il COP dipende dal salto termico fra evaporatore e condensatore: minore e il salto, maggiore e il rendimento frigorifero.',
        ],
      },
    ],
  },
  {
    id: 'a009-ord19',
    code: 'A009',
    year: 2019,
    shortTitle: 'A009 Ordinaria 2019',
    headline: 'Nave da crociera con apparato propulsivo tradizionale',
    sourcePdf: '/esami/originali/A009_ORD19.pdf',
    trace: [
      'Nave da crociera da 28.000 t con potenza complessiva di propulsione pari a 35.000 kW.',
      'La prova chiede numero e disposizione dei motori, dimensionamento, produzione massima di acqua calda sanitaria dal recupero sui gas di scarico, consumo orario di combustibile e rendimento termico effettivo.',
      'Va inoltre rappresentato lo schema dell impianto di propulsione con le apparecchiature per il trasferimento della potenza alle eliche.',
    ],
    assumptions: [
      'Configurazione scelta: due motori principali su due linee d asse, 17,5 MW ciascuno, per migliorare ridondanza e manovrabilita.',
      'Motori diesel 4 tempi medium speed da crociera, 12 cilindri a V, 500 rpm, pme = 24 bar e rapporto S/D = 1,2.',
      'Consumo specifico bsfc = 185 g/kWh; PCI del combustibile = 42.700 kJ/kg.',
      'Potenza recuperabile per ACS assunta pari a 9,5 MW sul totale dell impianto; riscaldamento acqua da 15 C a 60 C.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Numero, disposizione e dimensionamento dei motori',
          body: [
            'Per una nave da crociera con impianto tradizionale e ragionevole adottare due motori principali, uno per ciascuna linea d asse, con potenza unitaria 17,5 MW.',
            'Per un quattro tempi il volume totale di un motore e Vtot = P / (pme · n/2) = 17,5·10^6 / (2,4·10^6 · 4,167) = 1,75 m3.',
            'Dividendo per 12 cilindri si ottiene Vc = 0,1458 m3. Con S = 1,2D si ricavano alesaggio D = 0,537 m e corsa S = 0,644 m.',
          ],
        },
        {
          title: '2. Acqua calda sanitaria producibile dal recupero',
          body: [
            'La portata massima si ricava da m = Q / (cp · DeltaT) = 9.500 / (4,18 · 45) = 50,5 kg/s.',
            'In termini orari corrisponde a circa 181,8 t/h di acqua calda, valore massimo teorico ottenibile se tutto il calore recuperabile viene destinato all utenza sanitaria.',
          ],
        },
        {
          title: '3. Consumo orario e rendimento',
          body: [
            'Il consumo orario totale vale Ch = 0,185 · 35.000 = 6.475 kg/h.',
            'Il rendimento termico effettivo risulta eta = 3600 / (0,185 · 42.700) = 45,6%.',
          ],
        },
      ],
      results: [
        { label: 'Assetto propulsivo', value: '2 motori da 17,5 MW su 2 assi' },
        { label: 'Alesaggio motore', value: '537 mm' },
        { label: 'Corsa motore', value: '644 mm' },
        { label: 'ACS producibile', value: '181,8 t/h' },
        { label: 'Consumo orario', value: '6.475 kg/h' },
        { label: 'Rendimento termico effettivo', value: '45,6%' },
      ],
      schematic: [
        'Motore principale -> giunto elastico -> riduttore -> reggispinta -> linea d asse -> astuccio -> elica.',
        'Sistemi ausiliari: combustibile, lubrificazione, raffreddamento, aria di avviamento e recupero termico dai gas di scarico.',
      ],
    },
    selectedQuestions: [
      {
        code: '2',
        title: 'Impianto oleodinamico di una timoneria VLCC',
        points: [
          'In una VLCC la timoneria e normalmente elettroidraulica ridondata: due o piu gruppi motopompa alimentano uno o due attuatori a quattro martinetti oppure un servomotore rotativo a palette.',
          'Il circuito comprende serbatoio, filtri, pompe principali e di riserva, valvole di massima, ritegni, distributore servocomandato, tubazioni di mandata e ritorno, telemotore, trasduttori d angolo e comandi locali di emergenza.',
          'In marcia ordinaria il comando dalla plancia agisce sul servodistributore; l olio in pressione entra nella camera che genera la coppia necessaria sul settore timone e il circuito opposto scarica al serbatoio.',
          'Sono essenziali la separazione dei rami ridondanti, la possibilita di escludere un gruppo in avaria, i by-pass di sicurezza e il rispetto dei tempi di accostata richiesti dalle normative internazionali.',
        ],
      },
      {
        code: '3',
        title: 'UTA e trasformazioni psicrometriche',
        points: [
          'L unita di trattamento aria miscela aria esterna e aria di ricircolo, la filtra e la porta alle condizioni di mandata mediante batterie fredde, calde, umidificatori e ventilatori.',
          'Nel trattamento estivo l aria viene raffreddata e deumidificata sulla batteria fredda; in inverno viene riscaldata e, se necessario, umidificata fino a raggiungere la zona di benessere.',
          'Sul diagramma psicrometrico il tratto estivo scende verso sinistra fino alla curva di saturazione e poi si stabilizza tramite post-riscaldo; il tratto invernale sale quasi orizzontalmente per riscaldamento sensibile e poi verso l alto per umidificazione.',
          'Lo schema di massima comprende presa aria, serrande di miscela, filtri, batteria fredda, separatore condensa, batteria calda, eventuale umidificatore, ventilatore di mandata e rete di distribuzione.',
        ],
      },
    ],
  },
  {
    id: 'i159-ord18',
    code: 'I159',
    year: 2018,
    shortTitle: 'I159 Ordinaria 2018',
    headline: 'LNG carrier con propulsione elettrica e turbine a gas',
    sourcePdf: '/esami/originali/I159_ORD18.pdf',
    trace: [
      'LNG carrier con due azipod da 24.000 kW complessivi; generazione elettrica affidata a tre gruppi turbina a gas alternatore da 36.000 kW complessivi.',
      'Dati del ciclo: T1 = 20 C, T3 = 1050 C, rapporto di compressione beta = 16, consumo specifico 0,225 kg/kWh, PCI metano 50.000 kJ/kg.',
      'Richieste: rendimento ideale e globale, lavori di compressione ed espansione, lavoro utile specifico, consumo dopo 1.500 miglia e calore recuperabile dai gas di scarico fino a 200 C.',
    ],
    assumptions: [
      'Gas perfetto con cp = 1,005 kJ/(kg K) e gamma = 1,4.',
      'Potenza sviluppata dai tre gruppi assunta pari a 36 MW nella condizione di riferimento.',
      'Consumo totale calcolato alla massima richiesta di potenza dell apparato generatore.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Rendimento del Brayton ideale',
          body: [
            'Per il Brayton ideale eta_id = 1 - 1 / beta^((gamma - 1)/gamma). Con beta = 16 e gamma = 1,4 si ottiene eta_id = 54,7%.',
            'Le temperature isentropiche risultano T2 = 647 K e T4 = 599 K.',
          ],
        },
        {
          title: '2. Lavori specifici di compressione ed espansione',
          body: [
            'Il lavoro del compressore vale wc = cp · (T2 - T1) = 1,005 · (647 - 293) = 355,9 kJ/kg.',
            'Il lavoro di turbina vale wt = cp · (T3 - T4) = 1,005 · (1323 - 599) = 727,6 kJ/kg.',
            'Il lavoro utile specifico del ciclo e quindi wu = wt - wc = 371,6 kJ/kg.',
          ],
        },
        {
          title: '3. Rendimento globale e consumo di traversata',
          body: [
            'Dal consumo specifico reale si ottiene eta_gl = 3600 / (0,225 · 50.000) = 32,0%.',
            'Il tempo di percorrenza di 1.500 miglia a 22 nodi e t = 68,18 h. Il combustibile totale richiesto e m = 0,225 · 36.000 · 68,18 = 552.273 kg, cioe circa 552 t di metano equivalente.',
          ],
        },
        {
          title: '4. Calore recuperabile dai gas di scarico',
          body: [
            'Il rapporto combustibile/aria ideale si stima da q_in = cp · (T3 - T2) = 679 kJ/kg aria, quindi f = 679 / 50.000 = 0,0136.',
            'Con una portata combustibile di 8.100 kg/h si ricava una portata aria di circa 165,6 kg/s.',
            'Raffreddando i gas da circa 326 C a 200 C si recupera Q = m · cp · DeltaT = 165,6 · 1,005 · 126 = 20,98 MW.',
          ],
        },
      ],
      results: [
        { label: 'Rendimento Brayton ideale', value: '54,7%' },
        { label: 'Rendimento globale', value: '32,0%' },
        { label: 'Lavoro compressore', value: '355,9 kJ/kg' },
        { label: 'Lavoro turbina', value: '727,6 kJ/kg' },
        { label: 'Lavoro utile specifico', value: '371,6 kJ/kg' },
        { label: 'Consumo per 1.500 miglia', value: 'circa 552 t' },
        { label: 'Calore recuperabile', value: 'circa 21,0 MW' },
      ],
      schematic: [
        'Presa aria -> compressore -> combustore -> turbina -> generatore -> utenze di bordo e azipod.',
        'Sui gas di scarico si puo inserire un recuperatore termico per servizi ausiliari o produzione vapore.',
      ],
    },
    selectedQuestions: [
      {
        code: '1',
        title: 'Impianto a gas inerte su nave cisterna',
        points: [
          'L impianto a gas inerte mantiene le cisterne di carico in atmosfera non infiammabile, riducendo la concentrazione di ossigeno al di sotto del limite operativo ammesso.',
          'Il gas puo provenire dai gas di scarico di caldaia opportunamente lavati e raffreddati oppure da generatore autonomo. Dopo scrubber, demister e ventilatori viene inviato al ponte di carico e alle cisterne tramite deck water seal, non-return valve e valvole di isolamento.',
          'Le fasi operative tipiche sono inertizzazione, topping-up e gas-freeing controllato; sul diagramma di infiammabilita il percorso del contenuto della cisterna deve evitare il campo di combustibilita.',
          'Sono essenziali analizzatore di O2, allarmi, tenuta del deck seal, isolamenti efficaci e rispetto delle procedure SOLAS/MARPOL per evitare ritorni di fiamma verso la sala macchine.',
        ],
      },
      {
        code: '2',
        title: 'Difesa antincendio attiva e passiva',
        points: [
          'La difesa passiva comprende compartimentazione A e B, rivestimenti resistenti al fuoco, porte tagliafuoco, coibentazioni e corretta segregazione di locali e linee.',
          'La difesa attiva comprende rivelazione, allarme, rete incendio, sprinkler o water mist, schiuma, CO2, polveri, estintori portatili e dispositivi di chiusura rapida dei combustibili.',
          'Nel comparto macchina prevalgono CO2 e water mist; sul ponte di carico di una cisterna trovano largo impiego schiuma e sistemi di raffreddamento esterno; negli alloggi si usano sprinkler, idranti e rilevazione automatica.',
          'La scelta dipende dalla classe di incendio, dalla presenza di persone e dalla necessita di mantenere la galleggiabilita e la continuita di esercizio dopo l emergenza.',
        ],
      },
    ],
  },
  {
    id: 'i159-ord17',
    code: 'I159',
    year: 2017,
    shortTitle: 'I159 Ordinaria 2017',
    headline: 'Nave da crociera e recupero di vapore ausiliario',
    sourcePdf: '/esami/originali/I159_ORD17.pdf',
    trace: [
      'Nave da crociera con potenza diesel complessiva di 58.000 kW.',
      'La prima parte richiede portata massima di vapore producibile con caldaie a recupero e percentuale complessiva di utilizzazione del calore del combustibile, oltre allo schema dell impianto.',
    ],
    assumptions: [
      'Consumo specifico bsfc = 175 g/kWh e PCI = 42.700 kJ/kg.',
      'Quota di potenza termica recuperabile dagli scarichi pari al 25% della potenza del combustibile.',
      'Produzione di vapore saturo a circa 8 bar con salto entalpico utile 2.330 kJ/kg.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Potenza del combustibile e rendimento del motore',
          body: [
            'Dal consumo specifico si ricava il rendimento del motore: eta = 3600 / (0,175 · 42.700) = 48,2%.',
            'La potenza termica introdotta dal combustibile e quindi Qf = 58.000 / 0,4818 = 120,4 MW.',
          ],
        },
        {
          title: '2. Portata massima di vapore',
          body: [
            'Assumendo recuperabile il 25% della potenza del combustibile, la potenza resa alla caldaia a recupero e Qrec = 30,1 MW.',
            'La portata di vapore vale m_v = Qrec · 3600 / 2330 = 46,5 t/h.',
          ],
        },
        {
          title: '3. Utilizzazione complessiva del combustibile',
          body: [
            'Il grado complessivo di utilizzazione e dato da (potenza meccanica + potenza recuperata) / potenza combustibile.',
            'Si ottiene eta_tot = (58,0 + 30,1) / 120,4 = 73,2%.',
          ],
        },
      ],
      results: [
        { label: 'Portata massima di vapore', value: '46,5 t/h' },
        { label: 'Utilizzazione complessiva del combustibile', value: '73,2%' },
      ],
      schematic: [
        'Gas di scarico motori -> caldaia a recupero -> camino.',
        'Circuito acqua/vapore: hotwell -> pompa alimento -> economizzatore/evaporatore -> drum -> utenze -> ritorno condensa.',
      ],
    },
    selectedQuestions: [
      {
        code: '1',
        title: 'Apparato di propulsione piu idoneo per una nave da crociera',
        points: [
          'Per una nave da crociera moderna la soluzione piu convincente e spesso diesel-elettrica, ma se si resta nella logica della traccia si puo motivare anche un apparato tradizionale a piu motori con riduttori e CPP.',
          'Le ragioni della scelta sono ridondanza, comfort acustico, flessibilita di carico e continuita di servizio agli hotel loads della nave.',
          'In schema si evidenziano motori principali, alternatori o riduttori, sistemi di controllo giri/passo, linee d asse o azipod, reggispinta, impianti ausiliari e rete elettrica di distribuzione.',
          'Il punto chiave da spiegare e che il progetto di una nave passeggeri non massimizza solo il rendimento, ma anche affidabilita, vibrazioni contenute e manovrabilita in porto.',
        ],
      },
      {
        code: '2',
        title: 'Impianto di condizionamento e trattamenti dell aria',
        points: [
          'Il cuore frigorifero e il ciclo a compressione di vapore; a valle lavora la sezione aria con UTA, filtri, ventilatori, batterie fredde e calde, umidificatori e rete di mandata/ricircolo.',
          'Nel condizionamento estivo l aria viene raffreddata e deumidificata fino a un punto vicino alla saturazione, poi eventualmente post-riscaldata per ottenere una mandata confortevole.',
          'Nel condizionamento invernale si esegue riscaldamento sensibile e, se necessario, umidificazione per compensare l aria esterna fredda e secca.',
          'Per la correzione d esame conviene legare ogni tratto del diagramma psicrometrico alla corrispondente sezione reale della macchina, per evitare una descrizione puramente teorica.',
        ],
      },
    ],
  },
  {
    id: 'm582-ord16',
    code: 'M582',
    year: 2016,
    shortTitle: 'M582 Ordinaria 2016',
    headline: 'Petroliera, recupero vapore e trattamento HFO',
    sourcePdf: '/esami/originali/M582_ORD16.pdf',
    trace: [
      'Petroliera con motore diesel da 13.500 kW.',
      'La traccia richiede produzione oraria massima di vapore con caldaia a recupero, grado complessivo di utilizzazione del combustibile e schema semplificato dell impianto vapore.',
    ],
    assumptions: [
      'Consumo specifico bsfc = 180 g/kWh e PCI = 42.700 kJ/kg.',
      'Quota recuperabile come vapore pari al 24% della potenza del combustibile.',
      'Salto entalpico utile per il vapore: 2.330 kJ/kg.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Potenza del combustibile',
          body: [
            'Dal consumo specifico si ottiene eta = 3600 / (0,180 · 42.700) = 46,8%.',
            'La potenza termica immessa col combustibile vale Qf = 13.500 / 0,468 = 28,82 MW.',
          ],
        },
        {
          title: '2. Vapore producibile',
          body: [
            'Assumendo recuperabile il 24% della potenza del combustibile, Qrec = 6,92 MW.',
            'La portata di vapore e m_v = 6,917 · 3600 / 2330 = 10,69 t/h.',
          ],
        },
        {
          title: '3. Utilizzazione complessiva del combustibile',
          body: [
            'Il grado complessivo e eta_tot = (13,5 + 6,92) / 28,82 = 70,8%.',
          ],
        },
      ],
      results: [
        { label: 'Portata massima di vapore', value: '10,7 t/h' },
        { label: 'Utilizzazione complessiva', value: '70,8%' },
      ],
      schematic: [
        'Motore diesel -> gas di scarico -> caldaia a gas di scarico -> camino.',
        'Condense e acqua alimento in circuito chiuso verso drum e utenze ausiliarie.',
      ],
    },
    selectedQuestions: [
      {
        code: '1',
        title: 'Trattamento della nafta pesante e adduzione al motore',
        points: [
          'La nafta pesante passa dai doppi fondi ai serbatoi di sedimentazione, dove decanta acqua e impurita grossolane a temperatura controllata.',
          'Dai settling tanks il combustibile e inviato ai separatori centrifughi, che rimuovono acqua e solidi fini. Successivamente transita nei service tanks, nei riscaldatori finali, nei filtri fini e nel gruppo booster.',
          'Il circuito verso il motore comprende pompe di alimentazione, viscosimetro/regolazione della temperatura, filtri duplex, ritorni di eccesso e sistemi di sicurezza per leak-off e drenaggi.',
          'Nello schema e importante distinguere chiaramente deposito, trattamento, servizio e rilancio al motore, evidenziando anche i ritorni caldi e le linee di spurgo.',
        ],
      },
      {
        code: '4',
        title: 'Impianti fissi e mobili di estinzione incendi nel settore navale',
        points: [
          'Gli impianti fissi comprendono rete incendio, sprinkler, water mist, schiuma, CO2, polvere secca e sistemi speciali per locali tecnici o ponte di carico.',
          'Le apparecchiature mobili includono idranti con manichette, monitori, estintori portatili e carrellati, lance schiuma, equipaggiamento dei fireman e mezzi di compartimentazione.',
          'La scelta del mezzo estinguente deve seguire la classe di incendio: acqua per A, schiuma per liquidi infiammabili, polvere o CO2 per apparecchi elettrici e incendi localizzati, sistemi specifici per sala macchine e cargo area.',
          'In ambito normativo il riferimento didattico principale e SOLAS con FSS Code, a cui si affiancano le prescrizioni di classifica e le procedure del Safety Management System di bordo.',
        ],
      },
    ],
  },
  {
    id: 'm582-ord15',
    code: 'M582',
    year: 2015,
    shortTitle: 'M582 Ordinaria 2015',
    headline: 'Portacontainer con diesel lento sovralimentato',
    sourcePdf: '/esami/originali/M582_ORD15.pdf',
    trace: [
      'Portacontainer da 25.000 GT, velocita 16 nodi, apparato motore a poppa. Potenza effettiva 12 MW fornita da un diesel lento 8 cilindri in linea, 110 giri/min, pme = 16,2 bar.',
      'Richieste: caratteristiche geometriche del cilindro, velocita media del pistone, rendimento globale dato bsfc = 0,180 kg/kWh, consumo orario e consumo totale per 4.000 miglia.',
    ],
    assumptions: [
      'Rapporto corsa/alesaggio S/D = 3,5 tipico di motore lento sovralimentato.',
      'PCI del combustibile = 42.700 kJ/kg.',
    ],
    firstPart: {
      steps: [
        {
          title: '1. Geometria del cilindro',
          body: [
            'Per un due tempi Vtot = P / (pme · n) = 12·10^6 / (1,62·10^6 · 1,833) = 4,04 m3.',
            'Per cilindro si ha Vc = 4,04 / 8 = 0,505 m3. Con S = 3,5D si ricava D = 0,568 m e S = 1,990 m.',
          ],
        },
        {
          title: '2. Velocita media del pistone',
          body: [
            'cm = 2 · S · n / 60 = 2 · 1,990 · 110 / 60 = 7,30 m/s.',
          ],
        },
        {
          title: '3. Rendimento, consumi orari e di traversata',
          body: [
            'Il rendimento globale e eta = 3600 / (0,180 · 42.700) = 46,8%.',
            'Il consumo orario vale Ch = 0,180 · 12.000 = 2.160 kg/h.',
            'Per 4.000 miglia a 16 nodi il tempo e 250 h, quindi il consumo complessivo e 2.160 · 250 = 540.000 kg, cioe 540 t.',
          ],
        },
      ],
      results: [
        { label: 'Alesaggio', value: '568 mm' },
        { label: 'Corsa', value: '1.990 mm' },
        { label: 'Velocita media pistone', value: '7,30 m/s' },
        { label: 'Rendimento globale', value: '46,8%' },
        { label: 'Consumo orario', value: '2.160 kg/h' },
        { label: 'Consumo per 4.000 miglia', value: '540 t' },
      ],
      schematic: [
        'Motore diesel lento diretto sulla linea d asse, con turbocompressore, astuccio, reggispinta ed elica.',
      ],
    },
    selectedQuestions: [
      {
        code: '1',
        title: 'Parti essenziali di un impianto frigorifero',
        points: [
          'Il compressore aspira vapore a bassa pressione dall evaporatore e lo comprime fino alla pressione di condensazione.',
          'Nel condensatore il refrigerante cede calore all ambiente esterno e passa allo stato liquido; la valvola di laminazione abbassa poi la pressione senza scambio di lavoro.',
          'Nell evaporatore il fluido evapora assorbendo calore dall utenza da raffreddare. Il ciclo si richiude con la nuova aspirazione del compressore.',
          'Completano l impianto filtri, ricevitore di liquido, spia, pressostati, termostati e sistemi di sicurezza. Nello schizzo conviene indicare anche il senso del flusso e le grandezze di pressione.',
        ],
      },
      {
        code: '3',
        title: 'Una tipologia meccanica per il governo del timone',
        points: [
          'Una soluzione classica e la timoneria a quattro cilindri oleodinamici agenti su settore o tiller. Anche se il comando e moderno, il principio meccanico finale e la trasformazione del moto lineare in rotazione del timone.',
          'Due cilindri spingono e due tirano alternativamente, cosi da ottenere elevata coppia e buona ridondanza. Il quadrante trasferisce il moto al fusto del timone.',
          'I vantaggi sono robustezza, elevata forza disponibile e possibilita di continuare il servizio anche in configurazione degradata.',
          'Nel disegno d esame basta rendere chiari: attuatori, quadrante, fusto del timone, fine corsa, by-pass e collegamento con la centrale oleodinamica.',
        ],
      },
    ],
  },
];

export const examTopicBadges = [
  'Propulsione navale',
  'Cicli termodinamici',
  'Oleodinamica e timoneria',
  'Antincendio e impianti ausiliari',
];
