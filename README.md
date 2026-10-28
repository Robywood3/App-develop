# Simulatore Ciclo Combinato

Simulatore web di un impianto di produzione elettrica a ciclo combinato (CCGT):
turbina a gas, generatore di vapore a recupero (GVR), turbina a vapore e
condensatore, con calcolo termodinamico a regime e simulazione dinamica di
avviamento, rampe di carico, arresto e blocco TG.

JavaScript puro, nessuna dipendenza né passo di compilazione obbligatorio.

## Avvio

```bash
npm start            # python3 -m http.server 8080, poi apri http://localhost:8080
```

In alternativa apri direttamente `dist/simulatore-ccgt.html` (file singolo,
funziona anche senza server). Per rigenerarlo dopo una modifica:

```bash
npm run build
```

Test (Node ≥ 20):

```bash
npm test
```

## Cosa si può fare

- **Esercizio**: set-point di carico TG, gradiente di rampa, temperatura, pressione
  e umidità dell'aria, temperatura dell'acqua di raffreddamento, post-combustione in
  condotto, pressione HP scorrevole o fissa, numero di TG in servizio, profilo
  giornaliero di temperatura.
- **Progetto**: TG di classe E, F o H/J (portata, rapporto di compressione, TIT,
  rendimenti, aria di raffreddamento, isoterma di scarico, campo IGV), disposizione
  1+1 / 2+1 / 3+1, GVR a 1, 2 o 3 livelli con risurriscaldamento, pressioni e
  temperature di ogni livello, pinch point, rendimenti TV, condensatore ad acqua o
  aerocondensatore, composizione del gas naturale.
- **Mercato**: prezzo del gas (€/MWh PCS, convertito al PCI), CO₂ (EUA), O&M,
  prezzo dell'energia: costo marginale, clean spark spread, margine orario.
- **Sala controllo**: avviamento a caldo (lavaggio, accensione, parallelo,
  riscaldamento GVR, rullaggio TV), arresto normale, blocco TG con riconoscimento,
  velocità di simulazione fino a 300×, registro eventi e allarmi.
- **Analisi**: diagramma T-Q del GVR con pinch, diagramma T-s del ciclo a vapore,
  curve di rendimento/potenza vs carico e temperatura ambiente, trend, tabella delle
  correnti, bilancio energetico.
- **Utilities e ausiliari**: al punto di funzionamento corrente, bilancio della torre
  (evaporazione, spurgo, reintegro, dosaggi) o dell'aerocondensatore, ciclo chiuso con
  le utenze, acqua grezza/demi/reflui, stazione gas (preriscaldo Joule-Thomson), aria
  compressa e gas tecnici, vapore ausiliario e chimici, potenza ausiliaria per sistema.

## Documentazione di ingegneria

La sezione **Documentazione di ingegneria** genera, dal punto di progetto ISO della
configurazione corrente, un pacchetto di elaborati A3 con cartiglio, blocco
revisioni e codifica KKS semplificata:

| N. documento | Elaborato |
|---|---|
| `…-PR-PFD-001` | PFD generale con bilancio di massa ed energia e prestazioni nette |
| `…-PR-PFD-002` | Casi di funzionamento: 100/75/50 % ISO, 35 °C e −5 °C (prestazioni, TG, GVR, emissioni, utilities) |
| `…-PR-PFD-003…007` | PFD percorso aria/fumi (con composizione fumi), ciclo acqua-vapore (scambi per banco), sistemi di raffreddamento, bilancio idrico, gas combustibile e vapore ausiliario |
| `…-PR-PID-101…112` | P&ID di processo: TG aria/lavaggio/scarico, gas combustibile, olio TG; GVR HP, IP+RH, LP+preriscaldatore; vapore principale e bypass; TV, tenute, condensatore e vuoto; condensato; acqua alimento; spurghi e drenaggi; olio TV |
| `…-UT-PID-201…210` | P&ID utilities e ausiliari: stazione gas, acqua di circolazione e torre (o aerocondensatore), ciclo chiuso, aria compressa, acqua grezza/servizi/antincendio, acqua demi, dosaggi chimici e SWAS, acque reflue, gas tecnici, caldaia e vapore ausiliario |
| `…-PI-LST-001` | Line list (con colonna P&ID): DN per velocità limite, spessori ASME B31.1, classi ASME B16.34 / PN, materiali (CS, legati, inox, PE), condizioni di progetto e prova, coibentazione |
| `…-PI-LST-002` | Valve list generata dai P&ID: tipo, DN, classe, materiale, attuatore, posizione di sicurezza, taratura PSV |
| `…-IC-LST-001` | Instrument list generata dai P&ID: tag KKS, funzione ISA, servizio, campo, I/O e funzioni SIS |
| `…-ME-LST-001` | Equipment list (con colonna P&ID), processo e utilities |
| `…-EL-LST-001` | Load list: utenze MT/BT di processo e ausiliarie, potenze nominali e assorbite, carico contemporaneo |
| `…-PR-LST-001` | Elenco consumi utilities |
| `…-EL-SLD-001/002` | Schemi unifilari AT/generazione e servizi ausiliari MT/BT |
| `…-CV-PLT-001` | Plot plan in scala con coordinate, legenda e quote |
| `…-GA-ISO-001` | Vista isometrica d'insieme dell'impianto |
| `…-PI-ISO-001` | Isometrico della linea vapore HP con quote, coordinate e distinta materiali |

I P&ID registrano ogni valvola, strumento, linea e apparecchiatura disegnati: valve list,
instrument list e colonne P&ID di line list ed equipment list derivano da questo registro,
così gli elaborati restano coerenti tra loro. I P&ID di treno sono tipici (tag del treno 1).

Ogni elaborato si visualizza in anteprima e si esporta in **PDF** (vettoriale, generato
senza librerie esterne) o **SVG**; le liste anche in **CSV** (separatore `;`, per Excel).
Il pulsante *Scarica pacchetto PDF* produce un unico PDF con l'elenco elaborati in
apertura. I dati del cartiglio (progetto, committente, sito, prefisso, revisione,
firme) si modificano nella stessa sezione.

## Modello

| Componente | Modello |
|---|---|
| Acqua/vapore | IAPWS-IF97 regioni 1, 2, 4 (verificate con i valori di controllo IAPWS); campo p ≤ 165 bar |
| Aria e fumi | Miscele di gas ideali N₂, O₂, Ar, CO₂, H₂O con coefficienti di Shomate (NIST); aria umida |
| Combustione | Combustione completa di CH₄…C₄H₁₀ con inerti; PCI/PCS da composizione |
| Turbina a gas | Compressore e turbina con rendimenti isoentropici; raffreddamento statorico e rotorico; portata corretta e turbina in blocco sonico fuori progetto; regolazione IGV a temperatura di scarico costante, poi riduzione TIT; limite generatore |
| GVR | Metodo dei pinch point per zone, economizzatori in parallelo, degasaggio nel corpo LP, vincoli di fattibilità degli economizzatori (spostamento del pinch con post-combustione), temperatura minima al camino con ricircolo condensato |
| Turbina a vapore | Sezioni HP/IP/LP, legge del cono di Stodola (pressione scorrevole), rendimento a carico parziale, correzione di Baumann per l'umidità, perdita allo scarico |
| Condensatore | Acqua: portata costante, salto termico e TTD proporzionali al carico termico; ACC: ITD proporzionale al carico termico |
| Dinamica | Rampe TG, ritardo del primo ordine del ciclo a vapore (τ ≈ 4 min), sequenze di avviamento/arresto/blocco |

Valori tipici al punto ISO (classe F, 1+1, 3 livelli + RH): circa 446 MW netti,
rendimento netto 59,3 % PCI, camino 86 °C.

È uno strumento didattico e di prefattibilità: i risultati non sostituiscono i dati
di garanzia dei costruttori.

## Struttura

```
index.html            pagina dell'applicazione (moduli ES)
css/style.css         stile (tema chiaro/scuro)
js/engine/            modello fisico, usabile anche da Node
  steam.js            IAPWS-IF97
  gas.js              proprietà gas e combustione
  gt.js               turbina a gas
  bottoming.js        GVR, turbina a vapore, condensatore
  plant.js            integrazione impianto, ausiliari, emissioni, economia
  utilities.js        bilancio utilities e sistemi ausiliari
  dynamics.js         simulazione dinamica e sequenze
js/docs/              elaborati di ingegneria
  engineering.js      modello: correnti, linee, apparecchiature, utenze, layout
  utilities-eng.js    linee, utenze e apparecchiature dei sistemi utilities
  pidkit.js           kit P&ID: valvole, strumenti, gruppi tipici, registro
  pids-process.js     P&ID di processo (101-112)
  pids-util.js        P&ID utilities e ausiliari (201-210)
  pfds.js             PFD complementari e casi di funzionamento
  sheet.js            foglio vettoriale, cartiglio, tabelle impaginate, SVG
  pdf.js              scrittore PDF (Helvetica, WinAnsi)
  symbols.js          simboli P&ID (ISA 5.1) ed elettrici (IEC 60617)
  drawings-*.js       PFD generale, plot plan, isometrici, unifilari
  index.js            catalogo documenti, esportazioni
js/ui/                interfaccia (sinottico SVG, grafici canvas, viste)
scripts/build-single.mjs   genera la versione a file singolo in dist/
tests/                test con node:test
```
