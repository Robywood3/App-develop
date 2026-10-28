# Allegato A1 – Risultati dei casi di studio

Generato con `node tools/report-cases.js` il 2026-10-28 (simulatore FV+BESS v1.0, default di docs/allegati/A2_Benchmark_costi_2026.md). Valori in euro nominali, orizzonte 25 anni.

## 1. Casi

| Caso | Descrizione |
|---|---|
| A | Riferimento: Milano, 3 MWp a terra fisso, BESS 2 MWh / 1 MW, senza incentivi |
| A0 | Come A, solo FV |
| A1 | Come A + iper-ammortamento (moduli ENEA B/C) |
| A2 | Come A + iper-ammortamento + Nuova Sabatini |
| A3 | Come A + ricavi UVA/MSD 15 €/kW·a + peak shaving |
| B | Sud: Bari, 3 MWp a terra, BESS 2 MWh, iper-ammortamento + ZES (24 %) |
| B0 | Come B, solo FV |
| C | PMI Centro-Nord: Bologna, 1 MWp su copertura est-ovest, 3 GWh/a a 1 turno, BESS 1 MWh / 0,5 MW, iper + Sabatini |
| C0 | Come C senza incentivi |
| D | Energivoro a ciclo continuo: Milano, 8 MWp a terra tracker, 40 GWh/a, BESS 8 MWh / 4 MW |

## 2. Indicatori principali

| Caso | CAPEX k€ | €/kWp FV | €/kWh BESS | Prod. MWh/a | kWh/kWp | Autocons. | Autosuff. | Aiuti k€ | VAN k€ | TIR prog. | TIR equity | Payback anni | LCOE €/MWh |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 2409 | 616 | 281 | 3931 | 1310 | 86 % | 40 % | 0 | 4541 | 23,7 % | 42,9 % | 4,3 | 59,8 |
| A0 | 1848 | 616 | – | 3931 | 1310 | 80 % | 35 % | 0 | 4861 | 29,4 % | 56,5 % | 3,5 | 59,8 |
| A1 | 2409 | 616 | 281 | 3931 | 1310 | 86 % | 40 % | 1041 | 5225 | 26,8 % | 50,5 % | 3,8 | 59,8 |
| A2 | 2409 | 616 | 281 | 3931 | 1310 | 86 % | 40 % | 1179 | 5311 | 27,7 % | 53,5 % | 3,6 | 59,8 |
| A3 | 2409 | 616 | 281 | 3931 | 1310 | 85 % | 39 % | 0 | 4615 | 24,0 % | 43,9 % | 4,2 | 59,8 |
| B | 2409 | 616 | 281 | 5065 | 1688 | 82 % | 48 % | 1369 | 7524 | 38,7 % | 90,7 % | 2,4 | 46,4 |
| B0 | 1848 | 616 | – | 5065 | 1688 | 75 % | 42 % | 1050 | 7523 | 46,6 % | 110,8 % | 2,0 | 46,4 |
| C | 897 | 594 | 303 | 1241 | 1241 | 90 % | 39 % | 437 | 1646 | 24,7 % | 46,6 % | 4,0 | 60,0 |
| C0 | 897 | 594 | 303 | 1241 | 1241 | 90 % | 39 % | 0 | 1361 | 20,7 % | 36,2 % | 4,9 | 60,0 |
| D | 7392 | 660 | 264 | 12.334 | 1542 | 100 % | 34 % | 0 | 13.837 | 23,5 % | 42,7 % | 4,3 | 52,2 |

## 3. Valore incrementale del BESS

| Confronto | ΔCAPEX k€ | ΔVAN k€ | Scarica BESS MWh/a | Cicli/a | LCOS €/MWh |
|---|---:|---:|---:|---:|---:|
| A vs A0 | 561 | -320 | 405 | 225 | 162 |
| B vs B0 | 561 | 1 | 471 | 261 | 143 |
| A3 vs A0 | 561 | -246 | 367 | 204 | 178 |

### Scansione della taglia del BESS (caso A, rapporto 2 h)

| kWh / kW | CAPEX BESS k€ | VAN k€ | ΔVAN vs solo FV k€ | TIR | Scarica MWh/a | Da rete MWh/a |
|---|---:|---:|---:|---:|---:|---:|
| 0 / 0 | 0 | 4861 | 0 | 29,4 % | 0 | 0 |
| 1000 / 500 | 303 | 4699 | -162 | 26,0 % | 229 | 122 |
| 2000 / 1000 | 561 | 4541 | -320 | 23,7 % | 405 | 227 |
| 4000 / 2000 | 1078 | 4161 | -700 | 20,0 % | 718 | 469 |
| 6000 / 3000 | 1595 | 3733 | -1128 | 17,2 % | 1021 | 750 |

### Strategie EMS (caso A)

| Strategia | VAN k€ | Scarica MWh/a | Da rete MWh/a | Risparmio quota potenza anno 1 k€ |
|---|---:|---:|---:|---:|
| Solo autoconsumo | 4499 | 220 | 0 | 1,7 |
| Autoconsumo + arbitraggio | 4541 | 405 | 227 | 1,9 |
| Autoconsumo + arbitraggio + peak shaving 1,7 MW | 4539 | 367 | 238 | 7,6 |

## 4. Scenari di prezzo (caso A)

| PUN anno 1 €/MWh | Escalation | VAN k€ | TIR | Payback |
|---:|---:|---:|---:|---:|
| 100 | 0 %/a | 2484 | 18,1 % | 5,2 |
| 100 | 2 %/a | 3491 | 20,2 % | 5,0 |
| 130 | 0 %/a | 3364 | 21,6 % | 4,5 |
| 130 | 2 %/a | 4541 | 23,7 % | 4,3 |
| 170 | 2 %/a | 5904 | 28,0 % | 3,7 |
| 170 | -2 %/a | 3424 | 24,0 % | 3,9 |

## 5. Sensitività del VAN (caso A)

VAN base 4541 k€.

| Grandezza | Variazione | VAN sfavorevole k€ | VAN favorevole k€ | TIR sfav. | TIR fav. |
|---|---|---:|---:|---:|---:|
| WACC | ±2 pp | 3410 | 6058 | 23,7 % | 23,7 % |
| Escalation prezzi | ±1,5 pp | 3630 | 5651 | 22,1 % | 25,2 % |
| Prezzo energia (PUN) | ±20% | 3631 | 5420 | 20,7 % | 26,5 % |
| Oneri e componenti variabili | ±30% | 3906 | 5169 | 21,6 % | 25,7 % |
| Producibilità FV | ±8% | 4007 | 5068 | 21,9 % | 25,3 % |
| CAPEX | ±20% | 4133 | 4949 | 20,0 % | 29,0 % |
| OPEX | ±20% | 4442 | 4640 | 23,3 % | 24,0 % |

## 6. Caso A – bilancio energetico anno 1

| Voce | MWh |
|---|---:|
| Produzione FV | 3931 |
| Autoconsumo diretto | 3152 |
| FV caricato nel BESS | 244 |
| Immissione | 535 |
| Taglio | 0 |
| Scarica BESS | 405 |
| Carica BESS da rete | 227 |
| Ausiliari BESS | 3 |
| Prelievo da rete | 5673 |
| Consumo stabilimento | 9000 |

## 7. Caso A – conto economico e flussi (k€ nominali, primi 12 anni e ultimo)

| Anno | Risparmio energia | Vendita | Quota potenza | OPEX | Straord. | EBITDA | Ammort. | Imposte | FCF progetto | Interessi | FCF equity | DSCR |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | | | | | | | | | -2409 | | -964 | |
| 1 | 697 | 50 | 1,9 | 67 | 0 | 682 | 108 | 160 | 522 | 72 | 377 | 3,31 |
| 2 | 708 | 51 | 2,0 | 68 | 0 | 693 | 217 | 133 | 560 | 68 | 413 | 3,53 |
| 3 | 720 | 51 | 2,0 | 70 | 0 | 703 | 217 | 136 | 568 | 63 | 420 | 3,57 |
| 4 | 731 | 52 | 2,1 | 71 | 0 | 714 | 217 | 139 | 575 | 58 | 426 | 3,61 |
| 5 | 743 | 53 | 2,1 | 73 | 0 | 725 | 217 | 142 | 583 | 53 | 433 | 3,65 |
| 6 | 754 | 54 | 2,1 | 74 | 0 | 736 | 217 | 145 | 591 | 47 | 439 | 3,69 |
| 7 | 766 | 55 | 2,2 | 76 | 0 | 747 | 217 | 148 | 599 | 41 | 446 | 3,74 |
| 8 | 779 | 56 | 2,2 | 78 | 0 | 759 | 217 | 151 | 607 | 35 | 453 | 3,78 |
| 9 | 791 | 56 | 2,3 | 79 | 0 | 770 | 217 | 154 | 616 | 29 | 460 | 3,82 |
| 10 | 803 | 57 | 2,3 | 81 | 0 | 782 | 217 | 158 | 624 | 22 | 466 | 3,86 |
| 11 | 816 | 58 | 2,3 | 83 | 0 | 794 | 217 | 161 | 633 | 15 | 473 | 3,90 |
| 12 | 829 | 59 | 2,4 | 85 | 0 | 806 | 132 | 188 | 618 | 8 | 457 | 3,80 |
| 25 | 1029 | 67 | 3,0 | 112 | 0 | 860 | 0 | 240 | 620 | 0 | 620 | – |

## 8. Caso A – CAPEX per voce

| Gruppo | Voce | Unitario | Unità | Quantità | Totale € | Quota |
|---|---|---:|---|---:|---:|---:|
| FV | Moduli fotovoltaici (franco cantiere) | 130 | €/kWp | 3000 | 390.000 | 16,2 % |
| FV | Inverter | 35 | €/kWp | 3000 | 105.000 | 4,4 % |
| FV | Strutture di sostegno | 50 | €/kWp | 3000 | 150.000 | 6,2 % |
| FV | BOS elettrico DC/AC (cavi, quadri, cavidotti, terra, SPD) | 60 | €/kWp | 3000 | 180.000 | 7,5 % |
| FV | Cabine MT, trasformatori, protezioni | 50 | €/kWp | 3000 | 150.000 | 6,2 % |
| FV | Connessione (TICA) e adeguamento cabina utente | 30 | €/kWp | 3000 | 90.000 | 3,7 % |
| FV | Opere civili, viabilità, drenaggi | 35 | €/kWp | 3000 | 105.000 | 4,4 % |
| FV | Recinzione, videosorveglianza, antintrusione | 20 | €/kWp | 3000 | 60.000 | 2,5 % |
| FV | Montaggi meccanici ed elettrici | 80 | €/kWp | 3000 | 240.000 | 10,0 % |
| FV | Ingegneria, DL, CSE, collaudi | 30 | €/kWp | 3000 | 90.000 | 3,7 % |
| FV | Sviluppo, autorizzazioni, pratiche GSE/DSO | 40 | €/kWp | 3000 | 120.000 | 5,0 % |
| BESS | DC block (celle LFP, rack, BMS, container, HVAC, antincendio) | 110 | €/kWh | 2000 | 220.000 | 9,1 % |
| BESS | PCS (convertitori bidirezionali) | 60 | €/kW | 1000 | 60.000 | 2,5 % |
| BESS | BoP elettrico (trasformatori MT, quadri, cavi, protezioni) | 70 | €/kW | 1000 | 70.000 | 2,9 % |
| BESS | EMS / SCADA / integrazione | 40.000 | € | 1 | 40.000 | 1,7 % |
| BESS | Installazione, opere civili, trasporti, messa in servizio | 40 | €/kWh | 2000 | 80.000 | 3,3 % |
| BESS | Prevenzione incendi e distanze di sicurezza | 5 | €/kWh | 2000 | 10.000 | 0,4 % |
| BESS | Ingegneria, permessi, aggiornamento connessione | 15 | €/kWh | 2000 | 30.000 | 1,2 % |
| Comune | Contingenze | 8,0 | % | 2.190.000 | 175.200 | 7,3 % |
| Comune | Costi del committente (owner's cost) | 2,0 | % | 2.190.000 | 43.800 | 1,8 % |
| | **Totale** | | | | **2.409.000** | 100 % |

## 9. CAPEX per tipologia di installazione (3 MWp, solo FV, default per tipologia)

| Tipologia | CAPEX FV €/kWp | kWh/kWp Milano | LCOE €/MWh | VAN k€ |
|---|---:|---:|---:|---:|
| A terra, fisso | 616 | 1310 | 59,8 | 4861 |
| A terra, tracker | 671 | 1542 | 54,2 | 6238 |
| Copertura a falda | 534 | 1237 | 53,6 | 4825 |
| Copertura piana est-ovest | 578 | 1151 | 61,2 | 4312 |

## 10. Caso A – dati di ingegneria

| Grandezza | Valore |
|---|---|
| Moduli | 4844 × TOPCon bifacciale 620 Wp (2382×1134 mm) |
| Stringhe | 173 da 28 moduli |
| Inverter | 7 × Inverter di stringa 350 kW / 1500 V (2450 kWac) |
| Potenza DC effettiva | 3003,3 kWp (DC/AC 1,23) |
| Voc stringa alla Tmin (-9,5 °C) | 1487 V |
| Vmp stringa alla Tcella max (64,8 °C) | 1016 V |
| Cavo di stringa | 6 mm², ΔV 0,66 % su 70 m |
| Cavo AC inverter | 1 × 240 mm² Al, ΔV 1,18 % su 150 m |
| Trasformatori FV | 1 × 3150 kVA 15/0,8 kV |
| Linea MT | 120 mm² Al, I = 140 A; sezione minima per 12,5 kA × 0,50 s: 96 mm² |
| Superficie | 3,58 ha (moduli 13.085 m²) |
| BESS | 8 × Cabinet C&I LFP 261 kWh / 125 kW (AC block), 2088 kWh, trasformatore 1250 kVA |
