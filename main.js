const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const bk = require('./backup-lib');

// una sola istanza del programma
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win;
function creaFinestra() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 650,
    title: 'GC - GRE.MO', backgroundColor: '#ffffff', show: false,
    icon: fs.existsSync(path.join(__dirname, 'icon.ico')) ? path.join(__dirname, 'icon.ico') : undefined,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // PDF e file aperti dal programma: nuova finestra interna; link esterni nel browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1100, height: 850 } };
  });
  // F12 / Ctrl+Maiusc+I apre gli strumenti per sviluppatori (utile per assistenza)
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && i.key.toLowerCase() === 'i'))) win.webContents.toggleDevTools();
  });
}

// copia di sicurezza automatica: una al giorno in Documenti\GC-GRE.MO\Backup (ultime 60 copie)
ipcMain.on('backup', (_e, json) => {
  try {
    if (!json) return;
    const dir = path.join(app.getPath('documents'), 'GC-GRE.MO', 'Backup');
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const nome = `backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
    fs.writeFileSync(path.join(dir, nome), json, 'utf8');
    const tutti = fs.readdirSync(dir).filter(f => /^backup-.*\.json$/.test(f)).sort();
    tutti.slice(0, Math.max(0, tutti.length - 60)).forEach(f => fs.unlinkSync(path.join(dir, f)));
  } catch (err) { console.error('Backup non riuscito', err); }
});
ipcMain.handle('cartella-backup', () => {
  const dir = path.join(app.getPath('documents'), 'GC-GRE.MO', 'Backup');
  fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
  return dir;
});


// ---- copia di sicurezza completa (dati + allegati) in una cartella, di norma dentro Dropbox
const bkInfo = () => bk.cartella(app.getPath('userData'), app.getPath('documents'));
ipcMain.handle('bk-info', () => { const i = bkInfo(); return Object.assign(i, { copie: bk.lista(i.dir) }); });
ipcMain.handle('bk-scegli', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Scegli la cartella delle copie di sicurezza (meglio dentro Dropbox)', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const c = bk.cfgLeggi(app.getPath('userData')); c.dir = r.filePaths[0];
  bk.cfgScrivi(app.getPath('userData'), c);
  const i = bkInfo(); return Object.assign(i, { copie: bk.lista(i.dir) });
});
ipcMain.handle('bk-opzioni', (_e, o) => {
  const c = bk.cfgLeggi(app.getPath('userData'));
  if (o && typeof o.auto === 'boolean') c.auto = o.auto;
  if (o && [30, 60, 90, 180].includes(o.keep)) c.keep = o.keep;
  bk.cfgScrivi(app.getPath('userData'), c); return true;
});
ipcMain.handle('bk-mancanti', (_e, fids) => { const i = bkInfo(); bk.prepara(i.dir); return bk.mancanti(i.dir, fids || []); });
ipcMain.handle('bk-allegato', (_e, fid, nome, buf) => { bk.scriviAllegato(bkInfo().dir, fid, nome, buf); return true; });
ipcMain.handle('bk-dati', (_e, json, tag) => { const i = bkInfo(); return bk.scriviDati(i.dir, json, tag, i.keep); });
ipcMain.handle('bk-leggi', (_e, nome) => bk.leggiDati(bkInfo().dir, nome));
ipcMain.handle('bk-leggi-allegato', (_e, fid) => { const b = bk.leggiAllegato(bkInfo().dir, fid); return b ? new Uint8Array(b) : null; });
ipcMain.handle('bk-apri', () => { const i = bkInfo(); bk.prepara(i.dir); shell.openPath(i.dir); return i.dir; });

// ---- aggiornamenti automatici (da GitHub Releases): avvisa e chiede conferma
let autoUpdater = null, manuale = false;
function avviaAggiornamenti() {
  if (!app.isPackaged) return;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', async info => {
    const r = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Scarica e installa', 'Più tardi'], defaultId: 0, cancelId: 1,
      title: 'Aggiornamento disponibile', message: 'È disponibile la versione ' + info.version + ' di GC - GRE.MO.',
      detail: 'Versione attuale: ' + app.getVersion() + '. I tuoi dati non vengono toccati.'
    });
    if (r.response === 0) { win.setProgressBar(2); autoUpdater.downloadUpdate(); }
    manuale = false;
  });
  autoUpdater.on('update-not-available', () => {
    if (manuale) dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Aggiornamenti', message: 'Il programma è aggiornato all’ultima versione (' + app.getVersion() + ').' });
    manuale = false;
  });
  autoUpdater.on('download-progress', p => { if (win) win.setProgressBar(p.percent / 100); });
  autoUpdater.on('update-downloaded', async () => {
    if (win) win.setProgressBar(-1);
    const r = await dialog.showMessageBox(win, {
      type: 'question', buttons: ['Riavvia e installa ora', 'Alla chiusura'], defaultId: 0, cancelId: 1,
      title: 'Aggiornamento pronto', message: 'L’aggiornamento è stato scaricato.',
      detail: 'Salva eventuali modifiche in corso: il programma si riavvia in pochi secondi.'
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', err => {
    if (win) win.setProgressBar(-1);
    if (manuale) dialog.showMessageBox(win, { type: 'warning', buttons: ['OK'], title: 'Aggiornamenti', message: 'Impossibile controllare gli aggiornamenti.', detail: 'Verifica la connessione a internet e riprova.\n' + (err && err.message ? err.message : '') });
    manuale = false;
  });
  const controlla = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(controlla, 8000);
  setInterval(controlla, 4 * 60 * 60 * 1000);
}
ipcMain.handle('versione', () => app.getVersion());
ipcMain.handle('cerca-aggiornamenti', () => {
  if (!autoUpdater) { dialog.showMessageBox(win, { type: 'info', buttons: ['OK'], title: 'Aggiornamenti', message: 'Controllo aggiornamenti disponibile solo nel programma installato.' }); return; }
  manuale = true; autoUpdater.checkForUpdates().catch(() => {});
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { creaFinestra(); avviaAggiornamenti(); });
app.on('window-all-closed', () => app.quit());
