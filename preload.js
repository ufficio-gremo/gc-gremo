const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  backup: json => ipcRenderer.send('backup', json),
  apriCartellaBackup: () => ipcRenderer.invoke('cartella-backup'),
  bk: {
    info: () => ipcRenderer.invoke('bk-info'),
    scegli: () => ipcRenderer.invoke('bk-scegli'),
    opzioni: o => ipcRenderer.invoke('bk-opzioni', o),
    mancanti: f => ipcRenderer.invoke('bk-mancanti', f),
    allegato: (fid, nome, buf) => ipcRenderer.invoke('bk-allegato', fid, nome, buf),
    dati: (json, tag) => ipcRenderer.invoke('bk-dati', json, tag),
    leggi: nome => ipcRenderer.invoke('bk-leggi', nome),
    leggiAllegato: fid => ipcRenderer.invoke('bk-leggi-allegato', fid),
    apri: () => ipcRenderer.invoke('bk-apri')
  },
  versione: () => ipcRenderer.invoke('versione'),
  cercaAggiornamenti: () => ipcRenderer.invoke('cerca-aggiornamenti')
});
