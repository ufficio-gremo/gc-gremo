// Prepara app/index.html: scarica una volta le librerie (PDF e font) in app/vendor,
// così il programma funziona anche senza internet. Se il download non riesce,
// resta il collegamento online e il programma funziona comunque con internet.
const fs = require('fs'), path = require('path'), https = require('https');
const base = path.join(__dirname, '..', 'app'), vendor = path.join(base, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const scarica = (url, buffer) => new Promise((ok, ko) => {
  https.get(url, { headers: { 'User-Agent': UA } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return scarica(r.headers.location, buffer).then(ok, ko);
    if (r.statusCode !== 200) return ko(new Error(url + ' -> ' + r.statusCode));
    const c = []; r.on('data', d => c.push(d)); r.on('end', () => ok(buffer ? Buffer.concat(c) : Buffer.concat(c).toString('utf8')));
  }).on('error', ko);
});

(async () => {
  let html = fs.readFileSync(path.join(base, 'gestionale.html'), 'utf8');
  const libs = [
    ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf.umd.min.js'],
    ['https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'jspdf.plugin.autotable.min.js'],
    ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdf.min.js'],
    ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', 'pdf.worker.min.js']
  ];
  for (const [url, nome] of libs) {
    const f = path.join(vendor, nome);
    try {
      if (!fs.existsSync(f)) fs.writeFileSync(f, await scarica(url, true));
      html = html.split(url).join('vendor/' + nome);
      console.log('ok   ' + nome);
    } catch (e) { console.warn('ATTENZIONE: ' + nome + ' non scaricato (' + e.message + '): resta il collegamento online'); }
  }
  // font
  const fontUrl = (html.match(/https:\/\/fonts\.googleapis\.com\/css2[^"']+/) || [])[0];
  if (fontUrl) {
    try {
      const cssFile = path.join(vendor, 'fonts.css');
      if (!fs.existsSync(cssFile)) {
        let css = await scarica(fontUrl.replace(/&amp;/g, '&'), false);
        const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+/g) || [])];
        let n = 0;
        for (const u of urls) { const nome = 'font' + (n++) + '.woff2'; fs.writeFileSync(path.join(vendor, nome), await scarica(u, true)); css = css.split(u).join(nome); }
        fs.writeFileSync(cssFile, css);
      }
      html = html.split(fontUrl).join('vendor/fonts.css');
      console.log('ok   font');
    } catch (e) { console.warn('ATTENZIONE: font non scaricati (' + e.message + ')'); }
  }
  fs.writeFileSync(path.join(base, 'index.html'), html);
  console.log('Pronto: app/index.html');
})();
