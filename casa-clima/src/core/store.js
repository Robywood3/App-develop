import { promises as fs, readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';

/**
 * File JSON persistente con scrittura atomica (tmp + rename) e permessi 0600,
 * perché contiene token e password delle integrazioni.
 */
export class JsonStore {
  constructor(file, defaults = {}) {
    this.file = file;
    this.defaults = defaults;
    this.data = null;
    this._timer = null;
    this._writing = Promise.resolve();
  }

  load() {
    mkdirSync(path.dirname(this.file), { recursive: true });
    if (existsSync(this.file)) {
      try {
        this.data = { ...structuredClone(this.defaults), ...JSON.parse(readFileSync(this.file, 'utf8')) };
      } catch (err) {
        throw new Error(`File ${this.file} non leggibile: ${err.message}`);
      }
    } else {
      this.data = structuredClone(this.defaults);
      this.saveSync();
    }
    return this.data;
  }

  saveSync() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  /** Salva subito (in coda alle scritture precedenti). */
  save() {
    clearTimeout(this._timer);
    this._timer = null;
    const snapshot = JSON.stringify(this.data, null, 2);
    this._writing = this._writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, snapshot, { mode: 0o600 });
      await fs.rename(tmp, this.file);
    });
    return this._writing;
  }

  /** Salva dopo `ms` millisecondi, raggruppando più modifiche ravvicinate. */
  saveLater(ms = 2000) {
    if (this._timer) return;
    this._timer = setTimeout(() => this.save().catch(() => {}), ms);
  }

  async flush() {
    if (this._timer) await this.save();
    await this._writing;
  }
}
