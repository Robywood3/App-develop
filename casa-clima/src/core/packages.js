/*
 * "Pacchetti" in stile Home Assistant: file YAML (o JSON) nella cartella data/packages/
 * che raccolgono configurazione Casa-Clima, automazioni e scene. Vengono uniti in ordine alfabetico.
 */
import { promises as fs, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { toArray } from './util.js';

const EXT = /\.(ya?ml|json)$/i;

export function parsePackage(text, name = 'pacchetto') {
  try {
    const doc = name.endsWith('.json') ? JSON.parse(text) : YAML.parse(text, { prettyErrors: true });
    return doc || {};
  } catch (err) {
    throw new Error(`${name}: ${err.message.split('\n')[0]}`);
  }
}

export class PackageLoader {
  constructor(dir, defaultsDir) {
    this.dir = dir;
    this.defaultsDir = defaultsDir;
  }

  /** Al primo avvio copia i pacchetti di esempio. */
  ensureDefaults() {
    mkdirSync(this.dir, { recursive: true });
    if (readdirSync(this.dir).some((f) => EXT.test(f))) return;
    for (const f of readdirSync(this.defaultsDir)) {
      if (EXT.test(f)) copyFileSync(path.join(this.defaultsDir, f), path.join(this.dir, f));
    }
  }

  async files() {
    if (!existsSync(this.dir)) return [];
    return (await fs.readdir(this.dir)).filter((f) => EXT.test(f)).sort();
  }

  safePath(name) {
    const base = path.basename(String(name || ''));
    if (!EXT.test(base)) throw Object.assign(new Error('Il nome del file deve finire con .yaml, .yml o .json'), { status: 400 });
    return path.join(this.dir, base);
  }

  async read(name) {
    try {
      return await fs.readFile(this.safePath(name), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') throw Object.assign(new Error('Pacchetto non trovato'), { status: 404 });
      throw err;
    }
  }

  /** Valida e salva. Ritorna il contenuto interpretato. */
  async write(name, text) {
    const file = this.safePath(name);
    const doc = parsePackage(text, path.basename(file));
    if (typeof doc !== 'object' || Array.isArray(doc)) throw Object.assign(new Error('Il pacchetto deve essere un oggetto YAML'), { status: 400 });
    await fs.writeFile(`${file}.tmp`, text);
    await fs.rename(`${file}.tmp`, file);
    return doc;
  }

  async remove(name) {
    await fs.unlink(this.safePath(name));
  }

  async load() {
    const merged = { casa_clima: {}, automations: [], scenes: [], errors: [], files: [] };
    for (const f of await this.files()) {
      try {
        const doc = parsePackage(await fs.readFile(path.join(this.dir, f), 'utf8'), f);
        merged.files.push(f);
        const cc = doc.casa_clima;
        if (cc) {
          for (const [k, v] of Object.entries(cc)) {
            merged.casa_clima[k] = v && typeof v === 'object' && !Array.isArray(v) && merged.casa_clima[k] && typeof merged.casa_clima[k] === 'object'
              ? { ...merged.casa_clima[k], ...v }
              : v;
          }
        }
        merged.automations.push(...toArray(doc.automations ?? doc.automation).map((a) => ({ ...a, _file: f })));
        merged.scenes.push(...toArray(doc.scenes ?? doc.scene));
      } catch (err) {
        merged.errors.push(err.message);
      }
    }
    return merged;
  }
}
