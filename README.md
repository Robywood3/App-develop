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
  dynamics.js         simulazione dinamica e sequenze
js/ui/                interfaccia (sinottico SVG, grafici canvas, viste)
scripts/build-single.mjs   genera la versione a file singolo in dist/
tests/                test con node:test
```
