# Simulatore FV + BESS industriale

Simulatore di pre-fattibilità per un impianto **fotovoltaico industriale in autoconsumo con sistema di accumulo (BESS)**. Calcola ora per ora, per tutta la vita utile, la produzione, l'autoconsumo, l'esercizio della batteria e la bolletta evitata. Su questa base stima CAPEX, OPEX, incentivi italiani ed europei, flussi di cassa, VAN, TIR, LCOE e LCOS, e produce i principali dati di ingegneria: stringhe, cavi, trasformatori, protezioni ed elenco elaborati.

Funziona nel browser, senza installazione e senza server.

## Avvio

- **Uso immediato:** apri `standalone/Simulatore_FV_BESS.html` con un browser. È un file unico e funziona anche offline; servono solo i font da Google Fonts, altrimenti usa quelli di sistema.
- **Sviluppo:** apri `index.html`, che carica `css/` e `js/`. Dopo una modifica, rigenera il file unico con `npm run build`.

Il caso di esempio si carica all'apertura. Le modifiche restano salvate nel browser. Con **Copia configurazione** e **Importa configurazione** si salva o si condivide un caso in formato JSON.

## Cosa fa

| Scheda | Contenuto |
|---|---|
| Sintesi | Indicatori principali, valutazione in breve, contributo del BESS al VAN rispetto al solo FV, avvisi |
| Energia | Bilancio mensile, giorno medio del mese, bilancio annuo |
| Accumulo | Esercizio settimanale con SOC, cicli, stato di salute anno per anno, augmentation |
| Economia | Flussi di cassa di progetto e dell'equity, conto economico per anno, DSCR |
| CAPEX | Computo per voci modificabile, contingenze, ripartizione |
| Incentivi | Iper-ammortamento 2026, ZES, Sabatini, FESR, FER X, servizi di flessibilità e altri strumenti, con parametri modificabili e controllo del cumulo |
| Sensitività | Tornado del VAN su CAPEX, PUN, escalation, producibilità, OPEX, WACC e oneri |
| Ingegneria | Dimensionamento delle stringhe con 7 verifiche, cavi DC/AC/MT, trasformatori, BESS, tarature SPG/SPI (CEI 0-16), elenco elaborati |
| Elaborati | Elaborati di progetto in tre passi (scelta di fase e configurazione → elenco applicabile → generazione): relazioni in Word e PDF, tavole in CAD (DXF) e PDF, ZIP per cartelle |
| Relazione | Relazione sintetica dei risultati: copia, Word o PDF |

Dati di ingresso principali:

- **Sito:** 12 località italiane con irraggiamento e temperature mensili.
- **Consumi:** profilo per turni, oppure curva oraria o quartoraria da CSV.
- **FV:** a terra fisso, tracker, falda o est-ovest; scelta di moduli e inverter; perdite e degrado.
- **BESS:** taglia, rendimento, degrado, augmentation; strategia di autoconsumo, arbitraggio o peak shaving.
- **Rete:** limiti di prelievo e di immissione, immissione zero.
- **Prezzi:** PUN e componenti della bolletta in MT, oppure PUN orario da CSV.
- **Costi e finanza:** OPEX, fiscalità e debito.

## Documenti

| Documento | Contenuto |
|---|---|
| [01 – Relazione di ingegneria di dettaglio](docs/01_Relazione_Ingegneria_Dettaglio.md) | Basi di progetto, norme, generatore FV, conversione, MT e protezioni, BESS e sicurezza, terra, opere civili, SCADA, collaudi, manutenzione, MDR |
| [02 – Analisi economica](docs/02_Analisi_Economica.md) | Metodo, caso di riferimento, valore del BESS e CAPEX di pareggio, scenari di incentivo e di prezzo, rischi, modelli contrattuali |
| [03 – Contributi e incentivi UE e Italia](docs/03_Contributi_Incentivi_UE_IT.md) | Stato delle misure a ottobre 2026, intensità, cumulabilità, aree idonee, fiscalità, combinazioni consigliate per tre casi tipo, fonti |
| [04 – Valutazione del CAPEX](docs/04_Valutazione_CAPEX.md) | Stima per voci, Monte Carlo P10/P50/P90, registro dei rischi di costo, tipologie e taglie, spesa nel tempo, OPEX |
| [A1 – Risultati dei casi di studio](docs/allegati/A1_Risultati_casi.md) | Tabelle generate dal simulatore (`npm run report`) |
| [A2 – Benchmark di costo 2025–2026](docs/allegati/A2_Benchmark_costi_2026.md) | CAPEX, OPEX, prestazioni, prezzi dell'energia e parametri finanziari, con le fonti |

## Elaborati di progetto

La scheda **Elaborati** produce gli elaborati dell'elenco standard FV / FV + BESS / solo BESS (64 elaborati, tabella in `js/elaborati.js`).

1. **Scegli** la fase (PFTE o progetto definitivo, oppure progetto esecutivo), la configurazione (solo FV, FV + BESS, solo BESS), la procedura autorizzativa, il prefisso dei codici e la revisione. Finché la fase non è scelta l'elenco non si prepara.
2. **Prepara** l'elenco. Gli elaborati ● sono già selezionati e si possono escludere; quelli ○ ("se pertinente") si aggiungono a mano. Alcuni sono proposti in base alla procedura: screening VIA per il PAUR, relazione paesaggistica per AU e PAUR, VPIA per le opere pubbliche, PEF. Quelli – non sono generabili.
3. **Genera ed estrai** nei formati scelti, con anteprima delle tavole:

| Tipo di elaborato | Formati | Contenuto |
|---|---|---|
| Relazioni, calcoli, documenti economici e contrattuali (G, R, E, X, C) | **Word .docx**, **PDF** A4, Markdown | Cartiglio, scopo, riferimenti normativi, tabelle e calcoli dal simulatore, campi **[DA COMPLETARE]** evidenziati, intestazione e piè di pagina con numero di pagina |
| Elaborati grafici (T, D) | **CAD .dxf** (R12), **PDF** vettoriale A1/A0/A3, scheda Markdown | Disegno con cornice, cartiglio, legenda, note e scala; planimetrie in metri reali |

Si scarica un singolo file per formato, oppure lo ZIP con le cartelle `Word/`, `CAD/`, `PDF/` e `Markdown/`. Nel visualizzatore claude.ai il salvataggio passa dalla conferma del visualizzatore.

**Tavole CAD.** I DXF sono in formato R12 (AC1009, ANSI_1252), con layer per categoria (MODULI, INVERTER, CABINE, BESS, RECINZIONE, VIABILITA, CAVI_MT, CAVI_BT, TERRA, TVCC, QUOTE, CARTIGLIO…), tipi di linea e colori. Si aprono con AutoCAD, BricsCAD, DraftSight, LibreCAD, QCAD e LibreOffice Draw.
- **Planimetrie** (T02, T08, T09, T10, D01, D04, D08), in metri reali, con scala scelta in automatico: file di tavole 2P con il passo dal GCR, inverter e gruppi di stringhe, cabine, area BESS, recinzione, viabilità, cavidotto MT della lunghezza calcolata, cabina utente.
- **Sezioni e particolari** in scala fissa:
  - T03 sezione tra le file 1:50 con ombra al solstizio;
  - T07 e D05 strutture e basamenti 1:20;
  - T06 tipologici 1:50;
  - D07 cabina di consegna 1:50;
  - sezioni di scavo e di viabilità nella colonna laterale.
- **Schemi** in mm:
  - T05 e D02 unifilare con DG/SPG, DDI/SPI, linea MT, trasformatori, inverter, PCS e BESS, CCI;
  - D03 schema funzionale;
  - D06 architettura SCADA.
- T01 è il foglio di inquadramento con i riquadri per le basi cartografiche.

La geometria è di impostazione: il layout definitivo va sviluppato su rilievo, ortofoto e catasto.

Da riga di comando, con lo stesso obbligo di scelta:

```bash
node tools/genera-elaborati.js                                        # mostra fasi e configurazioni
node tools/genera-elaborati.js --fase pfte --config FB --elenco       # elenco applicabile, senza generare
node tools/genera-elaborati.js --fase esecutivo --config B --procedura au --includi D01 --formati docx,dxf,pdf --caso caso.json
```

`--caso` legge il JSON copiato con **Copia configurazione**. I file vanno in `elaborati/<fase>_<configurazione>_<data>/{Word,CAD,PDF,Markdown}/` (cartella esclusa da git).

I documenti di progetto in `docs/` sono disponibili anche in Word e PDF (`docs/word/`, `docs/pdf/`, rigenerabili con `npm run docs`).

## Modello di calcolo

- **Meteo:** il GHI medio mensile viene trasformato in valori giornalieri tramite un indice di serenità autocorrelato, che conserva la media del mese, e poi ripartito sulle ore secondo il profilo extraterrestre. La componente diffusa è calcolata con Erbs, l'irraggiamento sul piano dei moduli con Hay-Davies; il retro dei moduli bifacciali usa un fattore semplificato.
- **FV:** temperatura di cella da NOCT, coefficiente termico, perdite DC e AC, rendimento dell'inverter a carico parziale, clipping al rapporto DC/AC, degrado del primo anno e annuo.
- **BESS:** accoppiamento AC, rendimento di carica e scarica pari a √RTE, profondità di scarica utile, ausiliari. L'arbitraggio sceglie ogni giorno la carica notturna tra 5 livelli. Il peak shaving mantiene una riserva di SOC. Il degrado combina calendario e cicli; l'augmentation interviene alla soglia di SOH.
- **Economia:** il valore è la differenza ora per ora tra la bolletta senza impianto e quella con impianto, più le vendite in Ritiro Dedicato o FER X e il risparmio sulla quota potenza. L'analisi copre 25 anni nominali e calcola IRES e IRAP, ammortamenti, debito a rata costante e incentivi:
  - contributi: riducono la base ammortizzabile;
  - crediti d'imposta: non tassati;
  - maggiorazioni a scaglioni: base al netto degli altri aiuti;
  - tariffe e ricavi di capacità.
- **Ingegneria:** numero di moduli in serie dai limiti di tensione e di MPPT a Tmin e Tmax di progetto; verifiche di corrente per MPPT; sezioni dei cavi per portata e caduta di tensione; taglie standard dei trasformatori.

## Limiti

- Il meteo è sintetico e i prezzi seguono un profilo tipo. Per decidere un investimento usa PVGIS/TMY del sito, la curva di carico misurata e il PUN orario: entrambi si caricano da CSV.
- La strategia del BESS usa regole con previsione perfetta nell'arco della giornata: rappresenta un EMS ben fatto, non un ottimo matematico.
- Non sono modellati: ombreggiamenti specifici del sito, ora legale, oneri di sbilanciamento, servizi di rete nel dettaglio, valore della continuità di servizio.
- Incentivi e regole fiscali cambiano spesso. Lo stato è aggiornato a ottobre 2026 (documento 03) e va verificato con un consulente prima di ogni decisione.
- I documenti sono stime di pre-fattibilità (classe AACE 4) e vanno rivisti da un ingegnere abilitato.

## Struttura

```
fv-bess-simulator/
├── index.html               interfaccia (sviluppo)
├── standalone/              versione a file unico (npm run build)
├── css/style.css
├── js/data.js               siti, componenti, default, catalogo incentivi
├── js/engine.js             motore di calcolo (browser e Node)
├── js/charts.js             grafici SVG
├── js/elaborati.js          elenco elaborati, contenuti e formati di uscita
├── js/export.js             Word (.docx), PDF, CAD (.dxf), SVG e ZIP senza dipendenze
├── js/tavole.js             geometria degli elaborati grafici
├── js/ui.js                 interfaccia
├── tools/build-single.js    genera il file unico
├── tools/report-cases.js    calcola i casi di studio → docs/allegati/A1
├── tools/capex-montecarlo.js analisi di rischio del CAPEX
├── tools/genera-elaborati.js generazione degli elaborati da riga di comando
├── tools/export-docs.js     docs/*.md → docs/word/*.docx e docs/pdf/*.pdf
├── tests/                   test del motore e degli elaborati (npm test)
└── docs/                    documenti di progetto
```

## Comandi

```bash
npm test                         # test del motore e degli elaborati (Node ≥ 18)
npm run build                    # rigenera standalone/Simulatore_FV_BESS.html
npm run report                   # rigenera docs/allegati/A1_Risultati_casi.md
npm run docs                     # rigenera i documenti in Word e PDF
node tools/capex-montecarlo.js   # percentili del CAPEX
```

Il motore si usa anche da Node:

```js
const FVB = require('./js/engine.js');
const r = FVB.simulate({ project: { site: 'bari' }, pv: { kwp: 2000 }, bess: { kwh: 1000, kw: 500 } });
console.log(r.fin.npvProject, r.fin.irrProject, r.kpi.selfSufficiency);
```
