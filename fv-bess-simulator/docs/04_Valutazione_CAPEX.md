# Valutazione del CAPEX – Impianto FV industriale con BESS

| Documento | Revisione | Data | Stato |
|---|---|---|---|
| FVB-CST-001 | A | 28/10/2026 | Emesso per commenti – stima di classe AACE 4 |

> **Avvertenza.** Stima parametrica per voci, basata sui benchmark di mercato raccolti in [A2](allegati/A2_Benchmark_costi_2026.md) (ottobre 2026). Molte voci sono stime motivate e non quotazioni: la stima va portata alla classe 3 con offerte di fornitori ed EPC prima della decisione di investimento. Prezzi in euro correnti 2026, IVA esclusa.

---

## 1. Sintesi

| Grandezza | Caso A (3 MWp a terra + BESS 2 MWh / 1 MW, Milano) |
|---|---|
| CAPEX deterministico | **2.409 k€** (di cui contingenze 175 k€ e costi del committente 44 k€) |
| FV | 1.848 k€ = **616 €/kWp** |
| BESS | 561 k€ = **281 €/kWh** (561 €/kW) |
| Intervallo Monte Carlo (P10 – P50 – P90) | 2.288 – 2.430 – 2.581 k€ |
| FV €/kWp (P10 – P50 – P90) | 582 – 623 – 669 |
| BESS €/kWh (P10 – P50 – P90) | 254 – 279 – 306 |
| Classe di stima | AACE 18R-97 classe 4 (accuratezza attesa −20 % / +30 %) |
| Contingenza consigliata | **12–13 %** dei costi diretti per un budget P80 (oggi nel simulatore: 8 %) |
| Validità | 3 mesi; da aggiornare con gli indici dei moduli e delle celle LFP |

Messaggi principali:

- Il CAPEX FV (616 €/kWp a terra fisso, 534–578 €/kWp su copertura, 671 €/kWp con tracker) è in linea con i totali EPC italiani 2026 (0,62 €/Wp a terra fisso, 0,65 €/Wp su tetto C&I 0,5–2 MWp, 0,69 €/Wp tracker, A2 §1.2).
- Moduli e montaggi pesano un terzo del CAPEX FV. Il prezzo dei moduli è salito nel 2026 (0,108 → 0,15 €/Wp per l'alta efficienza tra gennaio e maggio): è la voce di mercato più volatile.
- Il BESS C&I costa circa il doppio del BESS utility (281 contro ~110–150 €/kWh dei riferimenti MACSE e BNEF) per le economie di scala, i PCS piccoli e l'integrazione nella cabina d'utente.
- La contingenza dell'8 % copre il P50 ma non il P80: per il budget di approvazione si consiglia il 12–13 %.

---

## 2. Metodo

1. **Struttura per voci (WBS di costo).** 11 voci FV e 7 voci BESS, ciascuna con un'unità di misura che segue il driver di costo: €/kWp per le voci proporzionali alla potenza DC, €/kWh per l'energia del BESS (celle, container, installazione), €/kW per la conversione (PCS, trasformatori), € a corpo per le voci fisse (EMS/SCADA).
2. **Valori unitari** dai benchmark 2025–2026 (A2 §1–2), con un valore tipico e un intervallo min–max per voce.
3. **Voci dipendenti dalla tipologia di installazione** (strutture, opere civili, sicurezza, sviluppo, montaggi): valori diversi per a terra fisso, tracker, falda, est-ovest su tetto piano (tabella `MOUNT_CAPEX` in `js/data.js`).
4. **Contingenze** (8 %) e **costi del committente** (2 %: project management interno, assicurazione CAR, legali) sui costi diretti.
5. **Analisi di rischio Monte Carlo** (`node tools/capex-montecarlo.js`, 20.000 iterazioni): distribuzioni triangolari min/tipico/max per voce; moduli, DC block e PCS correlati da un fattore di mercato comune (0,7) per rappresentare l'andamento congiunto di polisilicio, celle e semiconduttori.
6. **Esclusioni**: IVA, oneri finanziari in costruzione, acquisto del terreno, rinforzi di rete a carico dell'utente oltre il preventivo TICA, bonifiche, demolizioni, adeguamento strutturale delle coperture, compensazioni ambientali, costi di sviluppo pregressi.

---

## 3. CAPEX per voce – caso A

### 3.1 Fotovoltaico (3.000 kWp, a terra struttura fissa)

| Voce | Unitario | Min – max benchmark | Totale € | Quota sul totale |
|---|---:|---:|---:|---:|
| Moduli fotovoltaici TOPCon bifacciali, franco cantiere | 130 €/kWp | 120 – 160 | 390.000 | 16,2 % |
| Inverter di stringa 350 kW | 35 €/kWp | 24 – 50 | 105.000 | 4,4 % |
| Strutture fisse infisse o a vite | 50 €/kWp | 40 – 70 | 150.000 | 6,2 % |
| BOS elettrico DC/AC (cavi, quadri, cavidotti, terra, SPD) | 60 €/kWp | 40 – 90 | 180.000 | 7,5 % |
| Cabina di trasformazione, trasformatore 3.150 kVA, quadri MT | 50 €/kWp | 40 – 70 | 150.000 | 6,2 % |
| Connessione (TICA) e adeguamento della cabina utente | 30 €/kWp | 10 – 80 | 90.000 | 3,7 % |
| Opere civili, viabilità, drenaggi | 35 €/kWp | 20 – 60 | 105.000 | 4,4 % |
| Recinzione, videosorveglianza, antintrusione | 20 €/kWp | 10 – 35 | 60.000 | 2,5 % |
| Montaggi meccanici ed elettrici | 80 €/kWp | 50 – 120 | 240.000 | 10,0 % |
| Ingegneria, direzione lavori, coordinamento sicurezza, collaudi | 30 €/kWp | 20 – 50 | 90.000 | 3,7 % |
| Sviluppo, autorizzazioni, pratiche GSE e distributore | 40 €/kWp | 20 – 100 | 120.000 | 5,0 % |
| **Costi diretti FV** | **560 €/kWp** | 394 – 885 | **1.680.000** | |

### 3.2 Sistema di accumulo (2.000 kWh / 1.000 kW, 8 cabinet AC)

| Voce | Unitario | Min – max benchmark | Totale € | Quota sul totale |
|---|---:|---:|---:|---:|
| DC block: celle LFP, moduli, rack, BMS, involucro, HVAC, antincendio | 110 €/kWh | 75 – 150 | 220.000 | 9,1 % |
| PCS bidirezionali | 60 €/kW | 40 – 90 | 60.000 | 2,5 % |
| BoP elettrico: trasformatore 1.250 kVA, quadri MT, cavi, protezioni | 70 €/kW | 40 – 120 | 70.000 | 2,9 % |
| EMS, SCADA, integrazione con il CCI | 40.000 € | 20.000 – 80.000 | 40.000 | 1,7 % |
| Installazione, basamenti, trasporti, messa in servizio | 40 €/kWh | 25 – 70 | 80.000 | 3,3 % |
| Prevenzione incendi e distanze di sicurezza | 5 €/kWh | 3 – 10 | 10.000 | 0,4 % |
| Ingegneria, permessi, aggiornamento della connessione | 15 €/kWh | 10 – 30 | 30.000 | 1,2 % |
| **Costi diretti BESS** | **255 €/kWh** | | **510.000** | |

### 3.3 Riepilogo

| Voce | € | €/kWp FV | Quota |
|---|---:|---:|---:|
| Costi diretti FV | 1.680.000 | 560 | 69,7 % |
| Costi diretti BESS | 510.000 | | 21,2 % |
| Contingenze 8 % | 175.200 | | 7,3 % |
| Costi del committente 2 % | 43.800 | | 1,8 % |
| **Totale CAPEX** | **2.409.000** | | 100 % |

Ripartizione per natura: forniture principali (moduli, inverter, strutture, cabina e trasformatori, DC block, PCS, BoP BESS, EMS) 49 %; lavori (montaggi, opere civili, sicurezza, installazione BESS) 21 %; BOS e connessione 11 %; servizi tecnici e sviluppo 10 %; contingenze e costi del committente 9 %.

---

## 4. Analisi di rischio

### 4.1 Risultati Monte Carlo

| Percentile | Totale | FV €/kWp | BESS €/kWh |
|---|---:|---:|---:|
| P10 | 2.288 k€ | 582 | 254 |
| P50 | 2.430 k€ | 623 | 279 |
| P80 | 2.529 k€ | – | – |
| P90 | 2.581 k€ | 669 | 306 |

- Il P50 (2.430 k€) supera il deterministico senza contingenze (2.234 k€) dell'8,8 %, perché le distribuzioni sono asimmetriche verso l'alto (connessione, sviluppo, BoP BESS).
- Il P80 richiede una contingenza del **13,2 %** sui costi diretti. Il valore dell'8 % usato nel simulatore è adatto al P50; per il budget autorizzato si consiglia di portarlo al 12–13 % finché non si hanno offerte.

### 4.2 Registro dei rischi di costo

| Rischio | Voci colpite | Effetto stimato | Mitigazione |
|---|---|---|---|
| Prezzo dei moduli (polisilicio, dazi, fine dei rimborsi IVA all'export cinese, domanda UE) | Moduli | ±0,02–0,04 €/Wp = ±60–120 k€ | Prezzo bloccato in offerta con validità ≥ 90 giorni; acquisto anticipato |
| Moduli ENEA categoria B/C per l'iper-ammortamento | Moduli | +0,05–0,15 €/Wp (offerta ristretta) | Confronto tra beneficio fiscale e sovrapprezzo (doc. 02 §4) |
| Regolamento UE 2024/3015 sul lavoro forzato (applicabile da dicembre 2027) e criteri di resilienza NZIA | Moduli, celle | Possibile sovrapprezzo per filiere tracciate | Tracciabilità della filiera nei contratti |
| Prezzo delle celle LFP (+22 % tra ottobre 2025 e aprile 2026) | DC block | ±15–25 €/kWh = ±30–50 k€ | Formula di indicizzazione o prezzo fisso; augmentation contrattualizzata |
| Preventivo di connessione e opere sulla cabina utente | Connessione | da 10 a 80 €/kWp | TICA anticipato; sopralluogo in cabina |
| Prescrizioni dei Vigili del Fuoco sul BESS (distanze, muri REI, estinzione) | Prevenzione incendi, opere civili | +5–20 €/kWh | Valutazione del rischio incendio in fase di progetto (doc. 01 §8) |
| Terreno (portanza, falda, invarianza idraulica) | Strutture, opere civili | +10–30 €/kWp | Indagini geotecniche e prove di estrazione dei pali |
| Rame e alluminio | BOS, cavi | ±5 €/kWp | Clausole di indicizzazione LME |
| Cambio EUR/USD | Inverter, PCS, BESS | ±3–5 % sulle forniture in dollari | Contratti in euro |
| Costo della manodopera e disponibilità di montatori | Montaggi | ±10 €/kWp | Pianificazione fuori dai picchi di cantiere |

---

## 5. Effetto della tipologia e della taglia

### 5.1 Tipologia di installazione (3 MWp, solo FV, Milano)

| Tipologia | CAPEX FV | Producibilità | LCOE |
|---|---:|---:|---:|
| A terra, struttura fissa 25° | 616 €/kWp | 1.310 kWh/kWp | 59,8 €/MWh |
| A terra, tracker monoassiale | 671 €/kWp | 1.542 kWh/kWp | 54,2 €/MWh |
| Copertura a falda 15° | 534 €/kWp | 1.237 kWh/kWp | 53,6 €/MWh |
| Copertura piana est-ovest 10° | 578 €/kWp | 1.151 kWh/kWp | 61,2 €/MWh |

Il tracker costa il 9 % in più e produce il 18 % in più, quindi ha un LCOE più basso; richiede però più terreno (GCR minore) e più manutenzione. Le coperture hanno il CAPEX più basso ma richiedono la verifica statica della copertura (non inclusa) e, se in cemento-amianto, la bonifica.

### 5.2 Economie di scala (benchmark A2 §1.2 e §2.1)

| Taglia | FV chiavi in mano | BESS chiavi in mano |
|---|---|---|
| 100–200 kWp su tetto | 0,68 – 0,79 €/Wp | |
| 250–500 kWp su tetto | 0,61 – 0,72 €/Wp | |
| 0,5–2 MWp su tetto | 0,55 – 0,80 €/Wp (tipico 0,65) | |
| 1–10 MWp a terra fisso | 0,52 – 0,80 €/Wp (tipico 0,62) | |
| 1–10 MWp a terra tracker | 0,58 – 0,90 €/Wp (tipico 0,69) | |
| BESS C&I 0,5–5 MWh | | 280 – 450 €/kWh (fonti commerciali); 180 – 400 €/kWh (stima per voci, 2 h) |
| BESS 2 h utility, Europa | | ~150 – 240 €/kWh |
| BESS 4 h utility (riferimento MACSE ARERA 2026) | | 125 – 150,5 €/kWh |

Nel simulatore le voci a corpo (EMS) e le voci in €/kW producono l'effetto di scala del BESS; per il FV le voci sono lineari: per taglie sotto 1 MWp aumentare cabina, connessione e ingegneria del 30–60 %.

---

## 6. Distribuzione temporale della spesa

| Fase | Durata tipica | Quota CAPEX | Milestone di pagamento tipiche (EPC) |
|---|---|---:|---|
| Sviluppo e autorizzazioni (PAS o edilizia libera, TICA, VVF) | 3–9 mesi | 5 % | A stato di avanzamento delle pratiche |
| Ingegneria esecutiva e ordini | 1–2 mesi | 10 % | Anticipo 10 % alla firma dell'EPC |
| Approvvigionamento (moduli 6–10 settimane, trasformatori 16–30 settimane, BESS 12–20 settimane) | 2–6 mesi | 50 % | 50–60 % alla consegna in cantiere |
| Costruzione e montaggio | 3–5 mesi | 30 % | SAL mensili |
| Messa in servizio, collaudo, connessione | 1–2 mesi | 5 % | 10 % al collaudo; 5 % trattenuta di garanzia fino al test di PR |

Il trasformatore MT e il PCS del BESS sono le forniture a più lungo approvvigionamento: ordinarli subito dopo il preventivo di connessione.

---

## 7. Costi operativi (riferimento)

| Voce | Valore | Totale caso A, anno 1 |
|---|---|---:|
| O&M FV (pulizia, sfalcio, manutenzione preventiva e correttiva) | 11 €/kWp·a | 33 k€ |
| Vigilanza (a terra) | 2 €/kWp·a | 6 k€ |
| O&M BESS (LTSA, ricambi, HVAC) | 4 €/kWh·a | 8 k€ |
| Assicurazione all risks e RC | 0,30 % del CAPEX | 7 k€ |
| IMU e tributi | 4,5 k€/a | 4,5 k€ |
| Monitoraggio, telecontrollo | 3 k€/a | 3 k€ |
| Gestione e pratiche | 5 k€/a | 5 k€ |
| **Totale OPEX ordinario** | ≈ 22 €/kWp·a | **≈ 67 k€** |
| Sostituzione inverter (anno 13) | 45 €/kWac a prezzi 2026 | 146 k€ nominali (110 k€ a prezzi 2026) |
| Augmentation BESS (all'80 % di SOH, anno 15 nel caso A: 426 kWh) | 120 €/kWh di oggi, −3 %/a reale | 45 k€ nominali |

---

## 8. Come portare la stima alla classe 3

1. Layout di dettaglio (ombre, distanze, viabilità, percorsi cavi) e computo metrico delle quantità.
2. Indagini geotecniche e prove di estrazione dei pali; per le coperture, verifica statica e stato del manto.
3. Preventivo di connessione (TICA) e sopralluogo in cabina utente.
4. Offerte vincolanti: almeno 3 EPC FV (con e senza moduli ENEA B/C), 3 fornitori BESS chiavi in mano con LTSA, trasformatori.
5. Parere preventivo VVF sul BESS, se richiesto.
6. Aggiornamento del simulatore con i prezzi offerti (scheda CAPEX) e ricalcolo della contingenza (Monte Carlo con intervalli ridotti a ±10 %).
