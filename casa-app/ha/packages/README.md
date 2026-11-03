# Package YAML di Home Assistant

Questa cartella contiene le logiche che comandano gli impianti (CLAUDE.md, regola 3).
Le logiche restano in HA e funzionano anche con il backend spento.

## Da fare

1. Copia qui i package esistenti di HA: `clima.yaml`, `modalita_camino.yaml` (e PDC Agent, se è un package).
2. Copia i file in `/config/packages/` di HA (add-on Samba o File editor).
3. In `configuration.yaml` di HA abilita i package:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

4. Riavvia HA e controlla il log.

Casa App non contiene copie di queste logiche: non sono nel repository finché non le copi tu.
Per comandarle dall'app, scrivi le loro entità in `config/entities.yaml` (es. `camino.modalita`).
