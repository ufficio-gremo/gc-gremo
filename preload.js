const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  backup: json => ipcRenderer.send('backup', json),
  apriCartellaBackup: () => ipcRenderer.invoke('cartella-backup'),
  versione: () => ipcRenderer.invoke('versione'),
  cercaAggiornamenti: () => ipcRenderer.invoke('cerca-aggiornamenti')
});
