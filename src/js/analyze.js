import { combinations, randomChoice, formatBrazilianCurrency, formatBrazilianPercentage, combinationsCount, updateProgress, calculatePrizeCountsForGames } from './utils.js';
import { parseBrazilianNumber } from './validators.js';
import { PRIZE_DEFAULTS, GAME_COSTS } from './constants.js';

// Global map to hold chart instances, to prevent memory leaks
window.pieCharts = window.pieCharts || {};

/**
 * Configurações de análise para cada tipo de jogo.
 * Centraliza as regras e nomes de prêmios, eliminando a necessidade de blocos if/else repetitivos.
 */
export const GAME_ANALYSIS_CONFIG = {
    megasena: {
        fileName: 'jogos_megasena_passados.xlsx',
        expectedNumbers: 6,
        maxBalls: 60,
        prizeTiers: [
            { key: 'quadra', hits: 4, inputId: 'megasenaQuadraAnalise' },
            { key: 'quina', hits: 5, inputId: 'megasenaQuinaAnalise' },
            { key: 'sena', hits: 6, inputId: 'megasenaSenaAnalise', isMaxPrize: true }
        ],
        costInputId: 'megasenaCustoApostaAnalise'
    },
    quina: {
        fileName: 'jogos_quina_passados.xlsx',
        expectedNumbers: 5,
        maxBalls: 80,
        prizeTiers: [
            { key: 'duque', hits: 2, inputId: 'quinaDuqueAnalise' },
            { key: 'terno', hits: 3, inputId: 'quinaTernoAnalise' },
            { key: 'quadra', hits: 4, inputId: 'quinaQuadraAnalise' },
            { key: 'quina', hits: 5, inputId: 'quinaQuinaAnalise', isMaxPrize: true }
        ],
        costInputId: 'quinaCustoApostaAnalise'
    },
    lotofacil: {
        fileName: 'jogos_lotofacil_passados.xlsx',
        expectedNumbers: 15,
        maxBalls: 25,
        prizeTiers: [
            { key: 'onze', hits: 11, inputId: 'lotofacilOnzeAnalise' },
            { key: 'doze', hits: 12, inputId: 'lotofacilDozeAnalise' },
            { key: 'treze', hits: 13, inputId: 'lotofacilTrezeAnalise' },
            { key: 'quatorze', hits: 14, inputId: 'lotofacilQuatorzeAnalise' },
            { key: 'quinze', hits: 15, inputId: 'lotofacilQuinzeAnalise', isMaxPrize: true }
        ],
        costInputId: 'lotofacilCustoApostaAnalise'
    }
};

const PRIZE_COLOR_MAP = {
    'Sem Prêmio': '#9ca3af',
    'Duque': '#7c3aed',
    'Terno': '#db2777',
    'Quadra': '#2563eb',
    'Quina': '#059669',
    'Sena': '#f59e0b',
    'Onze': '#7c3aed',
    'Doze': '#65a30d',
    'Treze': '#06b6d4',
    'Quatorze': '#dc2626',
    'Quinze': '#f59e0b'
};

/**
 * Gera um PDF com os gráficos de pizza e um resumo da análise.
 */
async function printPieChartsToPDF() {
    if (!window.jspdf) {
        alert('Erro: Biblioteca jsPDF não carregada.');
        return;
    }
    if (!window.analysisReportData) {
        alert('Execute uma análise primeiro para gerar o PDF.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const { dadosResumo, tipoJogo } = window.analysisReportData;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Relatório de Análise - Distribuição de Prêmios', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Tipo de Jogo: ${tipoJogo.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Resumo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo da Análise', margin, y);
    y += 8;

    const keyStats = [
        'Quantidade dos Meus Jogos (Simples)',
        'Quantidade de Sorteios Históricos Analisados',
        'Custo Total das Minhas Apostas (por sorteio)',
        'Média de Valor Total de Prêmio por Sorteio',
        'Retorno Sobre Investimento (ROI Total %)'
    ];

    doc.setFontSize(9);
    dadosResumo.forEach(row => {
        if (keyStats.includes(row[0])) {
            doc.setFont('helvetica', 'bold');
            doc.text(row[0] + ':', margin, y);
            doc.setFont('helvetica', 'normal');
            let value = row[1];
            if (typeof value === 'number') {
                if (row[0].includes('%')) {
                    value = formatBrazilianPercentage(value);
                } else if (row[0].includes('Custo') || row[0].includes('Prêmio')) {
                    value = formatBrazilianCurrency(value);
                } else {
                    value = value.toLocaleString('pt-BR');
                }
            }
            doc.text(String(value), margin + 80, y);
            y += 6;
        }
    });
    y += 10;

    // Gráficos de Pizza
    const chartElements = document.querySelectorAll('#prize-distribution-charts-grid .pie-chart-item canvas');
    if (chartElements.length === 0) {
        doc.text('Nenhum gráfico de pizza para exibir.', margin, y);
    }

    for (let i = 0; i < chartElements.length; i++) {
        const canvas = chartElements[i];
        const chartImage = canvas.toDataURL('image/png', 1.0);
        const chartHeight = 80;
        const chartWidth = (canvas.width / canvas.height) * chartHeight;
        if (y + chartHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }
        doc.addImage(chartImage, 'PNG', (pageWidth - chartWidth) / 2, y, chartWidth, chartHeight);
        y += chartHeight + 10;
    }

    doc.save(`Relatorio_Pizza_${tipoJogo}.pdf`);
}

/**
 * Salva o relatório de análise em um arquivo Excel.
 */
function saveAnalysisToExcel() {
    if (window.analysisWorkbook && window.analysisWorkbook.wb && window.analysisWorkbook.filename) {
        XLSX.writeFile(window.analysisWorkbook.wb, window.analysisWorkbook.filename);
    } else {
        alert('Nenhum relatório para salvar. Execute uma análise primeiro.');
    }
}

/**
 * Shows a modal with prize frequency details.
 * @param {string} prizeTierKey - The key for the prize tier (e.g., 'quina').
 * @param {string} prizeTierLabel - The display name (e.g., 'Quina').
 */
function showPrizeFrequencyModal(prizeTierKey, prizeTierLabel) {
    const modal = document.getElementById('prize-frequency-modal');
    const titleEl = document.getElementById('prize-frequency-modal-title');
    const contentEl = document.getElementById('prize-frequency-modal-content');
    
    // This function will be fully implemented in interface.js where it has access to the report data.
    // This is just a placeholder call. The actual implementation is in main.js setup.
}

/**
 * Renders a pie chart in a given container.
 * @param {HTMLElement} containerElement - The div element where the chart will be rendered.
 * @param {object} chartData - Data for the chart, including labels and datasets.
 * @param {string} title - The title for the chart.
 */
function renderPrizeDistributionChart(containerElement, chartData, title) {
    // Destroy old chart if it exists for this container to prevent memory leaks
    if (window.pieCharts[containerElement.id]) {
        window.pieCharts[containerElement.id].destroy();
    }

    const total = Object.values(chartData.counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
        containerElement.innerHTML = `<div class="status-message info" style="display:flex; justify-content:center; align-items:center; height:100%; text-align: center;">Nenhum prêmio foi ganho na simulação para este conjunto de jogos.</div>`;
        return;
    }

    // Create a new canvas for the chart
    const canvas = document.createElement('canvas');
    containerElement.innerHTML = ''; // Clear previous content
    containerElement.appendChild(canvas);

    const chartDataPayload = [];

    if (chartData.counts.semPremio > 0) {
        chartDataPayload.push({
            label: 'Sem Prêmio',
            value: chartData.counts.semPremio,
            color: PRIZE_COLOR_MAP['Sem Prêmio']
        });
    }

    const sortedPrizeTiers = [...chartData.gameConfig.prizeTiers].sort((a, b) => a.hits - b.hits);
    sortedPrizeTiers.forEach(tier => {
        if (chartData.counts[tier.key] > 0) {
            const label = tier.key.charAt(0).toUpperCase() + tier.key.slice(1);
            chartDataPayload.push({
                label: label,
                value: chartData.counts[tier.key],
                color: PRIZE_COLOR_MAP[label] || '#333'
            });
        }
    });

    const ctx = canvas.getContext('2d');
    const newChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartDataPayload.map(d => d.label),
            datasets: [{
                label: 'Quantidade',
                data: chartDataPayload.map(d => d.value),
                backgroundColor: chartDataPayload.map(d => d.color),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedIndex = elements[0].index;
                    const clickedLabel = newChart.data.labels[clickedIndex];
                    const prizeTierKey = clickedLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // 'Sena' -> 'sena'
                    
                    // Find the original tier object to get the correct key
                    const tier = chartData.gameConfig.prizeTiers.find(t => t.key.toLowerCase() === prizeTierKey);
                    if (tier) {
                        showPrizeFrequencyModal(tier.key, clickedLabel);
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 18, weight: 'bold' },
                    padding: { top: 10, bottom: 20 }
                },
                tooltip: {
                    callbacks: {
                        footer: () => 'Clique para ver a Frequência de Prêmios',
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw;
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                            return `${label}: ${value.toLocaleString('pt-BR')} (${percentage}%)`;
                        }
                    }
                },
                legend: {
                    position: 'right',
                    labels: {
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                return data.labels.map((label, i) => {
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    const value = data.datasets[0].data[i];
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;

                                    return {
                                        text: `${label}: ${percentage}%`,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        lineWidth: style.borderWidth,
                                        hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                }
            }
        }
    });
}

/**
 * Função principal que orquestra a análise dos jogos do usuário contra o histórico de sorteios.
 * 
 * FLUXO DE TRABALHO:
 * 1.  **Inicialização da UI**: Mostra loaders e limpa status anteriores.
 * 2.  **Coleta de Dados**:
 *     - Obtém o tipo de jogo (Mega-Sena, Quina, etc.).
 *     - Obtém o arquivo de jogos do usuário.
 *     - Carrega o arquivo de sorteios históricos correspondente.
 * 3.  **Processamento e Validação**:
 *     - Lê os dados dos arquivos Excel.
 *     - Valida e limpa os jogos do usuário e os resultados históricos.
 * 4.  **Expansão de Jogos**:
 *     - Desdobra os jogos do usuário que têm mais dezenas que o padrão (ex: um jogo de 7 dezenas da Mega-Sena é expandido em 7 jogos de 6).
 * 5.  **Cálculo de Resultados**:
 *     - Itera sobre cada sorteio simulado.
 *     - Para cada sorteio, compara com todos os jogos (expandidos) do usuário.
 *     - Contabiliza os prêmios que teriam sido ganhos em cada sorteio.
 *     - Acumula estatísticas gerais (total de prêmios, ROI, frequência, etc.).
 * 6.  **Geração do Relatório**:
 *     - Cria um novo arquivo Excel com múltiplas abas:
 *       - **Resumo**: Estatísticas chave da análise.
 *       - **Prêmios por Sorteio**: Detalhamento de ganhos em cada concurso.
 *       - **Frequência de Prêmios**: Quantos sorteios renderam 0, 1, 2... prêmios de cada tipo.
 *       - **Meus Jogos**: Listas dos jogos originais e expandidos.
 *       - **Repetidos no Meu Jogo**: Análise de combinações internas (duques, ternos) que se repetem nos jogos do usuário.
 * 7.  **Finalização**: Oferece o arquivo Excel para download e atualiza o status na UI.
 */
async function executeAnalysis() {
    const status = document.getElementById('status-analise');
    const progress = document.getElementById('progress-analise');
    const loader = document.getElementById('loader-analise');

    // Hide and clear pie chart containers at the beginning
    const pieChartsWrapper = document.getElementById('prize-distribution-charts-wrapper');
    const pieChartsGrid = document.getElementById('prize-distribution-charts-grid');
    if (pieChartsWrapper) {
        pieChartsWrapper.style.display = 'none';
        if (pieChartsGrid) pieChartsGrid.innerHTML = '';
    }
    // Hide export buttons at the beginning
    const excelBtn = document.getElementById('btn-gerar-relatorio-excel');
    const pizzaPdfBtn = document.getElementById('btn-imprimir-graficos-pizza');
    if (excelBtn) excelBtn.style.display = 'none';
    if (pizzaPdfBtn) pizzaPdfBtn.style.display = 'none';
    const comparativePdfBtn = document.getElementById('btn-imprimir-grafico-analise');
    if (comparativePdfBtn) comparativePdfBtn.style.display = 'none';
    const simUniverseWrapper = document.getElementById('simulation-universe-display-wrapper');
    if (simUniverseWrapper) {
        simUniverseWrapper.style.display = 'none';
    }
    const comparativeControls = document.getElementById('analise-grafico-controls-wrapper');
    if (comparativeControls) {
        comparativeControls.style.display = 'none';
    }
    window.analysisWorkbook = null;
    window.analysisReportData = null;
    // Configuração da UI para o progresso
    status.style.display = 'none'; // Oculta a mensagem de status final
    loader.style.display = 'none'; // Oculta o loader simples
    progress.innerHTML = ''; // Limpa o conteúdo anterior da barra de progresso
    progress.style.display = 'block'; // Exibe o container da barra de progresso

    try {
        const tipoJogo = document.getElementById('gameTypeGlobal').value;
        const gameConfig = GAME_ANALYSIS_CONFIG[tipoJogo];

        // 1. Coletar arquivos de jogos do usuário da lista da UI
        const userGameFilesData = [];
        document.querySelectorAll('#analise-file-list .file-item-analise-wrapper').forEach(wrapper => {
            // Adicionado: Pular itens que não estão visíveis (filtrados por tipo de jogo)
            if (wrapper.style.display === 'none') {
                return; // 'return' em forEach é como 'continue' em um loop for.
            }

            const checkbox = wrapper.querySelector('.file-item-analise input[type="checkbox"]');
            if (checkbox && checkbox.checked) {
                const gameId = wrapper.dataset.itemId;
                const gameData = window.managedGames[gameId];
                if (gameData) {
                    userGameFilesData.push(gameData);
                }
            }
        });

        if (userGameFilesData.length === 0) {
            throw new Error('Por favor, adicione e marque pelo menos um jogo na lista para análise.');
        }

        // 2. Ler e processar todos os arquivos de jogos do usuário selecionados
        progress.textContent = 'Processando jogos do usuário...';
        const allUserGamesData = []; // Estrutura: [{fileName: '...', originalGames: [...]}]
        for (const gameData of userGameFilesData) {
            let fileBuffer;
            if (gameData.type === 'external') {
                fileBuffer = await gameData.file.arrayBuffer();
            } else if (gameData.type === 'generated' && gameData.workbook) {
                const wb_out = XLSX.write(gameData.workbook, { bookType: 'xlsx', type: 'array' });
                fileBuffer = wb_out;
            } else {
                continue; // Pula se não houver fonte de dados
            }
            const workbook = XLSX.read(fileBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            let jogos = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

            jogos = jogos.map(row => 
                row.filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= gameConfig.maxBalls).map(Number)
            ).filter(row => row.length > 0);

            if (jogos.length > 0) {
                allUserGamesData.push({
                    fileName: gameData.name,
                    originalGames: jogos
                });
            }
        }

        if (allUserGamesData.length === 0) {
            throw new Error('Nenhum jogo válido encontrado nos arquivos selecionados.');
        }

        // 3. Definir o universo de bolas para a simulação
        const selectedSimBalls = Array.from(document.querySelectorAll('#simulation-ball-panel .ball.active')).map(b => parseInt(b.dataset.number, 10));

        if (selectedSimBalls.length < gameConfig.expectedNumbers) {
            throw new Error(`O número de bolas selecionadas para simulação (${selectedSimBalls.length}) é menor que o necessário para um sorteio (${gameConfig.expectedNumbers}). Selecione mais bolas.`);
        }
        const ballUniverse = selectedSimBalls;

        // 4. Gerar sorteios simulados
        const simulationCount = parseInt(document.getElementById('simulatedGamesCount').value, 10);
        progress.textContent = `Simulando ${simulationCount.toLocaleString('pt-BR')} sorteios...`;
        const resultadosHistoricos = [];
        for (let i = 0; i < simulationCount; i++) {
            const draw = randomChoice(ballUniverse, null, gameConfig.expectedNumbers, false);
            resultadosHistoricos.push(draw.sort((a, b) => a - b));
        }

        // Armazena os resultados da simulação globalmente para serem usados por outros módulos (ex: gráfico comparativo)
        window.analysisSimulationResults = resultadosHistoricos;

        // Expande jogos com mais dezenas que o padrão (desdobramento)
        progress.textContent = 'Expandindo jogos do usuário (se necessário)...';
        let jogosUsuarioExpandidos = [];
        let temJogosExpandidos = false;
        let indiceAtual = 1;
        
        allUserGamesData.forEach(fileData => {
            fileData.originalGames.forEach(jogoOriginal => {
                const numeros = jogoOriginal.map(Number);
                if (numeros.length > gameConfig.expectedNumbers) {
                    temJogosExpandidos = true;
                    const combinacoes = combinations(numeros, gameConfig.expectedNumbers);
                    combinacoes.forEach(combinacao => {
                        jogosUsuarioExpandidos.push({
                            file: fileData.fileName,
                            gameData: [indiceAtual++, ...combinacao.sort((a, b) => a - b)]
                        });
                    });
                } else if (numeros.length === gameConfig.expectedNumbers) {
                    jogosUsuarioExpandidos.push({
                        file: fileData.fileName,
                        gameData: [indiceAtual++, ...numeros.sort((a, b) => a - b)]
                    });
                } // else ignore games with fewer numbers
            });
        });

        if (jogosUsuarioExpandidos.length === 0) {
            throw new Error('Nenhum jogo válido para análise após expansão/filtragem.');
        }

        // Coletar todas as dezenas únicas dos jogos do usuário (após expansão)
        const todasDezenasUnicasUsuario = new Set();
        jogosUsuarioExpandidos.forEach(item => {
            const dezenasDoJogo = item.gameData.slice(1); // Pega só as dezenas
            dezenasDoJogo.forEach(dezena => todasDezenasUnicasUsuario.add(dezena));
        });
        const arrayDezenasUnicasUsuario = Array.from(todasDezenasUnicasUsuario).sort((a, b) => a - b);
        const stringDezenasUnicasUsuario = arrayDezenasUnicasUsuario.map(d => String(d).padStart(2, '0')).join(', ');

        const resultadosHistoricosComIndice = resultadosHistoricos.map((resultado, indice) => [indice + 1, ...resultado]);

        // Coleta os valores dos prêmios e custo da aposta da interface
        const premios = {};
        gameConfig.prizeTiers.forEach(tier => {
            const inputEl = document.getElementById(tier.inputId);
            premios[tier.key] = parseBrazilianNumber(inputEl?.value) || PRIZE_DEFAULTS[tipoJogo][tier.key];
        });
        const custoApostaBase = parseBrazilianNumber(document.getElementById(gameConfig.costInputId)?.value) || PRIZE_DEFAULTS[tipoJogo].custoAposta;
        
        // Não usar calcularCustoComCotas globalmente, vamos calcular para cada jogo individualmente

        progress.textContent = 'Calculando resultados...';
        const resultados = [];

        // Estruturas para armazenar prêmios individuais por arquivo
        const resultadosIndividuais = {};
        allUserGamesData.forEach(fileData => {
            resultadosIndividuais[fileData.fileName] = [];
        });

        // Estruturas para armazenar estatísticas agregadas
        const pieChartCountsByFile = {};
        allUserGamesData.forEach(fileData => {
            pieChartCountsByFile[fileData.fileName] = { semPremio: 0 };
            gameConfig.prizeTiers.forEach(tier => {
                pieChartCountsByFile[fileData.fileName][tier.key] = 0;
            });
        });
        const totalPieChartCounts = { semPremio: 0 };
        gameConfig.prizeTiers.forEach(tier => {
            totalPieChartCounts[tier.key] = 0;
        });

        const totaisSorteiosSemPremio = {}; // { quadra: 500, quina: 2000, ... }
        const minMaxAcertos = {}; // { quadra: { min: 0, max: 5 }, ... }
        const frequenciaPremiosPorSorteio = {}; // { quadra: { 0: 1500, 1: 300, 2: 50 }, ... }

        gameConfig.prizeTiers.forEach(tier => {
            totaisSorteiosSemPremio[tier.key] = 0;
            minMaxAcertos[tier.key] = { min: Infinity, max: 0 };
            frequenciaPremiosPorSorteio[tier.key] = {};
        });

        let totalPremio = 0, totalPremioSemMaximo = 0;

        const loopStartTime = performance.now();
        // Loop principal: itera sobre cada sorteio histórico para calcular os resultados
        for (let i = 0; i < resultadosHistoricosComIndice.length; i++) {
            const jogoHistorico = resultadosHistoricosComIndice[i];
            if (i > 0 && (i % 100 === 0 || i === resultadosHistoricosComIndice.length - 1)) {
                const tempoDecorrido = (performance.now() - loopStartTime) / 1000;
                const velocidade = (i + 1) / tempoDecorrido;
                const sorteiosRestantes = resultadosHistoricosComIndice.length - (i + 1);
                const tempoRestante = velocidade > 0 ? sorteiosRestantes / velocidade : 0;
                const percentual = (i + 1) / resultadosHistoricosComIndice.length * 100;
                const info = `Analisando: ${(i + 1).toLocaleString('pt-BR')} / ${resultadosHistoricosComIndice.length.toLocaleString('pt-BR')}`;
                
                await updateProgress(
                    'progress-analise',
                    null, null, // currentCount, totalCount
                    false, // isAleatorio
                    percentual, // progressPercent
                    info, // info
                    null, // countLabel
                    tempoDecorrido, tempoRestante
                );
            }
            const numerosHistoricos = new Set(jogoHistorico.slice(1).map(Number).filter(num => !isNaN(num)));
            
            // Contadores de prêmios para ESTE sorteio (para o Excel)
            const premiosNesteSorteio = {};
            gameConfig.prizeTiers.forEach(tier => { premiosNesteSorteio[tier.key] = 0; });

            let bestOverallTierInSim = null;
            const bestTierByFileInSim = {};
            let premioTotalNesteSorteio = 0, premioSemMaximoNesteSorteio = 0;

            // Itera sobre os jogos para calcular prêmios e estatísticas
            allUserGamesData.forEach(fileData => {
                const prizeCountsForFile = calculatePrizeCountsForGames(fileData.originalGames, Array.from(numerosHistoricos), gameConfig);
                
                // Encontrar informações de cotas específicas deste jogo
                const gameId = Object.keys(window.managedGames).find(id => 
                    window.managedGames[id].name === fileData.fileName
                );
                const gameData = gameId ? window.managedGames[gameId] : null;
                
                let bestTierForThisFile = null;
                const sortedTiers = [...gameConfig.prizeTiers].sort((a, b) => b.hits - a.hits);

                // Contadores de prêmios individuais para ESTE arquivo e sorteio
                const premiosIndividuaisNesteSorteio = {};
                gameConfig.prizeTiers.forEach(tier => { premiosIndividuaisNesteSorteio[tier.key] = 0; });
                let premioTotalIndividualNesteSorteio = 0;

                // Calcular prêmios para cada categoria
                gameConfig.prizeTiers.forEach(tier => {
                    const count = prizeCountsForFile[tier.key] || 0;
                    
                    // Armazenar contadores individuais
                    premiosIndividuaisNesteSorteio[tier.key] = count;
                    
                    if (count > 0) {
                        // Calcular prêmio ajustado para cotas
                        let premioAjustado = premios[tier.key];
                        if (gameData && gameData.quotaInfo && gameData.quotaInfo.ativo) {
                            const proporcaoCotas = gameData.quotaInfo.cotasCompradas / gameData.quotaInfo.quantidadeCotas;
                            premioAjustado = premios[tier.key] * proporcaoCotas;
                        }
                        
                        // Acumula valores monetários individuais
                        premioTotalIndividualNesteSorteio += count * premioAjustado;
                        
                        // Acumula para contadores (para Excel)
                        premiosNesteSorteio[tier.key] += count;
                        
                        // Acumula valores monetários (para estatísticas)
                        premioTotalNesteSorteio += count * premioAjustado;
                        if (!tier.isMaxPrize) {
                            premioSemMaximoNesteSorteio += count * premioAjustado;
                        }
                        
                        // Encontra o melhor prêmio para este arquivo (para gráfico de pizza)
                        if (!bestTierForThisFile) {
                            bestTierForThisFile = tier;
                        }
                    }
                });

                // Armazenar linha individual para este arquivo
                const linhaIndividual = [
                    jogoHistorico[0], // Concurso
                    ...gameConfig.prizeTiers.map(tier => premiosIndividuaisNesteSorteio[tier.key]),
                    premioTotalIndividualNesteSorteio
                ];
                resultadosIndividuais[fileData.fileName].push(linhaIndividual);

                bestTierByFileInSim[fileData.fileName] = bestTierForThisFile;

                // Atualiza o melhor prêmio geral da simulação
                if (bestTierForThisFile && (!bestOverallTierInSim || bestTierForThisFile.hits > bestOverallTierInSim.hits)) {
                    bestOverallTierInSim = bestTierForThisFile;
                }
            });
 
            // Atualiza contadores para gráficos de pizza
            if (bestOverallTierInSim) {
                totalPieChartCounts[bestOverallTierInSim.key]++;
            } else {
                totalPieChartCounts.semPremio++;
            }

            allUserGamesData.forEach(fileData => {
                const bestTierForFile = bestTierByFileInSim[fileData.fileName];
                if (bestTierForFile) {
                    pieChartCountsByFile[fileData.fileName][bestTierForFile.key]++;
                } else {
                    pieChartCountsByFile[fileData.fileName].semPremio++;
                }
            });

            // Atualiza estatísticas baseadas nos contadores
            gameConfig.prizeTiers.forEach(tier => {
                const count = premiosNesteSorteio[tier.key];
                
                // Atualiza min/max de acertos por sorteio
                minMaxAcertos[tier.key].min = Math.min(minMaxAcertos[tier.key].min, count);
                minMaxAcertos[tier.key].max = Math.max(minMaxAcertos[tier.key].max, count);

                // Contabiliza sorteios sem prêmios
                if (count === 0) {
                    totaisSorteiosSemPremio[tier.key]++;
                }

                // Registra a frequência de prêmios
                frequenciaPremiosPorSorteio[tier.key][count] = (frequenciaPremiosPorSorteio[tier.key][count] || 0) + 1;
            });

            totalPremio += premioTotalNesteSorteio;
            totalPremioSemMaximo += premioSemMaximoNesteSorteio;

            // Adiciona a linha de resultado para a aba "Prêmios por Sorteio"
            const linhaResultado = [
                jogoHistorico[0], // Concurso
                ...gameConfig.prizeTiers.map(tier => premiosNesteSorteio[tier.key]),
                premioTotalNesteSorteio
            ];
            resultados.push(linhaResultado);
        }

        // Contadores para as faixas de percentual de prêmio vs custo
        const faixasCusto = {
            abaixo10: 0,
            entre10e20: 0,
            entre20e30: 0,
            entre30e40: 0,
            entre40e50: 0,
            entre50e60: 0,
            entre60e70: 0,
            entre70e80: 0,
            entre80e90: 0,
            entre90e100: 0,
            acima100: 0,
        };
        // Analisando repetições de agrupamentos internos nos jogos do usuário
        progress.textContent = 'Analisando repetições internas dos seus jogos...';
        const frequenciaAgrupamentosInternos = {
            duques: {},
            ternos: {},
            quadras: {},
            quinas: {},
            senas: {}, // Para Mega-Sena
            onzes: {}, // Para Lotofácil
            dozes: {}, // Para Lotofácil
            trezes: {}, // Para Lotofácil
            quatorzes: {}, // Para Lotofácil
            quinzes: {}  // Para Lotofácil
        };

        jogosUsuarioExpandidos.forEach(item => {
            const dezenasDoJogo = item.gameData.slice(1); // Remove o índice, já estão ordenadas

            const processarAgrupamentoInterno = (groupSize, groupTypeKey) => {
                if (dezenasDoJogo.length >= groupSize) {
                    const combos = combinations(dezenasDoJogo, groupSize); // dezenasDoJogo is already sorted
                    combos.forEach(combo => { // combo também estará ordenado
                        const comboKey = JSON.stringify(combo);
                        frequenciaAgrupamentosInternos[groupTypeKey][comboKey] = (frequenciaAgrupamentosInternos[groupTypeKey][comboKey] || 0) + 1;
                    });
                }
            };
            if (tipoJogo === 'quina') {
                processarAgrupamentoInterno(2, 'duques'); // Process 2-number groups (duques)
                processarAgrupamentoInterno(3, 'ternos'); // Process 3-number groups (ternos)
                processarAgrupamentoInterno(4, 'quadras'); // Process 4-number groups (quadras)
                processarAgrupamentoInterno(5, 'quinas');  // Process 5-number groups (quinas)
            } else if (tipoJogo === 'megasena') { // Mega-Sena
                processarAgrupamentoInterno(3, 'ternos'); // Process 3-number groups (ternos)
                processarAgrupamentoInterno(4, 'quadras'); // Process 4-number groups (quadras)
                processarAgrupamentoInterno(5, 'quinas');  // Process 5-number groups (quinas)
                processarAgrupamentoInterno(6, 'senas'); // Process 6-number groups (penas) - Mega-Sena
            } else { // Loto-Fácil
                processarAgrupamentoInterno(11, 'onzes'); // Lotofácil
                processarAgrupamentoInterno(12, 'dozes'); // Lotofácil
                processarAgrupamentoInterno(13, 'trezes'); // Lotofácil
                processarAgrupamentoInterno(14, 'quatorzes'); // Lotofácil
                processarAgrupamentoInterno(15, 'quinzes'); // Lotofácil
            };
        });


        progress.textContent = 'Calculando estatísticas finais...';
        const numeroJogosHistoricos = resultadosHistoricosComIndice.length;
        const numeroApostasUsuario = jogosUsuarioExpandidos.length;

        const mediaPremioPorSorteio = numeroJogosHistoricos > 0 ? totalPremio / numeroJogosHistoricos : 0;
        const mediaPremioSemMaximoPorSorteio = numeroJogosHistoricos > 0 ? totalPremioSemMaximo / numeroJogosHistoricos : 0;
        
        // Calcular custo total considerando as cotas específicas de cada jogo
        let custoTotalDasApostasPorSorteio = 0;
        allUserGamesData.forEach(fileData => {
            const gameId = Object.keys(window.managedGames).find(id => 
                window.managedGames[id].name === fileData.fileName
            );
            const gameData = gameId ? window.managedGames[gameId] : null;
            
            // Calcular custo específico para este jogo
            let custoJogo = custoApostaBase;
            if (gameData && gameData.quotaInfo && gameData.quotaInfo.ativo) {
                // Para jogos com cotas, usar a proporção das cotas compradas
                const proporcaoCotas = gameData.quotaInfo.cotasCompradas / gameData.quotaInfo.quantidadeCotas;
                custoJogo = custoApostaBase * proporcaoCotas;
                
                // Se pago 35% antecipado, multiplicar por 1.35
                if (gameData.quotaInfo.pago35Caixa) {
                    custoJogo *= 1.35;
                }
            }
            
            // Contar quantos jogos expandidos pertencem a este arquivo
            const jogosDesteArquivo = jogosUsuarioExpandidos.filter(jogo => jogo.file === fileData.fileName).length;
            custoTotalDasApostasPorSorteio += jogosDesteArquivo * custoJogo;
        });

        // Calcular distribuição de prêmios vs custo
        if (custoTotalDasApostasPorSorteio > 0 && numeroJogosHistoricos > 0) {
            resultados.forEach(resultadoSorteio => { // 'resultados' já contém o premioTotalNesteSorteio
                const premioNesteSorteio = resultadoSorteio[resultadoSorteio.length -1]; // Última coluna é o prêmio total
                const ratio = premioNesteSorteio / custoTotalDasApostasPorSorteio;

                if (ratio < 0.1) faixasCusto.abaixo10++;
                else if (ratio < 0.2) faixasCusto.entre10e20++;
                else if (ratio < 0.3) faixasCusto.entre20e30++;
                else if (ratio < 0.4) faixasCusto.entre30e40++;
                else if (ratio < 0.5) faixasCusto.entre40e50++;
                else if (ratio < 0.6) faixasCusto.entre50e60++;
                else if (ratio < 0.7) faixasCusto.entre60e70++;
                else if (ratio < 0.8) faixasCusto.entre70e80++;
                else if (ratio < 0.9) faixasCusto.entre80e90++;
                else if (ratio < 1.0) faixasCusto.entre90e100++;
                else faixasCusto.acima100++;
            });
        }
        const percFaixa = (count) => numeroJogosHistoricos > 0 ? count / numeroJogosHistoricos : 0;


        // ROI: (Média de Prêmio por Sorteio) / (Custo Total das Apostas do Usuário por Sorteio)
        const roiTotal = custoTotalDasApostasPorSorteio > 0 ? mediaPremioPorSorteio / custoTotalDasApostasPorSorteio : 0;
        const roiSemMaximo = custoTotalDasApostasPorSorteio > 0 ? mediaPremioSemMaximoPorSorteio / custoTotalDasApostasPorSorteio : 0;

        // Calcula a média de prêmios por sorteio para cada faixa baseada nos prêmios reais ganhos
        const mediasPremios = {};
        gameConfig.prizeTiers.forEach(tier => {
            mediasPremios[tier.key] = numeroJogosHistoricos > 0 ? totalPremio / numeroJogosHistoricos : 0;
        });

        // Calcular totais de agrupamentos repetidos no jogo do usuário
        let totalDuquesRepetidosUser = 0;
        let totalTernosRepetidosUser = 0;
        let totalQuadrasRepetidasUser = 0;
        let totalQuinasRepetidasUser = 0;
        let totalSenasRepetidasUser = 0; // Para Mega-Sena
        let totalOnzesRepetidasUser = 0;
        let totalDozesRepetidasUser = 0;
        let totalTrezesRepetidasUser = 0;
        let totalQuatorzesRepetidasUser = 0;
        let totalQuinzesRepetidasUser = 0;
        

        for (const key in frequenciaAgrupamentosInternos.duques) {
            if (frequenciaAgrupamentosInternos.duques[key] > 1) totalDuquesRepetidosUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.ternos) {
            if (frequenciaAgrupamentosInternos.ternos[key] > 1) totalTernosRepetidosUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quadras) {
            if (frequenciaAgrupamentosInternos.quadras[key] > 1) totalQuadrasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quinas) {
            if (frequenciaAgrupamentosInternos.quinas[key] > 1) totalQuinasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.senas) {
            if (frequenciaAgrupamentosInternos.senas[key] > 1) totalSenasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.onzes) {
            if (frequenciaAgrupamentosInternos.onzes[key] > 1) totalOnzesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.dozes) {
            if (frequenciaAgrupamentosInternos.dozes[key] > 1) totalDozesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.trezes) {
            if (frequenciaAgrupamentosInternos.trezes[key] > 1) totalTrezesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quatorzes) {
            if (frequenciaAgrupamentosInternos.quatorzes[key] > 1) totalQuatorzesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quinzes) {
            if (frequenciaAgrupamentosInternos.quinzes[key] > 1) totalQuinzesRepetidasUser++;
        }

        // --- START PIE CHARTS RENDERING LOGIC ---
        if (pieChartsWrapper && pieChartsGrid) {
            pieChartsWrapper.style.display = 'block';
            let chartCounter = 0;

            const renderChartForData = (counts, title) => {
                const chartItemContainer = document.createElement('div');
                chartItemContainer.className = 'pie-chart-item';
                chartItemContainer.id = `pie-chart-container-${chartCounter++}`;
                pieChartsGrid.appendChild(chartItemContainer);

                renderPrizeDistributionChart(chartItemContainer, { counts, gameConfig }, title);
            };

            // Render chart for each file
            for (const fileName in pieChartCountsByFile) {
                renderChartForData(pieChartCountsByFile[fileName], fileName);
            }

            // Render summary chart if more than one file was analyzed
            if (Object.keys(pieChartCountsByFile).length > 1) {
                // Calcular custo total de todos os jogos usando informações específicas de cotas
                let custoTotalTodosJogos = 0;
                const tabelaCustos = GAME_COSTS[tipoJogo] || {};
                
                allUserGamesData.forEach(fileData => {
                    // Buscar informações de cotas específicas deste jogo
                    const gameId = Object.keys(window.managedGames).find(id => 
                        window.managedGames[id].name === fileData.fileName
                    );
                    const gameData = gameId ? window.managedGames[gameId] : null;
                    
                    fileData.originalGames.forEach(jogo => {
                        const custoJogoBase = tabelaCustos[jogo.length] || 0;
                        
                        // Calcular custo ajustado usando informações específicas do jogo
                        let custoJogoAjustado = custoJogoBase;
                        if (gameData && gameData.quotaInfo && gameData.quotaInfo.ativo) {
                            const proporcaoCotas = gameData.quotaInfo.cotasCompradas / gameData.quotaInfo.quantidadeCotas;
                            custoJogoAjustado = custoJogoBase * proporcaoCotas;
                            
                            if (gameData.quotaInfo.pago35Caixa) {
                                custoJogoAjustado *= 1.35;
                            }
                        }
                        
                        custoTotalTodosJogos += custoJogoAjustado;
                    });
                });

                const tituloComCusto = `Todos os Jogos (Custo: ${formatBrazilianCurrency(custoTotalTodosJogos)})`;
                renderChartForData(totalPieChartCounts, tituloComCusto);
            }
        }
        // --- END PIE CHARTS RENDERING LOGIC ---

        // --- Display Simulation Universe ---
        if (simUniverseWrapper) {
            const simUniverseDisplay = document.getElementById('simulation-universe-display-panel');
            const simUniverseCountEl = document.getElementById('sim-universe-count');
            if (simUniverseDisplay) {
                simUniverseWrapper.style.display = 'block';
                if (simUniverseCountEl) simUniverseCountEl.textContent = ballUniverse.length;
                simUniverseDisplay.innerHTML = '';
                ballUniverse.sort((a,b) => a-b).forEach(ballNum => {
                    const ballEl = document.createElement('div');
                    ballEl.className = 'ball active';
                    ballEl.textContent = String(ballNum).padStart(2, '0');
                    simUniverseDisplay.appendChild(ballEl);
                });
            }
        }

        // Monta a aba de Resumo
        let dadosResumo = [];
        if (tipoJogo === 'quina') {
            dadosResumo = [ // ... (conteúdo da aba resumo)
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoApostaBase],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de Duque por Sorteio', mediasPremios.duque],
                ['Média de Prêmios de Terno por Sorteio', mediasPremios.terno],
                ['Média de Prêmios de Quadra por Sorteio', mediasPremios.quadra],
                ['Média de Prêmios de Quina por Sorteio', mediasPremios.quina],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem Quina)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem Quina %)', roiSemMaximo],
                ['Mínimo de Acertos de Duque em um Sorteio', minMaxAcertos.duque.min === Infinity ? 0 : minMaxAcertos.duque.min],
                ['Máximo de Acertos de Duque em um Sorteio', minMaxAcertos.duque.max],
                ['Mínimo de Acertos de Terno em um Sorteio', minMaxAcertos.terno.min === Infinity ? 0 : minMaxAcertos.terno.min],
                ['Máximo de Acertos de Terno em um Sorteio', minMaxAcertos.terno.max],
                ['Mínimo de Acertos de Quadra em um Sorteio', minMaxAcertos.quadra.min === Infinity ? 0 : minMaxAcertos.quadra.min],
                ['Máximo de Acertos de Quadra em um Sorteio', minMaxAcertos.quadra.max],
                ['Sorteios sem Nenhum Acerto de Duque', totaisSorteiosSemPremio.duque],
                ['Sorteios sem Nenhum Acerto de Terno', totaisSorteiosSemPremio.terno],
                ['Sorteios sem Nenhum Acerto de Quadra', totaisSorteiosSemPremio.quadra],
                ['Total de Duques Distintos Repetidos (nos seus jogos)', totalDuquesRepetidosUser],
                ['Total de Ternos Distintos Repetidos (nos seus jogos)', totalTernosRepetidosUser],
                ['Total de Quadras Distintas Repetidas (nos seus jogos)', totalQuadrasRepetidasUser],
                ['Total de Quinas Distintas Repetidas (nos seus jogos)', totalQuinasRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        } else if (tipoJogo === 'lotofacil') {
            dadosResumo = [ // ... (conteúdo da aba resumo)
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoApostaBase],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de 11 Acertos por Sorteio', mediasPremios.onze],
                ['Média de Prêmios de 12 Acertos por Sorteio', mediasPremios.doze],
                ['Média de Prêmios de 13 Acertos por Sorteio', mediasPremios.treze],
                ['Média de Prêmios de 14 Acertos por Sorteio', mediasPremios.quatorze],
                ['Média de Prêmios de 15 Acertos por Sorteio', mediasPremios.quinze],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem 15 Acertos)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem 15 Acertos %)', roiSemMaximo],
                ['Mínimo de Acertos de 11 em um Sorteio', minMaxAcertos.onze.min === Infinity ? 0 : minMaxAcertos.onze.min],
                ['Máximo de Acertos de 11 em um Sorteio', minMaxAcertos.onze.max],
                ['Mínimo de Acertos de 12 em um Sorteio', minMaxAcertos.doze.min === Infinity ? 0 : minMaxAcertos.doze.min],
                ['Máximo de Acertos de 12 em um Sorteio', minMaxAcertos.doze.max],
                ['Mínimo de Acertos de 13 em um Sorteio', minMaxAcertos.treze.min === Infinity ? 0 : minMaxAcertos.treze.min],
                ['Máximo de Acertos de 13 em um Sorteio', minMaxAcertos.treze.max],
                ['Mínimo de Acertos de 14 em um Sorteio', minMaxAcertos.quatorze.min === Infinity ? 0 : minMaxAcertos.quatorze.min],
                ['Máximo de Acertos de 14 em um Sorteio', minMaxAcertos.quatorze.max],
                ['Mínimo de Acertos de 15 em um Sorteio', minMaxAcertos.quinze.min === Infinity ? 0 : minMaxAcertos.quinze.min],
                ['Máximo de Acertos de 15 em um Sorteio', minMaxAcertos.quinze.max],
                ['Sorteios sem Nenhum Acerto de 11', totaisSorteiosSemPremio.onze],
                ['Sorteios sem Nenhum Acerto de 12', totaisSorteiosSemPremio.doze],
                ['Sorteios sem Nenhum Acerto de 13', totaisSorteiosSemPremio.treze],
                ['Sorteios sem Nenhum Acerto de 14', totaisSorteiosSemPremio.quatorze],
                ['Sorteios sem Nenhum Acerto de 15', totaisSorteiosSemPremio.quinze],
                ['Total de Onzes Distintos Repetidos (nos seus jogos)', totalOnzesRepetidasUser],
                ['Total de Dozes Distintos Repetidos (nos seus jogos)', totalDozesRepetidasUser],
                ['Total de Trezes Distintos Repetidos (nos seus jogos)', totalTrezesRepetidasUser],
                ['Total de Quatorzes Distintos Repetidos (nos seus jogos)', totalQuatorzesRepetidasUser],
                ['Total de Quinzes Distintos Repetidos (nos seus jogos)', totalQuinzesRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        } else { // Mega-Sena
            dadosResumo = [ // ... (conteúdo da aba resumo)
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoApostaBase],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de Quadra por Sorteio', mediasPremios.quadra],
                ['Média de Prêmios de Quina por Sorteio', mediasPremios.quina],
                ['Média de Prêmios de Sena por Sorteio', mediasPremios.sena],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem Sena)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem Sena %)', roiSemMaximo],
                ['Mínimo de Acertos de Quadra em um Sorteio', minMaxAcertos.quadra.min === Infinity ? 0 : minMaxAcertos.quadra.min],
                ['Máximo de Acertos de Quadra em um Sorteio', minMaxAcertos.quadra.max],
                ['Mínimo de Acertos de Quina em um Sorteio', minMaxAcertos.quina.min === Infinity ? 0 : minMaxAcertos.quina.min],
                ['Máximo de Acertos de Quina em um Sorteio', minMaxAcertos.quina.max],
                ['Sorteios sem Nenhum Acerto de Quadra', totaisSorteiosSemPremio.quadra],
                // Para Mega-Sena, faz sentido mostrar apenas a partir de Quadras repetidas, mas podemos manter a estrutura
                ['Total de Quadras Distintas Repetidas (nos seus jogos)', totalQuadrasRepetidasUser],
                ['Total de Quinas Distintas Repetidas (nos seus jogos)', totalQuinasRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        }

        // Cria o workbook e a primeira aba (Resumo)
        const wb = XLSX.utils.book_new();
        const planilhaResumo = XLSX.utils.aoa_to_sheet(dadosResumo);
        planilhaResumo['!cols'] = [{ wch: 50 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, planilhaResumo, 'Resumo');

        progress.textContent = 'Gerando arquivo Excel...';

        // Cria a aba "Prêmios por Sorteio"
        const prizeHeaders = gameConfig.prizeTiers.map(tier => `Prêmios de ${tier.key.charAt(0).toUpperCase() + tier.key.slice(1)}`);
        const dadosDetalhado = [
            ['Sorteio Histórico', ...prizeHeaders, 'Valor Total de Prêmio no Sorteio']
        ].concat(resultados);

        const planilhaDetalhado = XLSX.utils.aoa_to_sheet(dadosDetalhado);

        // Formata as células da aba "Prêmios por Sorteio"
        const premioColIndex = gameConfig.prizeTiers.length + 1;
        const colWidthsDetalhado = [{wch: 15}];
        gameConfig.prizeTiers.forEach(() => colWidthsDetalhado.push({wch: 18}));
        colWidthsDetalhado.push({wch: 25});
        planilhaDetalhado['!cols'] = colWidthsDetalhado;

        for (let r = 1; r < dadosDetalhado.length; r++) { 
            for (let c = 0; c < dadosDetalhado[0].length; c++) { 
                const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                if (!planilhaDetalhado[cellRef] || planilhaDetalhado[cellRef].v === undefined || planilhaDetalhado[cellRef].v === null) continue;
                
                planilhaDetalhado[cellRef].t = 'n'; // Todos os dados aqui são numéricos
                if (c === premioColIndex) {
                    planilhaDetalhado[cellRef].z = 'R$ #,##0.00'; 
                } else if (c > 0) { 
                    planilhaDetalhado[cellRef].z = '#,##0';
                } else { // Coluna do Sorteio Histórico (Concurso)
                    planilhaDetalhado[cellRef].z = '0'; 
                }
            }
        }
        XLSX.utils.book_append_sheet(wb, planilhaDetalhado, 'Prêmios por Sorteio');

        // Cria abas individuais de "Prêmios por Sorteio" para cada arquivo
        allUserGamesData.forEach(fileData => {
            const dadosIndividuais = [
                ['Sorteio Histórico', ...prizeHeaders, 'Valor Total de Prêmio no Sorteio']
            ].concat(resultadosIndividuais[fileData.fileName]);

            const planilhaIndividual = XLSX.utils.aoa_to_sheet(dadosIndividuais);

            // Formata as células da aba individual
            planilhaIndividual['!cols'] = colWidthsDetalhado;

            for (let r = 1; r < dadosIndividuais.length; r++) { 
                for (let c = 0; c < dadosIndividuais[0].length; c++) { 
                    const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                    if (!planilhaIndividual[cellRef] || planilhaIndividual[cellRef].v === undefined || planilhaIndividual[cellRef].v === null) continue;
                    
                    planilhaIndividual[cellRef].t = 'n'; // Todos os dados aqui são numéricos
                    if (c === premioColIndex) {
                        planilhaIndividual[cellRef].z = 'R$ #,##0.00'; 
                    } else if (c > 0) { 
                        planilhaIndividual[cellRef].z = '#,##0';
                    } else { // Coluna do Sorteio Histórico (Concurso)
                        planilhaIndividual[cellRef].z = '0'; 
                    }
                }
            }

            // Cria um nome de aba válido e único para prêmios
            let sheetNamePremios = `Prêmios_${fileData.fileName.replace(/\.xlsx$/i, '').replace(/[\/\\?*\[\]]/g, '')}`;
            sheetNamePremios = sheetNamePremios.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, planilhaIndividual, sheetNamePremios);
        });

        // Cria uma aba para cada arquivo de jogo original do usuário
        allUserGamesData.forEach(fileData => {
            const maxDezenasOriginais = Math.max(0, ...fileData.originalGames.map(jogo => jogo.length));
            const dadosOriginais = [
                ['Índice Original', ...Array.from({length: maxDezenasOriginais}, (_, i) => `Dezena ${i + 1}`)]
            ].concat(fileData.originalGames.map((jogo, indice) => {
                const dezenasOrdenadas = [...jogo].sort((a, b) => a - b);
                return [indice + 1, ...dezenasOrdenadas, ...Array(Math.max(0, maxDezenasOriginais - dezenasOrdenadas.length)).fill('')];
            }));

            const planilhaOriginais = XLSX.utils.aoa_to_sheet(dadosOriginais);
            if (dadosOriginais.length > 1 && dadosOriginais[0].length > 1) {
                for (let r = 1; r < dadosOriginais.length; r++) {
                    for (let c = 1; c < dadosOriginais[0].length; c++) {
                        const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                        if (planilhaOriginais[cellRef] && planilhaOriginais[cellRef].v !== '' && planilhaOriginais[cellRef].v !== null) {
                            planilhaOriginais[cellRef].t = 'n';
                            planilhaOriginais[cellRef].z = '00';
                        }
                    }
                }
            }
            planilhaOriginais['!cols'] = [{wch:15}, ...Array(maxDezenasOriginais).fill({ wch: 10 })];

            // Cria um nome de aba válido e curto
            let sheetName = fileData.fileName.replace(/\.xlsx$/i, '').replace(/[\/\\?*\[\]]/g, '');
            sheetName = sheetName.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, planilhaOriginais, sheetName);
        });

        // Cria a aba "Meus Jogos Expandidos", se houver
        if (temJogosExpandidos) {
            const dadosModificados = [
                ['Índice Original', 'Arquivo Original', ...Array.from({length: gameConfig.expectedNumbers}, (_, i) => `Dezena ${i + 1}`)]
            ].concat(jogosUsuarioExpandidos.map(item => {
                const [indice, ...dezenas] = item.gameData;
                return [indice, item.file, ...dezenas];
            }));
            const planilhaModificados = XLSX.utils.aoa_to_sheet(dadosModificados);
             for (let r = 1; r < dadosModificados.length; r++) {
                for (let c = 1; c < dadosModificados[0].length; c++) { 
                    const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                     if (planilhaModificados[cellRef] && planilhaModificados[cellRef].v !== '' && planilhaModificados[cellRef].v !== null) {
                        planilhaModificados[cellRef].t = 'n';
                        planilhaModificados[cellRef].z = '00';
                    }
                }
            }
            planilhaModificados['!cols'] = [{wch:15}, {wch:30}, ...Array(gameConfig.expectedNumbers).fill({ wch: 10 })];
            XLSX.utils.book_append_sheet(wb, planilhaModificados, 'Meus Jogos Expandidos');
        }

        // Nova Planilha: Frequência de Prêmios por Sorteio
        const dadosFrequencia = [];
        dadosFrequencia.push(['Análise de Frequência de Prêmios por Sorteio']); // Título Geral
        dadosFrequencia.push([]); // Linha em branco

        const processarFrequenciaTipo = (tipoNomeAmigavel, freqObj, nomeChaveFrequencia) => {
            if (Object.keys(freqObj).length === 0 && !(freqObj[0] > 0) ) { // Se não houve prêmios OU se não há contagem para 0 prêmios
                 // Verificar se existe a chave "0" com contagem, pois ela é válida (0 prêmios daquele tipo)
                let temContagemParaZero = false;
                if (frequenciaPremiosPorSorteio[nomeChaveFrequencia] && frequenciaPremiosPorSorteio[nomeChaveFrequencia][0] !== undefined) {
                    temContagemParaZero = true;
                }
                if (!temContagemParaZero && Object.keys(frequenciaPremiosPorSorteio[nomeChaveFrequencia]).length === 0) {
                    return; // Pula se realmente não há dados para este tipo de prêmio
                }
            }

            dadosFrequencia.push([`Frequência de Prêmios de ${tipoNomeAmigavel}`]);
            dadosFrequencia.push([`Número Exato de Prêmios de ${tipoNomeAmigavel} Obtidos em um Sorteio`, 'Quantidade de Sorteios']);
            
            const chavesOrdenadas = Object.keys(frequenciaPremiosPorSorteio[nomeChaveFrequencia]).map(Number).sort((a, b) => a - b);
            
            // Garante que o "0" apareça se não estiver presente mas deveria (todos os sorteios)
            if (!chavesOrdenadas.includes(0) && numeroJogosHistoricos > 0) {
                let totalSorteiosComAlgumPremioDesseTipo = 0;
                chavesOrdenadas.forEach(key => {
                    if (key > 0) {
                        totalSorteiosComAlgumPremioDesseTipo += frequenciaPremiosPorSorteio[nomeChaveFrequencia][key];
                    }
                });
                 // Só adiciona o 0 se a contagem para 0 explícita não existir e o total de sorteios for maior que os sorteios com prêmios
                if (frequenciaPremiosPorSorteio[nomeChaveFrequencia][0] === undefined && numeroJogosHistoricos > totalSorteiosComAlgumPremioDesseTipo) {
                    dadosFrequencia.push([0, numeroJogosHistoricos - totalSorteiosComAlgumPremioDesseTipo]);
                }
            }

            for (const numPremios of chavesOrdenadas) {
                dadosFrequencia.push([numPremios, frequenciaPremiosPorSorteio[nomeChaveFrequencia][numPremios]]);
            }
            dadosFrequencia.push([]); // Linha em branco para separar seções
        };

        gameConfig.prizeTiers.forEach(tier => {
            const nomeAmigavel = tier.key.charAt(0).toUpperCase() + tier.key.slice(1);
            const nomeFinal = tier.isMaxPrize ? `${nomeAmigavel} (Prêmio Máximo)` : nomeAmigavel;
            processarFrequenciaTipo(nomeFinal, frequenciaPremiosPorSorteio[tier.key], tier.key);
        });
        
        if (dadosFrequencia.length > 2) { 
            const planilhaFrequencia = XLSX.utils.aoa_to_sheet(dadosFrequencia);
            // Formatação da planilha de frequência
            for (let r = 0; r < dadosFrequencia.length; r++) {
                const linhaAtual = dadosFrequencia[r];
                if (linhaAtual.length === 2 && typeof linhaAtual[0] === 'number' && typeof linhaAtual[1] === 'number') { // Linhas de dados [numPremios, qtdSorteios]
                    const cellA = XLSX.utils.encode_cell({r: r, c: 0});
                    const cellB = XLSX.utils.encode_cell({r: r, c: 1});
                    if(planilhaFrequencia[cellA]) { planilhaFrequencia[cellA].t = 'n'; planilhaFrequencia[cellA].z = '#,##0'; }
                    if(planilhaFrequencia[cellB]) { planilhaFrequencia[cellB].t = 'n'; planilhaFrequencia[cellB].z = '#,##0'; }
                } else if (linhaAtual.length === 1 && r > 0) { // Títulos de seção (ex: "Frequência de Prêmios de Duque")
                    // Pode adicionar formatação de negrito ou mesclagem aqui se desejar
                    // Exemplo de mesclagem:
                    // if (!planilhaFrequencia['!merges']) planilhaFrequencia['!merges'] = [];
                    // planilhaFrequencia['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: 1 } }); // Mescla A e B
                }
            }
            planilhaFrequencia['!cols'] = [{ wch: 50 }, { wch: 20 }]; // Ajustar larguras
            XLSX.utils.book_append_sheet(wb, planilhaFrequencia, 'Frequência de Prêmios');
        }

        // Criação da Planilha "Repetidos no Meu Jogo" (usa frequenciaAgrupamentosInternos já populado)
        const dadosRepetidosInternos = [['Tipo de Agrupamento', 'Dezenas', 'Quantidade de Repetições']];
        const addRepetidosParaTipo = (tipoNomeAmigavel, freqMap) => {
            for (const comboKey in freqMap) {
                if (freqMap[comboKey] > 1) { // Apenas os repetidos
                    const dezenasArray = JSON.parse(comboKey);
                    const dezenasStr = dezenasArray.map(d => String(d).padStart(2, '0')).join(', ');
                    dadosRepetidosInternos.push([tipoNomeAmigavel, dezenasStr, freqMap[comboKey]]);
                }
            }
        };
        addRepetidosParaTipo('Duque', frequenciaAgrupamentosInternos.duques);
        addRepetidosParaTipo('Terno', frequenciaAgrupamentosInternos.ternos);
        addRepetidosParaTipo('Quadra', frequenciaAgrupamentosInternos.quadras);
        addRepetidosParaTipo('Quina', frequenciaAgrupamentosInternos.quinas);
        addRepetidosParaTipo('Sena', frequenciaAgrupamentosInternos.senas);
        addRepetidosParaTipo('Onze', frequenciaAgrupamentosInternos.onzes);
        addRepetidosParaTipo('Doze', frequenciaAgrupamentosInternos.dozes);
        addRepetidosParaTipo('Treze', frequenciaAgrupamentosInternos.trezes);
        addRepetidosParaTipo('Quatorze', frequenciaAgrupamentosInternos.quatorzes);
        addRepetidosParaTipo('Quinze', frequenciaAgrupamentosInternos.quinzes);

        if (dadosRepetidosInternos.length > 1) {
            const planilhaRepetidosInternos = XLSX.utils.aoa_to_sheet(dadosRepetidosInternos);
            for (let r = 1; r < dadosRepetidosInternos.length; r++) {
                const cellDezenas = XLSX.utils.encode_cell({r: r, c: 1});
                if (planilhaRepetidosInternos[cellDezenas]) {
                    planilhaRepetidosInternos[cellDezenas].t = 's'; // Forçar como string para manter formatação "01, 02"
                }
                const cellQuantidade = XLSX.utils.encode_cell({r: r, c: 2});
                if (planilhaRepetidosInternos[cellQuantidade]) {
                    planilhaRepetidosInternos[cellQuantidade].t = 'n';
                    planilhaRepetidosInternos[cellQuantidade].z = '#,##0';
                }
            }
            planilhaRepetidosInternos['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, planilhaRepetidosInternos, 'Repetidos no Meu Jogo');
        }

        // Store workbook and report data globally instead of saving immediately
        const filename = `Relatorio_Analise_${tipoJogo}.xlsx`;
        window.analysisWorkbook = { wb, filename };
        window.analysisReportData = { dadosResumo, tipoJogo }; // Store data for PDF

        // Show export buttons
        if (excelBtn) excelBtn.style.display = 'inline-flex';
        if (pizzaPdfBtn) pizzaPdfBtn.style.display = 'inline-flex';
        // The comparative chart button is handled by charts.js
        
        progress.style.display = 'none';
        status.textContent = 'Análise concluída! Gráficos de pizza gerados. Você já pode salvar o relatório em Excel ou PDF.';
        status.className = 'status-message success';
        status.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao processar arquivos:', error);
        progress.style.display = 'none';
        status.textContent = `Erro: ${error.message}`;
        status.classList.add('error');
        status.style.display = 'flex';
    } finally {
        // O loader já é ocultado no início, mas isso garante que ele não reapareça em caso de erro inesperado.
        loader.style.display = 'none';
    }
}

export { executeAnalysis, saveAnalysisToExcel, printPieChartsToPDF };