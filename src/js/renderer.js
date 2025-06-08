import { showPage } from './modules/uiUtils.js';
import { initGoalsManager, onShowGoalsManager } from './modules/goalsManager.js';
import { initGameplayHandler, onShowGameplayHandler } from './modules/gameplayHandler.js';
import { initHistoryHandler, onShowHistoryHandler } from './modules/historyHandler.js';
import { initStatsHandler, onShowStatsHandler } from './modules/statsHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('#nav-bar-main button');
    const pageContents = document.querySelectorAll('.page-content');
    const pythonErrorDisplay = document.getElementById('python-error-display');
    const tutorialModal = document.getElementById('tutorial-modal');
    const helpIconButton = document.getElementById('help-icon-button');

    const closeModalButton = document.querySelector('#tutorial-modal .close-modal-button');

    // === CÓDIGO PARA OS CONTROLES DA BARRA DE TÍTULO CUSTOMIZADA (CORRIGIDO COM SVG) ===
    const minimizeButton = document.getElementById('minimize-btn');
    const maximizeButton = document.getElementById('maximize-btn');
    const closeButton = document.getElementById('close-btn');

    if (minimizeButton) {
        minimizeButton.addEventListener('click', () => {
            window.electronAPI.send('minimize-window');
        });
    }

    if (maximizeButton) {
        maximizeButton.addEventListener('click', () => {
            window.electronAPI.send('maximize-window');
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            window.electronAPI.send('close-window');
        });
    }

    // Ouve a mudança de estado da janela para trocar o ícone de maximizar/restaurar
    if (window.electronAPI && typeof window.electronAPI.onWindowStateChange === 'function' && maximizeButton) {
        const maximizeIcon = maximizeButton.querySelector('.icon-maximize');
        const restoreIcon = maximizeButton.querySelector('.icon-restore');

        window.electronAPI.onWindowStateChange(state => {
            if (state.maximized) {
                maximizeIcon.style.display = 'none';
                restoreIcon.style.display = 'block';
            } else {
                maximizeIcon.style.display = 'block';
                restoreIcon.style.display = 'none';
            }
        });
    }
    // =======================================================================


    // CÓDIGO PARA EXIBIR A VERSÃO
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
        window.electronAPI.getAppVersion().then(version => {
            versionElement.innerText = `v${version}`;
        });
    }

    let isFirstLoad = true;

    // 1. Define a página inicial e a exibe.
    const initialPageId = 'GameplayPage';
    showPage(initialPageId, pageContents, navButtons);

    // 2. Inicializa todos os módulos de página.
    try {
        initGoalsManager();
        initGameplayHandler();
        initHistoryHandler();
        initStatsHandler();
    } catch (error) {
        console.error("Erro durante a inicialização dos módulos:", error);
        if (pythonErrorDisplay) {
            pythonErrorDisplay.textContent = `Erro crítico na inicialização: ${error.message}`;
            pythonErrorDisplay.style.display = 'block';
        }
    }

    // 3. Adiciona os eventos de clique para a navegação entre páginas.
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const pageId = e.target.getAttribute('data-page');
            if (!pageId) return;

            showPage(pageId, pageContents, navButtons);

            if (pageId === 'GerenciarMetasPage') onShowGoalsManager();
            else if (pageId === 'GameplayPage') onShowGameplayHandler();
            else if (pageId === 'HistoricoPartidasPage') onShowHistoryHandler();
            else if (pageId === 'EstatisticasPage') onShowStatsHandler();
        });
    });

    // 4. Lógica para o modal de tutorial/ajuda.
    if (helpIconButton && tutorialModal) {
        helpIconButton.addEventListener('click', () => {
            tutorialModal.style.display = 'block';
        });
    }
    if (closeModalButton && tutorialModal) {
        closeModalButton.addEventListener('click', () => {
            tutorialModal.style.display = 'none';
        });
    }
    if (tutorialModal) {
        window.addEventListener('click', (event) => {
            if (event.target === tutorialModal) {
                tutorialModal.style.display = 'none';
            }
        });
    }

    // 5. Lida com o recebimento de dados iniciais do backend.
    if (window.electronAPI && typeof window.electronAPI.onInitialData === 'function') {
        window.electronAPI.onInitialData((data) => {
            if (isFirstLoad) {
                if (initialPageId === 'GameplayPage') onShowGameplayHandler();

                const isFreshInstall = (data && data.exists && data.nome_meta === "Minha Meta Pessoal" && data.tempo_segundos === 0 && data.farm_referencia === 0) || (data && data.exists === false);
                if (isFreshInstall && tutorialModal) {
                    tutorialModal.style.display = 'block';
                }
                isFirstLoad = false;
            }
        });
    } else {
        console.error("[renderer.js] Erro CRÍTICO: electronAPI.onInitialData não está disponível.");
        if (initialPageId === 'GameplayPage') onShowGameplayHandler();
        isFirstLoad = false;
    }
});
