// Funzioni per la copia di sicurezza (cartella Dropbox). Nessuna dipendenza da Electron: si possono provare da sole.
const fs = require('fs');
const path = require('path');

const RE_DATI = /^backup-\d{4}-\d{2}-\d{2}(_[a-z0-9-]+)?\.json$/;
const RE_GIORNO = /^backup-\d{4}-\d{2}-\d{2}\.json$/;
const nomeSicuro = s => String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
const fidOk = f => /^[A-Za-z0-9_-]{1,64}$/.test(String(f));

// cartella Dropbox del computer (legge le impostazioni che Dropbox stesso salva)
function trovaDropbox(env = process.env) {
  const cand = [];
  if (env.APPDATA) cand.push(path.join(env.APPDATA, 'Dropbox', 'info.json'));
  if (env.LOCALAPPDATA) cand.push(path.join(env.LOCALAPPDATA, 'Dropbox', 'info.json'));
  if (env.HOME) cand.push(path.join(env.HOME, '.dropbox', 'info.json'));
  for (const f of cand) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      for (const k of ['personal', 'business']) if (j[k] && j[k].path && fs.existsSync(j[k].path)) return j[k].path;
    } catch (e) { /* prossimo */ }
  }
  return null;
}
const dentro = (dir, base) => { if (!dir || !base) return false; const r = path.relative(path.resolve(base), path.resolve(dir)); return !r.startsWith('..') && !path.isAbsolute(r); };

function cfgLeggi(userData) { try { return JSON.parse(fs.readFileSync(path.join(userData, 'backup.json'), 'utf8')) || {}; } catch (e) { return {}; } }
function cfgScrivi(userData, c) { fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(path.join(userData, 'backup.json'), JSON.stringify(c), 'utf8'); }

// cartella in uso: quella scelta, altrimenti Dropbox\GC-GRE.MO-Backup, altrimenti Documenti\GC-GRE.MO\Copie
function cartella(userData, documents, env = process.env) {
  const c = cfgLeggi(userData), db = trovaDropbox(env);
  const dir = c.dir || (db ? path.join(db, 'GC-GRE.MO-Backup') : path.join(documents, 'GC-GRE.MO', 'Copie'));
  return { dir, dropbox: !!db && dentro(dir, db), dropboxTrovato: !!db, scelta: !!c.dir, auto: c.auto !== false, keep: c.keep || 60 };
}

const dDati = dir => path.join(dir, 'dati'), dAll = dir => path.join(dir, 'allegati');
function prepara(dir) {
  fs.mkdirSync(dDati(dir), { recursive: true }); fs.mkdirSync(dAll(dir), { recursive: true });
  const l = path.join(dir, 'LEGGIMI.txt');
  if (!fs.existsSync(l)) fs.writeFileSync(l, 'Copie di sicurezza di GC - GRE.MO\r\n\r\n- dati\\      un file al giorno con tutti i dati del programma (commesse, magazzino, utenti, impostazioni...)\r\n- allegati\\  i PDF e i file allegati alle schede (ognuno copiato una sola volta)\r\n\r\nPer ripristinare: nel programma, Impostazioni > Copie di sicurezza > Ripristina.\r\nNon rinominare e non cancellare i file di questa cartella.\r\n', 'utf8');
}
const scrittura = (file, dati) => { const t = file + '.tmp'; fs.writeFileSync(t, dati); fs.renameSync(t, file); };

// tra gli id indicati, quali allegati non sono ancora nella cartella
function mancanti(dir, fids) {
  let have = new Set();
  try { have = new Set(fs.readdirSync(dAll(dir)).filter(f => !f.endsWith('.tmp')).map(f => f.split('__')[0])); } catch (e) { }
  return fids.filter(f => fidOk(f) && !have.has(f));
}
function scriviAllegato(dir, fid, nome, buf) {
  if (!fidOk(fid)) throw new Error('id allegato non valido');
  prepara(dir);
  scrittura(path.join(dAll(dir), fid + '__' + nomeSicuro(nome)), Buffer.from(buf));
}
function scriviDati(dir, json, tag, keep, quando = new Date()) {
  prepara(dir);
  const p = n => String(n).padStart(2, '0');
  const nome = `backup-${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}${tag ? '_' + String(tag).replace(/[^a-z0-9-]/gi, '').toLowerCase() : ''}.json`;
  scrittura(path.join(dDati(dir), nome), Buffer.from(json, 'utf8'));
  const tutti = fs.readdirSync(dDati(dir)).filter(f => RE_GIORNO.test(f)).sort();
  tutti.slice(0, Math.max(0, tutti.length - (keep || 60))).forEach(f => { try { fs.unlinkSync(path.join(dDati(dir), f)); } catch (e) { } });
  return nome;
}
function lista(dir) {
  try {
    return fs.readdirSync(dDati(dir)).filter(f => RE_DATI.test(f)).sort().reverse().map(f => { const s = fs.statSync(path.join(dDati(dir), f)); return { nome: f, size: s.size, data: s.mtime.toISOString() }; });
  } catch (e) { return []; }
}
function leggiDati(dir, nome) { if (!RE_DATI.test(nome)) throw new Error('nome non valido'); return fs.readFileSync(path.join(dDati(dir), nome), 'utf8'); }
function leggiAllegato(dir, fid) {
  if (!fidOk(fid)) throw new Error('id non valido');
  const f = fs.readdirSync(dAll(dir)).find(x => x.startsWith(fid + '__') && !x.endsWith('.tmp'));
  if (!f) return null;
  return fs.readFileSync(path.join(dAll(dir), f));
}
module.exports = { trovaDropbox, dentro, cfgLeggi, cfgScrivi, cartella, prepara, mancanti, scriviAllegato, scriviDati, lista, leggiDati, leggiAllegato, nomeSicuro };
