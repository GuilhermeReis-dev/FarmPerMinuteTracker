import { showFloatingWarning, calculateFPM } from './uiUtils.js';

// --- Elementos DOM ---
let manualTimeMinInput, manualTimeSecInput, manualFarmInput, manualCharacterInput;
let manualDifficultySelect, manualFpmDisplay, saveManualMatchButton, manualMatchStatus;
let refreshHistoryButton, editHistoryEntryButton, deleteHistoryEntryButton;
let matchHistoryTableBody, matchHistoryStatus;
let selectedMatchRow = null;
let selectedMatchId = null;
let editMatchModal, closeEditModalButton, editMatchIdDisplay, editMatchForm;
let editMatchIdInput, editTimeMinInput, editTimeSecInput, editFarmInput;
let editCharacterInput, editDifficultySelect, editFpmDisplay, saveEditedMatchButton, cancelEditMatchButton, editMatchStatus;

// --- Funções para Adição Manual de Partida ---

function updateManualFPMDisplay() {
    if (!manualFarmInput || !manualTimeMinInput || !manualTimeSecInput || !manualFpmDisplay) return;
    const farm = parseInt(manualFarmInput.value) || 0;
    const mins = parseInt(manualTimeMinInput.value) || 0;
    const secs = parseInt(manualTimeSecInput.value) || 0;
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds > 0) {
        const fpm = calculateFPM(farm, totalSeconds);
        manualFpmDisplay.textContent = fpm.toFixed(2) + ' FPM';
    } else {
        manualFpmDisplay.textContent = 'N/A';
    }
}

async function handleSaveManualMatch() {
    if (!manualTimeMinInput || !manualTimeSecInput || !manualFarmInput ||
        !manualCharacterInput || !manualDifficultySelect || !manualMatchStatus || !manualFpmDisplay) {
        console.error("Elementos do formulário manual não encontrados.");
        return;
    }

    const mins = parseInt(manualTimeMinInput.value) || 0;
    const secs = parseInt(manualTimeSecInput.value) || 0;
    const farm = parseInt(manualFarmInput.value) || 0;
    const character = manualCharacterInput.value.trim();
    let difficulty = manualDifficultySelect.value;

    difficulty = difficulty.toUpperCase();

    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds <= 0) {
        showFloatingWarning("O tempo da partida deve ser maior que zero.", 'error');
        manualMatchStatus.textContent = "Tempo inválido.";
        manualMatchStatus.className = 'status-message error';
        return;
    }
    if (farm < 0) {
        showFloatingWarning("O farm não pode ser negativo.", 'error');
        manualMatchStatus.textContent = "Farm inválido.";
        manualMatchStatus.className = 'status-message error';
        return;
    }

    const fpm = calculateFPM(farm, totalSeconds);

    manualMatchStatus.textContent = 'A salvar partida manualmente...';
    manualMatchStatus.className = 'status-message';

    try {
        console.log('Dados enviados ao backend:', {
            time_seconds: totalSeconds,
            farm: farm,
            fpm: fpm,
            character: character || null,
            difficulty: difficulty
        });

        const result = await window.electronAPI.invokePython('add_manual_match', {
            time_seconds: totalSeconds,
            farm: farm,
            fpm: fpm,
            character: character || null,
            difficulty: difficulty
        });

        if (result && result.success) {
            showFloatingWarning(result.message, 'success');
            manualMatchStatus.textContent = result.message;
            manualMatchStatus.className = 'status-message success';
            manualTimeMinInput.value = '';
            manualTimeSecInput.value = '';
            manualFarmInput.value = '';
            manualCharacterInput.value = '';
            manualDifficultySelect.value = 'NORMAL';
            manualFpmDisplay.textContent = 'N/A';
            loadMatchHistory();
        } else {
            showFloatingWarning(`Erro: ${result?.message || 'Falha ao salvar manualmente.'}`, 'error');
            manualMatchStatus.textContent = `Erro: ${result?.message || 'Falha ao salvar.'}`;
            manualMatchStatus.className = 'status-message error';
        }
    } catch (e) {
        showFloatingWarning(`Erro de comunicação: ${e.message || e}`, 'error');
        manualMatchStatus.textContent = `Erro: ${e.message || e}`;
        manualMatchStatus.className = 'status-message error';
        console.error("Erro em handleSaveManualMatch:", e);
    }
    setTimeout(() => {
        if (manualMatchStatus && manualMatchStatus.textContent.includes('sucesso')) {
            manualMatchStatus.textContent = '';
        }
    }, 3000);
}

// --- Funções para Lista de Histórico ---

async function loadMatchHistory() {
    if (!matchHistoryTableBody || !matchHistoryStatus) {
        console.error("Elementos da tabela de histórico não encontrados.");
        return;
    }
    matchHistoryStatus.textContent = 'A carregar histórico...';
    matchHistoryStatus.className = 'status-message';
    editHistoryEntryButton.disabled = true;
    deleteHistoryEntryButton.disabled = true;
    selectedMatchRow = null;
    selectedMatchId = null;

    try {
        const result = await window.electronAPI.invokePython('get_match_history');
        matchHistoryTableBody.innerHTML = '';

        if (result && result.success && result.history) {
            if (result.history.length === 0) {
                const row = matchHistoryTableBody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 7; // Ajustado de 8 para 7
                cell.textContent = 'Nenhuma partida registrada no histórico.';
                cell.style.textAlign = 'center';
                matchHistoryStatus.textContent = '';
            } else {
                result.history.forEach(match => {
                    const row = matchHistoryTableBody.insertRow();
                    row.dataset.matchId = match.id;

                    // A CÉLULA DO ID FOI REMOVIDA DAQUI
                    row.insertCell().textContent = match.data_hora ? new Date(match.data_hora).toLocaleDateString('pt-BR') : 'N/D';
                    const mins = Math.floor((match.tempo_segundos || 0) / 60);
                    const secs = (match.tempo_segundos || 0) % 60;
                    row.insertCell().textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    row.insertCell().textContent = match.farm_obtido;
                    row.insertCell().textContent = match.fpm_calculado !== null ? match.fpm_calculado.toFixed(2) : 'N/A';
                    row.insertCell().textContent = match.origem || 'N/D';
                    row.insertCell().textContent = match.dificuldade_partida || 'N/D';
                    row.insertCell().textContent = match.personagem_utilizado || 'N/D';

                    row.addEventListener('click', () => selectHistoryRow(row, match.id));
                });
                matchHistoryStatus.textContent = 'Histórico carregado.';
                matchHistoryStatus.className = 'status-message success';
            }
        } else {
            matchHistoryStatus.textContent = `Erro: ${result?.message || 'Falha ao carregar histórico.'}`;
            matchHistoryStatus.className = 'status-message error';
        }
    } catch (e) {
        matchHistoryStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        matchHistoryStatus.className = 'status-message error';
        console.error("Erro em loadMatchHistory:", e);
    }
    setTimeout(() => {
        if (matchHistoryStatus && matchHistoryStatus.textContent.includes('Histórico carregado')) {
            matchHistoryStatus.textContent = '';
        }
    }, 3000);
}

function selectHistoryRow(rowElement, matchId) {
    if (selectedMatchRow) {
        selectedMatchRow.classList.remove('selected');
    }
    rowElement.classList.add('selected');
    selectedMatchRow = rowElement;
    selectedMatchId = matchId;

    if (editHistoryEntryButton) editHistoryEntryButton.disabled = false;
    if (deleteHistoryEntryButton) deleteHistoryEntryButton.disabled = false;
}

// --- Funções para Edição e Exclusão ---
function openEditModal() {
    if (!selectedMatchId || !selectedMatchRow || !editMatchModal) {
        showFloatingWarning("Selecione uma partida para editar.", "warning");
        return;
    }

    const cells = selectedMatchRow.cells;
    editMatchIdInput.value = selectedMatchId;
    editMatchIdDisplay.textContent = `(ID: ${selectedMatchId})`;

    // ÍNDICES DAS CÉLULAS AJUSTADOS
    const [mins, secs] = cells[1].textContent.split(':'); // Era cells[2]
    editTimeMinInput.value = parseInt(mins, 10);
    editTimeSecInput.value = parseInt(secs, 10);
    editFarmInput.value = parseInt(cells[2].textContent, 10); // Era cells[3]
    editFpmDisplay.textContent = cells[3].textContent; // Era cells[4]
    editDifficultySelect.value = cells[5].textContent !== 'N/D' ? cells[5].textContent : 'NORMAL'; // Era cells[6]
    editCharacterInput.value = cells[6].textContent !== 'N/D' ? cells[6].textContent : ''; // Era cells[7]

    editMatchStatus.textContent = '';
    editMatchModal.style.display = 'block';
}

function closeEditModal() {
    if (editMatchModal) {
        editMatchModal.style.display = 'none';
    }
}

async function handleSaveEditedMatch() {
    if (!editMatchIdInput || !editTimeMinInput || !editTimeSecInput || !editFarmInput ||
        !editCharacterInput || !editDifficultySelect || !editMatchStatus) {
        console.error("Elementos do modal de edição não encontrados.");
        return;
    }

    const matchIdToUpdate = editMatchIdInput.value;
    const mins = parseInt(editTimeMinInput.value) || 0;
    const secs = parseInt(editTimeSecInput.value) || 0;
    const farm = parseInt(editFarmInput.value) || 0;
    const character = editCharacterInput.value.trim();
    let difficulty = editDifficultySelect.value;

    difficulty = difficulty.toUpperCase();

    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds <= 0) {
        showFloatingWarning("O tempo da partida deve ser maior que zero.", 'error');
        editMatchStatus.textContent = "Tempo inválido.";
        editMatchStatus.className = 'status-message error';
        return;
    }
    if (farm < 0) {
        showFloatingWarning("O farm não pode ser negativo.", 'error');
        editMatchStatus.textContent = "Farm inválido.";
        editMatchStatus.className = 'status-message error';
        return;
    }

    const fpm = calculateFPM(farm, totalSeconds);

    editMatchStatus.textContent = 'A salvar edições...';
    editMatchStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('update_match_history_entry', {
            match_id: matchIdToUpdate,
            time_seconds: totalSeconds,
            farm: farm,
            fpm: fpm,
            character: character || null,
            difficulty: difficulty
        });

        if (result && result.success) {
            showFloatingWarning(result.message, 'success');
            editMatchStatus.textContent = result.message;
            editMatchStatus.className = 'status-message success';
            closeEditModal();
            loadMatchHistory();
        } else {
            showFloatingWarning(`Erro: ${result?.message || 'Falha ao salvar edições.'}`, 'error');
            editMatchStatus.textContent = `Erro: ${result?.message || 'Falha ao salvar.'}`;
            editMatchStatus.className = 'status-message error';
        }
    } catch (e) {
        showFloatingWarning(`Erro de comunicação: ${e.message || e}`, 'error');
        editMatchStatus.textContent = `Erro: ${e.message || e}`;
        editMatchStatus.className = 'status-message error';
        console.error("Erro em handleSaveEditedMatch:", e);
    }
    setTimeout(() => {
        if (editMatchStatus && editMatchStatus.textContent.includes('sucesso')) {
            editMatchStatus.textContent = '';
        }
    }, 3000);
}

async function handleDeleteHistoryEntry() {
    if (!selectedMatchId) {
        showFloatingWarning("Selecione uma partida para excluir.", "warning");
        return;
    }
    if (!confirm(`Tem certeza que deseja excluir a partida ID ${selectedMatchId} do histórico? Esta ação não pode ser desfeita.`)) {
        return;
    }

    matchHistoryStatus.textContent = 'A excluir partida...';
    matchHistoryStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('delete_match_history_entry', {
            match_id: selectedMatchId
        });

        if (result && result.success) {
            showFloatingWarning(result.message, 'success');
            matchHistoryStatus.textContent = result.message;
            matchHistoryStatus.className = 'status-message success';
            loadMatchHistory();
        } else {
            showFloatingWarning(`Erro: ${result?.message || 'Falha ao excluir.'}`, 'error');
            matchHistoryStatus.textContent = `Erro: ${result?.message || 'Falha ao excluir.'}`;
            matchHistoryStatus.className = 'status-message error';
        }
    } catch (e) {
        showFloatingWarning(`Erro de comunicação: ${e.message || e}`, 'error');
        matchHistoryStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        matchHistoryStatus.className = 'status-message error';
        console.error("Erro em handleDeleteHistoryEntry:", e);
    }
    setTimeout(() => {
        if (matchHistoryStatus && matchHistoryStatus.textContent.includes('sucesso')) {
            matchHistoryStatus.textContent = '';
        }
    }, 3000);
}

export function initHistoryHandler() {
    manualTimeMinInput = document.getElementById('manual-time-min');
    manualTimeSecInput = document.getElementById('manual-time-sec');
    manualFarmInput = document.getElementById('manual-farm');
    manualCharacterInput = document.getElementById('manual-character');
    manualDifficultySelect = document.getElementById('manual-difficulty');
    manualFpmDisplay = document.getElementById('manual-fpm-display');
    saveManualMatchButton = document.getElementById('save-manual-match-button');
    manualMatchStatus = document.getElementById('manual-match-status');

    refreshHistoryButton = document.getElementById('refresh-history-button');
    editHistoryEntryButton = document.getElementById('edit-history-entry-button');
    deleteHistoryEntryButton = document.getElementById('delete-history-entry-button');
    matchHistoryTableBody = document.getElementById('match-history-tbody');
    matchHistoryStatus = document.getElementById('match-history-status');

    editMatchModal = document.getElementById('edit-match-modal');
    closeEditModalButton = document.getElementById('close-edit-modal-button');
    editMatchIdDisplay = document.getElementById('edit-match-id-display');
    editMatchForm = document.getElementById('edit-match-form');
    editMatchIdInput = document.getElementById('edit-match-id');
    editTimeMinInput = document.getElementById('edit-time-min');
    editTimeSecInput = document.getElementById('edit-time-sec');
    editFarmInput = document.getElementById('edit-farm');
    editCharacterInput = document.getElementById('edit-character');
    editDifficultySelect = document.getElementById('edit-difficulty');
    editFpmDisplay = document.getElementById('edit-fpm-display');
    saveEditedMatchButton = document.getElementById('save-edited-match-button');
    cancelEditMatchButton = document.getElementById('cancel-edit-match-button');
    editMatchStatus = document.getElementById('edit-match-status');

    if (manualTimeMinInput) manualTimeMinInput.addEventListener('input', updateManualFPMDisplay);
    if (manualTimeSecInput) manualTimeSecInput.addEventListener('input', updateManualFPMDisplay);
    if (manualFarmInput) manualFarmInput.addEventListener('input', updateManualFPMDisplay);
    if (saveManualMatchButton) saveManualMatchButton.addEventListener('click', handleSaveManualMatch);

    if (refreshHistoryButton) refreshHistoryButton.addEventListener('click', loadMatchHistory);
    if (editHistoryEntryButton) editHistoryEntryButton.addEventListener('click', openEditModal);
    if (deleteHistoryEntryButton) deleteHistoryEntryButton.addEventListener('click', handleDeleteHistoryEntry);

    if (closeEditModalButton) closeEditModalButton.addEventListener('click', closeEditModal);
    if (saveEditedMatchButton) saveEditedMatchButton.addEventListener('click', handleSaveEditedMatch);
    if (cancelEditMatchButton) cancelEditMatchButton.addEventListener('click', closeEditModal);
    if (editMatchModal) {
        editMatchModal.addEventListener('click', (event) => {
            if (event.target === editMatchModal) {
                closeEditModal();
            }
        });
    }
    if (editTimeMinInput) editTimeMinInput.addEventListener('input', () => updateEditFPMDisplay());
    if (editTimeSecInput) editTimeSecInput.addEventListener('input', () => updateEditFPMDisplay());
    if (editFarmInput) editFarmInput.addEventListener('input', () => updateEditFPMDisplay());

    if (editHistoryEntryButton) editHistoryEntryButton.disabled = true;
    if (deleteHistoryEntryButton) deleteHistoryEntryButton.disabled = true;
}

function updateEditFPMDisplay() {
    if (!editFarmInput || !editTimeMinInput || !editTimeSecInput || !editFpmDisplay) return;
    const farm = parseInt(editFarmInput.value) || 0;
    const mins = parseInt(editTimeMinInput.value) || 0;
    const secs = parseInt(editTimeSecInput.value) || 0;
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds > 0) {
        const fpm = calculateFPM(farm, totalSeconds);
        editFpmDisplay.textContent = fpm.toFixed(2) + ' FPM';
    } else {
        editFpmDisplay.textContent = 'N/A';
    }
}

export function onShowHistoryHandler() {
    console.log("Histórico - onShow");
    loadMatchHistory();
    if (manualTimeMinInput) manualTimeMinInput.value = '';
    if (manualTimeSecInput) manualTimeSecInput.value = '';
    if (manualFarmInput) manualFarmInput.value = '';
    if (manualCharacterInput) manualCharacterInput.value = '';
    if (manualDifficultySelect) manualDifficultySelect.value = 'NORMAL';
    if (manualFpmDisplay) manualFpmDisplay.textContent = 'N/A';
    if (manualMatchStatus) manualMatchStatus.textContent = '';
}
