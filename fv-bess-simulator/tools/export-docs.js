// Converte i documenti di progetto in Word e PDF.
//   node tools/export-docs.js   ->  docs/word/*.docx, docs/pdf/*.pdf
const fs = require('fs'), path = require('path'), X = require('../js/export.js');
const DOCS = path.join(__dirname, '..', 'docs');
const list = fs.readdirSync(DOCS).filter(f => /\.md$/.test(f)).map(f => path.join(DOCS, f))
  .concat(fs.readdirSync(path.join(DOCS, 'allegati')).filter(f => /\.md$/.test(f)).map(f => path.join(DOCS, 'allegati', f)));
for (const dir of ['word', 'pdf']) fs.mkdirSync(path.join(DOCS, dir), { recursive: true });
for (const file of list) {
  const md = fs.readFileSync(file, 'utf8'), base = path.basename(file, '.md');
  const title = (/^#\s+(.+)$/m.exec(md) || [, base])[1];
  const code = (/\|\s*(FVB-[A-Z]+-\d+)\s*\|/.exec(md) || [, base])[1];
  const meta = { title, left: 'Simulatore FV + BESS · ' + code, right: 'Rev. A' };
  fs.writeFileSync(path.join(DOCS, 'word', base + '.docx'), X.docx(md, meta));
  fs.writeFileSync(path.join(DOCS, 'pdf', base + '.pdf'), X.pdfReport(md, meta));
  console.log(base);
}
