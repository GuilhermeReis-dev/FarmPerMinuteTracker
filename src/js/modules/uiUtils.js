// src/js/modules/uiUtils.js

/**
 * Mostra uma mensagem flutuante de aviso ou erro.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de mensagem ('warning', 'error', 'success').
 * @param {number} duration - A duração em milissegundos que a mensagem ficará visível.
 */
export function showFloatingWarning(message, type = 'warning', duration = 3000) {
    const floatingWarningMessage = document.getElementById('floating-warning-message');
    if (!floatingWarningMessage) {
        console.error("Elemento 'floating-warning-message' não encontrado no DOM.");
        return;
    }

    floatingWarningMessage.textContent = message;
    // Garante que remove classes antigas antes de adicionar a nova.
    floatingWarningMessage.className = 'floating-message'; // Reset
    floatingWarningMessage.classList.add(`${type}-message`);

    floatingWarningMessage.style.opacity = '1';
    floatingWarningMessage.style.display = 'block';

    setTimeout(() => {
        floatingWarningMessage.style.opacity = '0';
        setTimeout(() => {
            floatingWarningMessage.style.display = 'none';
        }, 500); // Tempo para a transição de opacidade completar
    }, duration);
}

/**
 * Calcula o Farm Per Minute (FPM).
 * @param {number} farm - A quantidade total de farm.
 * @param {number} totalSeconds - O tempo total em segundos.
 * @returns {number} O FPM calculado, ou 0 se os inputs forem inválidos.
 */
export function calculateFPM(farm, totalSeconds) {
    if (totalSeconds <= 0 || farm < 0) {
        return 0;
    }
    return (farm / totalSeconds) * 60;
}

/**
 * Mostra uma página de conteúdo específica e atualiza o estado ativo do botão de navegação.
 * @param {string} pageIdToShow - O ID da página de conteúdo a ser mostrada (sem o sufixo '-content').
 * @param {NodeListOf<Element>} pageContents - Uma NodeList de todos os elementos de conteúdo da página.
 * @param {NodeListOf<Element>} navButtons - Uma NodeList de todos os botões de navegação.
 */
export function showPage(pageIdToShow, pageContents, navButtons) {
    pageContents.forEach(content => {
        if (content) {
            content.style.display = 'none';
        }
    });

    navButtons.forEach(button => {
        button.classList.remove('active');
    });

    const targetPage = document.getElementById(`${pageIdToShow}-content`);
    const targetButton = document.querySelector(`#nav-bar-main button[data-page="${pageIdToShow}"]`);

    if (targetPage) {
        targetPage.style.display = 'block';
    } else {
        console.warn(`Página com ID '${pageIdToShow}-content' não encontrada.`);
    }

    if (targetButton) {
        targetButton.classList.add('active');
    } else {
        console.warn(`Botão de navegação para a página '${pageIdToShow}' não encontrado.`);
    }
}