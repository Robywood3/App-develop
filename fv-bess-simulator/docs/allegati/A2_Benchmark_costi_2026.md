# Benchmark di costo e prestazione 2025–2026: FV C&I + BESS behind-the-meter (Italia/Europa)

Data di redazione e consultazione delle fonti: **27/10/2026**.
Ambito: impianti FV commerciali/industriali 0,5–10 MWp (copertura e a terra) con BESS LFP 1–10 MWh (1–4 h), behind-the-meter, utenza in MT.

## Note di metodo (leggere prima di usare i numeri)

- Ogni numero ha un rimando `[n]` alla lista fonti in fondo. I valori senza fonte primaria sono marcati **[stima]** con la motivazione.
- In questa sessione il recupero diretto delle pagine (WebFetch/curl) era bloccato dal proxy per quasi tutti i domini (pv-magazine, ess-news, energy-storage.news, arera.it, modoenergy.com, solareindustriale.it, API PVGIS del JRC). I dati provengono quindi dagli estratti dei risultati di ricerca web. Prima di un uso contrattuale, verificare sul documento originale le voci marcate *(da verificare)*.
- Conversione USD→EUR: **1 € = 1,16 US$ [stima]** (livello medio 2025–2026; serve solo per rendere confrontabili BNEF ed Ember).
- Contesto 2026: la crisi dello Stretto di Hormuz ha fatto salire gas e prezzi elettrici in Italia da luglio 2026 (PUN mensile 157 €/MWh a luglio e 180 ad agosto; valori giornalieri di 180–260 €/MWh in settembre-ottobre) [12][13][16]. Le banche centrali hanno ripreso a rialzare i tassi [33][34]. Per un simulatore pluriennale conviene usare scenari, non il solo spot del 2026.
- Prezzi IVA esclusa. Valori FV in €/Wp DC (= k€/MWp), BESS in €/kWh di capacità nominale installata (BOL).

---

## 1) CAPEX fotovoltaico, voce per voce (Italia, 2026)

### 1.1 Componenti

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Moduli TOPCon bifacciali, spot Europa (sun.store PV Index, set-2026) | 0,108 | 0,114 | 0,125 | €/Wp | [1] 0,114 €/Wp set-2026; picco 0,125 a mag-2026; [3] OPIS giu-2026 0,108 €/W DDP (≥600 W) |
| Moduli TOPCon "high efficiency" (pvXchange) | 0,115 | 0,140 | 0,150 | €/Wp | [2] 0,115 gen-2026 → 0,140 apr-2026 → 0,150 mag-2026 (dati di set-ott 2026 non trovati) |
| Moduli TOPCon consegnati in cantiere IT (lotto progetto, con logistica) | 0,12 | 0,13 | 0,16 | €/Wp | **[stima]** spot [1][2] + 5–10% per logistica, assicurazione e margine del distributore |
| Moduli HJT / back-contact | 0,128 | 0,16 | 0,22 | €/Wp | [1] BC 0,128 €/Wp set-2026. Spot HJT non trovato: **[stima]** +0,02–0,06 €/Wp sul TOPCon. [4] riporta 0,20–0,28 €/Wp come "prezzo grossista" DE senza fonte (affidabilità bassa) |
| Inverter di stringa >20 kW (hardware, spot) | 0,024 | 0,035 | 0,05 | €/Wp | [5] sun.store ago-2026: 24,26 €/kW (>20 kW). Tipico e massimo sono **[stima]** per marchi tier-1 con garanzia estesa e DC/AC 1,2 |
| Inverter centralizzato / power station (inverter + trafo MT, skid) | 0,03 | 0,045 | 0,06 | €/Wp | **[stima]**: prezzo pubblico europeo non trovato. Ordine di grandezza dal valore USA di 5–6 c$/W per stringa vs centrale [6] |
| Struttura fissa a terra (incluse fondazioni a vite/infisse) | 0,04 | 0,05 | 0,07 | €/Wp | [7] TaiyangNews: 0,04–0,06 €/W. Max **[stima]** per terreni difficili |
| Tracker monoassiale 1P (escluse fondazioni speciali) | 0,07 | 0,08 | 0,10 | €/Wp | [7] 0,07–0,09 €/W (1P); il 2P costa poco di più |
| Struttura zavorrata su tetto piano (est-ovest o sud 10–15°) | 0,04 | 0,055 | 0,08 | €/Wp | **[stima]**: prezzo pubblico non trovato [8]. Dipende dal carico ammesso sulla copertura; la verifica statica costa 1.500–4.000 € a parte [8] |
| Struttura complanare su lamiera/copertura a falda | 0,02 | 0,03 | 0,04 | €/Wp | **[stima]** |
| BOS elettrico DC+AC (cavi, quadri di stringa e di parallelo, cavidotti, terra, SPD) | 0,04 | 0,06 | 0,09 | €/Wp | **[stima]**: quota tipica del 8–12% del CAPEX EPC |
| Cabina MT utente/consegna + trafo MT/BT + quadri MT | 0,03 | 0,07 | 0,12 | €/Wp | Computi VIA (MASE): cabina di consegna prefabbricata 68.000 €/cad; trafo 2.000 kVA 21.000–30.140 € [9]. **[stima]**: su 1 MWp ≈ 0,10–0,12; su 5–10 MWp ≈ 0,03–0,05 |
| Connessione (corrispettivo TICA + opere di utenza per la connessione) | 0,01 | 0,03 | 0,08 | €/Wp | TICA MT: CP = min(CP_A; CP_B), con CP_A = 35 €/kW·P + 90 €/(kW·km)·P·D_A + 100 € e CP_B = 4 €/kW·P + 7,5 €/(kW·km)·P·D_B + 6.000 € [10] *(valori storici del TICA, verificare l'aggiornamento)*. Le tabelle TIC 2026 aggiornano solo i contributi di prelievo (es. 494,83 € BT→MT) [10]. **[stima]** per le opere di rete eseguite in proprio |
| Montaggio meccanico ed elettrico (manodopera) | 0,05 | 0,08 | 0,12 | €/Wp | **[stima]**: per le coperture servono anche linee vita e sollevamenti |
| Opere civili (viabilità, cavidotti, basamenti, drenaggi) – solo a terra | 0,02 | 0,035 | 0,06 | €/Wp | **[stima]** |
| Recinzione + videosorveglianza/antintrusione – solo a terra | 0,01 | 0,02 | 0,035 | €/Wp | **[stima]** (≈ 25–45 €/m di recinzione; TVCC/termocamere 15–40 k€/MWp) |
| Ingegneria, direzione lavori, collaudi, sicurezza, pratiche | 0,02 | 0,03 | 0,05 | €/Wp | **[stima]** 3–6% dell'EPC |
| Sviluppo/autorizzazione (a terra: diritti di superficie, PAS/AU, studi) | 0,02 | 0,05 | 0,10 | €/Wp | **[stima]** (20–100 k€/MWp). Per le coperture in autoconsumo è quasi nullo |

### 1.2 Totali EPC chiavi in mano (Italia)

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| C&I su tetto 100–200 kWp | 0,675 | 0,72 | 0,79 | €/Wp | [11] solareindustriale.it 2026: 100 kW 72–79 k€; 200 kW 675–750 €/kWp (fonte commerciale) |
| C&I su tetto 250–500 kWp | 0,61 | 0,66 | 0,72 | €/Wp | [11] 500 kW 305–335 k€; 250 kW 165–180 k€ |
| C&I su tetto 0,5–2 MWp (tipico del simulatore) | 0,55 | 0,65 | 0,80 | €/Wp | **[stima]** dall'interpolazione di [11] e dalla somma delle voci in 1.1 (moduli 0,13, inverter 0,04, zavorre 0,055, BOS 0,06, cabina 0,05, montaggio 0,08, ingegneria 0,03, connessione 0,02, margine EPC 8–10%) |
| A terra, fisso, 1–10 MWp (escluso sviluppo) | 0,52 | 0,62 | 0,80 | €/Wp | **[stima]** dalla somma delle voci 1.1. Riscontri: [11] 1 MW a terra 0,70–1,20 €/Wp (fonte commerciale, prudente); SolarPower Europe ~500 €/kWp per utility con moduli cinesi [37] (taglia maggiore) |
| A terra, tracker monoassiale, 1–10 MWp (escluso sviluppo) | 0,58 | 0,69 | 0,90 | €/Wp | **[stima]** = fisso + 0,03–0,05 €/Wp (struttura [7]) + 0,01–0,02 per opere civili/cavi aggiuntivi. Per coperture piane con inseguitore un costruttore dichiara 1,10 €/kWp contro 0,90 del fisso [11b] |
| Riferimento regolatorio: FER X ≤1 MW – prezzo assegnato | – | 77 | – | €/MWh | [24] ARERA 339/2025: 77 €/MWh, di cui 63 per il CAPEX e 14 per l'OPEX |

---

## 2) CAPEX BESS (LFP)

### 2.1 Benchmark internazionali e italiani

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Celle LFP 314 Ah, EXW Cina | 36 | 46 | 53 | €/kWh | [14] BNEF dic-2025: minimo osservato 36 $/kWh per la cella (31 €). [15] InfoLink: 0,300 CNY/Wh (ott-2025) → 0,365 CNY/Wh (apr-2026, +22%), cioè ~50 $/kWh. Benchmark Minerals ago-2026: 53,15 $/kWh EXW China [15] |
| Pacco/sistema DC per storage stazionario (media BNEF 2025) | 43 | 60 | 70 | €/kWh | [14] BNEF Battery Price Survey dic-2025: pacco stazionario 70 $/kWh (−45% a/a), minimo 50 $/kWh |
| DC block 2 h (Cina, lato DC, raffreddamento a liquido) | – | 0,49 CNY/Wh ≈ 60 | – | €/kWh | [15] InfoLink apr-2026 (era 0,41 CNY/Wh a ott-2025) |
| Sistema AC 4 h, Europa, fornitura (senza installazione) | 93 | 97 | – | €/kWh | [16b] InfoLink: ~113 $/kWh a metà 2026 → ~108 $/kWh a fine 2026 |
| Turnkey BESS Europa (BNEF ESS Cost Survey 2025, media durate) | – | 153 | 237 | €/kWh | [17] 177 $/kWh Europa (Cina 73 $, USA 219 $). Il max corrisponde a 275 $/kWh, il valore 2024 riportato da fonti precedenti |
| Turnkey globale 2 h / 4 h (BNEF 2025) | 95 (4 h) | 107 (2 h) | – | €/kWh | [17] 124 $/kWh (2 h), 110 $/kWh (4 h), media 117 $/kWh |
| All-in utility ≥4 h fuori Cina/USA (Ember, ott-2025) | – | 108 | – | €/kWh | [18] 125 $/kWh = 75 $ di apparecchiature + 50 $ di installazione e connessione; la connessione varia da 30 a 100 $/kWh |
| Investimento di riferimento ARERA per MACSE (asta 2029, utility) | 125 | 150,5 | – | €/kWh | [19] delibera 332/2026: da 125.000 a 150.500 €/MWh; WACC 8,2%. Lo studio tecnico ARERA 2025 riporta 191–282 €/kWh per sistemi da 4 h [19b] *(da verificare)* |
| CAPEX mediano globale Modo Energy (set-2026), 2 h / 4 h | 173 (4 h) | 280 (2 h) | – | €/kWh | [20] 325 k$/MWh (2 h) e 201 k$/MWh (4 h), connessione inclusa; il premio di durata è sceso dal 38% al 22% |
| BESS C&I chiavi in mano Italia, 0,5–5 MWh | 280 | 350–400 | 450 | €/kWh | [21] solareindustriale.it: 280–450 €/kWh; 1 MWh ≈ 350–400 k€ (fonte commerciale) |
| BESS commerciale (Fraunhofer ISE 2024, DE) | 450 | – | 800 | €/kWh | [22] dato 2024, ormai superato dai prezzi 2025–26 |
| BESS 10 MW/20 MWh Germania, all-in 2026 | 350 | – | 500 | €/kWh | [23] Phelas (consulente) |
| Aggiudicazione MACSE (set-2025, 10 GWh) | 12.146 | 12.959 | 15.846 | €/MWh/anno | [25] media pesata 12.959; CSud 14.566, Sud 12.146, Sicilia 15.846, Sardegna 15.029; tetto 37.000 |

### 2.2 Ripartizione proposta per BESS C&I behind-the-meter (1–10 MWh, connessione MT esistente)

Base: benchmark utility [17][18][19] maggiorati per la taglia C&I (container singoli, PCS piccoli, integrazione con la cabina d'utente). Riscontro di mercato: [21][23]. Tutte le cifre sono **[stima]**.

| Voce | 2 h: min | 2 h: tipico | 2 h: max | 4 h: min | 4 h: tipico | 4 h: max | Unità |
|---|---|---|---|---|---|---|---|
| DC block (celle, moduli, rack, BMS, container, HVAC, antincendio) | 75 | 110 | 150 | 70 | 105 | 140 | €/kWh |
| PCS (inverter bidirezionale; tipico ≈ 60 €/kW) | 20 | 30 | 45 | 10 | 15 | 25 | €/kWh |
| BoP elettrico (trafo MT/BT, quadri MT, cavi, protezioni, adeguamento cabina) | 20 | 35 | 60 | 12 | 25 | 40 | €/kWh |
| EMS/SCADA/controllo peak-shaving | 5 | 10 | 20 | 3 | 5 | 10 | €/kWh |
| Installazione, opere civili, trasporti, messa in servizio | 25 | 45 | 70 | 20 | 35 | 55 | €/kWh |
| Ingegneria, permessi (prevenzione incendi), aggiornamento connessione, contingenza | 15 | 30 | 55 | 12 | 25 | 45 | €/kWh |
| **Totale turnkey** | **180** | **260** | **400** | **150** | **210** | **330** | €/kWh |

### 2.3 Augmentation

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Costo dei kWh aggiunti (moduli + installazione, prezzi 2026) | 90 | 120 | 200 | €/kWh aggiunto | [23] Phelas: 2–4 M€ per ripotenziare i moduli di un 10 MW/20 MWh, cioè ≈100–200 €/kWh (calcolo nostro). Min e tipico **[stima]**, che assume ulteriori cali del prezzo delle celle [14][15] |
| Momento dell'intervento | anno 8 | anno 10 | anno 12 | – | [23] l'80% di SoH si raggiunge tra l'anno 8 e il 12 |
| Alternativa: FOM comprensivo di augmentation (NREL ATB 2025) | – | 4 | – | % CAPEX/anno | [26] |

---

## 3) OPEX

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| O&M FV C&I su tetto (manutenzione preventiva/correttiva, pulizia, verifiche) | 6 | 10 | 15 | €/kWp/anno | **[stima]**: nessuna fonte pubblica italiana in €/kWp per l'industriale [27]. Ancoraggio: OPEX FER X 14 €/MWh [24] × 1,2–1,5 MWh/kWp = 17–21 €/kWp/anno di OPEX **totale** (O&M + assicurazione + oneri + gestione) |
| O&M FV a terra 1–10 MWp (incluso sfalcio e lavaggio) | 7 | 11 | 16 | €/kWp/anno | **[stima]** come sopra |
| Monitoraggio/telecontrollo/asset management | 0,5 | 1,0 | 2,0 | €/kWp/anno | **[stima]** |
| Sostituzione inverter di stringa (una volta, anni 12–15) | 0,03 | 0,04 | 0,06 | €/Wp | **[stima]** = prezzo hardware [5] + manodopera e logistica. In alternativa un fondo di 1–2 €/kWp/anno |
| Assicurazione all-risk + RCT + mancato guadagno (FV) | 0,20 | 0,30 | 0,50 | % CAPEX/anno | **[stima]**: nessuna fonte con tasso pubblico [28] |
| Security/vigilanza (solo a terra) | 1 | 2 | 4 | €/kWp/anno | **[stima]** (vigilanza su allarme e manutenzione TVCC) |
| IMU impianti a terra (categoria D/1, rendita su suolo e opere, esclusi moduli e inverter) | 0,5 | 1,5 | 3 | €/kWp/anno | Regola: circ. AdE 2/E/2016 e 36/E/2013, IMU = rendita × 1,05 × 65 × aliquota (fino a 1,06%) [29]. Il valore in €/kWp è **[stima]** |
| IMU FV su tetto in autoconsumo | 0 | 0 | 0,5 | €/kWp/anno | [29] CGT Milano 2026: pertinenza senza rendita autonoma (se il valore cresce meno del 15%) |
| Affitto o diritto di superficie (terreno) | 2.000 | 3.000 | 4.000 | €/ha/anno | [30] Meteoweb 2023: 2.500–3.500, fino a 4.000 in Pianura Padana; solareindustriale: 2.000–3.500. Attenzione al DL 63/2024 sui terreni agricoli [30] |
| Occupazione di suolo | 1,3 (fisso) | 1,5 | 2,0 (tracker) | ha/MWp | **[stima]** |
| O&M BESS (contratto LTSA, monitoraggio, HVAC, antincendio) | 0,5 | 1,5 | 2,5 | % CAPEX/anno | [23] contratto O&M 0,5–1,5% CAPEX; [26] NREL ATB 2024: FOM 2,5% CAPEX; consultazione ARERA per MACSE: costi fissi ≈ 2% CAPEX [19c] |
| O&M BESS in €/kWh | 2 | 4 | 7 | €/kWh/anno | **[stima]** = % × CAPEX tipico 210–260 €/kWh |
| Assicurazione BESS | 0,3 | 0,4 | 0,6 | % CAPEX/anno | **[stima]** (premio superiore al FV per il rischio incendio) |
| Costi variabili BESS | – | 6 | – | US$/MWh scaricato | [31] NYISO/BMcD: VOM 6,47 $/MWh (USA 2024), solo come riferimento |

---

## 4) Prestazioni

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Degradazione TOPCon nel primo anno (garanzia) | 0,8 | 1,0 | 1,0 | % | [32] Jinko Tiger Neo 3.0, Phono Draco, Qn-Solar, Luxen: ≤1% il primo anno |
| Degradazione TOPCon, anni 2–30 (garanzia lineare) | 0,35 | 0,40 | 0,40 | %/anno | [32] 0,4%/anno; 87,4% della potenza all'anno 30 |
| Degradazione HJT (garanzia tipica) | 0,25 | 0,35 | 0,40 | %/anno | **[stima]** (datasheet HJT tipici 1%/0,375%) |
| RTE AC-AC BESS LFP (POI, ausiliari inclusi) | 80 | 86 | 90 | % | [26] NREL ATB 2025: 85%; [19b] ARERA: 80–90%; [35] container 5 MWh: 88% dichiarato (probabilmente lato DC) |
| Cicli di vita della cella (80% SoH, 0,3C, 25 °C, DoD 100%) | 8.000 | 10.000 | 12.000 | cicli | [35] evreporter: 10.000 per la cella 314 Ah |
| Cicli a livello di sistema (DoD 90%) | 6.000 | 8.000 | 10.000 | cicli | [35] 8.000 cicli a livello BESS, 20 anni di vita calendariale |
| Vita utile BESS | 15 | 15–20 | 20 | anni | [19b][26] |
| Degradazione capacità BESS (≈1 ciclo/giorno) | 1,5 | 2,0 | 3,0 | %/anno | [23] invecchiamento calendariale LFP 1,5–2,5%/anno; altre fonti 2–3%/anno |
| Degradazione per ciclo (equivalente) | 0,0020 | 0,0025 | 0,0035 | %/ciclo | **[stima]** = 20% di perdita su 8.000 cicli [35] (accelera nell'ultima parte della vita) |
| Producibilità media nazionale del parco FV esistente | – | 1.122 | – | kWh/kW | [36] dati ENEA/GSE a fine 2022 (include tetti non ottimali e impianti vecchi) |
| Nord (Milano/Pianura Padana), fisso a inclinazione ottimale | 1.150 | 1.250 | 1.350 | kWh/kWp/anno | **[stima PVGIS]**: API JRC non raggiungibile da questa sessione; valori attesi con PVGIS-SARAH3 e perdite al 14%. Da rieseguire su re.jrc.ec.europa.eu |
| Nord, tracker monoassiale | 1.320 | 1.450 | 1.580 | kWh/kWp/anno | **[stima]** fisso × 1,15–1,18 |
| Centro (Roma/Lazio), fisso ottimale | 1.380 | 1.480 | 1.570 | kWh/kWp/anno | Riscontro: PVsyst Roma, fisso 20°, 1.563 kWh/kWp, PR 84,8% (meteo SolarGIS) [36] |
| Centro, tracker monoassiale | 1.650 | 1.750 | 1.850 | kWh/kWp/anno | **[stima]** fisso × 1,18–1,20 |
| Sud e isole (Puglia/Sicilia), fisso ottimale | 1.494 | 1.600 | 1.700 | kWh/kWp/anno | PVsyst Molise 1.510; Fiumesanto (Sardegna) 1.494 [36][36b] |
| Sud e isole, tracker monoassiale (bifacciale) | 1.726 | 1.850 | 1.950 | kWh/kWp/anno | PVsyst Villafrati (PA) 1.726; Militello (CT) 1.824; Pedagaggi bifacciale 1.876 [36b] |
| Guadagno del tracker sul fisso ottimale | 15 | 20 | 30 | % | [36b] JRC: ≈ +30% nel Sud Europa (teorico); **[stima]** +15–25% nei progetti reali |
| Penalità per tetto piano con zavorre E-O 10° rispetto al fisso ottimale | −15 | −10 | −5 | % | **[stima]**; [36] tetto piano a Roma: 86,3% dell'irraggiamento rispetto ai 34° ottimali |

---

## 5) Prezzi dell'energia in Italia

### 5.1 Prezzo all'ingrosso

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| PUN Index GME, media 2025 | 115,32 | 115,32 | 115,94 | €/MWh | [12] Newsletter GME gen-2026 / QualEnergia: 115,32 (2024: 108,52). Relazione annuale GME: 115,94 [12b] |
| PUN 2025 nelle ore di picco / fuori picco | 110,66 | – | 124,23 | €/MWh | [12][12c] |
| PUN 2025 per trimestre (Q1 / Q2 / Q3) | 101,74 | 110,33 | 137,98 | €/MWh | [12d] CCIAA Genova |
| PUN 2026 mensile, gen–set | 114 (feb) | ~145 (media) | ~205 (set) | €/MWh | gen 133, feb 114, mar 143, apr 119, mag 119, giu 131–133, lug 157, ago 180, set ≈ 200–208 [13][13b][16]. La **media gen–set ≈ 145 €/MWh è un nostro calcolo** su dati secondari che a volte si contraddicono (es. luglio 132,5 secondo un'altra pagina Switcho). Da verificare sul GME |
| PUN ottobre 2026 (giornaliero) | 180 | 220 | 260 | €/MWh | [16c] comparasemplice (dati GME): 219 il 10/10, 259 il 20/10, 252 il 21/10 |
| Futures baseload Italia Cal-2027 | 72 (giu-27) | ~100 | 112 (gen-27) | €/MWh | [38] ICE Endex IPB da TradingView, istantanee **non datate** (gen-27 106,7–111,5; giu-27 72–86; ott-27 ≈97). **Settlement EEX/ICE di ottobre 2026 non trovato.** Le istantanee sono probabilmente precedenti alla crisi |
| Profilo per fasce, esempio dic-2025 (F1 / F2 / F3) | 104,5 (F3) | 111,2 (F2) | 130,1 (F1) | €/MWh | [13c] tabella Switcho. Nessuna media annua 2025 per fascia trovata |
| Rapporto fascia/PUN da usare nel simulatore | F3 0,93 | F2 1,03 | F1 1,07 | × PUN | **[stima]** da picco/fuori picco 2025 (124,2/110,7 su 115,3) [12] e da dic-2025 [13c] |
| Prezzi zonali 2025 rispetto al PUN | Sardegna −3,77 | NORD −0,07; CSUD +0,38; SUD −0,91; SICI +0,13 | CNOR +0,85 | €/MWh | [39] presentazione AIEE su dati GME (tabella di lettura difficile, valori approssimati). [12c]: NORD e CNOR ≈116 €/MWh, altre zone 112–115; differenziale Nord-Sud +2,4 |
| Prezzi zonali nelle ore solari, Q2 2026 | <20 €/MWh fino al 10% delle ore | – | – | – | [40] Italia Solare: SUD, CALA, SARD e SICI; 215 ore sotto 20 €/MWh nel trimestre (tra le 10 e le 18). Spread mensile sul PUN a maggio: SARD −8,57, SICI −7,72 |
| Capture price solare nazionale | 0,80 | 0,86 | 0,95 | × PUN | [41] Modo Energy: capture rate annuo 86%; mar-2026 124,72 €/MWh contro una media a 12 mesi di 97,32. Min e max **[stima]**; il rischio di forte calo dal 2027 al Sud è segnalato da Italia Solare [40] |
| Spread di arbitraggio TB4 (4 ore), zona NORD, H1 2026 | – | ≈ 75 | – | €/MWh medio giornaliero | [42] Modo: TB4 NORD 110.000 €/MW/anno → 110.000/(365×4) ≈ 75 €/MWh (**calcolo nostro**, senza perdite). I ricavi BESS H1 2026 vanno da 95.500 €/MW/anno (CNOR/NORD) a 149.000 (SARD). Il TB2 in Sardegna è +34% rispetto al Nord |
| Spread serale vs ore solari da usare nel simulatore (zona NORD/CSUD) | 40 | 70 | 110 | €/MWh | **[stima]** basata su [42] e [40] (al Sud e nelle isole +20–35%) |
| Prezzo minimo garantito RID 2026, FV (primi 1,5 GWh/anno, impianti ≤1 MW) | – | 47,5 | – | €/MWh | [43] edilizia.com e solareindustriale.it (secondarie): 47,5 (+1,4% FOI). Delibera ARERA non verificata |
| FER X ≤1 MW (contratto per differenza a 20 anni, alternativa al merchant) | – | 77 | – | €/MWh | [24] |

### 5.2 Costo di prelievo evitato per un'impresa in MT (€/MWh, IVA esclusa)

| Componente | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Energia (PUN orario × profilo) | 115 | 130 | 180 | €/MWh | §5.1; il tipico è uno scenario 2027 **[stima]** |
| Perdite di rete MT (maggiorazione dell'energia) | 3,0 | 3,8 | 4,5 | % | **[stima]** (fattore perdite MT del TIS ARERA, valore non verificato in questa sessione) [44] |
| Dispacciamento (uplift, unità essenziali, Terna) | 7,7 | 11,6 | 13 | €/MWh | [44] CTE Axpo Q2 2026: 11,55; Q3 2026: uplift 3,66 + unità essenziali 3,35 + funzionamento Terna 0,72 |
| Corrispettivo mercato della capacità | 14,5 | 15,9 | 16 | €/MWh | [44] Axpo Q3 2026: 15,941 €/MWh lordo perdite (14,492 netto) |
| Spread/commercializzazione del fornitore | 3 | 8 | 15 | €/MWh | **[stima]** |
| Trasporto e misura MT (quota energia, e-distribuzione 2026) | 11,6 | 11,6 | 11,8 | €/MWh | [45] MTA1 0,01176; MTA2 0,01169; MTA3 0,01164 €/kWh |
| Oneri generali ASOS + ARIM, MT altri usi | 15 | 25 | 35 | €/MWh | **Non trovato** il valore unitario 2026. **[stima]** sui livelli 2024–25. Il DL 21/2026 (L. 49/2026) riduce l'ASOS per le MT non energivore (431,5 M€ nel 2026) [46] |
| Accisa (usi non domestici) | 7,5 | 12,5 | 12,5 | €/MWh | [47] 12,5 €/MWh sui primi 200.000 kWh/mese; 7,5 oltre (fino a 1,2 GWh/mese); oltre 1,2 GWh/mese quota fissa di 4.820 €/mese. L'autoconsumo FV >20 kW nello stesso sito è esente (art. 52 c.3 lett. b TUA; circ. ADM 21/2026) [48] |
| **Totale costo variabile di prelievo evitato** | **185** | **≈220** | **275** | €/MWh | **Calcolo nostro**: 130×1,038 + 11,6 + 15,9 + 8 + 11,6 + 25 + 12,5 ≈ 219. Riscontro: Confindustria/Eurostat H1-2025 prezzo medio imprese IT 278 €/MWh (media di tutte le fasce, con le quote fisse) [49] |
| **Valore dell'energia immessa in rete (RID/merchant)** | 85 | 110 | 150 | €/MWh | **[stima]** = PUN × capture rate 0,86 [41] meno i corrispettivi GSE; pavimento RID 47,5 [43] |
| Rapporto valore autoconsumo / valore immissione | 1,7 | 2,0 | 2,4 | × | Calcolo nostro |

### 5.3 Corrispettivi di potenza MT (peak shaving)

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Quota potenza trasporto MTA3 (>500 kW) | – | 28,35 (= 2,36 €/kW/mese) | – | €/kW/anno | [45] e-distribuzione 2026: 28,3493 €/kW/anno, applicata alla potenza massima prelevata nel mese |
| Quota potenza MTA2 (100–500 kW) | – | 32,32 (= 2,69 €/kW/mese) | – | €/kW/anno | [45] |
| Quota potenza MTA1 (≤100 kW) | – | 35,99 (= 3,00 €/kW/mese) | – | €/kW/anno | [45] |
| Quota fissa MTA3 | – | 702,77 | – | €/anno | [45] |
| Eventuale quota potenza degli oneri ASOS/ARIM | – | non trovato | – | €/kW/anno | Verificare le tabelle ARERA. Senza questa quota il valore del solo peak shaving resta basso (≈2,4 €/kW/mese) |

---

## 6) Parametri finanziari

| Voce | Min | Tipico | Max | Unità | Fonte / nota |
|---|---|---|---|---|---|
| Euribor 6M | 2,10 | 2,72 | 2,80 | % | [33] euribor-rates.eu 24/07/2026: 2,723%; global-rates: min 2026 2,103%, max 2,724% (a luglio) |
| Euribor 12M | – | 3,33 | – | % | [34] rivaluta.it, 15/09/2026 |
| Tasso BCE sui depositi | 2,00 | 2,50 | 2,50 | % | [34] 2,00% ad apr-2026 → 2,25% a giu-2026 → 2,50% dal 16/09/2026 (XTB e rivaluta, **da verificare** su BCE). La decisione di ottobre 2026 non è stata trovata |
| IRS/swap 10–15 anni (base del tasso fisso) | 2,7 | 3,0 | 3,4 | % | **[stima]** tra l'Euribor 12M e il Bund 10Y oltre 3,5% [50] |
| Spread su project finance FV Italia | 150 | 200 | 275 | bps | **Non trovato** (margini non pubblicati per i deal 2026 [50b]). **[stima]** |
| Costo del debito all-in (tasso fisso) | 4,3 | 5,0 | 6,0 | % | **[stima]** = IRS + spread |
| Leva (debito/CAPEX), project finance | 60 | 70 | 80 | % | **[stima]**; per il C&I con finanziamento corporate 50–70% |
| Durata del debito FV (tenor) | 12 | 15 | 18 | anni | **[stima]**; con contratto FER X a 20 anni fino a 18 anni |
| Durata del debito BESS | 7 | 10 | 12 | anni | **[stima]**; MACSE 15 anni |
| WACC BESS (regolatorio, nominale) | 8,0 | 8,2 | – | % | [19] ARERA 332/2026, MACSE: da 8,0% a 8,2% (dati al 31/08/2026) |
| WACC FV (regolatorio FER X, **reale pre-tax**) | – | 6,5 | – | % | [24b] consultazione ARERA 239/2025 |
| WACC FV C&I nominale post-tax (merchant/autoconsumo) | 6,0 | 7,0 | 8,5 | % | **[stima]**; riferimento storico Vartiainen et al.: 7% nominale per l'utility FV in Europa [51] |
| Inflazione Italia 2026 / 2027 / 2028 | 1,7 | 2,4 | 3,2 | % | [52] Banca d'Italia ott-2026: 3,2% nel 2026, 2,4% nel 2027, 1,7% nel 2028 (ipotesi petrolio 114 $/bbl) |
| Inflazione Italia 2029–2030 | 1,7 | 2,0 | 2,3 | % | **[stima]** = obiettivo BCE |

---

## Default consigliati per il simulatore

| Chiave | Valore | Unità | Base |
|---|---|---|---|
| pv.module_price | 0.13 | €/Wp | [1][2] spot + logistica |
| pv.inverter_string_price | 0.035 | €/Wp | [5] + stima |
| pv.inverter_central_price | 0.045 | €/Wp | [stima] |
| pv.structure_fixed_ground | 0.05 | €/Wp | [7] |
| pv.structure_tracker_1axis | 0.08 | €/Wp | [7] |
| pv.structure_roof_ballast | 0.055 | €/Wp | [stima] |
| pv.bos_electrical | 0.06 | €/Wp | [stima] |
| pv.mv_substation | 0.06 | €/Wp | [9] + stima (≈0,10 a 1 MWp; 0,04 a 10 MWp) |
| pv.grid_connection | 0.03 | €/Wp | [10] TICA + stima |
| pv.installation_labour | 0.08 | €/Wp | [stima] |
| pv.civil_works_ground | 0.035 | €/Wp | [stima] |
| pv.fence_security_ground | 0.02 | €/Wp | [stima] |
| pv.engineering_permits | 0.03 | €/Wp | [stima] |
| pv.development_ground | 0.05 | €/Wp | [stima] |
| pv.epc_total_roof_CI | 0.65 | €/Wp | [11] + somma delle voci |
| pv.epc_total_ground_fixed | 0.62 | €/Wp (escluso sviluppo) | somma delle voci |
| pv.epc_total_ground_tracker | 0.69 | €/Wp (escluso sviluppo) | somma delle voci |
| bess.capex_turnkey_2h | 260 | €/kWh | §2.2 [stima] su [17][18][19][21] |
| bess.capex_turnkey_4h | 210 | €/kWh | §2.2 [stima] |
| bess.pcs_price | 60 | €/kW | [stima] |
| bess.augmentation_price | 120 | €/kWh aggiunto | [23] + stima |
| bess.augmentation_year | 10 | anno | [23] |
| pv.om_cost | 10 | €/kWp/anno (tetto); 11 a terra | [stima]; [24] |
| pv.monitoring_cost | 1.0 | €/kWp/anno | [stima] |
| pv.inverter_replacement | 0.04 (una volta, anno 13) | €/Wp | [5] + stima |
| pv.insurance_rate | 0.30 | % CAPEX/anno | [stima] |
| pv.security_cost_ground | 2 | €/kWp/anno | [stima] |
| pv.imu_ground | 1.5 | €/kWp/anno (0 su tetto) | [29] + stima |
| land.lease | 3000 | €/ha/anno | [30] |
| land.use | 1.5 | ha/MWp (fisso 1,3; tracker 1,8) | [stima] |
| bess.om_rate | 1.5 | % CAPEX/anno | [23][26][19c] |
| bess.insurance_rate | 0.4 | % CAPEX/anno | [stima] |
| pv.degr_year1 | 1.0 | % | [32] |
| pv.degr_annual | 0.4 | %/anno | [32] |
| bess.rte_ac | 86 | % | [26][19b] |
| bess.cycle_life | 8000 | cicli (al 80% SoH) | [35] |
| bess.calendar_life | 15 | anni (20 con augmentation) | [19b][26] |
| bess.degr_annual | 2.0 | %/anno (≈1 ciclo/giorno) | [23] |
| yield.fixed_north / centre / south | 1250 / 1480 / 1600 | kWh/kWp/anno | [stima PVGIS] + [36][36b] |
| yield.tracker_north / centre / south | 1450 / 1750 / 1850 | kWh/kWp/anno | [36b] + stima |
| price.pun_base_2027 | 130 | €/MWh (scenari 100 / 130 / 170) | [12][13][16][38] stima |
| price.fascia_mult_F1/F2/F3 | 1.07 / 1.03 / 0.93 | × PUN | [12][13c] stima |
| price.solar_capture_rate | 0.86 | × PUN | [41] |
| price.bess_spread_evening_vs_solar | 70 | €/MWh | [42] stima |
| price.rid_min_guaranteed | 47.5 | €/MWh | [43] |
| grid.loss_factor_MT | 3.8 | % sul PUN | [stima] §5.2 |
| grid.withdrawal_adders_MT | 85 | €/MWh oltre il PUN×1,038 (disp. 11,6 + capacità 15,9 + fornitore 8 + trasporto 11,6 + oneri 25 + accisa 12,5) | §5.2 |
| grid.power_charge_MT | 2.36 | €/kW/mese (MTA3) | [45] |
| fin.wacc_pv / fin.wacc_bess | 7.0 / 8.2 | % nominale | [stima] / [19] |
| fin.debt_rate / leverage / tenor | 5.0% / 70% / 15 anni | – | [stima] su [33][34] |
| fin.inflation | 3.2 (2026), 2.4 (2027), 2.0 (2028–30) | % | [52] + stima |

---

## Fonti (consultate il 27/10/2026)

1. sun.store PV Index via PV Tech, "European PV module prices inch downwards in September" (set/ott-2026) e articoli di luglio e agosto 2026 – https://www.pv-tech.org/european-pv-module-prices-ease-out-in-september/ ; https://www.pv-tech.org/european-pv-module-prices-and-demand-fall-in-august/ ; https://www.pv-tech.org/european-premium-pv-module-prices-keep-rising-bifacial-topcon-cools-off/
2. pvXchange (via EMA Energiewelt, mag-2026; Solarserver; Logicenergy 2026) – https://ema-energiewelt.de/wissen/solarmodule-preise-anstieg-2026-trendwende ; https://www.solarserver.de/photovoltaik-preis-pv-modul-preisindex/ ; https://www.logicenergy.de/neuigkeiten/pv-preisentwicklung-2026
3. OPIS via pv magazine India, "China solar module forward prices ease amid softer Europe demand" (04/07/2026) – https://www.pv-magazine-india.com/2026/07/04/china-solar-module-forward-prices-ease-amid-softer-europe-demand/
4. EMA Energiewelt, "Photovoltaik-Markt 2026: Preise, Hersteller, Trends" (2026) – https://ema-energiewelt.de/wissen/photovoltaik-markt-2026-preise-hersteller-trends
5. sun.store PV Index, inverter ago-2026 (via PV Tech) – https://www.pv-tech.org/european-pv-module-prices-and-demand-fall-in-august/ ; dati 2024: https://pv-tech.org/european-module-prices-decline-december-sun-store-latest-pv-index-report
6. Solar Builder, "Saving costs with large-scale string inverter design, part 1" (data non indicata) – https://solarbuildermag.com/solar-tariff/solar-costs-savings-large-scale-string-inverter-design-part-1/
7. TaiyangNews, "Balancing Higher Tracker Costs With Increased Energy Yields" (data non indicata, 2025 circa) – https://taiyangnews.info/technology/balancing-higher-tracker-costs-with-increased-energy-yields
8. Sun Ballast, scheda EasyWest; solareindustriale.it, progetto 500 kW – https://www.sunballast.com/wp-content/uploads/2024/06/SB-IT-SCHEDA-TECNICA-EASY-WEST-V2.pdf ; https://www.solareindustriale.it/progetti/impianto-fotovoltaico-500-kw
9. MASE – Valutazioni ambientali, elenchi prezzi di progetti FV (cabina 68.000 €, trafo 2 MVA) – https://va.mite.gov.it/File/Documento/786122 ; https://va.mite.gov.it/File/Documento/732585
10. ARERA, TICA e Tabelle TIC 2026 (delibera 575/2025/R/eel, 23/12/2025) – https://www.arera.it/fileadmin/allegati/docs/25/575-2025-R-eel-TABELLE_TIC.pdf ; FAQ TIT: https://www.arera.it/operatore-elettricita/faq-testo-integrato-trasmissione-distribuzione-e-misura-dellenergia-1
11. solareindustriale.it, progetti 100/200/250/500 kW e 1 MW (2026, fonte commerciale) – https://www.solareindustriale.it/progetti/impianto-fotovoltaico-200-kw ; https://www.solareindustriale.it/progetti/impianto-fotovoltaico-100-kw ; https://www.solareindustriale.it/progetti/impianto-fotovoltaico-1-mw
11b. QualEnergia, "Fotovoltaico su tetti piani, Contact Italia punta sull'inseguimento monoassiale" – https://www.qualenergia.it/articoli/fotovoltaico-tetti-piani-contact-italia-punta-inseguimento-monoassiale/
12. QualEnergia, "Nel 2025 Pun medio a 115 euro per MWh" (gen-2026, su newsletter GME) – https://www.qualenergia.it/pro/articoli-pro/nel-2025-pun-medio-a-115-euro-mwh/ ; Newsletter GME 16/01/2026 – https://gme.mercatoelettrico.org/Portals/0/Documents/\../Newsletter/20260116Newsletter.pdf
12b. GME, Relazione annuale 2025 – https://www.mercatoelettrico.org/Portals/0/Documents/it-IT/Gme_RelazioneAnnualeWeb_2025.pdf
12c. Facile.it, riepilogo dei prezzi 2025 – https://www.facile.it/energia-luce-gas/news/prezzi-gas-elettricita-italia-dati-riassuntivi-2025.html
12d. CCIAA Genova, Newsletter energia e gas n. 14–16 (2025) – https://www.ge.camcom.gov.it/it/tutela/prezzi-e-tariffe/prezzi-medi-mensili-del-gas-naturale-1/newsletter-energia-e-gas-1/archivio-energia-e-gas/251017-newsletter-energia-e-gas-n-16.pdf
13. Italia Solare, comunicato "mercato elettrico Q2 2026" (16/07/2026) e abstract del report mercati del 06/07/2026 – https://www.italiasolare.eu/wp-content/uploads/2026/07/20260716_cs-mercato-elettrico-1.pdf ; https://is.italiasolare.eu/data/report/abstract/italia-solare-report-mercati-20260706-abstract.pdf
13b. Switcho, "PUN maggio 2026" (tabella mensile), "PUN settembre 2026" – https://www.switcho.it/blog/luce-gas/pun-maggio-2026/ ; https://www.switcho.it/blog/luce-gas/pun-settembre-2026/
13c. Switcho, tabella PUN per fasce (ott–dic 2025) – https://www.switcho.it/blog/?p=115368
14. BloombergNEF, Lithium-Ion Battery Price Survey 2025 (comunicato, dic-2025) – https://about.bnef.com/insights/clean-energy/lithium-ion-battery-pack-prices/ ; https://about.bnef.com/insights/clean-transport/new-record-lows-for-battery-prices/
15. ESS News, "China's 314 Ah storage cell prices climb more than 20% in six months" (22/04/2026, dati InfoLink); Benchmark Minerals, "Cell Price Review Q3 2026" – https://www.ess-news.com/2026/04/22/chinas-314-ah-storage-cell-prices-climb-more-than-20-in-six-months/ ; https://source.benchmarkminerals.com/article/lithium-cost-pass-through-drives-volatile-quarter-for-energy-storage-cells-cell-price-review-q3-2026
16. Il Sole 24 Ore (EN), "Electricity producers 2026, exceptional circumstances…" (set-2026, Elettricità Futura su dati GME: mag 119, giu 132, lug 157, ago 180; 212 €/MWh il 2/9) – https://en.ilsole24ore.com/art/electricity-producers-2026-exceptional-circumstances-now-more-renewables-AJvUzz0
16b. ESS News, "Flexibility shapes Europe's storage future: signals from China's supply chain" (16/07/2026, InfoLink) – https://www.ess-news.com/2026/07/16/flexibility-shapes-europes-storage-future-signals-from-chinas-supply-chain/
16c. Comparasemplice, aggiornamenti PUN giornalieri 10/20/21-10-2026 (dati GME) – https://www.comparasemplice.it/informazioni/news/pun-aggiornamento-del-20-10-2026
17. BNEF Energy Storage System Cost Survey 2025 via Energy-Storage.news (dic-2025) – https://www.energy-storage.news/behind-the-numbers-bnef-finds-40-year-on-year-drop-in-bess-costs/ ; https://www.energy-storage.news/?p=92133
18. Ember, "How cheap is battery storage?" (dic-2025, dati di ott-2025) – https://ember-energy.org/latest-insights/how-cheap-is-battery-storage/
19. ESS News, "Italy's next MACSE: ARERA sets auction premium cap higher, up from €22,000 to €27,000/MWh" (28/09/2026); ARERA delibera 332/2026/R/eel (24/09/2026) – https://www.ess-news.com/2026/09/28/italys-next-macse-arera-sets-auction-premium-cap-higher-up-from-e22000-to-e27000-mwh/ ; https://www.arera.it/fileadmin/allegati/docs/26/332-2026-R-eel.pdf
19b. Studio tecnico ARERA sugli accumuli (Allegato B alla delibera 168/2025, citato da Energía Estratégica) – https://arera.it/fileadmin/allegati/docs/25/168-2025-R-eel-ALLEGATO_B.pdf ; https://energiaestrategica.com/strategicenergy/en/notes/macse-italy
19c. ESS News, "Italy's MACSE Auction: battery storage price cap boosted to €37,000" (2025) – https://www.ess-news.com/?p=6100
20. Modo Energy, "Global battery capex – September 2026" (abstract) – https://modoenergy.com/research/global-battery-capex-september-2026-research
21. solareindustriale.it, "Quando conviene installare un sistema BESS" e "Accumulo BESS" (2026, fonte commerciale) – https://www.solareindustriale.it/blog-fotovoltaico/quando-conviene-installare-un-sistema-bess ; https://www.solareindustriale.it/accumulo-bess
22. Fraunhofer ISE, Stromgestehungskosten Erneuerbare Energien (lug-2024) – https://www.ise.fraunhofer.de/content/dam/ise/de/documents/publications/studies/DE2024_ISE_Studie_Stromgestehungskosten_Erneuerbare_Energien.pdf
23. Phelas, "BESS investment analysis" (2026) – https://www.phelas.com/en/insights/knowledge/bess-investment-analysis
24. Assolombarda, "FER X transitorio – PdA per gli impianti fino a 1 MW" (ARERA 339/2025: 77 €/MWh = 63 CAPEX + 14 OPEX); QualEnergia – https://www.assolombarda.it/servizi/energia/informazioni/fer-x-transitorio-pda-per-gli-impianti-fino-a-1-mw ; https://www.qualenergia.it/pro/articoli-pro/fer-x-transitorio-tariffe-sotto-1-mw-fotovoltaico-77-mwh/
24b. ARERA, DCO 239/2025/R/efr Allegato A (WACC 6,5% reale pre-tax) – https://www.arera.it/fileadmin/allegati/docs/25/239-2025-R-efr-ALLEGATO_A.pdf
25. Teleborsa / QualEnergia / Energy-Storage.news, esiti della prima asta MACSE (01/10/2025) – https://www.teleborsa.it/AMP/News/2025/10/01/terna-conclusa-la-prima-asta-macse-assegnati-10-gwh-di-capacita-di-accumulo-di-energia-155.html ; https://www.qualenergia.it/pro/articoli-pro/asta-macse-aggiudicati-10-gwh-quasi-13000-mwh-annui/
26. NREL/NLR Annual Technology Baseline 2024 e 2025, Utility-Scale Battery Storage – https://atb.nrel.gov/electricity/2024/utility-scale_battery_storage ; https://atb.nlr.gov/electricity/2025/utility-scale_battery_storage
27. solareindustriale.it, "Costi O&M del fotovoltaico industriale" (nessun €/kWp pubblicato) – https://www.solareindustriale.it/blog-fotovoltaico/costi-om-fotovoltaico-industriale
28. Marsh (presentazione a Svensk Solenergi, dic-2024); Enel Energia/Helvetia – https://svensksolenergi.se/wp-content/uploads/2024/12/Marsh.pdf
29. Agenzia Entrate, circ. 2/E/2016 (via Fiscozen, ECNews); CGT Milano 2026 – https://www.fiscozen.it/news/impianto-fotovoltaico-aziendale-quando-non-scatta-accatastamento-autonomo-e-imu/ ; https://www.ecnews.it/fiscale/?p=144356
30. Meteoweb (feb-2023); solareindustriale.it, canone del diritto di superficie (2026) – https://www.meteoweb.eu/2023/02/affitto-terreni-agro-fotovoltaico/1001198602/ ; https://www.solareindustriale.it/blog-fotovoltaico/canone-diritto-superficie-fotovoltaico-quanto-guadagna
31. NYISO, 2025–2029 Demand Curve Reset, presentazione BMcD (lug-2024) – https://www.nyiso.com/documents/20142/45958275/2025-2029%20DCR%20-%20BMcD%20Presentation%2007232024%20ICAPWG.pdf/0bc0c3b6-077f-8df4-8dec-2b473cdcdf10
32. pv magazine, "JinkoSolar announces new TOPCon solar modules with efficiency of 24.8%" (23/10/2024); datasheet Phono Solar Draco – https://pv-magazine.com/2024/10/23/jinkosolar-announces-new-topcon-solar-modules-with-efficiency-of-24-8 ; https://ressupply.com/documents/phono/Draco_Series_420-440W_Data_Sheet.pdf
33. euribor-rates.eu, Euribor 6 mesi; global-rates.com, storico 2026 – https://www.euribor-rates.eu/it/tassi-euribor-aggiornati/3/euribor-tasso-6-mesi/ ; https://www.global-rates.com/it/tassi-di-interesse/euribor/storico/2026/?id=3
34. rivaluta.it, "Analisi tecnica Euribor 12 mesi, 15 settembre 2026"; XTB, BCE e tassi 2026 – https://www.rivaluta.it/analisi-tecnica-euribor-12-mesi-15-settembre-2026/ ; https://www.xtb.com/it/formazione/bce-tassi-interesse-mutui-in-italia-notizie
35. EVreporter, "Understanding BESS – Part 4/5" (cicli delle celle 314 Ah); ETN News, RelyEZ GridUltra 5 MWh (set-2024) – https://evreporter.com/understanding-battery-energy-storage-system-bess-part-5/ ; https://etn.news/energy-storage/relyez-gridultra-battery-energy-storage-system-launch-china?format=amp
36. Regione FVG, PER cap. 9 (dati ENEA/GSE); relazioni PVsyst su va.mite.gov.it (Roma 1.563; Molise 1.510) – https://prod-energia.regione.fvg.it/export/sites/energia/documents/il-piano-energetico-regionale/9_Ruolo_del_fotovoltaico_nel_PER.pdf ; https://va.mite.gov.it/File/Documento/593419
36b. Politesi (PoliMi), tesi Pedagaggi/Fiumesanto; relazioni VIA Villafrati e Militello; JRC (tracking +30%) – https://www.politesi.polimi.it/handle/10589/229869 ; https://va.mite.gov.it/File/Documento/811782 ; https://publications.jrc.ec.europa.eu/repository/handle/JRC52138
37. SolarPower Europe, studio sul reshoring (via pv magazine, 24/10/2025) – https://www.pv-magazine.com/2025/10/24/solar-modules-could-be-produced-in-europe-at-e0-15-w/
38. TradingView, ICE Endex Italian Power Financial Base Futures (istantanee non datate) – https://in.tradingview.com/symbols/ICEENDEX-IPB1!/contracts
39. AIEE, presentazione Benedettini (lug-2026, dati GME) – https://www.aiee.it/wp-content/uploads/2026/07/BENEDETTINI.pdf
40. Italia Solare (vedi 13); pv magazine, "Italy's solar capture price falls below market average in southern regions" (16/07/2026) – https://www.pv-magazine.com/2026/07/16/italys-solar-capture-price-falls-below-market-average-in-southern-regions/
41. Modo Energy, "Europe solar capture rates – March 2026" (16/04/2026) – https://modoenergy.com/research/europe-solar-capture-rates-capture-price-march-2026-italy-red-tape-solar-buildout
42. Modo Energy, "Italy BESS benchmark H1 2026"; "Italy BESS market overview" (ott-2025) – https://modoenergy.com/research/italy-bess-benchmark-h1-2026-battery ; https://modoenergy.com/research/italy-bess-market-overview-fixed-revenue-merchant-october-25
43. edilizia.com, "Ritiro dedicato: cos'è, come funziona, quanto paga"; solareindustriale.it, "Ritiro dedicato" (2026) – https://www.edilizia.com/guide/ritiro-dedicato-cose-come-funziona-quanto-paga-conviene/ ; https://www.solareindustriale.it/incentivi/ritiro-dedicato
44. Axpo Italia, CTE "Scegli Dinamico/Sereno 2.0" (mag e ago 2026) – https://www.axpo.com/content/dam/axpo19/italy/cte-offerte-business/Scegli%20Sereno%202.0_2608.pdf ; https://www.axpo.com/content/dam/axpo19/italy/cte-offerte-business/Scegli%20Dinamico%202.0_2608.pdf
45. e-distribuzione, tariffe di trasporto 2026 MTA1/MTA2/MTA3 – https://www.e-distribuzione.it/content/dam/e-distribuzione/a-chi-ci-rivolgiamo/venditori/2026/MTA3.pdf ; …/MTA2.pdf ; …/MTA1.pdf
46. ARERA, delibera 91/2026/R/eel (riduzione ASOS, DL 21/2026) e 98/2026/R/com – https://www.arera.it/fileadmin/allegati/docs/26/91-2026-R-eel.pdf ; https://www.arera.it/fileadmin/allegati/docs/26/98-2026-R-com_Relazione_tecnica.pdf
47. Switcho, "Accise e IVA in bolletta"; Butangas, prospetto del carico fiscale (circa 2021) – https://www.switcho.it/blog/luce-gas/cosa-sono-le-accise-e-liva-nella-bolletta-dellenergia-elettrica ; https://butangas.it/wp-content/uploads/2021/10/Link_carico_fiscale.pdf
48. Certifico, TU Accise art. 52; nota SicilCER sulla circolare ADM 21/2026 (ago-2026) – https://certifico.com/full-plus/officina-elettrica-legislazione-tu-accise-e-note ; https://www.qualenergia.it/wp-content/uploads/2026/08/SicilCER-su-Circolare-ADM-accise-elettricita-agosto-2026.pdf
49. Confindustria (H1-2025, Eurostat/GME) – https://www.confindustria.it/en/?p=21553
50. Argus Media, "Interest rates now main brake on EU renewables – Repsol" (2026) – https://www.argusmedia.com/en/news-and-insights/latest-market-news/2878746-interest-rates-now-main-brake-on-eu-renewables-repsol
50b. Leaders League, Revalue Energies 160 M€ PF (ott-2026); The Asset, Sonnedix (giu-2026) – https://www.leadersleague.com/en/news/revalue-energies-closes-eur160-million-project-financing-for-26-photovoltaic-projects ; https://www.theasset.com/article/56545/sonnedix-closes-debt-financing-for-spanish-italian-pv-developments
51. Vartiainen et al., "Impact of WACC, CAPEX…" (Progress in Photovoltaics, 2020) – https://scienceportal.tecnalia.com/en/publications/impact-of-weighted-average-cost-of-capital-capital-expenditure-an/
52. Banca d'Italia, Proiezioni macroeconomiche per l'Italia (16/10/2026) – https://www.bancaditalia.it/pubblicazioni/proiezioni-macroeconomiche/2026/Proiezioni-macroeconomiche-Italia-ottobre-2026.pdf

### Dati non trovati (da reperire con accesso diretto alle fonti)
- Media 2025 per fasce F1/F2/F3 e prezzi zonali annui ufficiali (statistiche GME).
- PUN mensile ufficiale di luglio, agosto e settembre 2026 (i dati secondari sono incoerenti).
- Settlement futures Italia Cal-2027 di ottobre 2026 (EEX/ICE).
- Valori unitari ASOS/ARIM MT 2026 dopo il DL 21/2026, ed eventuale quota potenza degli oneri.
- Fattore perdite MT vigente (TIS).
- Producibilità PVGIS per città (API JRC bloccata dal proxy): rieseguire con PVGIS-SARAH3, perdite 14%, fisso ottimale e tracker monoassiale.
- Margini bancari del project finance FV Italia 2026; premi assicurativi pubblici; O&M C&I in €/kWp da fonte indipendente.
