// src/js/modules/goalsManager.js

import { showFloatingWarning, calculateFPM } from './uiUtils.js';

// --- Elementos DOM e Variáveis de Estado ---
let goalNameInput, goalTimeMinInput, goalTimeSecInput, goalFarmInput;
let goalFpmDisplay, saveGoalButton, deleteGoalButton, personalGoalStatus;
let otherProfilesList, newProfileNameInput, addProfileButton, otherProfilesListStatus;
let profileDetailsArea, selectedProfileNameDisplay, exampleMatchesList, profileAvgFpmDisplay;
let exampleMatchesStatus, exampleMatchMinInput, exampleMatchSecInput, exampleMatchFarmInput;
let addExampleMatchButton, editExampleMatchButton, deleteExampleMatchButton, clearExampleMatchButton;
let selectedOtherProfileId = null;
let selectedExampleMatchId = null;

// --- Funções para "Minha Meta Pessoal" ---

function updatePersonalFPMDisplay() {
    if (!goalFarmInput || !goalTimeMinInput || !goalTimeSecInput || !goalFpmDisplay) return;
    const farm = parseInt(goalFarmInput.value) || 0;
    const mins = parseInt(goalTimeMinInput.value) || 0;
    const secs = parseInt(goalTimeSecInput.value) || 0;
    const totalSeconds = (mins * 60) + secs;
    const fpm = calculateFPM(farm, totalSeconds);
    goalFpmDisplay.textContent = fpm.toFixed(2) + ' FPM';
}

async function loadPersonalGoal() {
    if (!personalGoalStatus) return;
    personalGoalStatus.textContent = 'A carregar meta pessoal...';
    personalGoalStatus.className = 'status-message';
    try {
        const result = await window.electronAPI.invokePython('get_personal_goal');
        if (result && result.success !== false) {
            if (result.exists) {
                goalNameInput.value = result.nome_meta || 'Minha Meta Pessoal';
                const ts = result.tempo_segundos || 0;
                goalTimeMinInput.value = Math.floor(ts / 60);
                goalTimeSecInput.value = ts % 60;
                goalFarmInput.value = result.farm_referencia || 0;
                deleteGoalButton.disabled = false;
                saveGoalButton.textContent = 'Atualizar Meta';
            } else {
                goalNameInput.value = 'Minha Meta Pessoal';
                goalTimeMinInput.value = '0';
                goalTimeSecInput.value = '0';
                goalFarmInput.value = '0';
                deleteGoalButton.disabled = true;
                saveGoalButton.textContent = 'Criar Meta';
            }
            updatePersonalFPMDisplay();
            personalGoalStatus.textContent = '';
        } else {
            personalGoalStatus.textContent = `Erro: ${result?.message || "Erro desconhecido."}`;
            personalGoalStatus.className = 'status-message error';
        }
    } catch (e) {
        personalGoalStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        personalGoalStatus.className = 'status-message error';
    }
}

// O restante das funções de Meta Pessoal, Outros Perfis, e Partidas de Exemplo permanecem inalteradas
// ...

// --- Funções para "Outros Perfis" (com a lógica de edição corrigida) ---

async function loadOtherProfiles() {
    if (!otherProfilesList) return;
    otherProfilesListStatus.textContent = 'A carregar perfis...';
    try {
        const result = await window.electronAPI.invokePython('get_other_profiles');
        otherProfilesList.innerHTML = '';
        if (result && result.success && result.profiles) {
            if (result.profiles.length === 0) {
                otherProfilesList.innerHTML = '<li>Nenhum perfil salvo.</li>';
            }
            result.profiles.forEach(profile => {
                const li = document.createElement('li');
                li.dataset.id = profile.id;

                const nameDisplay = document.createElement('span');
                nameDisplay.className = 'profile-name-display';
                nameDisplay.textContent = profile.name;
                li.appendChild(nameDisplay);

                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'profile-name-input-inline';
                nameInput.value = profile.name;
                li.appendChild(nameInput);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'profile-actions';
                li.appendChild(actionsDiv);

                const editBtn = document.createElement('button');
                editBtn.innerHTML = '✏️';
                editBtn.className = 'edit-profile-icon-btn';
                editBtn.title = 'Editar nome';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    toggleEditProfileName(li, true);
                };
                actionsDiv.appendChild(editBtn);

                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Salvar';
                saveBtn.className = 'save-inline-edit-btn';
                saveBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleSaveProfileName(li, profile.id, profile.name);
                };
                actionsDiv.appendChild(saveBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'X';
                deleteBtn.className = 'delete-profile-btn';
                deleteBtn.title = 'Excluir perfil';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleDeleteOtherProfile(profile.id, profile.name);
                };
                actionsDiv.appendChild(deleteBtn);

                li.addEventListener('click', () => {
                    if (!li.classList.contains('editing')) {
                        displayProfileDetails(profile);
                    }
                });
                otherProfilesList.appendChild(li);
            });
            addProfileButton.disabled = result.profiles.length >= 3;
            otherProfilesListStatus.textContent = '';
        } else {
            otherProfilesListStatus.textContent = `Erro: ${result?.message || 'Falha ao carregar.'}`;
        }
    } catch (e) {
        otherProfilesListStatus.textContent = `Erro: ${e.message || e}`;
    }
}

function toggleEditProfileName(liElement, isEditing) {
    liElement.classList.toggle('editing', isEditing);
    if (isEditing) {
        const input = liElement.querySelector('.profile-name-input-inline');
        input.focus();
        input.select();
    }
}

async function handleSaveProfileName(liElement, profileId, originalName) {
    const input = liElement.querySelector('.profile-name-input-inline');
    const newName = input.value.trim();

    if (!newName) {
        showFloatingWarning('Nome do perfil não pode ser vazio!', 'error');
        input.value = originalName;
        return;
    }
    if (newName === originalName) {
        toggleEditProfileName(liElement, false);
        return;
    }

    const result = await window.electronAPI.invokePython('update_other_profile_name', { id: profileId, name: newName });
    if (result && result.success) {
        showFloatingWarning('Nome do perfil atualizado!', 'success');
        const nameDisplay = liElement.querySelector('.profile-name-display');
        nameDisplay.textContent = newName;
        if (selectedOtherProfileId === profileId) {
            selectedProfileNameDisplay.textContent = newName;
        }

        // Atualiza o nome original para a próxima vez que a função for chamada
        const saveBtn = liElement.querySelector('.save-inline-edit-btn');
        saveBtn.onclick = (e) => {
            e.stopPropagation();
            handleSaveProfileName(liElement, profileId, newName);
        };
    } else {
        showFloatingWarning(`Erro: ${result?.message || 'Erro desconhecido.'}`, 'error');
        input.value = originalName;
    }
    toggleEditProfileName(liElement, false);
}

// ... As outras funções (handleSaveGoal, handleDeleteGoal, etc) não precisam de alteração e foram omitidas para brevidade ...
// As funções para adicionar e gerir partidas de exemplo também permanecem as mesmas.

export function initGoalsManager() {
    // Associa todas as variáveis aos elementos do DOM
    goalNameInput = document.getElementById('goal-name');
    goalTimeMinInput = document.getElementById('goal-time-min');
    goalTimeSecInput = document.getElementById('goal-time-sec');
    goalFarmInput = document.getElementById('goal-farm');
    goalFpmDisplay = document.getElementById('goal-fpm-display');
    saveGoalButton = document.getElementById('save-goal-button');
    deleteGoalButton = document.getElementById('delete-goal-button');
    personalGoalStatus = document.getElementById('personal-goal-status');
    otherProfilesList = document.getElementById('other-profiles-list');
    newProfileNameInput = document.getElementById('new-profile-name');
    addProfileButton = document.getElementById('add-profile-button');
    otherProfilesListStatus = document.getElementById('other-profiles-list-status');
    profileDetailsArea = document.getElementById('profile-details-area');
    selectedProfileNameDisplay = document.getElementById('selected-profile-name-display');
    exampleMatchesList = document.getElementById('example-matches-list');
    profileAvgFpmDisplay = document.getElementById('profile-avg-fpm-display');
    exampleMatchesStatus = document.getElementById('example-matches-status');
    exampleMatchMinInput = document.getElementById('example-match-min');
    exampleMatchSecInput = document.getElementById('example-match-sec');
    exampleMatchFarmInput = document.getElementById('example-match-farm');
    addExampleMatchButton = document.getElementById('add-example-match-button');
    editExampleMatchButton = document.getElementById('edit-example-match-button');
    deleteExampleMatchButton = document.getElementById('delete-example-match-button');
    clearExampleMatchButton = document.getElementById('clear-example-match-button');

    // Adiciona os event listeners
    if (goalTimeMinInput) goalTimeMinInput.addEventListener('input', updatePersonalFPMDisplay);
    if (goalTimeSecInput) goalTimeSecInput.addEventListener('input', updatePersonalFPMDisplay);
    if (goalFarmInput) goalFarmInput.addEventListener('input', updatePersonalFPMDisplay);
    if (saveGoalButton) saveGoalButton.addEventListener('click', handleSaveGoal);
    if (deleteGoalButton) deleteGoalButton.addEventListener('click', handleDeleteGoal);
    if (addProfileButton) addProfileButton.addEventListener('click', handleAddProfile);
    if (addExampleMatchButton) addExampleMatchButton.addEventListener('click', handleAddExampleMatch);
    if (editExampleMatchButton) editExampleMatchButton.addEventListener('click', handleEditExampleMatch);
    if (deleteExampleMatchButton) deleteExampleMatchButton.addEventListener('click', handleDeleteExampleMatch);
    if (clearExampleMatchButton) clearExampleMatchButton.addEventListener('click', clearExampleMatchInputs);
    if (exampleMatchMinInput) exampleMatchMinInput.addEventListener('input', updateExampleMatchButtonStates);
    if (exampleMatchSecInput) exampleMatchSecInput.addEventListener('input', updateExampleMatchButtonStates);
    if (exampleMatchFarmInput) exampleMatchFarmInput.addEventListener('input', updateExampleMatchButtonStates);
}

export function onShowGoalsManager() {
    loadPersonalGoal();
    loadOtherProfiles();
    if (!selectedOtherProfileId && profileDetailsArea) {
        profileDetailsArea.style.display = 'none';
    }
    updateExampleMatchButtonStates();
}

async function handleSaveGoal() {
    if (!goalNameInput || !goalTimeMinInput || !goalTimeSecInput || !goalFarmInput || !personalGoalStatus) return;
    const goalData = {
        nome_meta: goalNameInput.value.trim(),
        tempo_segundos: (parseInt(goalTimeMinInput.value || 0) * 60) + parseInt(goalTimeSecInput.value || 0),
        farm_referencia: parseInt(goalFarmInput.value || 0)
    };

    if (!goalData.nome_meta) {
        personalGoalStatus.textContent = 'Nome da meta é obrigatório.';
        personalGoalStatus.className = 'status-message error';
        return;
    }
    personalGoalStatus.textContent = 'A salvar meta pessoal...';
    personalGoalStatus.className = 'status-message';
    try {
        const result = await window.electronAPI.invokePython('save_personal_goal', goalData);
        if (result && result.success) {
            personalGoalStatus.textContent = result.message;
            personalGoalStatus.className = 'status-message success';
            if (result.updated_goal && result.updated_goal.exists) {
                deleteGoalButton.disabled = false;
                saveGoalButton.textContent = 'Atualizar Meta';
            }
        } else {
            personalGoalStatus.textContent = `Erro ao salvar meta: ${result?.message || 'Erro desconhecido.'}`;
            personalGoalStatus.className = 'status-message error';
        }
    } catch (e) {
        personalGoalStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        personalGoalStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (personalGoalStatus && personalGoalStatus.textContent.includes('sucesso')) {
            personalGoalStatus.textContent = '';
        }
    }, 3000);
}

async function handleDeleteGoal() {
    if (!personalGoalStatus) return;
    if (!confirm("Tem certeza que deseja excluir sua meta pessoal? Esta ação não pode ser desfeita.")) return;

    personalGoalStatus.textContent = 'A excluir meta pessoal...';
    personalGoalStatus.className = 'status-message';
    try {
        const result = await window.electronAPI.invokePython('delete_personal_goal');
        if (result && result.success) {
            personalGoalStatus.textContent = result.message;
            personalGoalStatus.className = 'status-message success';
            loadPersonalGoal();
        } else {
            personalGoalStatus.textContent = `Erro ao excluir meta: ${result?.message || 'Erro desconhecido.'}`;
            personalGoalStatus.className = 'status-message error';
        }
    } catch (e) {
        personalGoalStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        personalGoalStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (personalGoalStatus && personalGoalStatus.textContent.includes('sucesso')) {
            personalGoalStatus.textContent = '';
        }
    }, 3000);
}

async function handleAddProfile() {
    if (!newProfileNameInput || !otherProfilesListStatus) return;
    const name = newProfileNameInput.value.trim();
    if (!name) {
        otherProfilesListStatus.textContent = 'Nome do perfil é obrigatório.';
        otherProfilesListStatus.className = 'status-message error';
        return;
    }
    otherProfilesListStatus.textContent = 'A adicionar perfil...';
    otherProfilesListStatus.className = 'status-message';
    try {
        const result = await window.electronAPI.invokePython('add_other_profile', { name });
        if (result && result.success) {
            otherProfilesListStatus.textContent = result.message;
            otherProfilesListStatus.className = 'status-message success';
            newProfileNameInput.value = '';
            loadOtherProfiles();
        } else {
            otherProfilesListStatus.textContent = `Erro ao adicionar perfil: ${result?.message || 'Falha ao adicionar.'}`;
            otherProfilesListStatus.className = 'status-message error';
        }
    } catch (e) {
        otherProfilesListStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        otherProfilesListStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (otherProfilesListStatus && otherProfilesListStatus.textContent.includes('sucesso')) {
            otherProfilesListStatus.textContent = '';
        }
    }, 3000);
}

async function handleDeleteOtherProfile(profileId, profileName) {
    if (!otherProfilesListStatus || !profileDetailsArea) return;
    if (!confirm(`Tem certeza que deseja excluir o perfil "${profileName}" e todas as suas partidas de exemplo?`)) return;

    otherProfilesListStatus.textContent = 'A excluir perfil...';
    otherProfilesListStatus.className = 'status-message';
    try {
        const result = await window.electronAPI.invokePython('delete_other_profile', { id: profileId });
        if (result && result.success) {
            otherProfilesListStatus.textContent = result.message;
            otherProfilesListStatus.className = 'status-message success';
            loadOtherProfiles();
            if (selectedOtherProfileId === profileId) {
                profileDetailsArea.style.display = 'none';
                selectedOtherProfileId = null;
            }
        } else {
            otherProfilesListStatus.textContent = `Erro ao excluir perfil: ${result?.message || 'Falha ao excluir.'}`;
            otherProfilesListStatus.className = 'status-message error';
        }
    } catch (e) {
        otherProfilesListStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        otherProfilesListStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (otherProfilesListStatus && otherProfilesListStatus.textContent.includes('sucesso')) {
            otherProfilesListStatus.textContent = '';
        }
    }, 3000);
}

async function displayProfileDetails(profile) {
    if (!profileDetailsArea || !selectedProfileNameDisplay || !exampleMatchesList || !profileAvgFpmDisplay || !exampleMatchesStatus) {
        return;
    }

    document.querySelectorAll('#other-profiles-list li').forEach(li => li.classList.remove('selected'));
    const selectedLi = document.querySelector(`#other-profiles-list li[data-id="${profile.id}"]`);
    if (selectedLi) selectedLi.classList.add('selected');

    selectedOtherProfileId = profile.id;
    selectedProfileNameDisplay.textContent = profile.name;
    profileDetailsArea.style.display = 'block';
    exampleMatchesList.innerHTML = '<li>A carregar partidas de exemplo...</li>';
    profileAvgFpmDisplay.textContent = 'Calculando...';
    exampleMatchesStatus.textContent = '';
    clearExampleMatchInputs();

    try {
        const result = await window.electronAPI.invokePython('get_example_matches', { profile_id: profile.id });
        exampleMatchesList.innerHTML = '';
        if (result && result.success && result.matches) {
            if (result.matches.length === 0) {
                exampleMatchesList.innerHTML = '<li>Nenhuma partida de exemplo cadastrada.</li>';
            }
            result.matches.forEach(match => {
                const li = document.createElement('li');
                const mins = Math.floor((match.time_seconds || 0) / 60);
                const secs = (match.time_seconds || 0) % 60;
                li.textContent = `Tempo: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} - Farm: ${match.farm || 0} - FPM: ${Number(match.fpm || 0).toFixed(2)}`;
                li.dataset.id = match.id;
                li.addEventListener('click', () => selectExampleMatch(match));
                exampleMatchesList.appendChild(li);
            });
            profileAvgFpmDisplay.textContent = `${Number(result.profile_avg_fpm || 0).toFixed(2)} FPM`;
        } else {
            exampleMatchesList.innerHTML = `<li>Erro: ${result?.message || 'Falha ao carregar partidas.'}</li>`;
            profileAvgFpmDisplay.textContent = 'N/A';
        }
        updateExampleMatchButtonStates();
    } catch (e) {
        exampleMatchesList.innerHTML = `<li>Erro de comunicação: ${e.message || e}</li>`;
        profileAvgFpmDisplay.textContent = 'N/A';
        updateExampleMatchButtonStates();
    }
}

function selectExampleMatch(match) {
    if (!exampleMatchMinInput || !exampleMatchSecInput || !exampleMatchFarmInput) return;
    document.querySelectorAll('#example-matches-list li').forEach(li => li.classList.remove('selected'));
    const selectedLi = document.querySelector(`#example-matches-list li[data-id="${match.id}"]`);
    if (selectedLi) selectedLi.classList.add('selected');

    selectedExampleMatchId = match.id;
    exampleMatchMinInput.value = Math.floor((match.time_seconds || 0) / 60);
    exampleMatchSecInput.value = (match.time_seconds || 0) % 60;
    exampleMatchFarmInput.value = match.farm || 0;
    updateExampleMatchButtonStates();
}

function clearExampleMatchInputs() {
    if (!exampleMatchMinInput || !exampleMatchSecInput || !exampleMatchFarmInput) return;
    selectedExampleMatchId = null;
    exampleMatchMinInput.value = '';
    exampleMatchSecInput.value = '';
    exampleMatchFarmInput.value = '';
    document.querySelectorAll('#example-matches-list li').forEach(li => li.classList.remove('selected'));
    updateExampleMatchButtonStates();
}

function updateExampleMatchButtonStates() {
    if (!addExampleMatchButton || !editExampleMatchButton || !deleteExampleMatchButton || !clearExampleMatchButton || !exampleMatchesList || !exampleMatchesStatus) return;

    const isProfileSelected = selectedOtherProfileId !== null;
    const isMatchSelected = selectedExampleMatchId !== null;
    const existingMatchesCount = Array.from(exampleMatchesList.children).filter(li => li.dataset.id).length;
    const maxMatchesReached = existingMatchesCount >= 5;

    addExampleMatchButton.disabled = !isProfileSelected || isMatchSelected || maxMatchesReached;
    editExampleMatchButton.disabled = !isMatchSelected;
    deleteExampleMatchButton.disabled = !isMatchSelected;
    clearExampleMatchButton.disabled = !(exampleMatchMinInput.value || exampleMatchSecInput.value || exampleMatchFarmInput.value || isMatchSelected);

    if (!isProfileSelected) {
        exampleMatchesStatus.textContent = 'Selecione um perfil para gerenciar suas partidas de exemplo.';
        exampleMatchesStatus.className = 'status-message';
    } else if (maxMatchesReached && !isMatchSelected) {
        exampleMatchesStatus.textContent = 'Limite de 5 partidas de exemplo atingido para este perfil.';
        exampleMatchesStatus.className = 'status-message error';
    } else {
        exampleMatchesStatus.textContent = '';
    }
}


async function handleAddExampleMatch() {
    if (!selectedOtherProfileId || !exampleMatchMinInput || !exampleMatchSecInput || !exampleMatchFarmInput || !exampleMatchesStatus) return;

    const mins = parseInt(exampleMatchMinInput.value || 0);
    const secs = parseInt(exampleMatchSecInput.value || 0);
    const farm = parseInt(exampleMatchFarmInput.value || 0);
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds <= 0 || farm < 0) {
        exampleMatchesStatus.textContent = 'Tempo e Farm devem ser válidos (tempo > 0).';
        exampleMatchesStatus.className = 'status-message error';
        return;
    }
    if (totalSeconds === 0 && farm > 0) {
        exampleMatchesStatus.textContent = 'Não pode haver farm com tempo zero.';
        exampleMatchesStatus.className = 'status-message error';
        return;
    }

    exampleMatchesStatus.textContent = 'Adicionando partida de exemplo...';
    exampleMatchesStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('add_example_match', {
            profile_id: selectedOtherProfileId,
            time_seconds: totalSeconds,
            farm: farm
        });

        if (result && result.success) {
            exampleMatchesStatus.textContent = result.message;
            exampleMatchesStatus.className = 'status-message success';
            displayProfileDetails({ id: selectedOtherProfileId, name: selectedProfileNameDisplay.textContent });
            clearExampleMatchInputs();
        } else {
            if (result?.message && result.message.includes('Limite de 5 partidas')) {
                showFloatingWarning(result.message, 'warning');
                exampleMatchesStatus.textContent = result.message;
                exampleMatchesStatus.className = 'status-message error';
            } else {
                showFloatingWarning(`Erro: ${result?.message || 'Falha ao adicionar partida.'}`, 'error');
                exampleMatchesStatus.textContent = `Erro: ${result?.message || 'Falha ao adicionar partida.'}`;
                exampleMatchesStatus.className = 'status-message error';
            }
        }
    } catch (e) {
        showFloatingWarning(`Erro de comunicação: ${e.message || e}`, 'error');
        exampleMatchesStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        exampleMatchesStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (exampleMatchesStatus && exampleMatchesStatus.textContent.includes('sucesso') && !exampleMatchesStatus.textContent.includes('Limite')) {
            exampleMatchesStatus.textContent = '';
        }
    }, 3000);
}

async function handleEditExampleMatch() {
    if (!selectedExampleMatchId || !selectedOtherProfileId || !exampleMatchMinInput || !exampleMatchSecInput || !exampleMatchFarmInput || !exampleMatchesStatus) return;

    const mins = parseInt(exampleMatchMinInput.value || 0);
    const secs = parseInt(exampleMatchSecInput.value || 0);
    const farm = parseInt(exampleMatchFarmInput.value || 0);
    const totalSeconds = (mins * 60) + secs;

    if (totalSeconds <= 0 || farm < 0) {
        exampleMatchesStatus.textContent = 'Tempo e Farm devem ser válidos (tempo > 0).';
        exampleMatchesStatus.className = 'status-message error';
        return;
    }
    if (totalSeconds === 0 && farm > 0) {
        exampleMatchesStatus.textContent = 'Não pode haver farm com tempo zero.';
        exampleMatchesStatus.className = 'status-message error';
        return;
    }

    exampleMatchesStatus.textContent = 'Atualizando partida de exemplo...';
    exampleMatchesStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('update_example_match', {
            match_id: selectedExampleMatchId,
            profile_id: selectedOtherProfileId,
            time_seconds: totalSeconds,
            farm: farm
        });

        if (result && result.success) {
            exampleMatchesStatus.textContent = result.message;
            exampleMatchesStatus.className = 'status-message success';
            displayProfileDetails({ id: selectedOtherProfileId, name: selectedProfileNameDisplay.textContent });
            clearExampleMatchInputs();
        } else {
            exampleMatchesStatus.textContent = `Erro: ${result?.message || 'Falha ao atualizar partida.'}`;
            exampleMatchesStatus.className = 'status-message error';
        }
    } catch (e) {
        exampleMatchesStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        exampleMatchesStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (exampleMatchesStatus && exampleMatchesStatus.textContent.includes('sucesso')) {
            exampleMatchesStatus.textContent = '';
        }
    }, 3000);
}

async function handleDeleteExampleMatch() {
    if (!selectedExampleMatchId || !selectedOtherProfileId || !exampleMatchesStatus) return;
    if (!confirm("Tem certeza que deseja excluir esta partida de exemplo?")) return;

    exampleMatchesStatus.textContent = 'Excluindo partida de exemplo...';
    exampleMatchesStatus.className = 'status-message';

    try {
        const result = await window.electronAPI.invokePython('delete_example_match', {
            match_id: selectedExampleMatchId,
            profile_id: selectedOtherProfileId
        });

        if (result && result.success) {
            exampleMatchesStatus.textContent = result.message;
            exampleMatchesStatus.className = 'status-message success';
            displayProfileDetails({ id: selectedOtherProfileId, name: selectedProfileNameDisplay.textContent });
            clearExampleMatchInputs();
        } else {
            exampleMatchesStatus.textContent = `Erro: ${result?.message || 'Falha ao excluir partida.'}`;
            exampleMatchesStatus.className = 'status-message error';
        }
    } catch (e) {
        exampleMatchesStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        exampleMatchesStatus.className = 'status-message error';
    }
    setTimeout(() => {
        if (exampleMatchesStatus && exampleMatchesStatus.textContent.includes('sucesso')) {
            exampleMatchesStatus.textContent = '';
        }
    }, 3000);
}
