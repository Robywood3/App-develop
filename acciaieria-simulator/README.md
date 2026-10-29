# Simulatore Acciaieria Integrata (SIM-ACC-01)

Simulatore di impianto di un'acciaieria a ciclo completo per **laminati piani (configurazione A)** o **tubi
(configurazione B)**, costruito sulla descrizione funzionale *"Acciaieria integrata per laminati piani e tubi"* (DF)
e con il formato dei simulatori della knowledge base (stesso impianto del *Gas Power Simulator* KB-T-07):
cartiglio, schema a blocchi interattivo, ispettore, input con marcatore di origine, bilanci, emissioni,
dimensioni principali, tabella delle correnti, confronto tra casi, vista assonometrica, elaborati, planimetria,
salvataggio del caso, verifiche e limiti. **Stato D**: valori di screening da confermare con i licenziatari.

## Cosa calcola

Bilancio di massa ed energia annuo, a ritroso dall'acciaio liquido, area per area (B1…B12):

| Blocco | Area (DF) |
| --- | --- |
| B1 | Parco materie prime e logistica in ingresso (§3) |
| B2 | Cokeria e agglomerazione, solo BF-BOF (§4.1) |
| B3 | Altoforno o riduzione diretta DRI, anche a idrogeno (§4) |
| B4 | Convertitore BOF o forno elettrico EAF (§5.1) |
| B5 | Metallurgia secondaria LF, RH/VD (§5.2) |
| B6 | Colata continua: bramme, thin slab, tondi (§6) |
| B7 | A: treno nastri e lamiere – B: tubi senza saldatura (§7.1, §8.1) |
| B8 | A: decapaggio, freddo, ricottura, zincatura – B: tubi saldati ERW/SAW (§7.2–7.4, §8.2) |
| B9 | Finitura, Q&T, controlli e spedizione (§7.5, §8.3) |
| B10 | Energia elettrica, sottostazione, centrale a gas di recupero (§9) |
| B11 | ASU, acqua, gas naturale, calce (§9) |
| B12 | Captazione fumi, sottoprodotti (§10) |

Risultati: rese e prodotti, carica metallica e rottame interno, consumi di energia elettrica, gas naturale,
ossigeno e acqua, CO₂ diretta per bilancio del carbonio e indiretta dalla rete, bilancio del ferro,
dimensioni principali (altoforni, moduli DRI, forni e trasformatori, linee di colata, laminatoi, ASU,
sottostazione), confronto automatico con gli indicatori della DF §12.1.

Elaborati scaricabili (CSV, Markdown, SVG): equipment list, load list, utility summary, bilancio materiali,
WBS con discipline e interfacce (§12.2), battery limits (§12.3), sottoprodotti.

## File

- `src/data.js` – parametri (default, campo, marcatore F/R/A, fonte nella DF), casi di riferimento A1–B2
- `src/engine.js` – motore di calcolo (funzione pura `AccEngine.solve`)
- `src/docs.js` – elaborati, planimetria e altezze della vista assonometrica
- `src/page.html`, `src/page.js` – pagina
- `tools/build.js` – crea `standalone/simulatore-acciaieria.html` (file unico, apribile nel browser)
- `tests/engine.test.js` – test del motore e degli elaborati

```sh
node tests/engine.test.js
node tools/build.js
```
