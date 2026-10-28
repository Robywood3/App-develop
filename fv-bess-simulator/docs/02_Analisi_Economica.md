# Analisi economica – Impianto fotovoltaico industriale con sistema di accumulo

| Documento | Revisione | Data | Stato |
|---|---|---|---|
| FVB-ECO-001 | A | 28/10/2026 | Emesso per commenti (pre-fattibilità, classe di stima AACE 4) |

> **Avvertenza.** I valori derivano dal simulatore FV+BESS di questo repository (meteo sintetico da medie mensili, prezzi orari con profilo tipo, default di costo in [A2](allegati/A2_Benchmark_costi_2026.md)). Servono a confrontare configurazioni e a decidere se approfondire. Prima di una decisione di investimento vanno sostituiti con: dati PVGIS/TMY del sito, curva di carico quartoraria misurata (almeno 12 mesi), offerte EPC e BESS, condizioni bancarie, parere fiscale sugli incentivi. Tutte le tabelle numeriche sono riproducibili con `node tools/report-cases.js` ([A1](allegati/A1_Risultati_casi.md)).

---

## 0. Sintesi

1. **Il fotovoltaico in autoconsumo è molto redditizio.** Nel caso di riferimento (Milano, 3 MWp a terra, stabilimento da 9 GWh/a su due turni) il solo FV costa 1,85 M€ (616 €/kWp), produce 3.931 MWh/a con un LCOE di 60 €/MWh e sostituisce energia acquistata a circa 210–220 €/MWh. VAN 4,86 M€ al WACC del 7 %, TIR di progetto 29 %, rientro in 3,5 anni.
2. **Il BESS dietro il contatore, senza incentivi né ricavi di rete, riduce il VAN.** Con 2 MWh / 1 MW (561 k€, 281 €/kWh) il VAN scende di 320 k€ rispetto al solo FV. Il BESS scarica 405 MWh/a (225 cicli equivalenti) con un LCOS di 162 €/MWh: lo spread che sfrutta (immissione a ~110 €/MWh contro prelievo evitato a ~215 €/MWh, più l'arbitraggio notturno) non ripaga il costo con un WACC del 7 %. **Il CAPEX di pareggio è circa 90 €/kWh**, un terzo dei prezzi C&I attuali.
3. **Il BESS diventa neutro o conveniente in quattro situazioni**, da verificare caso per caso:
   - incentivi sul BESS al Sud (iper-ammortamento + credito ZES): pareggio a ~280 €/kWh, cioè ai prezzi correnti;
   - limite di immissione zero o molto basso, che altrimenti costringe a tagliare la produzione: pareggio ~240 €/kWh;
   - quote potenza elevate o penali per supero della potenza impegnata, ricavi da servizi di flessibilità (UVA/MSD) e valore della continuità di servizio (UPS di stabilimento), che il simulatore non quantifica;
   - prezzi delle batterie in ulteriore calo (augmentation e sostituzioni future sono già scontate del 3 %/anno reale).
4. **Incentivi.** Transizione 5.0 è chiusa e il bando MIMIT per le PMI pure. Oggi lo strumento principale è **l'iper-ammortamento 2026–2028**, che però vale per il FV solo con **moduli iscritti al registro ENEA nelle categorie B/C** (celle europee ad alta efficienza), con un'offerta molto ristretta e prezzi più alti. Nel caso A aggiunge 0,7 M€ di VAN. Al Sud il credito d'imposta **ZES Unica** porta l'intensità di aiuto oltre il 50 %. Dettagli in [03](03_Contributi_Incentivi_UE_IT.md).
5. **Raccomandazione per il caso di riferimento:** realizzare il FV dimensionato sull'autoconsumo (produzione ≤ 105 % dei consumi, requisito anche per l'iper-ammortamento). Predisporre lo spazio, la potenza in cabina e le vie cavi per un BESS da 1–2 MWh, e acquistarlo quando si verifica una delle condizioni del punto 3 o quando il turnkey C&I scende sotto 150 €/kWh. In alternativa, dimensionare un BESS piccolo (≤ 1 MWh) se l'EMS deve gestire la limitazione di immissione o la continuità dei carichi critici.

---

## 1. Metodo

### 1.1 Modello energetico

| Aspetto | Modellazione |
|---|---|
| Passo e orizzonte | Orario (8.760 h), ripetuto per ogni anno della vita utile (25 anni) con degrado FV e BESS |
| Irraggiamento | Medie mensili di GHI (ENEA/PVGIS) → indice di serenità giornaliero autocorrelato (conserva la media mensile) → ripartizione oraria sul profilo extraterrestre; diffusa con Erbs; piano dei moduli con Hay-Davies; retro dei moduli bifacciali con fattore di vista semplificato |
| Moduli e inverter | Temperatura di cella da NOCT; coefficiente di potenza; perdite DC e AC; efficienza inverter a carico parziale; clipping al rapporto DC/AC; tracker monoassiale ±55° con perdita di backtracking del 4 % |
| Carico | Profilo per turni (1, 2, 3 turni, ciclo continuo), sabati e festivi, fermate di agosto e Natale, stagionalità, rumore ±4 %; oppure curva oraria/quartoraria caricata da CSV |
| Prezzi | Profilo orario del PUN con forma "duck curve" 2025–26 (avvallamento nelle ore solari, picco serale, livelli mensili, fine settimana), tarato sul PUN medio. Il profilo dà un capture rate solare di 0,86 e uno spread medio giornaliero TB4 di 67 €/MWh (benchmark: 0,86 e ~75 €/MWh nel 2026, A2 §5.1). Si può caricare il PUN orario reale |
| BESS | Accoppiamento AC; carica dal surplus FV; scarica sul deficit; arbitraggio con scelta giornaliera della carica notturna da rete (5 livelli, valore residuo del SOC); peak shaving con riserva di SOC; limite di cicli giornalieri; ausiliari; degrado di calendario e per ciclo; augmentation all'80 % di SOH |
| Rete | Limite di immissione con taglio della produzione; immissione zero; potenza disponibile in prelievo |

### 1.2 Valorizzazione

- **Risparmio in bolletta** = (costo del prelievo senza impianto − costo del prelievo con impianto), ora per ora. Il costo variabile del prelievo è PUN × (1 + perdite 3,8 %) + spread del fornitore 8 €/MWh + componenti variabili di rete e di sistema 64 €/MWh (dispacciamento 11,6, capacità 15,9, trasporto 11,6, ASOS/ARIM ~25) + accise 12,5 €/MWh: circa **215 €/MWh** con PUN 130. Lo stesso costo si applica all'energia che il BESS preleva per l'arbitraggio.
- **Quota potenza**: 28 €/kW·anno (MTA3 e-distribuzione 2026) sul picco mensile di prelievo. È bassa: il solo peak shaving vale poco.
- **Vendita delle eccedenze**: prezzo zonale orario (Ritiro Dedicato) al netto di 0,5 €/MWh di corrispettivi GSE. In alternativa CfD FER X (strike 70 €/MWh nel catalogo).
- **Escalation**: prezzi dell'energia +2 %/anno nominale, OPEX +2,2 %/anno.

### 1.3 Modello finanziario e fiscale

| Voce | Ipotesi |
|---|---|
| Flussi | Nominali, annuali; anno 0 = investimento, entrata in esercizio a inizio anno 1 |
| WACC / costo dell'equity | 7,0 % / 9,0 % nominali |
| Debito | 60 % del CAPEX, 5,0 %, 12 anni, rata costante (corporate loan) |
| Imposte | IRES 24 % su EBITDA − ammortamenti − maggiorazioni − interessi; IRAP 3,9 % su EBITDA − ammortamenti. Si assume **capienza fiscale** dell'impresa (le perdite fiscali del progetto riducono le imposte del gruppo); disattivabile |
| Ammortamento | 9 %/anno per FV e BESS (primo anno a metà aliquota) |
| Contributi in conto impianti | Riducono la base ammortizzabile |
| Crediti d'imposta | Non concorrono al reddito; compensati negli anni indicati |
| Iper-ammortamento | Maggiorazione a scaglioni (180 % / 100 % / 50 %) sulla spesa ammessa al netto degli altri aiuti, dedotta con lo stesso piano dell'ammortamento, solo IRES |
| Spese straordinarie | Sostituzione inverter anno 13 (45 €/kWac), augmentation BESS (120 €/kWh di oggi, −3 %/anno reale) spesate nell'anno |
| Fine vita | Dismissione 25 €/kWp nell'ultimo anno, valore residuo nullo |
| Indicatori | VAN e TIR di progetto (unlevered) e dell'equity (levered), payback semplice e attualizzato, LCOE FV, LCOS BESS (escluso il costo dell'energia di carica), DSCR |

---

## 2. Caso di riferimento A

### 2.1 Configurazione

| Elemento | Valore |
|---|---|
| Sito | Milano, zona di mercato NORD |
| Stabilimento | 9.000 MWh/a, due turni (6–22) dal lunedì al venerdì, sabato ridotto, fermata di 2 settimane ad agosto e a Natale; picco ~2,2 MW |
| FV | 3.003 kWp DC / 2.450 kWac, a terra struttura fissa 25° sud, GCR 0,42; 4.844 moduli TOPCon bifacciali 620 Wp; 7 inverter da 350 kW |
| BESS | 2 MWh / 1 MW LFP (8 cabinet AC da 261 kWh / 125 kW), RTE 86 %, DoD 90 % |
| Connessione | MT 15 kV in cabina utente esistente; immissione max 3 MW |
| EMS | Autoconsumo + arbitraggio notturno (spread minimo 30 €/MWh) |

### 2.2 Bilancio energetico (anno 1)

| Voce | MWh/a | Quota |
|---|---:|---:|
| Produzione FV | 3.931 | 100 % |
| · autoconsumo diretto | 3.152 | 80 % |
| · caricata nel BESS | 244 | 6 % |
| · immessa in rete | 535 | 14 % |
| Scarica BESS ai carichi | 405 | |
| Carica BESS da rete (arbitraggio) | 227 | |
| Prelievo da rete | 5.673 | 63 % del consumo |
| Consumo dello stabilimento | 9.000 | |

Producibilità specifica 1.310 kWh/kWp, PR 86 % (con guadagno bifacciale). Autoconsumo 86 % della produzione, autosufficienza 40 % dei consumi. CO₂ evitata circa 830 t/a.

### 2.3 Indicatori economici

| Indicatore | Solo FV (A0) | FV + BESS (A) |
|---|---:|---:|
| CAPEX | 1.848 k€ (616 €/kWp) | 2.409 k€ (+561 k€ BESS, 281 €/kWh) |
| Risparmio + vendite anno 1 | 722 k€ | 749 k€ |
| VAN di progetto (7 %) | **4.861 k€** | **4.541 k€** |
| TIR di progetto | 29,4 % | 23,7 % |
| TIR equity (60 % debito) | 56,5 % | 42,9 % |
| Payback semplice | 3,5 anni | 4,3 anni |
| LCOE FV | 59,8 €/MWh | 59,8 €/MWh |
| LCOS BESS | – | 162 €/MWh |
| DSCR minimo | – | 3,3 |

Conto economico e flussi anno per anno: [A1 §7](allegati/A1_Risultati_casi.md). Il flusso di progetto dell'anno 1 è di 522 k€ su 2.409 k€ investiti; l'EBITDA cresce da 682 k€ a ~860 k€ per l'escalation dei prezzi, compensata in parte dal degrado.

---

## 3. Il valore del sistema di accumulo

### 3.1 Valore incrementale

| Confronto | ΔCAPEX | ΔVAN | Scarica BESS | Cicli/anno | LCOS |
|---|---:|---:|---:|---:|---:|
| A (BESS 2 MWh, nessun incentivo) vs A0 | +561 k€ | **−320 k€** | 405 MWh/a | 225 | 162 €/MWh |
| A3 (con UVA/MSD 15 €/kW·a e peak shaving) vs A0 | +561 k€ | −246 k€ | 367 MWh/a | 204 | 178 €/MWh |
| B (Bari, iper-ammortamento + ZES) vs B0 | +561 k€ | **+1 k€** | 471 MWh/a | 261 | 143 €/MWh |

### 3.2 Da dove viene (e dove manca) il valore

Ogni MWh spostato dal BESS vale la differenza tra il costo evitato del prelievo serale e il valore dell'energia che altrimenti sarebbe stata immessa o, nell'arbitraggio, prelevata di notte:

- **Spostamento del surplus FV:** 215 €/MWh evitati contro ~110 €/MWh di ricavo dell'immissione, al netto del 14 % di perdite di ciclo: circa 75–85 €/MWh di margine. Nel caso A il surplus disponibile è piccolo (535 MWh/a residui) perché il FV è dimensionato sui consumi.
- **Arbitraggio notturno:** le componenti di rete e le accise si pagano sia sull'energia caricata sia su quella evitata e quindi si annullano; resta lo spread del PUN (~45–65 €/MWh tra notte e picco) meno le perdite. Margine di 25–40 €/MWh.
- **Peak shaving:** con la quota potenza MTA3 a 28 €/kW·anno, tagliare 500 kW di picco vale ~14 k€/anno; nel caso A vale 6 k€/anno perché i picchi dello stabilimento sono piatti.

Con 225 cicli/anno e margini di 30–80 €/MWh il BESS da 2 MWh genera 25–35 k€/anno, contro una rata equivalente del CAPEX di ~50 k€/anno (561 k€ al 7 % su 20 anni) più 8 k€/anno di O&M e un'augmentation all'anno 15.

### 3.3 Taglia e strategia

| BESS (2 h) | CAPEX BESS | VAN | ΔVAN vs solo FV | TIR |
|---|---:|---:|---:|---:|
| nessuno | – | 4.861 k€ | – | 29,4 % |
| 1 MWh / 0,5 MW | 303 k€ | 4.699 k€ | −162 k€ | 26,0 % |
| 2 MWh / 1 MW | 561 k€ | 4.541 k€ | −320 k€ | 23,7 % |
| 4 MWh / 2 MW | 1.078 k€ | 4.161 k€ | −700 k€ | 20,0 % |
| 6 MWh / 3 MW | 1.595 k€ | 3.733 k€ | −1.128 k€ | 17,2 % |

| Strategia EMS (caso A) | VAN | Scarica | Da rete |
|---|---:|---:|---:|
| Solo autoconsumo | 4.499 k€ | 220 MWh/a | 0 |
| Autoconsumo + arbitraggio | 4.541 k€ | 405 MWh/a | 227 MWh/a |
| + peak shaving a 1,7 MW | 4.539 k€ | 367 MWh/a | 238 MWh/a |

L'arbitraggio raddoppia i cicli e migliora il VAN di 42 k€; il peak shaving non aggiunge valore con le tariffe attuali.

### 3.4 CAPEX di pareggio del BESS

CAPEX chiavi in mano del BESS (€/kWh, contingenze incluse) per cui il VAN di FV + BESS eguaglia quello del solo FV:

| Scenario | Pareggio | Rispetto al prezzo attuale (281 €/kWh) |
|---|---:|---|
| Caso A, nessun incentivo | ~92 €/kWh | −67 % |
| Caso A, PUN 170 €/MWh | ~98 €/kWh | −65 % |
| Caso A con iper-ammortamento | ~138 €/kWh | −51 % |
| Caso A con UVA/MSD 15 €/kW·a e peak shaving | ~135 €/kWh | −52 % |
| Caso A con immissione zero (vincolo del distributore) | ~241 €/kWh | −14 % |
| Caso B (Bari) con iper-ammortamento + ZES | ~281 €/kWh | in pari |

Lettura: un BESS behind-the-meter si giustifica oggi quando **evita un taglio di produzione** (immissione limitata) o quando è **incentivato al Sud**. Negli altri casi conviene predisporre l'impianto e rimandare l'acquisto, oppure valutare un BESS stand-alone di taglia utility per MACSE o per i mercati, che è un altro modello di business.

---

## 4. Scenari di incentivo

| Caso | Descrizione | Aiuti (nominali) | Intensità | VAN | TIR progetto | Payback |
|---|---|---:|---:|---:|---:|---:|
| A | Milano, nessun incentivo | 0 | 0 % | 4.541 k€ | 23,7 % | 4,3 anni |
| A1 | + iper-ammortamento (moduli ENEA B/C) | 1.041 k€ | 43 % | 5.225 k€ | 26,8 % | 3,8 anni |
| A2 | + iper-ammortamento + Nuova Sabatini | 1.179 k€ | 49 % | 5.311 k€ | 27,7 % | 3,6 anni |
| B | Bari, iper-ammortamento + ZES 24 % | 1.369 k€ | 57 % | 7.524 k€ | 38,7 % | 2,4 anni |
| C | PMI Bologna, 1 MWp su tetto est-ovest + BESS 1 MWh, iper + Sabatini | 437 k€ | 49 % | 1.646 k€ | 24,7 % | 4,0 anni |
| C0 | come C senza incentivi | 0 | 0 % | 1.361 k€ | 20,7 % | 4,9 anni |

Note:
- Gli aiuti dell'iper-ammortamento sono il **risparmio IRES nominale** distribuito sugli anni di ammortamento: in valore attuale valgono circa due terzi del nominale.
- Il caso A1 assume moduli di categoria B/C **allo stesso prezzo** dei moduli standard. Se costano 0,10 €/Wp in più (+300 k€ per 3 MWp), il beneficio netto dell'iper-ammortamento scende da 684 a 468 k€ di VAN (−32 %). Va verificato con offerte reali prima di scegliere.
- Il credito ZES al 24 % è un'ipotesi (40 % della Carta per una grande impresa × riparto del 60 %): la percentuale effettiva si conosce solo dopo la chiusura della finestra.
- Iper-ammortamento e ZES sono cumulabili con base al netto; il simulatore controlla che il totale degli aiuti non superi il 100 % della spesa, ma la verifica delle intensità massime della Carta degli aiuti regionali o del GBER resta da fare con il consulente.

---

## 5. Rischi e sensitività

### 5.1 Prezzo dell'energia

| PUN anno 1 | Escalation | VAN | TIR | Payback |
|---:|---:|---:|---:|---:|
| 100 €/MWh | 0 %/a | 2.484 k€ | 18,1 % | 5,2 anni |
| 100 €/MWh | +2 %/a | 3.491 k€ | 20,2 % | 5,0 anni |
| 130 €/MWh | 0 %/a | 3.364 k€ | 21,6 % | 4,5 anni |
| **130 €/MWh** | **+2 %/a** | **4.541 k€** | **23,7 %** | **4,3 anni** |
| 170 €/MWh | +2 %/a | 5.904 k€ | 28,0 % | 3,7 anni |
| 170 €/MWh | −2 %/a | 3.424 k€ | 24,0 % | 3,9 anni |

Il PUN del 2026 (~145 €/MWh medio gennaio–settembre, oltre 200 €/MWh a ottobre per la crisi di Hormuz) è sopra lo scenario base, mentre i futures 2027 rilevati prima della crisi erano intorno a 100 €/MWh. Il progetto resta ampiamente positivo anche con PUN 100 senza escalation (VAN 2,5 M€), perché metà del valore evitato sono oneri, accise e componenti di rete che non dipendono dal PUN.

### 5.2 Tornado del VAN (caso A)

| Grandezza | Variazione | VAN sfavorevole | VAN favorevole |
|---|---|---:|---:|
| WACC | ±2 pp | 3.410 k€ | 6.058 k€ |
| Escalation prezzi | ±1,5 pp | 3.630 k€ | 5.651 k€ |
| PUN | ±20 % | 3.631 k€ | 5.420 k€ |
| Oneri e componenti variabili | ±30 % | 3.906 k€ | 5.169 k€ |
| Producibilità FV | ±8 % | 4.007 k€ | 5.068 k€ |
| CAPEX | ±20 % | 4.133 k€ | 4.949 k€ |
| OPEX | ±20 % | 4.442 k€ | 4.640 k€ |

In nessuno scenario elementare il VAN diventa negativo. Le grandezze che pesano di più sono quelle di mercato (prezzi e loro dinamica) e il costo del capitale, non il CAPEX.

### 5.3 Rischi qualitativi

| Rischio | Effetto | Mitigazione |
|---|---|---|
| Revisione degli oneri sull'autoconsumo (oggi esente da oneri di rete e da accise oltre 20 kW) | Riduzione del costo evitato | Scenario oneri −30 % già nel tornado; il VAN resta positivo |
| Cannibalizzazione dei prezzi nelle ore solari | Valore dell'immissione più basso | Dimensionare sull'autoconsumo; immissione 14 % nel caso A |
| Variazione dei turni o della domanda dello stabilimento | Meno autoconsumo | Curva di carico misurata; FV ≤ consumi diurni; BESS modulare |
| Ritardi della connessione o del titolo autorizzativo | Slittamento dei flussi e degli incentivi (iper-ammortamento entro il 30/9/2028) | Avvio anticipato di TICA e PAS; aree idonee |
| Moduli ENEA B/C non disponibili o costosi | Perdita dell'iper-ammortamento | Confronto con offerte reali; caso A senza incentivi già positivo |
| Degrado BESS più rapido | Augmentation anticipata | Garanzia di prestazione (SOH, RTE) e contratto LTSA |
| Fuoco BESS / prescrizioni VVF | Costi di distanze e protezioni, assicurazione | Relazione di rischio incendio (doc. 01 §8) |

---

## 6. Alternative di finanziamento e di contratto

| Modello | Quando conviene | Effetti sull'analisi |
|---|---|---|
| Investimento diretto con debito corporate (caso base) | Impresa con capienza fiscale e accesso al credito | Massimo VAN; accesso a iper-ammortamento, ZES, Sabatini |
| Leasing finanziario | Impresa che vuole preservare le linee di credito | Iper-ammortamento spetta all'utilizzatore secondo le regole della misura (da verificare) |
| PPA on-site con terzo investitore (ESCo) | Impresa senza capitale o capienza fiscale | Nessun CAPEX; risparmio = costo evitato − prezzo PPA (sconto sul costo di prelievo da negoziare; indicativamente 15–25 %); gli incentivi fiscali restano all'investitore |
| Green loan / sustainability-linked loan (BEI, InvestEU tramite banche) | Progetti allineati alla Tassonomia UE (attività 4.1 e 4.10) | Spread inferiore di 10–30 bp (indicativo) |
| Comunità energetica / autoconsumo diffuso | Surplus FV rilevante e utenze vicine | Tariffa premio sull'energia condivisa; poco rilevante con autoconsumo all'86 % |

---

## 7. Conclusioni

- Il fotovoltaico in autoconsumo per uno stabilimento a due turni è un investimento a basso rischio e ad alto rendimento anche senza incentivi (TIR > 20 % in tutti gli scenari elementari).
- Il BESS behind-the-meter è oggi una scelta da motivare con vincoli di rete, incentivi al Sud, continuità di servizio o servizi di flessibilità; non con il solo spostamento dell'energia. Il simulatore permette di ripetere il calcolo con la curva di carico e il PUN orario reali dello stabilimento: è il primo passo consigliato.
- L'iper-ammortamento può aumentare il VAN del 15–20 % ma impone moduli B/C: la scelta del modulo va fatta confrontando il beneficio fiscale con il sovrapprezzo.

### Prossimi passi

1. Raccolta della curva di carico quartoraria (portale del distributore) e delle bollette degli ultimi 12 mesi; caricamento nel simulatore.
2. Calcolo PVGIS sul sito e rilievo dell'area o delle coperture (portata, ombre, vincoli).
3. Richiesta di preventivo di connessione (TICA) per la modifica della connessione esistente.
4. Richiesta di offerte EPC per il FV con e senza moduli ENEA B/C, e di offerte BESS 1–2 MWh con garanzia di prestazione.
5. Verifica fiscale dell'ammissibilità a iper-ammortamento, ZES (se al Sud), Sabatini e bandi regionali aperti; prenotazione sulla piattaforma GSE.
