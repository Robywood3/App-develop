// Formattazione numerica con convenzioni italiane (virgola decimale, punto per le migliaia).

const cache = new Map();

function formatter(d) {
  let f = cache.get(d);
  if (!f) {
    f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
    cache.set(d, f);
  }
  return f;
}

export function fmt(v, d = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const out = formatter(d).format(v);
  return out === '-0' || /^-0[,]0*$/.test(out) ? out.slice(1) : out;
}

export function fmtSigned(v, d = 1) {
  if (!Number.isFinite(v)) return '—';
  return (v > 0 ? '+' : '') + fmt(v, d);
}
