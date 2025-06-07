// Módulo para lidar com a página de estatísticas

let statTopChar;
let statGeralValue, statFacilValue, statNormalValue, statDificilValue;
let statsStatus, refreshButton;
let characterFilterSelect;
let fpmChartInstance = null;

/**
 * Atualiza um card de estatística com um valor.
 */
function updateStatCard(element, value, isText = false) {
    if (!element) return;

    if (value !== null && value !== undefined && value !== '') {
        element.textContent = isText ? value : Number(value).toFixed(2);
        element.classList.remove('no-data');
        element.classList.toggle('small-text', isText && value.length > 10);
    } else {
        element.textContent = 'N/A';
        element.classList.add('no-data');
    }
}

/**
 * Renderiza o gráfico de evolução do FPM.
 */
function renderFPMChart(chartData) {
    const canvas = document.getElementById('fpm-evolution-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (fpmChartInstance) {
        fpmChartInstance.destroy();
    }

    if (!chartData || chartData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText("Nenhuma partida encontrada para os filtros selecionados.", canvas.width / 2, canvas.height / 2);
        return;
    }

    const reversedData = [...chartData].reverse();
    const labels = reversedData.map(d => new Date(d.data_hora).toLocaleDateString('pt-BR'));
    const fpmValues = reversedData.map(d => d.fpm_calculado);

    fpmChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Seu FPM',
                data: fpmValues,
                borderColor: '#4FC3F7',
                backgroundColor: 'rgba(79, 195, 247, 0.2)',
                tension: 0.2,
                fill: true,
                pointBackgroundColor: '#4FC3F7',
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#E0E0E0' } },
                tooltip: {
                    backgroundColor: '#2D2D2D',
                    titleColor: '#E0E0E0',
                    bodyColor: '#C0C0C0',
                    boxPadding: 5,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#C0C0C0' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#C0C0C0' }
                }
            }
        }
    });
}

/**
 * Busca estatísticas filtradas e atualiza a UI.
 */
async function loadFilteredStats() {
    if (!statsStatus || !characterFilterSelect) return;

    statsStatus.textContent = 'Carregando estatísticas...';
    statsStatus.className = 'status-message';

    const characterFilter = characterFilterSelect.value;
    const payload = {
        character_filter: characterFilter
    };

    try {
        const result = await window.electronAPI.invokePython('get_filtered_stats', payload);

        if (result && result.success && result.stats) {
            const { averages, summary, chart_data } = result.stats;

            updateStatCard(statTopChar, summary.top_character, true);

            updateStatCard(statGeralValue, averages['Média Geral']);
            updateStatCard(statFacilValue, averages['Média (Easy)']);
            updateStatCard(statNormalValue, averages['Média (Normal)']);
            updateStatCard(statDificilValue, averages['Média (Hard)']);

            renderFPMChart(chart_data);

            statsStatus.textContent = 'Estatísticas atualizadas.';
            statsStatus.className = 'status-message success';
        } else {
            statsStatus.textContent = `Erro: ${result?.message || 'Falha ao carregar.'}`;
            statsStatus.className = 'status-message error';
        }
    } catch (e) {
        statsStatus.textContent = `Erro de comunicação: ${e.message || e}`;
        statsStatus.className = 'status-message error';
        console.error("Erro em loadFilteredStats:", e);
    }

    setTimeout(() => {
        if (statsStatus && statsStatus.textContent.includes('atualizadas')) {
            statsStatus.textContent = '';
        }
    }, 3000);
}

/**
 * Popula o menu de filtro de personagens.
 */
async function populateCharacterFilter() {
    try {
        const result = await window.electronAPI.invokePython('get_all_characters');
        if (result && result.success) {
            while (characterFilterSelect.options.length > 1) {
                characterFilterSelect.remove(1);
            }
            result.characters.forEach(char => {
                const option = document.createElement('option');
                option.value = char;
                option.textContent = char;
                characterFilterSelect.appendChild(option);
            });
        }
    } catch (e) {
        console.error("Erro ao popular filtro de personagens:", e);
    }
}


/**
 * Inicializa o módulo de estatísticas.
 */
export function initStatsHandler() {
    statTopChar = document.getElementById('stat-top-char');
    statGeralValue = document.getElementById('stat-geral-value');
    statFacilValue = document.getElementById('stat-facil-value');
    statNormalValue = document.getElementById('stat-normal-value');
    statDificilValue = document.getElementById('stat-dificil-value');
    statsStatus = document.getElementById('stats-status');
    refreshButton = document.getElementById('refresh-stats-button');
    characterFilterSelect = document.getElementById('character-filter-select');

    if (refreshButton) {
        refreshButton.addEventListener('click', onShowStatsHandler);
    }
    if (characterFilterSelect) {
        characterFilterSelect.addEventListener('change', loadFilteredStats);
    }
}

/**
 * Função chamada quando a página de estatísticas é exibida.
 * Garante que o filtro padrão seja "Todos os Personagens".
 */
export async function onShowStatsHandler() {
    console.log("Estatísticas - onShow");

    // Primeiro, popula a lista de personagens para o menu dropdown.
    await populateCharacterFilter();

    // Depois, define o valor do filtro para 'all' (Todos os Personagens).
    characterFilterSelect.value = 'all';

    // Finalmente, carrega as estatísticas com base nesse filtro padrão.
    await loadFilteredStats();
}
