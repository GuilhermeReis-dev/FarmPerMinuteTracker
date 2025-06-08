const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let initialDataForRenderer = null;

// A flag isDev não é mais necessária para o caminho do arquivo, mas é útil para outras coisas
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 800,
    frame: false,
    webPreferences: {
      devTools: true,
      preload: path.join(__dirname, 'preload.js'), // Este caminho é relativo ao __dirname e está correto
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // ======================= ALTERAÇÃO PRINCIPAL =======================
  // Unificamos o caminho. O app sempre vai carregar o index.html de dentro
  // da pasta 'src', tanto em desenvolvimento quanto em produção.
  const htmlPath = path.join(__dirname, 'src', 'index.html');
  mainWindow.loadFile(htmlPath).catch((err) => {
    console.error(`[main.js] Falha ao carregar o arquivo HTML em: ${htmlPath}`, err);
    // Adicione um diálogo de erro para o usuário final, caso o arquivo não seja encontrado
    dialog.showErrorBox('Erro Crítico', `Não foi possível carregar a interface do aplicativo. O arquivo em ${htmlPath} não foi encontrado.`);
  });
  // ===================================================================

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { maximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { maximized: false });
  });

  // Mantenha o DevTools aberto para depuração, mesmo na versão de produção, até ter certeza que tudo funciona
  //mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    Menu.setApplicationMenu(null);
    if (initialDataForRenderer && mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('initial-data', initialDataForRenderer);
      initialDataForRenderer = null;
    }
  });
}

// O resto do seu arquivo main.js continua igual...
// (spawn do python, ipcMain, autoUpdater, etc.)

function callPythonBackend(action, dataPayload, callback) {
  let backendProcess;

  if (isDev) {
    const pythonExecutable = 'python';
    const scriptPath = path.join(__dirname, 'engine', 'backend.py');
    backendProcess = spawn(pythonExecutable, [scriptPath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
  } else {
    // Na versão de produção, o backend.exe está na raiz dos recursos
    const executablePath = path.join(process.resourcesPath, 'backend.exe');
    backendProcess = spawn(executablePath, [], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
  }

  // O restante da função callPythonBackend permanece o mesmo
  let fullData = '';
  let errorData = '';

  if (action) {
    const command = { action, payload: dataPayload || {} };
    try {
      backendProcess.stdin.write(JSON.stringify(command));
      backendProcess.stdin.end();
    } catch (e) {
      console.error('[main.js] Erro ao escrever para stdin do Python:', e);
      if (callback) callback(e, null);
      return;
    }
  } else {
    backendProcess.stdin.end();
  }

  backendProcess.stdout.on('data', (data) => {
    fullData += data.toString();
  });

  backendProcess.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  backendProcess.on('close', (code) => {
    if (errorData.trim()) {
      console.error(`[main.js] Python stderr: "${errorData.trim()}"`);
    }

    if (code === 0 && fullData.trim()) {
      try {
        const jsonData = JSON.parse(fullData.trim());
        if (callback) callback(null, jsonData);
      } catch (error) {
        const parseErrorMsg = `ERRO ao fazer parse do JSON do Python: ${error.message}. Dados brutos: "${fullData.trim()}"`;
        console.error(`[main.js] ${parseErrorMsg}`);
        if (callback) callback(new Error(parseErrorMsg), null);
      }
    } else if (code !== 0) {
      const errorMsg = `Processo Python terminou com erro (código ${code}). Stderr: ${errorData.trim()}`;
      console.error(`[main.js] ${errorMsg}`);
      if (callback) callback(new Error(errorMsg), null);
    } else if (!fullData.trim() && callback) {
      callback(null, { message: 'Python executou sem output.' });
    }
  });

  backendProcess.on('error', (err) => {
    console.error('[main.js] Falha ao iniciar o processo Python:', err);
    if (callback) callback(err, null);
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
  callPythonBackend('get_personal_goal', null, (err, data) => {
    if (err) {
      console.error('[main.js] Erro ao chamar backend para dados iniciais:', err.message);
      initialDataForRenderer = { error: `Erro ao carregar dados iniciais: ${err.message}`, success: false };
    } else {
      initialDataForRenderer = data;
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('call-python', async (event, action, data) => {
  return new Promise((resolve, reject) => {
    callPythonBackend(action, data, (err, result) => {
      if (err) {
        console.error(`[main.js] Erro na chamada Python para action ${action}:`, err.message);
        reject({ success: false, message: err.message || 'Erro desconhecido na comunicação com o backend.' });
      } else {
        resolve(result);
      }
    });
  });
});

autoUpdater.on('checking-for-update', () => {
  console.log('A verificar por atualizações...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Atualização disponível!', info);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Nenhuma atualização disponível.', info);
});

autoUpdater.on('error', (err) => {
  console.error('Erro no auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  const logMessage = `Velocidade de download: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s` +
    ` - Baixado ${Math.round(progressObj.percent)}%` +
    ` (${Math.round(progressObj.transferred / 1048576)}/${Math.round(progressObj.total / 1048576)} MB)`;
  console.log(logMessage);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Atualização descarregada.', info);
  const dialogOpts = {
    type: 'info',
    buttons: ['Reiniciar Agora', 'Mais Tarde'],
    title: 'Atualização do Aplicativo',
    message: process.platform === 'win32' ? info.releaseName : info.releaseNotes,
    detail: 'Uma nova versão foi descarregada. Reinicie o aplicativo para aplicar as atualizações.'
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
