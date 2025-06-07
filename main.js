const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let initialDataForRenderer = null;

const isDev = !app.isPackaged;

/**
 * Cria a janela principal do aplicativo.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (initialDataForRenderer && mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('initial-data', initialDataForRenderer);
      initialDataForRenderer = null;
    }
  });
}

/**
 * Chama o script Python do backend com uma ação e dados específicos.
 */
function callPythonBackend(action, dataPayload, callback) {
  let backendProcess;

  if (isDev) {
    const pythonExecutable = 'python';
    const scriptPath = path.join(__dirname, 'backend.py');
    backendProcess = spawn(pythonExecutable, [scriptPath], {
      env: { ...process.env, 'PYTHONIOENCODING': 'utf-8' }
    });
  } else {
    const executablePath = path.join(process.resourcesPath, 'backend.exe');
    backendProcess = spawn(executablePath, [], {
      env: { ...process.env, 'PYTHONIOENCODING': 'utf-8' }
    });
  }

  let fullData = '';
  let errorData = '';

  if (action) {
    const command = { action: action, payload: dataPayload || {} };
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
      callback(null, { message: "Python executou sem output." });
    }
  });

  backendProcess.on('error', (err) => {
    console.error('[main.js] Falha ao iniciar o processo Python:', err);
    if (callback) callback(err, null);
  });
}

// --- Ciclo de Vida do Aplicativo Electron ---

app.whenReady().then(() => {
  createWindow();

  // 2. MUDANÇA IMPORTANTE: Mudamos para 'checkForUpdates'
  // Isto permite-nos controlar o que acontece depois.
  autoUpdater.checkForUpdates();

  callPythonBackend("get_personal_goal", null, (err, data) => {
    if (err) {
      console.error("[main.js] Erro ao chamar backend para dados iniciais:", err.message);
      initialDataForRenderer = { error: `Erro ao carregar dados iniciais: ${err.message}`, success: false };
    } else {
      initialDataForRenderer = data;
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- Comunicação IPC ---

// 3. NOVO: Cria um "ouvinte" para quando o frontend pedir a versão.
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('call-python', async (event, action, data) => {
  return new Promise((resolve, reject) => {
    callPythonBackend(action, data, (err, result) => {
      if (err) {
        console.error(`[main.js] Erro na chamada Python para action ${action}:`, err.message);
        reject({ success: false, message: err.message || "Erro desconhecido na comunicação com o backend." });
      } else {
        resolve(result);
      }
    });
  });
});

// //================================================================//
// //                LOGS DO AUTO-UPDATER                           //
// //================================================================//
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
  console.error('Erro no auto-updater: ' + err);
});
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Velocidade de download: " + Math.round(progressObj.bytesPerSecond / 1024) + " KB/s";
  log_message = log_message + ' - Baixado ' + Math.round(progressObj.percent) + '%';
  log_message = log_message + ' (' + Math.round(progressObj.transferred / 1048576) + "/" + Math.round(progressObj.total / 1048576) + ' MB)';
  console.log(log_message);
});

// 4. MUDANÇA IMPORTANTE: Agora mostramos a nossa própria mensagem.
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
    if (returnValue.response === 0) { // O índice 0 é o primeiro botão: 'Reiniciar Agora'
      autoUpdater.quitAndInstall();
    }
  });
});