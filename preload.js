const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onInitialData: (callback) => {
    const listener = (_event, value) => {
      console.log('[preload.js] Evento "initial-data" recebido no preload com valor:', value); // Log adicionado
      callback(value);
    };
    ipcRenderer.on('initial-data', listener);
    // Opcional: retornar uma função para remover o listener se não for mais necessário
    // return () => { ipcRenderer.removeListener('initial-data', listener); };
  },
  onPythonError: (callback) => {
    const listener = (_event, value) => {
      console.log('[preload.js] Evento "python-error" recebido no preload com valor:', value); // Log adicionado
      callback(value);
    };
    ipcRenderer.on('python-error', listener);
    // return () => { ipcRenderer.removeListener('python-error', listener); };
  },
  invokePython: (action, data) => ipcRenderer.invoke('call-python', action, data)
});

console.log("Preload script carregado e API 'electronAPI' exposta com onInitialData, onPythonError, invokePython.");