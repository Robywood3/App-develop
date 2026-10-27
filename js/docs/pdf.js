// Scrittore PDF minimale, senza dipendenze: pagine con grafica vettoriale e testo
// nei font standard Helvetica / Helvetica-Bold (codifica WinAnsi).

// Larghezze Helvetica (unità 1/1000 em) per i caratteri 32..126.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELV_B = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Caratteri non presenti in WinAnsi sostituiti con equivalenti leggibili.
const SUBST = {
  '₂': '2', '₃': '3', '₄': '4', 'Δ': 'D', 'η': 'eta', 'β': 'beta', 'φ': 'phi', '≥': '>=', '≤': '<=',
  '→': '->', '←': '<-', '↑': '^', '↓': 'v', '−': '-', '≈': '~', '√': 'rad', 'Ω': 'ohm', '∅': 'Ø', '⌀': 'Ø',
};
// Caratteri WinAnsi oltre ASCII (codice -> larghezza Helvetica)
const WIN = {
  '€': [0x80, 556], '‚': [0x82, 222], '„': [0x84, 333], '…': [0x85, 1000], '‘': [0x91, 222], '’': [0x92, 222],
  '“': [0x93, 333], '”': [0x94, 333], '•': [0x95, 350], '–': [0x96, 556], '—': [0x97, 1000], '°': [0xb0, 400],
  '±': [0xb1, 584], '²': [0xb2, 333], '³': [0xb3, 333], 'µ': [0xb5, 556], '·': [0xb7, 278], '¹': [0xb9, 333],
  '½': [0xbd, 834], '×': [0xd7, 584], 'Ø': [0xd8, 778], 'ø': [0xf8, 611], '÷': [0xf7, 584],
  'À': [0xc0, 667], 'È': [0xc8, 667], 'É': [0xc9, 667], 'Ì': [0xcc, 278], 'Ò': [0xd2, 778], 'Ù': [0xd9, 722],
  'à': [0xe0, 556], 'á': [0xe1, 556], 'è': [0xe8, 556], 'é': [0xe9, 556], 'ì': [0xec, 278], 'í': [0xed, 278],
  'ò': [0xf2, 556], 'ó': [0xf3, 556], 'ù': [0xf9, 556], 'ú': [0xfa, 556], 'ü': [0xfc, 556], 'ö': [0xf6, 556], 'ä': [0xe4, 556],
};

export function normalizeText(s) {
  let out = '';
  for (const ch of String(s)) out += SUBST[ch] ?? ch;
  return out;
}

/** Larghezza del testo in unità di `size` (stessa unità della dimensione del font). */
export function textWidth(s, size, bold = false) {
  const tbl = bold ? HELV_B : HELV;
  let w = 0;
  for (const ch of normalizeText(s)) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 126) w += tbl[c - 32];
    else if (WIN[ch]) w += WIN[ch][1] * (bold ? 1.05 : 1);
    else w += 556;
  }
  return (w * size) / 1000;
}

// Stringa PDF letterale con escape ottali per i caratteri non ASCII.
function pdfString(s) {
  let out = '(';
  for (const ch of normalizeText(s)) {
    const c = ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (c >= 32 && c <= 126) out += ch;
    else {
      const code = WIN[ch] ? WIN[ch][0] : 63; // '?'
      out += '\\' + code.toString(8).padStart(3, '0');
    }
  }
  return out + ')';
}

const n = (v) => (Math.round(v * 1000) / 1000).toString();

function rgb(hex) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => n(parseInt(f.slice(i, i + 2), 16) / 255)).join(' ');
}

/**
 * Converte la lista di primitive di un foglio (unità mm, asse y verso il basso)
 * in un content stream PDF.
 */
export function sheetToContent(sheet) {
  const k = 72 / 25.4;
  const ops = [`q ${n(k)} 0 0 ${n(-k)} 0 ${n(sheet.h * k)} cm 1 J 1 j`];
  const style = (st) => {
    const o = [];
    if (st.s) o.push(`${rgb(st.s)} RG`, `${n(st.w ?? 0.25)} w`, st.d ? `[${st.d.map(n).join(' ')}] 0 d` : '[] 0 d');
    if (st.f) o.push(`${rgb(st.f)} rg`);
    return o.join(' ');
  };
  const paint = (st, closed) => (st.f && st.s ? (closed ? 'b' : 'B') : st.f ? 'f' : closed ? 's' : 'S');
  for (const p of sheet.items) {
    switch (p.t) {
      case 'path': {
        if (!p.st.s && !p.st.f) break;
        let d = `${n(p.pts[0][0])} ${n(p.pts[0][1])} m`;
        for (let i = 1; i < p.pts.length; i++) d += ` ${n(p.pts[i][0])} ${n(p.pts[i][1])} l`;
        ops.push(`${style(p.st)} ${d} ${paint(p.st, p.closed)}`);
        break;
      }
      case 'circle': {
        const { cx, cy, r } = p;
        const c = 0.5523 * r;
        const d = `${n(cx + r)} ${n(cy)} m ${n(cx + r)} ${n(cy + c)} ${n(cx + c)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c `
          + `${n(cx - c)} ${n(cy + r)} ${n(cx - r)} ${n(cy + c)} ${n(cx - r)} ${n(cy)} c `
          + `${n(cx - r)} ${n(cy - c)} ${n(cx - c)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c `
          + `${n(cx + c)} ${n(cy - r)} ${n(cx + r)} ${n(cy - c)} ${n(cx + r)} ${n(cy)} c`;
        ops.push(`${style(p.st)} ${d} ${paint(p.st, true)}`);
        break;
      }
      case 'text': {
        const w = textWidth(p.s, p.size, p.bold);
        const dx = p.anchor === 'middle' ? -w / 2 : p.anchor === 'end' ? -w : 0;
        const a = ((p.rot || 0) * Math.PI) / 180;
        const ca = Math.cos(a), sa = Math.sin(a);
        const x = p.x + dx * ca, y = p.y + dx * sa;
        ops.push(`BT ${rgb(p.color || '#000')} rg /${p.bold ? 'F2' : 'F1'} ${n(p.size)} Tf ${n(ca)} ${n(sa)} ${n(sa)} ${n(-ca)} ${n(x)} ${n(y)} Tm ${pdfString(p.s)} Tj ET`);
        break;
      }
      default: break;
    }
  }
  ops.push('Q');
  return ops.join('\n');
}

/** Assembla un documento PDF da un elenco di fogli. Restituisce Uint8Array. */
export function buildPdf(sheets, info = {}) {
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(null);
  const pages = add(null);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  const k = 72 / 25.4;
  for (const sh of sheets) {
    const content = sheetToContent(sh);
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pg = add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${n(sh.w * k)} ${n(sh.h * k)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`);
    kids.push(`${pg} 0 R`);
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  const date = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  const pdfDate = `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  const infoObj = add(`<< /Title ${pdfString(info.title || 'Documento')} /Author ${pdfString(info.author || '')} /Subject ${pdfString(info.subject || '')} /Producer (Simulatore Ciclo Combinato) /CreationDate (${pdfDate}) >>`);

  // intestazione con 4 byte binari; il resto è ASCII, quindi offset = lunghezza stringa
  const header = '%PDF-1.4\n%';
  const offsets = [];
  let pos = header.length + 5;
  let out = '';
  for (let i = 0; i < objs.length; i++) {
    offsets.push(pos);
    const s = `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    out += s;
    pos += s.length;
  }
  const xrefPos = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  const body = out + xref + trailer;
  const bytes = new Uint8Array(pos - out.length + body.length);
  let j = 0;
  for (const ch of header) bytes[j++] = ch.charCodeAt(0);
  for (const b of [0xe2, 0xe3, 0xcf, 0xd3, 0x0a]) bytes[j++] = b;
  for (let i = 0; i < body.length; i++) bytes[j++] = body.charCodeAt(i) & 0xff;
  return bytes;
}
