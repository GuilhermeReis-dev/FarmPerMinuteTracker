const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Funções existentes
  onInitialData: (callback) => {
    const listener = (_event, value) => {
      console.log('[preload.js] Evento "initial-data" recebido no preload com valor:', value); // Log adicionado
      callback(value);
    };
    ipcRenderer.on('initial-data', listener);
  },
  onPythonError: (callback) => {
    const listener = (_event, value) => {
      console.log('[preload.js] Evento "python-error" recebido no preload com valor:', value); // Log adicionado
      callback(value);
    };
    ipcRenderer.on('python-error', listener);
  },
  invokePython: (action, data) => ipcRenderer.invoke('call-python', action, data),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ATUALIZADO: Função para enviar eventos para o processo principal
  send: (channel) => {
    // Lista de canais permitidos para segurança
    const validChannels = ['minimize-window', 'maximize-window', 'close-window'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel);
    }
  },

  // ADICIONADO: Função para receber o estado da janela (maximizada/restaurada)
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, value) => callback(value));
  }
});

console.log("Preload script carregado e API 'electronAPI' exposta.");
