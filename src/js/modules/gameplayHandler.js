// src/js/modules/gameplayHandler.js

import { showFloatingWarning, calculateFPM } from './uiUtils.js';

// --- Elementos DOM e Variáveis de Estado para "Gameplay" ---
let timerDisplay, startTimerButton, pauseTimerButton, finalizeTimerButton, resetTimerButton;
let displayModeSelect, minhaMetaLabel, minhaMetaFpmGameplay, outroMetaLabel, outroPerfilRefSelect;
let outroPerfilFpmGameplay, seuDesempenhoLabel, seuDesempenhoSelect, seuDesempenhoFpmGameplay;
let postGameFormArea, finalTimeMinInput, finalTimeSecInput, finalFarmInput, finalCharacterInput;
let finalDifficultySelect, fpmPartidaAtual, registerMatchButton, cancelContinueButton, postGameStatus;

let metasReferenciaSection;

let timerInterval = null;
let elapsedSeconds = 0;
let isTimerRunning = false;
const MINION_ARRIVAL_DELAY = 33;

let fpmMinhaMetaRaw = null;
let fpmOutroPerfilRaw = null;
let outrosPerfisRefDataGameplay = {};
let personalFpmStatsOptionsGameplay = {};

// --- Funções do Cronômetro ---
function updateTimerDisplayDOM() {
    if (!timerDisplay) return;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (displayModeSelect && displayModeSelect.value === 'dynamic') {
        updateDynamicFarmTargets();
    }
}

function runTimer() {
    elapsedSeconds++;
    updateTimerDisplayDOM();
    if (isTimerRunning) {
        timerInterval = setTimeout(runTimer, 1000);
    }
}

function startTimer() {
    if (!isTimerRunning) {
        isTimerRunning = true;
        if (startTimerButton) startTimerButton.disabled = true;
        if (pauseTimerButton) pauseTimerButton.disabled = false;
        if (finalizeTimerButton) finalizeTimerButton.disabled = false;
        if (resetTimerButton) resetTimerButton.disabled = false;
        if (postGameFormArea) postGameFormArea.style.display = 'none';

        if (metasReferenciaSection) metasReferenciaSection.style.display = 'block';

        updateReferenceDisplays();
        runTimer();
    }
}

function pauseTimer() {
    if (isTimerRunning) {
        isTimerRunning = false;
        clearTimeout(timerInterval);
        timerInterval = null;
        if (startTimerButton) {
            startTimerButton.disabled = false;
            startTimerButton.textContent = 'Retomar';
        }
        if (pauseTimerButton) pauseTimerButton.disabled = true;
    }
}

function resetTimer() {
    pauseTimer();
    elapsedSeconds = 0;
    updateTimerDisplayDOM();
    if (startTimerButton) {
        startTimerButton.disabled = false;
        startTimerButton.textContent = 'Iniciar';
    }
    if (pauseTimerButton) pauseTimerButton.disabled = true;
    if (finalizeTimerButton) finalizeTimerButton.disabled = true;
    if (resetTimerButton) resetTimerButton.disabled = false;
    if (postGameFormArea) postGameFormArea.style.display = 'none';
    if (fpmPartidaAtual) fpmPartidaAtual.textContent = 'N/A';
    if (finalFarmInput) finalFarmInput.value = '';
    if (finalCharacterInput) finalCharacterInput.value = '';
    // if (finalDifficultySelect) finalDifficultySelect.value = 'NORMAL'; // REMOVIDO

    if (metasReferenciaSection) metasReferenciaSection.style.display = 'none';

    updateReferenceDisplays();
}


function finalizeTimer() {
    pauseTimer();
    if (postGameFormArea && finalTimeMinInput && finalTimeSecInput) {
        finalTimeMinInput.value = Math.floor(elapsedSeconds / 60);
        finalTimeSecInput.value = elapsedSeconds % 60;
        if (finalFarmInput) finalFarmInput.value = '';
        if (finalCharacterInput) finalCharacterInput.value = '';
        // if (finalDifficultySelect) finalDifficultySelect.value = 'NORMAL'; // REMOVIDO
        calculateCurrentGameFPM();
        postGameFormArea.style.display = 'block';
    }
    if (finalizeTimerButton) finalizeTimerButton.disabled = true;
    if (startTimerButton) startTimerButton.disabled = true;
    if (pauseTimerButton) pauseTimerButton.disabled = true;

    if (metasReferenciaSection) metasReferenciaSection.style.display = 'none';
}

// --- Funções de Referência de FPM ---
function _formatDynamicFarmDisplay(farmValue) {
    if (farmValue === null || farmValue === undefined || isNaN(farmValue)) {
        return "N/A";
    }
    if (farmValue < 10000) {
        return `${Math.round(farmValue)} farm`;
    } else {
        const farmK = farmValue / 1000.0;
        return farmK % 1 === 0 ? `${Math.round(farmK)}k farm` : `${farmK.toFixed(1)}k farm`;
    }
}

function updateDynamicFarmTargets() {
    const effectiveFarmSeconds = Math.max(0, elapsedSeconds - MINION_ARRIVAL_DELAY);
    if (minhaMetaFpmGameplay) {
        if (fpmMinhaMetaRaw !== null) {
            const targetFarm = (fpmMinhaMetaRaw / 60) * effectiveFarmSeconds;
            minhaMetaFpmGameplay.textContent = _formatDynamicFarmDisplay(targetFarm);
            minhaMetaFpmGameplay.className = 'fpm-display dynamic-farm-target';
        } else {
            minhaMetaFpmGameplay.textContent = "N/A (Defina)";
            minhaMetaFpmGameplay.className = 'fpm-display';
        }
    }
    if (outroPerfilFpmGameplay) {
        if (fpmOutroPerfilRaw !== null) {
            const targetFarmOutro = (fpmOutroPerfilRaw / 60) * effectiveFarmSeconds;
            outroPerfilFpmGameplay.textContent = _formatDynamicFarmDisplay(targetFarmOutro);
            outroPerfilFpmGameplay.className = 'fpm-display dynamic-farm-target';
        } else {
            outroPerfilFpmGameplay.textContent = "N/A";
            outroPerfilFpmGameplay.className = 'fpm-display';
        }
    }
    if (seuDesempenhoFpmGameplay && seuDesempenhoSelect) {
        const selectedKey = seuDesempenhoSelect.value;
        const fpmHistValue = personalFpmStatsOptionsGameplay[selectedKey];
        if (fpmHistValue !== null && fpmHistValue !== undefined) {
            const targetFarmHist = (fpmHistValue / 60) * effectiveFarmSeconds;
            seuDesempenhoFpmGameplay.textContent = _formatDynamicFarmDisplay(targetFarmHist);
            seuDesempenhoFpmGameplay.className = 'fpm-display dynamic-farm-target';
        } else {
            seuDesempenhoFpmGameplay.textContent = "N/A";
            seuDesempenhoFpmGameplay.className = 'fpm-display';
        }
    }
}

function updateReferenceDisplays() {
    const mode = displayModeSelect ? displayModeSelect.value : 'static';
    if (minhaMetaLabel && minhaMetaFpmGameplay) {
        minhaMetaLabel.textContent = mode === 'dynamic' ? "Farm Alvo (Minha Meta):" : "FPM Minha Meta:";
        if (fpmMinhaMetaRaw !== null) {
            if (mode === 'dynamic') {
                updateDynamicFarmTargets();
            } else {
                minhaMetaFpmGameplay.textContent = `${fpmMinhaMetaRaw.toFixed(2)} FPM`;
                minhaMetaFpmGameplay.className = 'fpm-display';
            }
        } else {
            minhaMetaFpmGameplay.textContent = "N/A (Defina)";
            minhaMetaFpmGameplay.className = 'fpm-display';
        }
    }
    if (outroMetaLabel && outroPerfilFpmGameplay) {
        outroMetaLabel.textContent = mode === 'dynamic' ? "Farm Alvo (Outro):" : "FPM Meta Outro:";
        if (fpmOutroPerfilRaw !== null) {
            if (mode === 'dynamic') {
                updateDynamicFarmTargets();
            } else {
                outroPerfilFpmGameplay.textContent = `${fpmOutroPerfilRaw.toFixed(2)} FPM`;
                outroPerfilFpmGameplay.className = 'fpm-display';
            }
        } else {
            outroPerfilFpmGameplay.textContent = "N/A";
            outroPerfilFpmGameplay.className = 'fpm-display';
        }
    }
    if (seuDesempenhoLabel && seuDesempenhoFpmGameplay && seuDesempenhoSelect) {
        seuDesempenhoLabel.textContent = mode === 'dynamic' ? "Farm Alvo (Seu Hist.):" : "FPM Pessoal (Hist.):";
        const selectedKey = seuDesempenhoSelect.value;
        const fpmHistValue = personalFpmStatsOptionsGameplay[selectedKey];
        if (fpmHistValue !== null && fpmHistValue !== undefined) {
            if (mode === 'dynamic') {
                updateDynamicFarmTargets();
            } else {
                seuDesempenhoFpmGameplay.textContent = `${fpmHistValue.toFixed(2)} FPM`;
                seuDesempenhoFpmGameplay.className = 'fpm-display';
            }
        } else {
            seuDesempenhoFpmGameplay.textContent = "N/A";
            seuDesempenhoFpmGameplay.className = 'fpm-display';
        }
    }
    if (mode === 'dynamic') {
        updateDynamicFarmTargets();
    }
}

async function loadGameplayReferences() {
    try {
        const metaResult = await window.electronAPI.invokePython('get_personal_goal');
        if (metaResult && metaResult.exists && metaResult.fpm_meta !== null) {
            fpmMinhaMetaRaw = parseFloat(metaResult.fpm_meta);
        } else {
            fpmMinhaMetaRaw = null;
        }
    } catch (e) {
        console.error("Erro ao carregar meta pessoal para gameplay:", e);
        fpmMinhaMetaRaw = null;
    }
    if (outroPerfilRefSelect) {
        try {
            const profilesResult = await window.electronAPI.invokePython('get_other_profiles');
            outroPerfilRefSelect.innerHTML = '<option value="">Nenhum</option>';
            outrosPerfisRefDataGameplay = {};
            if (profilesResult && profilesResult.success && profilesResult.profiles) {
                profilesResult.profiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile.id;
                    option.textContent = profile.name;
                    outroPerfilRefSelect.appendChild(option);
                    outrosPerfisRefDataGameplay[profile.id] = profile.name;
                });
            }
            await onOutroPerfilRefSelect();
        } catch (e) {
            console.error("Erro ao carregar outros perfis para gameplay:", e);
            if (outroPerfilRefSelect) outroPerfilRefSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            fpmOutroPerfilRaw = null;
        }
    }
    if (seuDesempenhoSelect) {
        try {
            const historySummary = await window.electronAPI.invokePython('get_historical_fpm_summary');
            seuDesempenhoSelect.innerHTML = '<option value="">Nenhum histórico</option>';
            personalFpmStatsOptionsGameplay = {};
            if (historySummary && historySummary.success && historySummary.stats) {
                Object.entries(historySummary.stats).forEach(([key, value]) => {
                    if (value !== null && value !== undefined) {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = `${key}`;
                        seuDesempenhoSelect.appendChild(option);
                        personalFpmStatsOptionsGameplay[key] = parseFloat(value);
                    }
                });
            }
            await onSeuDesempenhoSelect();
        } catch (e) {
            console.error("Erro ao carregar histórico pessoal para gameplay:", e);
            if (seuDesempenhoSelect) seuDesempenhoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    updateReferenceDisplays();
}

async function onOutroPerfilRefSelect() {
    if (!outroPerfilRefSelect) {
        fpmOutroPerfilRaw = null;
        updateReferenceDisplays();
        return;
    }
    const selectedProfileId = outroPerfilRefSelect.value;
    if (selectedProfileId && selectedProfileId !== "") {
        try {
            const profileData = await window.electronAPI.invokePython('get_single_profile_avg_fpm', { profile_id: selectedProfileId });
            if (profileData && profileData.success && profileData.avg_fpm !== null) {
                fpmOutroPerfilRaw = parseFloat(profileData.avg_fpm);
            } else {
                fpmOutroPerfilRaw = null;
            }
        } catch (e) {
            console.error("Erro ao buscar FPM do perfil selecionado:", e);
            fpmOutroPerfilRaw = null;
        }
    } else {
        fpmOutroPerfilRaw = null;
    }
    updateReferenceDisplays();
}

async function onSeuDesempenhoSelect() {
    if (!seuDesempenhoSelect) {
        updateReferenceDisplays();
        return;
    }
    updateReferenceDisplays();
}

// --- Funções do Formulário Pós-Partida ---
function calculateCurrentGameFPM() {
    if (!finalFarmInput || !finalTimeMinInput || !finalTimeSecInput || !fpmPartidaAtual) return;
    const farm = parseInt(finalFarmInput.value) || 0;
    const mins = parseInt(finalTimeMinInput.value) || 0;
    const secs = parseInt(finalTimeSecInput.value) || 0;
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds > 0) {
        const fpm = calculateFPM(farm, totalSeconds);
        fpmPartidaAtual.textContent = `${fpm.toFixed(2)} FPM`;
        fpmPartidaAtual.className = 'fpm-display success';
    } else if (farm > 0 && totalSeconds <= 0) {
        fpmPartidaAtual.textContent = "Inválido (Farm > 0 com Tempo <= 0)";
        fpmPartidaAtual.className = 'fpm-display error';
    }
    else {
        fpmPartidaAtual.textContent = "N/A";
        fpmPartidaAtual.className = 'fpm-display';
    }
}

async function registerMatch() {
    if (!finalTimeMinInput || !finalTimeSecInput || !finalFarmInput || !finalCharacterInput || !finalDifficultySelect || !postGameStatus) return;
    const mins = parseInt(finalTimeMinInput.value) || 0;
    const secs = parseInt(finalTimeSecInput.value) || 0;
    const farm = parseInt(finalFarmInput.value) || 0;
    const character = finalCharacterInput.value.trim();
    const difficulty = finalDifficultySelect.value;
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds <= 0) {
        showFloatingWarning("Tempo da partida deve ser maior que zero.", 'error');
        postGameStatus.textContent = "Tempo da partida deve ser maior que zero.";
        postGameStatus.className = 'status-message error';
        return;
    }
    if (farm < 0) {
        showFloatingWarning("Farm não pode ser negativo.", 'error');
        postGameStatus.textContent = "Farm não pode ser negativo.";
        postGameStatus.className = 'status-message error';
        return;
    }
    const fpm = calculateFPM(farm, totalSeconds);
    postGameStatus.textContent = 'Registrando partida...';
    postGameStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('register_gameplay_match', {
            time_seconds: totalSeconds,
            farm: farm,
            fpm: fpm,
            character: character || null,
            difficulty: difficulty
        });
        if (result && result.success) {
            showFloatingWarning(result.message, 'success');
            postGameStatus.textContent = result.message;
            postGameStatus.className = 'status-message success';
            resetTimer();
            loadGameplayReferences();
        } else {
            showFloatingWarning(`Erro: ${result?.message || 'Falha ao registrar.'}`, 'error');
            postGameStatus.textContent = `Erro: ${result?.message || 'Falha ao registrar.'}`;
            postGameStatus.className = 'status-message error';
        }
    } catch (e) {
        showFloatingWarning(`Erro de comunicação: ${e.message || e}`, 'error');
        postGameStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        postGameStatus.className = 'status-message error';
        console.error("Erro em registerMatch:", e);
    }
    setTimeout(() => {
        if (postGameStatus && postGameStatus.textContent.includes('sucesso')) {
            postGameStatus.textContent = '';
        }
    }, 3000);
}

function cancelAndContinue() {
    if (postGameFormArea) postGameFormArea.style.display = 'none';
    if (startTimerButton) {
        startTimerButton.disabled = (elapsedSeconds > 0 && !isTimerRunning);
        startTimerButton.textContent = elapsedSeconds > 0 ? 'Retomar' : 'Iniciar';
    }
    if (pauseTimerButton) pauseTimerButton.disabled = elapsedSeconds === 0 || isTimerRunning;
    if (finalizeTimerButton) finalizeTimerButton.disabled = elapsedSeconds === 0;
    if (resetTimerButton) resetTimerButton.disabled = false;
}

// --- Função de Inicialização do Módulo ---
export function initGameplayHandler() {
    timerDisplay = document.getElementById('timer-display');
    startTimerButton = document.getElementById('start-timer-button');
    pauseTimerButton = document.getElementById('pause-timer-button');
    finalizeTimerButton = document.getElementById('finalize-timer-button');
    resetTimerButton = document.getElementById('reset-timer-button');

    metasReferenciaSection = document.getElementById('metas-referencia-section');

    displayModeSelect = document.getElementById('display-mode-select');
    minhaMetaLabel = document.getElementById('minha-meta-label');
    minhaMetaFpmGameplay = document.getElementById('minha-meta-fpm-gameplay');
    outroMetaLabel = document.getElementById('outro-meta-label');
    outroPerfilRefSelect = document.getElementById('outro-perfil-ref-select');
    outroPerfilFpmGameplay = document.getElementById('outro-perfil-fpm-gameplay');
    seuDesempenhoLabel = document.getElementById('seu-desempenho-label');
    seuDesempenhoSelect = document.getElementById('seu-desempenho-select');
    seuDesempenhoFpmGameplay = document.getElementById('seu-desempenho-fpm-gameplay');

    postGameFormArea = document.getElementById('post-game-form-area');
    finalTimeMinInput = document.getElementById('final-time-min');
    finalTimeSecInput = document.getElementById('final-time-sec');
    finalFarmInput = document.getElementById('final-farm');
    finalCharacterInput = document.getElementById('final-character');
    finalDifficultySelect = document.getElementById('final-difficulty');
    fpmPartidaAtual = document.getElementById('fpm-partida-atual');
    registerMatchButton = document.getElementById('register-match-button');
    cancelContinueButton = document.getElementById('cancel-continue-button');
    postGameStatus = document.getElementById('post-game-status');

    if (startTimerButton) startTimerButton.addEventListener('click', startTimer);
    if (pauseTimerButton) pauseTimerButton.addEventListener('click', pauseTimer);
    if (finalizeTimerButton) finalizeTimerButton.addEventListener('click', finalizeTimer);
    if (resetTimerButton) resetTimerButton.addEventListener('click', resetTimer);

    if (displayModeSelect) displayModeSelect.addEventListener('change', updateReferenceDisplays);
    if (outroPerfilRefSelect) outroPerfilRefSelect.addEventListener('change', onOutroPerfilRefSelect);
    if (seuDesempenhoSelect) seuDesempenhoSelect.addEventListener('change', onSeuDesempenhoSelect);

    if (finalFarmInput) finalFarmInput.addEventListener('input', calculateCurrentGameFPM);
    if (finalTimeMinInput) finalTimeMinInput.addEventListener('input', calculateCurrentGameFPM);
    if (finalTimeSecInput) finalTimeSecInput.addEventListener('input', calculateCurrentGameFPM);
    if (registerMatchButton) registerMatchButton.addEventListener('click', registerMatch);
    if (cancelContinueButton) cancelContinueButton.addEventListener('click', cancelAndContinue);

    if (startTimerButton) startTimerButton.disabled = false;
    if (pauseTimerButton) pauseTimerButton.disabled = true;
    if (finalizeTimerButton) finalizeTimerButton.disabled = true;
    if (resetTimerButton) resetTimerButton.disabled = false;
    if (postGameFormArea) postGameFormArea.style.display = 'none';

    if (metasReferenciaSection) metasReferenciaSection.style.display = 'none';
}

// --- Função Chamada Quando a Página é Exibida ---
export function onShowGameplayHandler() {
    console.log("Gameplay - onShow");
    loadGameplayReferences();
    updateTimerDisplayDOM();
    updateReferenceDisplays();
}
