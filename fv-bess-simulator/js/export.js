/*
 * FV+BESS Simulator – esportazione senza dipendenze esterne:
 *   relazioni  Markdown → Word (.docx, OOXML) e PDF (A4, font standard PDF)
 *   tavole     disegno vettoriale → CAD (.dxf R12, ANSI_1252), PDF (A1/A3) e SVG (anteprima)
 *   ZIP        archivio senza compressione (CRC-32)
 * Il disegno usa coordinate "mondo" (metri per le planimetrie, mm per gli schemi); la funzione sheet()
 * aggiunge cornice e cartiglio e fissa la trasformazione mondo → foglio usata da PDF e SVG.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FVB_EXPORT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- byte, ZIP ----------
  const utf8 = s => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8'));
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function bytesOf(d) { return typeof d === 'string' ? utf8(d) : d; }
  // entries: [{ name, data: string (UTF-8) | Uint8Array }]
  function zip(entries) {
    const parts = [], central = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const e of entries) {
      const name = utf8(e.name), data = bytesOf(e.data), crc = crc32(data);
      const head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    }
    const csize = central.reduce((a, p) => a + p.length, 0);
    const end = Uint8Array.from([].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(csize), u32(off), u16(0)));
    const all = parts.concat(central, [end]), out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  // ---------- Markdown → blocchi ----------
  function parseMd(md) {
    const L = md.replace(/\r/g, '').split('\n'), B = []; let i = 0;
    const isTableSep = s => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(s);
    const cells = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    while (i < L.length) {
      const l = L[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      let m;
      if ((m = /^```\s*(\w*)/.exec(l))) { const lang = m[1], buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]); i++; B.push({ t: 'code', lang, text: buf.join('\n') }); continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { B.push({ t: 'h', level: m[1].length, text: m[2].trim() }); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < L.length && isTableSep(L[i + 1])) {
        const head = cells(l), align = cells(L[i + 1]).map(c => /:$/.test(c) ? 'r' : ''), rows = []; i += 2;
        while (i < L.length && /^\s*\|/.test(L[i])) rows.push(cells(L[i++]));
        B.push({ t: 'table', head, align, rows: rows.map(r => head.map((_, k) => r[k] === undefined ? '' : r[k])) }); continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { B.push({ t: 'hr' }); i++; continue; }
      if (/^>/.test(l)) { const buf = []; while (i < L.length && /^>/.test(L[i])) { const s = L[i++].replace(/^>\s?/, ''); if (s.trim() === '') { if (buf.length) { B.push({ t: 'quote', text: buf.join(' ') }); buf.length = 0; } } else buf.push(s.trim()); } if (buf.length) B.push({ t: 'quote', text: buf.join(' ') }); continue; }
      if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d/.test(l), items = [];
        while (i < L.length && (/^\s*([-*]|\d+[.)])\s+/.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) {
          if (/^\s*([-*]|\d+[.)])\s+/.test(L[i])) { const mk = /^\s*([-*]|\d+)/.exec(L[i])[1]; items.push({ text: L[i].replace(/^\s*([-*]|\d+[.)])\s+/, ''), level: /^\s{2,}/.test(L[i]) ? 1 : 0, num: /\d/.test(mk) ? mk : null }); }
          else items[items.length - 1].text += ' ' + L[i].trim();
          i++;
        }
        B.push({ t: 'list', ordered, items }); continue;
      }
      const buf = [];
      while (i < L.length && !/^\s*$/.test(L[i]) && !/^(#{1,6}\s|```|>|\s*\|)/.test(L[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(L[i])) buf.push(L[i++].trim());
      if (buf.length) B.push({ t: 'p', text: buf.join(' ') }); else i++;
    }
    return B.flatMap(b => b.t === 'code' && b.lang === 'mermaid' ? mermaidBlocks(b.text) : [b]);
  }
  // testo con **grassetto**, *corsivo*, `codice`, [link](url); [DA COMPLETARE ...] evidenziato
  function inline(text) {
    const runs = [], re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]*\)|(?:^|(?<=[\s(]))\*[^*\s][^*]*\*(?=[\s.,;:)]|$)|<br\s*\/?>)/g;
    let last = 0, m;
    const push = (s, f) => { if (s) runs.push(Object.assign({ s }, f || {})); };
    while ((m = re.exec(text))) {
      push(text.slice(last, m.index)); const t = m[0];
      if (t.startsWith('**')) { const c = t.slice(2, -2); push(c, { b: true, hl: /^\[DA COMPLETARE/.test(c) }); }
      else if (t.startsWith('`')) push(t.slice(1, -1), { c: true });
      else if (t.startsWith('[')) push(/^\[([^\]]+)\]/.exec(t)[1]);
      else if (t.startsWith('<br')) push(' / ');
      else push(t.slice(1, -1), { i: true });
      last = m.index + t.length;
    }
    push(text.slice(last));
    return runs.length ? runs : [{ s: '' }];
  }
  const plain = t => inline(t).map(r => r.s).join('');
  // diagrammi Mermaid → elenco dei collegamenti o tabella del cronoprogramma
  function mermaidBlocks(code) {
    const lines = code.split('\n').map(s => s.trim()).filter(Boolean), kind = (lines[0] || '').split(/\s/)[0];
    if (kind === 'gantt') {
      const rows = [];
      for (const l of lines.slice(1)) { const m = /^(.+?)\s*:\s*(?:milestone,\s*)?[\w]+,\s*(\d{4}-\d{2}-\d{2}),\s*(\d+)d/.exec(l); if (m) rows.push([m[1], m[2].split('-').reverse().join('/'), /milestone/.test(l) ? 'traguardo' : m[3]]); }
      return [{ t: 'table', head: ['Attività', 'Inizio', 'Durata (giorni)'], align: ['', '', 'r'], rows }];
    }
    const label = {}, edges = [];
    const node = s => { const m = /^(\w+)(?:\["([^"]*)"\])?/.exec(s.trim()); if (!m) return null; if (m[2] !== undefined) label[m[1]] = m[2].replace(/<br\s*\/?>/g, ', '); return m[1]; };
    for (const l of lines.slice(1)) {
      const m = /^(.+?)\s*(-->|-\.->|---)\s*(?:\|"?([^|"]*)"?\|\s*)?(.+)$/.exec(l); if (!m) continue;
      const a = node(m[1]), b = node(m[4]); if (a && b) edges.push([a, m[2], m[3] || '', b]);
    }
    const nm = id => label[id] || id;
    return [{ t: 'p', text: '**Schema a blocchi** (lo schema grafico è nella tavola CAD corrispondente):' },
      { t: 'list', ordered: false, items: edges.map(([a, k, l, b]) => ({ text: `${nm(a)} ${k === '-.->' ? '⇢ (segnali)' : k === '---' ? '—' : '→'} ${nm(b)}${l ? ' [' + l + ']' : ''}`, level: 0 })) }];
  }

  // ---------- Word (.docx) ----------
  const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  function wRuns(text, extra) {
    return inline(text).map(r => {
      const pr = (r.c ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') + (r.b || (extra && extra.b) ? '<w:b/>' : '') + (r.i ? '<w:i/>' : '') + (r.hl ? '<w:highlight w:val="yellow"/>' : '');
      return `<w:r>${pr ? '<w:rPr>' + pr + '</w:rPr>' : ''}<w:t xml:space="preserve">${xe(r.s)}</w:t></w:r>`;
    }).join('');
  }
  const wP = (style, inner, jc) => `<w:p><w:pPr><w:pStyle w:val="${style}"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
  function colWidths(head, rows, total, measure) {
    const nat = head.map((h, k) => Math.max(measure(h, true), ...rows.map(r => measure(r[k] || '', false)), 1));
    let sum = nat.reduce((a, b) => a + b, 0);
    if (sum <= total) return nat.map(v => v * total / sum);
    let lo = 0, hi = Math.max(...nat);
    for (let it = 0; it < 40; it++) { const c = (lo + hi) / 2; if (nat.reduce((a, v) => a + Math.min(v, c), 0) > total) hi = c; else lo = c; }
    const w = nat.map(v => Math.min(v, lo)); sum = w.reduce((a, b) => a + b, 0);
    return w.map(v => v * total / sum);
  }
  function docx(md, meta) {
    meta = meta || {};
    const B = parseMd(md), body = [], TW = 9638;
    let first = true;
    for (const b of B) {
      if (b.t === 'h') { body.push(wP(first && b.level === 1 ? 'Title' : 'Heading' + Math.min(3, Math.max(1, b.level - 1)), wRuns(b.text))); first = false; }
      else if (b.t === 'p') body.push(wP('Normal', wRuns(b.text)));
      else if (b.t === 'quote') body.push(wP('Quote', wRuns(b.text)));
      else if (b.t === 'hr') body.push('<w:p><w:pPr><w:pStyle w:val="Normal"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="A0A8AE"/></w:pBdr></w:pPr></w:p>');
      else if (b.t === 'code') b.text.split('\n').forEach(l => body.push(wP('Code', `<w:r><w:t xml:space="preserve">${xe(l)}</w:t></w:r>`)));
      else if (b.t === 'list') b.items.forEach((it, k) => body.push(`<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>${it.level ? '<w:ind w:left="720" w:hanging="240"/>' : ''}</w:pPr><w:r><w:t xml:space="preserve">${it.num ? it.num + '. ' : '•  '}</w:t></w:r>${wRuns(it.text)}</w:p>`));
      else if (b.t === 'table') {
        const w = colWidths(b.head, b.rows, TW, (s, h) => plain(s).length * (h ? 1.1 : 1) + 2).map(Math.round);
        const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="A0A8AE"/>`).join('');
        const row = (cells, head) => `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((c, k) => `<w:tc><w:tcPr><w:tcW w:w="${w[k]}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E3EAEC"/>' : ''}</w:tcPr>${wP('TableText', wRuns(c, head ? { b: true } : null), b.align[k] === 'r' ? 'right' : null)}</w:tc>`).join('')}</w:tr>`;
        body.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${w.map(v => `<w:gridCol w:w="${v}"/>`).join('')}</w:tblGrid>${row(b.head, true)}${b.rows.map(r => row(r, false)).join('')}</w:tbl>`, '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:after="60"/></w:pPr></w:p>');
      }
      if (b.t !== 'h') first = false;
    }
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W_NS}><w:body>${body.join('')}<w:p/><w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const st = (id, name, type, ppr, rpr, extra) => `<w:style w:type="${type}" w:styleId="${id}"${id === 'Normal' ? ' w:default="1"' : ''}><w:name w:val="${name}"/>${id !== 'Normal' && type === 'paragraph' ? '<w:basedOn w:val="Normal"/>' : ''}${extra || ''}${ppr ? '<w:pPr>' + ppr + '</w:pPr>' : ''}${rpr ? '<w:rPr>' + rpr + '</w:rPr>' : ''}</w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      st('Normal', 'Normal', 'paragraph') +
      st('Title', 'Title', 'paragraph', '<w:keepNext/><w:spacing w:after="200"/>', '<w:b/><w:color w:val="13283A"/><w:sz w:val="32"/><w:szCs w:val="32"/>', '<w:next w:val="Normal"/>') +
      st('Heading1', 'heading 1', 'paragraph', '<w:keepNext/><w:spacing w:before="280" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="B86A10"/></w:pBdr><w:outlineLvl w:val="0"/>', '<w:b/><w:color w:val="13283A"/><w:sz w:val="26"/><w:szCs w:val="26"/>', '<w:next w:val="Normal"/>') +
      st('Heading2', 'heading 2', 'paragraph', '<w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/>', '<w:b/><w:color w:val="13283A"/><w:sz w:val="22"/><w:szCs w:val="22"/>', '<w:next w:val="Normal"/>') +
      st('Heading3', 'heading 3', 'paragraph', '<w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/>', '<w:b/><w:color w:val="57666F"/><w:sz w:val="20"/><w:szCs w:val="20"/>', '<w:next w:val="Normal"/>') +
      st('Quote', 'Quote', 'paragraph', '<w:pBdr><w:left w:val="single" w:sz="18" w:space="6" w:color="B86A10"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="FBF4E6"/><w:ind w:left="170"/>', '<w:color w:val="57666F"/><w:sz w:val="18"/><w:szCs w:val="18"/>') +
      st('Code', 'Code', 'paragraph', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="16"/><w:szCs w:val="16"/>') +
      st('TableText', 'Table Text', 'paragraph', '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>', '<w:sz w:val="16"/><w:szCs w:val="16"/>') +
      st('ListParagraph', 'List Paragraph', 'paragraph', '<w:spacing w:after="40"/><w:ind w:left="360" w:hanging="240"/>') +
      st('Header', 'header', 'paragraph', '<w:spacing w:after="0"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="A0A8AE"/></w:pBdr>', '<w:color w:val="57666F"/><w:sz w:val="15"/><w:szCs w:val="15"/>') +
      st('Footer', 'footer', 'paragraph', '<w:spacing w:after="0"/>', '<w:color w:val="57666F"/><w:sz w:val="15"/><w:szCs w:val="15"/>') + '</w:styles>';
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W_NS}><w:p><w:pPr><w:pStyle w:val="Header"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">${xe(meta.left || '')}</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">${xe(meta.right || '')}</w:t></w:r></w:p></w:hdr>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${W_NS}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9638"/></w:tabs></w:pPr><w:r><w:t xml:space="preserve">${xe(meta.footer || 'Bozza generata dal simulatore FV + BESS')}</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Pag. </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> di </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>' },
      { name: 'word/document.xml', data: docXml },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings ${W_NS}><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>` },
      { name: 'word/header1.xml', data: header },
      { name: 'word/footer1.xml', data: footer },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(meta.title || '')}</dc:title><dc:creator>Simulatore FV + BESS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>` },
      { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Simulatore FV + BESS</Application></Properties>' }
    ]);
  }

  // ---------- PDF: testo, metriche, codifica WinAnsi ----------
  const HELV = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584'.split(',').map(Number);
  const HELVB = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584'.split(',').map(Number);
  const HIGH = { 0x80: 556, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0xA0: 278, 0xA7: 556, 0xA9: 737, 0xAB: 556, 0xB0: 400, 0xB1: 584, 0xB2: 333, 0xB3: 333, 0xB5: 556, 0xB7: 278, 0xBB: 556, 0xD7: 584 };
  const BASE = { 'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ì': 'i', 'í': 'i', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'ú': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n', 'À': 'A', 'È': 'E', 'É': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U', 'Ä': 'A', 'Ö': 'O', 'Ü': 'U' };
  const WIN = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '●': 0x95, '–': 0x96, '—': 0x97 };
  const SUB = { '≤': '<=', '≥': '>=', '√': 'rad', '○': 'o', '☐': '[ ]', '→': '->', '⇢': '->', '←': '<-', '≈': '~', 'Δ': 'Delta ', 'φ': 'phi', 'ρ': 'rho', 'η': 'eta', 'γ': 'gamma', 'β': 'beta', 'α': 'alfa', 'σ': 'sigma', '∑': 'S', '₂': '2', '₃': '3', '′': "'", '″': '"', ' ': ' ', ' ': ' ', '✓': 'v', '×': '×', '−': '-', '·': '·' };
  function win(s) { // stringa con soli codici 0–255 (WinAnsi)
    let o = '';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (c < 128 || (c >= 0xA0 && c <= 0xFF)) o += ch;
      else if (WIN[ch]) o += String.fromCharCode(WIN[ch]);
      else if (SUB[ch] !== undefined) o += win(SUB[ch]);
      else o += '?';
    }
    return o;
  }
  function charW(code, font) {
    if (font === 'F3') return 600;
    const T = font === 'F2' ? HELVB : HELV;
    if (code >= 32 && code <= 126) return T[code - 32];
    if (HIGH[code]) return HIGH[code];
    const ch = String.fromCharCode(code), b = BASE[ch];
    if (b) return T[b.charCodeAt(0) - 32];
    return 556;
  }
  const textW = (s, font, size) => { let w = 0; for (let i = 0; i < s.length; i++) w += charW(s.charCodeAt(i), font); return w * size / 1000; };
  const pstr = s => '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
  const f2 = v => (Math.round(v * 100) / 100).toString();
  function pdfFile(pages, info) { // pages: [{w, h, ops}]
    const objs = []; const add = s => (objs.push(s), objs.length);
    const fonts = [['F1', 'Helvetica'], ['F2', 'Helvetica-Bold'], ['F3', 'Courier'], ['F4', 'Helvetica-Oblique']].map(([k, n]) => [k, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`)]);
    const fontRes = '<< ' + fonts.map(([k, id]) => `/${k} ${id} 0 R`).join(' ') + ' >>';
    const pagesId = objs.length + 1; objs.push(null);
    const kids = [];
    for (const p of pages) {
      const content = p.ops.join('\n'), cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${f2(p.w)} ${f2(p.h)}] /Resources << /Font ${fontRes} >> /Contents ${cid} 0 R >>`));
    }
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    const infoId = add(`<< /Title ${pstr(win(info.title || ''))} /Producer (Simulatore FV + BESS) /Creator (Simulatore FV + BESS) >>`);
    const catId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out = '%PDF-1.4\n%âãÏÓ\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255; return b;
  }

  // ---------- PDF relazione (A4) ----------
  const INK = '0.075 0.157 0.227', MUTED = '0.34 0.4 0.44', ACC = '0.72 0.42 0.06', HLC = '0.62 0.30 0';
  function pdfReport(md, meta) {
    meta = meta || {};
    const PW = 595.28, PH = 841.89, ML = 56, MR = 56, MT = 70, MB = 60, AW = PW - ML - MR;
    const pages = []; let ops, y;
    const newPage = () => { ops = []; pages.push({ w: PW, h: PH, ops }); y = PH - MT; };
    newPage();
    const fontOf = r => r.c ? 'F3' : r.b || r.hl ? 'F2' : r.i ? 'F4' : 'F1';
    // spezza i run in righe di larghezza max
    function wrap(runs, size, maxW, base) {
      const lines = [[]]; let w = 0;
      const pushTok = (tok, f, col) => {
        const tw = textW(tok, f, size);
        if (w + tw > maxW && w > 0 && tok.trim()) { lines.push([]); w = 0; if (!tok.trim()) return; tok = tok.replace(/^\s+/, ''); }
        if (tw > maxW) { let part = ''; for (const ch of tok) { if (textW(part + ch, f, size) > maxW) { lines[lines.length - 1].push({ s: part, f, col }); lines.push([]); part = ch; w = 0; } else part += ch; } tok = part; }
        const L = lines[lines.length - 1], last = L[L.length - 1];
        if (last && last.f === f && last.col === col) last.s += tok; else L.push({ s: tok, f, col });
        w += textW(tok, f, size);
      };
      for (const r of runs) { const f = base && base.f && !r.c ? (r.hl ? 'F2' : base.f) : fontOf(r), col = r.hl ? HLC : base && base.col || INK; for (const tok of win(r.s).split(/(?<=\s)/)) if (tok) pushTok(tok, f, col); }
      return lines.map(l => { if (l.length) l[l.length - 1].s = l[l.length - 1].s.replace(/\s+$/, ''); return l; });
    }
    const lineW = (l, size) => l.reduce((a, s) => a + textW(s.s, s.f, size), 0);
    function drawLine(l, x, yy, size) { let xx = x; for (const s of l) { if (s.s) ops.push(`BT /${s.f} ${size} Tf ${s.col} rg ${f2(xx)} ${f2(yy)} Td ${pstr(s.s)} Tj ET`); xx += textW(s.s, s.f, size); } }
    function ensure(h) { if (y - h < MB) newPage(); }
    function para(runs, size, lead, x, w, base, before) {
      const lines = wrap(runs, size, w, base); y -= before || 0;
      for (const l of lines) { ensure(lead); y -= lead; drawLine(l, x, y + (lead - size) * 0.5, size); }
      return lines.length;
    }
    function table(b) {
      const size = 7.6, lead = 9.4, pad = 3, nat = (s, h) => textW(win(plain(s)), h ? 'F2' : 'F1', size) + 2 * pad + 1;
      const wcol = colWidths(b.head, b.rows, AW, nat);
      const cellLines = (txt, k, head) => wrap(inline(txt), size, wcol[k] - 2 * pad, head ? { f: 'F2' } : null);
      const drawRow = (cells, head) => {
        const L = cells.map((c, k) => cellLines(c, k, head)), h = Math.max(...L.map(l => l.length)) * lead + 2 * pad;
        if (y - h < MB) { newPage(); if (!head) drawRow(b.head, true); }
        const top = y; let x = ML;
        if (head) ops.push(`0.89 0.918 0.925 rg ${f2(ML)} ${f2(top - h)} ${f2(AW)} ${f2(h)} re f`);
        L.forEach((lines, k) => {
          lines.forEach((l, j) => { const yy = top - pad - (j + 1) * lead + (lead - size) * 0.6; const lx = b.align[k] === 'r' ? x + wcol[k] - pad - lineW(l, size) : x + pad; drawLine(l, lx, yy, size); });
          x += wcol[k];
        });
        ops.push(`0.63 0.66 0.68 RG 0.4 w ${f2(ML)} ${f2(top - h)} ${f2(AW)} ${f2(h)} re S`);
        x = ML; for (let k = 0; k < wcol.length - 1; k++) { x += wcol[k]; ops.push(`${f2(x)} ${f2(top)} m ${f2(x)} ${f2(top - h)} l S`); }
        y = top - h;
      };
      y -= 4; ensure(lead * 3); drawRow(b.head, true); b.rows.forEach(r => drawRow(r, false)); y -= 8;
    }
    const B = parseMd(md); let first = true;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.t === 'h') {
        const lvl = first && b.level === 1 ? 0 : b.level, size = [17, 15, 12.5, 10.5, 10, 10, 10][lvl], lead = size * 1.3;
        ensure(lead * 3 + 8); y -= lvl <= 1 ? 10 : 7;
        para(inline(b.text), size, lead, ML, AW, { f: 'F2', col: lvl === 3 ? MUTED : INK });
        if (lvl === 2) { ops.push(`${ACC} RG 0.8 w ${ML} ${f2(y - 2)} m ${f2(ML + AW)} ${f2(y - 2)} l S`); y -= 5; }
        y -= 3; first = false; continue;
      }
      first = false;
      if (b.t === 'p') { para(inline(b.text), 9.5, 13, ML, AW); y -= 5; }
      else if (b.t === 'quote') { const y0 = y; const n = para(inline(b.text), 8.6, 11.5, ML + 12, AW - 12, { col: MUTED }, 2); ops.push(`${ACC} RG 2 w ${ML + 3} ${f2(Math.min(y0, PH - MT))} m ${ML + 3} ${f2(y)} l S`); y -= 6; void n; }
      else if (b.t === 'hr') { ensure(10); y -= 5; ops.push(`0.63 0.66 0.68 RG 0.5 w ${ML} ${f2(y)} m ${f2(ML + AW)} ${f2(y)} l S`); y -= 5; }
      else if (b.t === 'code') { for (const l of b.text.split('\n')) { ensure(10); y -= 10; ops.push(`BT /F3 7.6 Tf ${INK} rg ${ML + 6} ${f2(y)} Td ${pstr(win(l))} Tj ET`); } y -= 6; }
      else if (b.t === 'list') { b.items.forEach((it, k) => { const ind = ML + (it.level ? 26 : 10); ensure(13); ops.push(`BT /F1 9.5 Tf ${INK} rg ${f2(ind)} ${f2(y - 13 + 2)} Td ${pstr(it.num ? it.num + '.' : '\u0095')} Tj ET`); para(inline(it.text), 9.5, 13, ind + 10, AW - (ind - ML) - 10); y -= 1.5; }); y -= 4; }
      else if (b.t === 'table') table(b);
    }
    const N = pages.length;
    pages.forEach((p, i) => {
      p.ops.push(`BT /F1 7.5 Tf ${MUTED} rg ${ML} ${f2(PH - 40)} Td ${pstr(win(meta.left || ''))} Tj ET`);
      const r = win(meta.right || ''); p.ops.push(`BT /F1 7.5 Tf ${MUTED} rg ${f2(PW - MR - textW(r, 'F1', 7.5))} ${f2(PH - 40)} Td ${pstr(r)} Tj ET`);
      p.ops.push(`0.63 0.66 0.68 RG 0.5 w ${ML} ${f2(PH - 46)} m ${f2(PW - MR)} ${f2(PH - 46)} l S`);
      const fl = win(meta.footer || 'Bozza generata dal simulatore FV + BESS'), pg = `Pag. ${i + 1} di ${N}`;
      p.ops.push(`BT /F1 7.5 Tf ${MUTED} rg ${ML} 34 Td ${pstr(fl)} Tj ET`, `BT /F1 7.5 Tf ${MUTED} rg ${f2(PW - MR - textW(pg, 'F1', 7.5))} 34 Td ${pstr(pg)} Tj ET`);
    });
    return pdfFile(pages, { title: meta.title });
  }

  // ---------- disegni: modello, foglio, cartiglio ----------
  // layer: colore ACI, tipo di linea, spessore (mm) per PDF/SVG
  const LAYERS = {
    CORNICE: [7, 'CONTINUOUS', 0.5], CARTIGLIO: [7, 'CONTINUOUS', 0.25], TESTI: [7, 'CONTINUOUS', 0.18], QUOTE: [4, 'CONTINUOUS', 0.13],
    MODULI: [5, 'CONTINUOUS', 0.18], STRUTTURE: [8, 'CONTINUOUS', 0.25], CABINE: [6, 'CONTINUOUS', 0.35], INVERTER: [30, 'CONTINUOUS', 0.3],
    BESS: [3, 'CONTINUOUS', 0.35], RECINZIONE: [1, 'DASHED', 0.3], VIABILITA: [8, 'CONTINUOUS', 0.18], CAVI_MT: [1, 'DASHDOT', 0.4],
    CAVI_BT: [30, 'DASHED', 0.25], CAVI_DC: [5, 'DASHED', 0.18], TERRA: [3, 'DASHED', 0.25], TVCC: [6, 'CONTINUOUS', 0.25],
    DRENAGGI: [4, 'DASHED', 0.25], ILLUMINAZIONE: [2, 'CONTINUOUS', 0.25], ESISTENTE: [8, 'CONTINUOUS', 0.35], SCHEMA: [7, 'CONTINUOUS', 0.35],
    PROTEZIONI: [1, 'CONTINUOUS', 0.3], CONTROLLO: [5, 'DASHED', 0.25], TERRENO: [94, 'CONTINUOUS', 0.35], RIEMPIMENTI: [9, 'CONTINUOUS', 0.13],
    SEGNAPOSTO: [8, 'DASHED', 0.25], ANTINCENDIO: [1, 'CONTINUOUS', 0.35]
  };
  const ACI = { 1: [200, 30, 30], 2: [180, 140, 0], 3: [0, 135, 60], 4: [0, 130, 160], 5: [30, 60, 200], 6: [160, 40, 160], 7: [0, 0, 0], 8: [110, 110, 110], 9: [185, 185, 185], 30: [225, 115, 0], 94: [70, 110, 40] };
  const DASH = { CONTINUOUS: [], DASHED: [3, 1.5], DASHDOT: [5, 1.2, 0.6, 1.2] };
  const SHEETS = { A0: [1189, 841], A1: [841, 594], A2: [594, 420], A3: [420, 297] };
  const SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

  function extents(ents) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const P = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    for (const e of ents) {
      if (e.t === 'line') { P(e.x1, e.y1); P(e.x2, e.y2); } else if (e.t === 'poly' || e.t === 'fill') e.pts.forEach(p => P(p[0], p[1]));
      else if (e.t === 'circle' || e.t === 'arc') { P(e.x - e.r, e.y - e.r); P(e.x + e.r, e.y + e.r); } else if (e.t === 'text') P(e.x, e.y);
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /*
   * d = { code, title, unit: 'm'|'mm', sheet: 'A1'|'A3', scale?: denominatore, ents, legend: [layer], notes: [testo], info: {...} }
   * Calcola la scala (se non data) per far entrare il disegno, poi aggiunge cornice, cartiglio, legenda e note (in coordinate mondo).
   */
  function layoutArea(d) {
    const [SW, SH] = SHEETS[d.sheet || 'A1'], m = 10, ml = 20, tbH = 62;
    const side = Math.max(d.sideW || 0, d.legend && d.legend.length ? 72 : 0);
    return { SW, SH, m, ml, tbH, side, area: { x: ml + 5, y: m + tbH + 8, w: SW - ml - m - 10 - side, h: SH - 2 * m - tbH - 14 } };
  }
  // scala normalizzata che fa entrare il disegno nell'area utile del foglio
  function fitScale(d) {
    const { area } = layoutArea(d), ex = extents(d.ents), per = d.unit === 'm' ? 1000 : 1;
    const need = Math.max(ex.w * per / area.w, ex.h * per / area.h);
    return SCALES.find(s => s >= need * 1.02) || SCALES[SCALES.length - 1];
  }
  function sheet(d) {
    const { SW, SH, m, ml, tbH, side, area } = layoutArea(d), tbW = 180;
    const ex = extents(d.ents), per = d.unit === 'm' ? 1000 : 1;
    const scale = d.scale || fitScale(d);
    const k = per / scale; // mm di foglio per unità mondo
    const ox = ex.x0 - (area.w / k - ex.w) / 2, oy = ex.y0 - (area.h / k - ex.h) / 2;
    const T = { k, ox, oy, ax: area.x, ay: area.y, SW, SH, scale };
    const W = (sx, sy) => [(sx - area.x) / k + ox, (sy - area.y) / k + oy]; // foglio → mondo
    const E = [], H = mm => mm / k;
    const L = (x1, y1, x2, y2, layer) => { const a = W(x1, y1), b = W(x2, y2); E.push({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], layer: layer || 'CORNICE' }); };
    const R = (x, y, w, h, layer) => { const p = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(q => W(q[0], q[1])); E.push({ t: 'poly', pts: p, closed: true, layer: layer || 'CARTIGLIO' }); };
    const Tx = (x, y, s, h, o) => { const p = W(x, y); E.push(Object.assign({ t: 'text', x: p[0], y: p[1], s: String(s), h: H(h), layer: 'CARTIGLIO' }, o || {})); };
    R(ml, m, SW - ml - m, SH - 2 * m, 'CORNICE');
    // cartiglio in basso a destra
    const tx = SW - m - tbW, ty = m, i = d.info || {};
    R(tx, ty, tbW, tbH);
    const rows = [[ty + tbH - 10, 'COMMITTENTE', i.client], [ty + tbH - 20, 'PROGETTO', i.project], [ty + tbH - 32, 'ELABORATO', d.title]];
    L(tx, ty + tbH - 10, tx + tbW, ty + tbH - 10, 'CARTIGLIO'); L(tx, ty + tbH - 20, tx + tbW, ty + tbH - 20, 'CARTIGLIO'); L(tx, ty + tbH - 34, tx + tbW, ty + tbH - 34, 'CARTIGLIO'); L(tx, ty + 12, tx + tbW, ty + 12, 'CARTIGLIO');
    rows.forEach(([yy, lab, val]) => { Tx(tx + 2, yy + 6.5, lab, 1.8); Tx(tx + 2, yy + 1.8, val || '', lab === 'ELABORATO' ? 3 : 2.5); });
    const cols = [['CODICE', i.docCode], ['FASE', i.phase], ['SCALA', d.unit === 'm' ? '1:' + scale : (d.scaleLabel || '–')], ['FORMATO', d.sheet || 'A1'], ['REV.', i.rev], ['DATA', i.date]];
    const cw = tbW / cols.length; cols.forEach(([lab, val], j) => { if (j) L(tx + j * cw, ty + 12, tx + j * cw, ty + tbH - 34, 'CARTIGLIO'); Tx(tx + j * cw + 1.5, ty + tbH - 39, lab, 1.6); Tx(tx + j * cw + 1.5, ty + 15, val || '', j === 0 ? 2 : 2.4); });
    [['REDATTO', 0], ['VERIFICATO', 1], ['APPROVATO', 2]].forEach(([lab, j]) => { if (j) L(tx + j * tbW / 3, ty, tx + j * tbW / 3, ty + 12, 'CARTIGLIO'); Tx(tx + j * tbW / 3 + 1.5, ty + 8.5, lab, 1.6); });
    // stato e note a sinistra del cartiglio
    const nx = ml + 5, nw = SW - m - tbW - nx - 8;
    Tx(nx, ty + tbH - 4, 'NOTE', 2.2, { layer: 'TESTI' });
    const notes = ['Bozza generata dal simulatore FV + BESS: non valida per la costruzione. Da sviluppare e verificare a cura di un tecnico abilitato.'].concat(d.notes || []);
    let ny = ty + tbH - 9; const maxCh = Math.floor(nw / 1.15);
    for (const n of notes) { const words = String(n).split(' '); let line = (notes.indexOf(n) + 1) + '. '; for (const wd of words) { if ((line + wd).length > maxCh) { if (ny > ty + 2) Tx(nx, ny, line, 1.9, { layer: 'TESTI' }); ny -= 3.1; line = '   '; } line += wd + ' '; } if (ny > ty + 2) Tx(nx, ny, line, 1.9, { layer: 'TESTI' }); ny -= 3.6; }
    // legenda (a destra dell'area di disegno o in alto a destra)
    if (d.legend && d.legend.length) {
      const lx = SW - m - side + 4, lh = 6 + d.legend.length * 5.2, ly = SH - m - 5 - lh;
      R(lx, ly, 57, lh, 'CARTIGLIO'); Tx(lx + 2, ly + lh - 4.5, 'LEGENDA', 2.2);
      d.legend.forEach(([layer, text], j) => { const yy = ly + lh - 10 - j * 5.2; L(lx + 2, yy + 1, lx + 12, yy + 1, layer); Tx(lx + 14, yy, text, 1.9, { layer: 'TESTI' }); });
    }
    // particolari a scala propria nella colonna laterale (coordinate locali in metri)
    let dy = SH - m - 8 - (d.legend && d.legend.length ? 6 + d.legend.length * 5.2 + 8 : 0);
    for (const det of d.details || []) {
      const dex = extents(det.ents), kd = 1000 / det.scale, sx0 = SW - m - side + 4, w = dex.w * kd, h = dex.h * kd;
      const top = dy - 6, sy0 = top - h;
      Tx(sx0, top + 1.5, det.title + ' – scala 1:' + det.scale, 2.2, { layer: 'TESTI' });
      const S = (lx, ly) => W(sx0 + (lx - dex.x0) * kd, sy0 + (ly - dex.y0) * kd), f = kd / k;
      for (const e of det.ents) {
        if (e.t === 'line') { const a = S(e.x1, e.y1), b = S(e.x2, e.y2); E.push(Object.assign({}, e, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] })); }
        else if (e.t === 'poly' || e.t === 'fill') E.push(Object.assign({}, e, { pts: e.pts.map(q => S(q[0], q[1])) }));
        else if (e.t === 'circle' || e.t === 'arc') { const c = S(e.x, e.y); E.push(Object.assign({}, e, { x: c[0], y: c[1], r: e.r * f })); }
        else if (e.t === 'text') { const c = S(e.x, e.y); E.push(Object.assign({}, e, { x: c[0], y: c[1], h: e.h * f })); }
      }
      dy = sy0 - 8; void w;
    }
    if (d.north) { const nxx = ml + 16, nyy = SH - m - 20, p = W(nxx, nyy); const r = H(7); E.push({ t: 'circle', x: p[0], y: p[1], r, layer: 'TESTI' }, { t: 'fill', pts: [[p[0], p[1] + r], [p[0] - r * 0.35, p[1] - r * 0.6], [p[0], p[1] - r * 0.25], [p[0] + r * 0.35, p[1] - r * 0.6]], layer: 'TESTI' }, { t: 'text', x: p[0], y: p[1] + r * 1.3, s: 'N', h: H(3.5), layer: 'TESTI', align: 'center' }); }
    return Object.assign({}, d, { scale, T, ents: d.ents.concat(E) });
  }
  // trasformazione mondo → mm di foglio
  const toSheet = (T, x, y) => [(x - T.ox) * T.k + T.ax, (y - T.oy) * T.k + T.ay];

  // ---------- DXF R12 ----------
  function dxfText(s) { let o = ''; for (const ch of String(s)) { const c = ch.codePointAt(0); o += c < 128 || (c >= 0xA0 && c <= 0xFF) ? ch : WIN[ch] ? String.fromCharCode(WIN[ch]) : '\\U+' + c.toString(16).toUpperCase().padStart(4, '0'); } return o; }
  function dxf(d) {
    const g = []; const p = (c, v) => g.push(String(c), String(v));
    const n6 = v => (Math.round(v * 1e6) / 1e6).toString();
    const ex = extents(d.ents), used = [...new Set(d.ents.map(e => e.layer || '0'))];
    p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252');
    p(9, '$INSBASE'); p(10, 0); p(20, 0); p(30, 0); p(9, '$EXTMIN'); p(10, n6(ex.x0)); p(20, n6(ex.y0)); p(30, 0); p(9, '$EXTMAX'); p(10, n6(ex.x1)); p(20, n6(ex.y1)); p(30, 0);
    p(9, '$LTSCALE'); p(40, n6(1 / d.T.k)); p(9, '$TEXTSTYLE'); p(7, 'STANDARD'); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    const LT = [['CONTINUOUS', 'Continua', []], ['DASHED', 'Tratteggiata __ __ __', DASH.DASHED], ['DASHDOT', 'Tratto punto __ . __ .', DASH.DASHDOT]];
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, LT.length);
    for (const [name, desc, pat] of LT) { p(0, 'LTYPE'); p(2, name); p(70, 0); p(3, desc); p(72, 65); p(73, pat.length); p(40, n6(pat.reduce((a, b) => a + b, 0))); pat.forEach((v, i) => p(49, n6(i % 2 ? -v : v))); }
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, used.length + 1);
    p(0, 'LAYER'); p(2, '0'); p(70, 0); p(62, 7); p(6, 'CONTINUOUS');
    for (const l of used) { if (l === '0') continue; const L = LAYERS[l] || [7, 'CONTINUOUS']; p(0, 'LAYER'); p(2, l); p(70, 0); p(62, L[0]); p(6, L[1]); }
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'STYLE'); p(70, 1); p(0, 'STYLE'); p(2, 'STANDARD'); p(70, 0); p(40, 0); p(41, 0.85); p(50, 0); p(71, 0); p(42, 2.5); p(3, 'txt'); p(4, ''); p(0, 'ENDTAB');
    p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    for (const e of d.ents) {
      const l = e.layer || '0';
      if (e.t === 'line') { p(0, 'LINE'); p(8, l); p(10, n6(e.x1)); p(20, n6(e.y1)); p(30, 0); p(11, n6(e.x2)); p(21, n6(e.y2)); p(31, 0); }
      else if (e.t === 'circle') { p(0, 'CIRCLE'); p(8, l); p(10, n6(e.x)); p(20, n6(e.y)); p(30, 0); p(40, n6(e.r)); }
      else if (e.t === 'arc') { p(0, 'ARC'); p(8, l); p(10, n6(e.x)); p(20, n6(e.y)); p(30, 0); p(40, n6(e.r)); p(50, n6(e.a0)); p(51, n6(e.a1)); }
      else if (e.t === 'poly') { p(0, 'POLYLINE'); p(8, l); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, e.closed ? 1 : 0); for (const q of e.pts) { p(0, 'VERTEX'); p(8, l); p(10, n6(q[0])); p(20, n6(q[1])); p(30, 0); } p(0, 'SEQEND'); p(8, l); }
      else if (e.t === 'fill') { const q = e.pts.length === 3 ? [e.pts[0], e.pts[1], e.pts[2], e.pts[2]] : e.pts; p(0, 'SOLID'); p(8, l); [[10, 20, q[0]], [11, 21, q[1]], [12, 22, q[3]], [13, 23, q[2]]].forEach(([a, b, v]) => { p(a, n6(v[0])); p(b, n6(v[1])); }); [30, 31, 32, 33].forEach(c => p(c, 0)); }
      else if (e.t === 'text') {
        const ha = e.align === 'center' ? 1 : e.align === 'right' ? 2 : 0, va = e.valign === 'middle' ? 2 : e.valign === 'top' ? 3 : 0;
        p(0, 'TEXT'); p(8, l); p(10, n6(e.x)); p(20, n6(e.y)); p(30, 0); p(40, n6(e.h)); p(1, dxfText(e.s)); if (e.rot) p(50, n6(e.rot)); p(41, 0.85);
        if (ha || va) { p(72, ha); p(11, n6(e.x)); p(21, n6(e.y)); p(31, 0); if (va) p(73, va); }
      }
    }
    p(0, 'ENDSEC'); p(0, 'EOF');
    const s = g.join('\r\n') + '\r\n', b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
    return b;
  }

  // ---------- PDF e SVG della tavola ----------
  const MM = 72 / 25.4;
  function pdfDrawing(d) {
    const T = d.T, W = T.SW * MM, Hh = T.SH * MM, ops = [], P = (x, y) => { const s = toSheet(T, x, y); return [s[0] * MM, s[1] * MM]; };
    let cur = '';
    const style = l => { const L = LAYERS[l] || [7, 'CONTINUOUS', 0.25], c = ACI[L[0]] || [0, 0, 0], key = l; if (key === cur) return; cur = key; ops.push(`${c.map(v => f2(v / 255)).join(' ')} RG ${c.map(v => f2(v / 255)).join(' ')} rg ${f2(L[2] * MM)} w [${(DASH[L[1]] || []).map(v => f2(v * MM)).join(' ')}] 0 d`); };
    for (const e of d.ents) {
      style(e.layer || '0');
      if (e.t === 'line') { const a = P(e.x1, e.y1), b = P(e.x2, e.y2); ops.push(`${f2(a[0])} ${f2(a[1])} m ${f2(b[0])} ${f2(b[1])} l S`); }
      else if (e.t === 'poly' || e.t === 'fill') { const q = e.pts.map(v => P(v[0], v[1])); ops.push(q.map((v, i) => `${f2(v[0])} ${f2(v[1])} ${i ? 'l' : 'm'}`).join(' ') + (e.t === 'fill' ? ' h f' : e.closed ? ' h S' : ' S')); }
      else if (e.t === 'circle' || e.t === 'arc') {
        const a0 = e.t === 'arc' ? e.a0 : 0, a1 = e.t === 'arc' ? (e.a1 < e.a0 ? e.a1 + 360 : e.a1) : 360, n = Math.max(12, Math.ceil((a1 - a0) / 10));
        const q = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; q.push(P(e.x + e.r * Math.cos(a), e.y + e.r * Math.sin(a))); }
        ops.push(q.map((v, i) => `${f2(v[0])} ${f2(v[1])} ${i ? 'l' : 'm'}`).join(' ') + (e.t === 'circle' ? ' h S' : ' S'));
      } else if (e.t === 'text') {
        // altezza DXF = altezza delle maiuscole (0,718 del corpo)
        const s = win(e.s), size = e.h * T.k * MM / 0.718, w = textW(s, 'F1', size) * 0.85, a = (e.rot || 0) * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
        let dx = e.align === 'center' ? -w / 2 : e.align === 'right' ? -w : 0, dy = e.valign === 'middle' ? -size * 0.36 : e.valign === 'top' ? -size * 0.72 : 0;
        const o = P(e.x, e.y), x = o[0] + dx * c - dy * sn, y = o[1] + dx * sn + dy * c;
        const col = (ACI[(LAYERS[e.layer] || [7])[0]] || [0, 0, 0]).map(v => f2(v / 255)).join(' ');
        ops.push(`BT /F1 ${f2(size)} Tf 85 Tz ${col} rg ${f2(c)} ${f2(sn)} ${f2(-sn)} ${f2(c)} ${f2(x)} ${f2(y)} Tm ${pstr(s)} Tj ET`);
      }
    }
    return pdfFile([{ w: W, h: Hh, ops }], { title: d.code + ' – ' + d.title });
  }
  function svg(d) {
    const T = d.T, P = (x, y) => { const s = toSheet(T, x, y); return [s[0], T.SH - s[1]]; }, o = [];
    const col = l => { const c = ACI[(LAYERS[l] || [7])[0]] || [0, 0, 0]; return `rgb(${c.join(',')})`; };
    const st = l => { const L = LAYERS[l] || [7, 'CONTINUOUS', 0.25]; return `stroke="${col(l)}" stroke-width="${L[2]}" fill="none"${DASH[L[1]] && DASH[L[1]].length ? ` stroke-dasharray="${DASH[L[1]].join(' ')}"` : ''}`; };
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    for (const e of d.ents) {
      if (e.t === 'line') { const a = P(e.x1, e.y1), b = P(e.x2, e.y2); o.push(`<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" ${st(e.layer)}/>`); }
      else if (e.t === 'poly') o.push(`<${e.closed ? 'polygon' : 'polyline'} points="${e.pts.map(v => P(v[0], v[1]).map(f2).join(',')).join(' ')}" ${st(e.layer)}/>`);
      else if (e.t === 'fill') o.push(`<polygon points="${e.pts.map(v => P(v[0], v[1]).map(f2).join(',')).join(' ')}" fill="${col(e.layer)}" stroke="none"/>`);
      else if (e.t === 'circle') { const c = P(e.x, e.y); o.push(`<circle cx="${f2(c[0])}" cy="${f2(c[1])}" r="${f2(e.r * T.k)}" ${st(e.layer)}/>`); }
      else if (e.t === 'arc') { const a0 = e.a0 * Math.PI / 180, a1 = e.a1 * Math.PI / 180, s = P(e.x + e.r * Math.cos(a0), e.y + e.r * Math.sin(a0)), t = P(e.x + e.r * Math.cos(a1), e.y + e.r * Math.sin(a1)), large = ((e.a1 - e.a0 + 360) % 360) > 180 ? 1 : 0; o.push(`<path d="M${f2(s[0])},${f2(s[1])} A${f2(e.r * T.k)},${f2(e.r * T.k)} 0 ${large} 0 ${f2(t[0])},${f2(t[1])}" ${st(e.layer)}/>`); }
      else if (e.t === 'text') { const c = P(e.x, e.y), h = e.h * T.k; o.push(`<text x="${f2(c[0])}" y="${f2(c[1])}" font-size="${f2(h / 0.718)}" font-family="Arial, Helvetica, sans-serif" fill="${col(e.layer)}"${e.align === 'center' ? ' text-anchor="middle"' : e.align === 'right' ? ' text-anchor="end"' : ''}${e.valign === 'middle' ? ' dominant-baseline="central"' : e.valign === 'top' ? ' dominant-baseline="hanging"' : ''}${e.rot ? ` transform="rotate(${f2(-e.rot)} ${f2(c[0])} ${f2(c[1])})"` : ''}>${esc(e.s)}</text>`); }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T.SW} ${T.SH}" class="sheet"><rect width="${T.SW}" height="${T.SH}" fill="#fff"/>${o.join('')}</svg>`;
  }

  return { zip, crc32, utf8, parseMd, inline, docx, pdfReport, sheet, fitScale, dxf, pdfDrawing, svg, extents, LAYERS, SHEETS, win, textW };
});
