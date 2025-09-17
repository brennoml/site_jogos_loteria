import { parseBrazilianNumber } from './validators.js';
import { calculatePrizesForGames as calculatePrizesForSingleDraw } from './utils.js';
import { PRIZE_DEFAULTS, GAME_COSTS } from './constants.js';
import { GAME_ANALYSIS_CONFIG } from './analyze.js';
import { validateAndGetFileInfo } from './validators.js';

// Objeto para armazenar as instâncias dos gráficos atuais
const chartInstances = {};

/**
 * Lê jogos de um arquivo Excel para análise gráfica
 * @param {File} file - Arquivo Excel contendo os jogos
 * @param {number} numerosEsperados - Quantidade esperada de números por jogo (não utilizado)
 * @param {number} maxBalls - Valor máximo válido para as bolas
 * @returns {Promise<Array<Array<number>>>} Array de jogos válidos
 */

/**
 * Calcula os prêmios para cada sorteio histórico.
 */
function calculatePrizes(jogos, resultadosHistoricos, gameConfig, premios, downgradeMaxPrize = false) {
    return resultadosHistoricos.map(resultado => 
        calculatePrizesForSingleDraw(jogos, resultado, gameConfig, premios, downgradeMaxPrize)
    );
}

/**
 * Obtém as configurações dos eixos do gráfico.
 */
function getAxisConfig() {
    const xMinElement = document.getElementById('analise-grafico-eixo-x-min');
    const xMaxElement = document.getElementById('analise-grafico-eixo-x-max');
    const yMinElement = document.getElementById('analise-grafico-eixo-y-min');
    const yMaxElement = document.getElementById('analise-grafico-eixo-y-max');

    return {
        xMin: xMinElement ? parseFloat(xMinElement.value) || null : null, // Mudado para parseFloat para percentuais
        xMax: xMaxElement ? parseFloat(xMaxElement.value) || null : null, // Mudado para parseFloat para percentuais
        yMin: yMinElement ? parseBrazilianNumber(yMinElement.value) || null : null,
        yMax: yMaxElement ? parseBrazilianNumber(yMaxElement.value) || null : null
    };
}

/**
 * Obtém as configurações dos eixos do gráfico de distribuição.
 */
function getDistAxisConfig() {
    const xMinElement = document.getElementById('dist-grafico-eixo-x-min');
    const xMaxElement = document.getElementById('dist-grafico-eixo-x-max');
    const yMinElement = document.getElementById('dist-grafico-eixo-y-min');
    const yMaxElement = document.getElementById('dist-grafico-eixo-y-max');

    return {
        xMin: xMinElement ? parseBrazilianNumber(xMinElement.value) || null : null,
        xMax: xMaxElement ? parseBrazilianNumber(xMaxElement.value) || null : null,
        yMin: yMinElement ? parseBrazilianNumber(yMinElement.value) || null : null,
        yMax: yMaxElement ? parseBrazilianNumber(yMaxElement.value) || null : null
    };
}
/**
 * Cria um gráfico usando Chart.js.
 */
function createChart(canvasId, datasets, labels, title, axisConfig = {}) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        throw new Error('Elemento canvas para gráfico não encontrado');
    }
    
    const context = ctx.getContext('2d');
    
    const scalesConfig = {
        x: {
            display: true,
            title: {
                display: true,
                text: 'Percentual de Sorteios Testados (%)',
                color: '#374151',
                font: { size: 14, weight: 'bold' }
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
                callback: function(value) {
                    // Converte o índice para percentual baseado no total de dados
                    const totalItems = this.chart.data.labels.length;
                    const percentage = ((value + 1) / totalItems) * 100;
                    return percentage.toFixed(1) + '%';
                }
            }
        },
        y: {
            display: true,
            position: 'right', // Move para o lado direito
            title: {
                display: true,
                text: 'Prêmios por Sorteio (R$)',
                color: '#374151',
                font: { size: 14, weight: 'bold' }
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
                callback: function(value) {
                    return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    }).format(value);
                }
            }
        }
    };

    // Aplicar configurações personalizadas dos eixos
    if (axisConfig.xMin !== undefined && axisConfig.xMin !== null && axisConfig.xMin !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = datasets.length > 0 ? datasets[0].data.length : 100;
        scalesConfig.x.min = Math.floor((axisConfig.xMin / 100) * totalItems) - 1;
    }
    if (axisConfig.xMax !== undefined && axisConfig.xMax !== null && axisConfig.xMax !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = datasets.length > 0 ? datasets[0].data.length : 100;
        scalesConfig.x.max = Math.floor((axisConfig.xMax / 100) * totalItems) - 1;
    }
    if (axisConfig.yMin !== undefined && axisConfig.yMin !== null && axisConfig.yMin !== '') {
        scalesConfig.y.min = axisConfig.yMin;
    }
    if (axisConfig.yMax !== undefined && axisConfig.yMax !== null && axisConfig.yMax !== '') {
        scalesConfig.y.max = axisConfig.yMax;
    }
    
    const chart = new Chart(context, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 18, weight: 'bold' },
                    color: '#1f2937'
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const totalItems = context[0].chart.data.labels.length;
                            const percentage = ((dataIndex + 1) / totalItems) * 100;
                            return `Percentual: ${percentage.toFixed(1)}% (Sorteio ${dataIndex + 1} de ${totalItems})`;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            const formattedValue = new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                            }).format(value);
                            return `${context.dataset.label}: ${formattedValue}`;
                        }
                    }
                }
            },
            scales: scalesConfig,
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    chartInstances[canvasId] = chart;
}

/**
 * Cria um gráfico de distribuição de prêmios usando Chart.js.
 * @param {string} canvasId - ID do elemento canvas.
 * @param {Array} datasets - Os datasets para o gráfico.
 * @param {string} title - O título do gráfico.
 */
function createPrizeDistributionChart(canvasId, datasets, title, axisConfig = {}) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        throw new Error(`Elemento canvas para gráfico '${canvasId}' não encontrado`);
    }
    
    const context = ctx.getContext('2d');
    
    const scalesConfig = {
        x: {
            type: 'linear', // Eixo X é numérico (valor do prêmio)
            display: true,
            title: {
                display: true,
                text: 'Valor do Prêmio (R$)',
                color: '#374151',
                font: { size: 14, weight: 'bold' }
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
                callback: function(value) {
                    return new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    }).format(value);
                }
            }
        },
        y: {
            display: true,
            position: 'right',
            title: {
                display: true,
                text: 'Quantidade de Sorteios',
                color: '#374151',
                font: { size: 14, weight: 'bold' }
            },
            grid: {
                color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
                // Apenas inteiros no eixo Y
                precision: 0,
                beginAtZero: true
            }
        }
    };

    // Aplicar configurações personalizadas dos eixos
    if (axisConfig.xMin !== undefined && axisConfig.xMin !== null && axisConfig.xMin !== '') {
        scalesConfig.x.min = axisConfig.xMin;
    }
    if (axisConfig.xMax !== undefined && axisConfig.xMax !== null && axisConfig.xMax !== '') {
        scalesConfig.x.max = axisConfig.xMax;
    }
    if (axisConfig.yMin !== undefined && axisConfig.yMin !== null && axisConfig.yMin !== '') {
        scalesConfig.y.min = axisConfig.yMin;
    }
    if (axisConfig.yMax !== undefined && axisConfig.yMax !== null && axisConfig.yMax !== '') {
        scalesConfig.y.max = axisConfig.yMax;
    }
    
    const chart = new Chart(context, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 18, weight: 'bold' },
                    color: '#1f2937'
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const value = context[0].parsed.x;
                            const formattedValue = new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                            }).format(value);
                            return `Prêmio de ${formattedValue}`;
                        },
                        label: function(context) {
                            const count = context.parsed.y;
                            return `${context.dataset.label}: ${count} sorteio(s)`;
                        }
                    }
                }
            },
            scales: scalesConfig,
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    chartInstances[canvasId] = chart;
}

/**
 * Atualiza os eixos do gráfico atual.
 */
function updateChartAxes() {
    const mainChart = chartInstances['resultsChart'];
    if (!mainChart) {
        console.warn('Nenhum gráfico principal ativo para atualizar');
        return;
    }

    const axisConfig = getAxisConfig();
    
    // Atualizar configurações dos eixos
    if (axisConfig.xMin !== undefined && axisConfig.xMin !== null && axisConfig.xMin !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = mainChart.data.labels.length;
        mainChart.options.scales.x.min = Math.floor((axisConfig.xMin / 100) * totalItems) - 1;
    } else {
        delete mainChart.options.scales.x.min;
    }
    
    if (axisConfig.xMax !== undefined && axisConfig.xMax !== null && axisConfig.xMax !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = mainChart.data.labels.length;
        mainChart.options.scales.x.max = Math.floor((axisConfig.xMax / 100) * totalItems) - 1;
    } else {
        delete mainChart.options.scales.x.max;
    }
    
    if (axisConfig.yMin !== undefined && axisConfig.yMin !== null && axisConfig.yMin !== '') {
        mainChart.options.scales.y.min = axisConfig.yMin;
    } else {
        delete mainChart.options.scales.y.min;
    }
    
    if (axisConfig.yMax !== undefined && axisConfig.yMax !== null && axisConfig.yMax !== '') {
        mainChart.options.scales.y.max = axisConfig.yMax;
    } else {
        delete mainChart.options.scales.y.max;
    }

    mainChart.update();
}

/**
 * Atualiza os eixos do gráfico de distribuição.
 */
function updateDistChartAxes() {
    const distChart = chartInstances['distributionChart'];
    if (!distChart) {
        console.warn('Nenhum gráfico de distribuição ativo para atualizar');
        return;
    }

    const axisConfig = getDistAxisConfig();
    
    // Update X axis
    if (axisConfig.xMin !== undefined && axisConfig.xMin !== null && axisConfig.xMin !== '') {
        distChart.options.scales.x.min = axisConfig.xMin;
    } else {
        delete distChart.options.scales.x.min;
    }
    
    if (axisConfig.xMax !== undefined && axisConfig.xMax !== null && axisConfig.xMax !== '') {
        distChart.options.scales.x.max = axisConfig.xMax;
    } else {
        delete distChart.options.scales.x.max;
    }
    
    // Update Y axis
    if (axisConfig.yMin !== undefined && axisConfig.yMin !== null && axisConfig.yMin !== '') {
        distChart.options.scales.y.min = axisConfig.yMin;
    } else {
        delete distChart.options.scales.y.min;
    }
    
    if (axisConfig.yMax !== undefined && axisConfig.yMax !== null && axisConfig.yMax !== '') {
        distChart.options.scales.y.max = axisConfig.yMax;
    } else {
        delete distChart.options.scales.y.max;
    }

    distChart.update();
}
/**
 * Preenche sugestões automáticas nos campos de eixos.
 */
function populateAxisSuggestions() {
    const mainChart = chartInstances['resultsChart'];
    if (!mainChart) return;

    let minX = 0, maxX = 100; // Para percentuais
    let minY = Infinity, maxY = -Infinity;

    mainChart.data.datasets.forEach(dataset => {
        dataset.data.forEach(value => {
            if (typeof value === 'number' && !isNaN(value)) {
                minY = Math.min(minY, value);
                maxY = Math.max(maxY, value);
            }
        });
    });

    const xMinInput = document.getElementById('analise-grafico-eixo-x-min');
    const xMaxInput = document.getElementById('analise-grafico-eixo-x-max');
    const yMinInput = document.getElementById('analise-grafico-eixo-y-min');
    const yMaxInput = document.getElementById('analise-grafico-eixo-y-max');

    if (xMinInput && !xMinInput.value) {
        xMinInput.placeholder = `Mín: ${minX}%`;
    }
    if (xMaxInput && !xMaxInput.value) {
        xMaxInput.placeholder = `Máx: ${maxX}%`;
    }
    if (yMinInput && !yMinInput.value) {
        yMinInput.placeholder = `Mín: ${minY !== Infinity ? 'R$ ' + minY.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : 'Auto'}`;
    }
    if (yMaxInput && !yMaxInput.value) {
        yMaxInput.placeholder = `Máx: ${maxY !== -Infinity ? 'R$ ' + maxY.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : 'Auto'}`;
    }
}

/**
 * Preenche sugestões automáticas nos campos de eixos do gráfico de distribuição.
 */
function populateDistAxisSuggestions() {
    const distChart = chartInstances['distributionChart'];
    if (!distChart) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    distChart.data.datasets.forEach(dataset => {
        dataset.data.forEach(point => {
            if (typeof point.x === 'number' && !isNaN(point.x)) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
            }
            if (typeof point.y === 'number' && !isNaN(point.y)) {
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }
        });
    });

    const xMinInput = document.getElementById('dist-grafico-eixo-x-min');
    const xMaxInput = document.getElementById('dist-grafico-eixo-x-max');
    const yMinInput = document.getElementById('dist-grafico-eixo-y-min');
    const yMaxInput = document.getElementById('dist-grafico-eixo-y-max');

    if (xMinInput && !xMinInput.value) {
        xMinInput.placeholder = `Mín: ${minX !== Infinity ? formatCurrency(minX) : 'Auto'}`;
    }
    if (xMaxInput && !xMaxInput.value) {
        xMaxInput.placeholder = `Máx: ${maxX !== -Infinity ? formatCurrency(maxX) : 'Auto'}`;
    }
    if (yMinInput && !yMinInput.value) {
        yMinInput.placeholder = `Mín: ${minY !== Infinity ? minY.toLocaleString('pt-BR') : 'Auto'}`;
    }
    if (yMaxInput && !yMaxInput.value) {
        yMaxInput.placeholder = `Máx: ${maxY !== -Infinity ? maxY.toLocaleString('pt-BR') : 'Auto'}`;
    }
}


/**
 * Imprime o gráfico atual em PDF.
 */
function printChartToPDF() {
    const mainChart = chartInstances['resultsChart'];
    if (!mainChart) {
        alert('Nenhum gráfico principal disponível para imprimir. Gere um gráfico primeiro.');
        return;
    }

    if (!window.jspdf) {
        alert('Biblioteca jsPDF não carregada. Verifique se o script está incluído no HTML.');
        return;
    }

    try {
        // Obter informações do gráfico atual
        const tipoJogo = document.getElementById('gameTypeGlobal').value.toUpperCase();
        const canvas = document.getElementById('resultsChart');
        
        if (!canvas) {
            throw new Error('Canvas do gráfico não encontrado');
        }

        // Criar o PDF em formato paisagem para melhor visualização do gráfico
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Configurações da página
        const pageWidth = 297; // A4 paisagem
        const pageHeight = 210;
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);
        const contentHeight = pageHeight - (2 * margin);

        // Adicionar título
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        const title = `Análise Gráfica Comparativa - ${tipoJogo}`;
        const titleWidth = pdf.getTextWidth(title);
        const titleX = (pageWidth - titleWidth) / 2;
        pdf.text(title, titleX, margin + 10);

        // Adicionar data e hora
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const now = new Date();
        const dateTime = `Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
        const dateTimeWidth = pdf.getTextWidth(dateTime);
        const dateTimeX = pageWidth - margin - dateTimeWidth;
        pdf.text(dateTime, dateTimeX, margin + 5);

        // Calcular dimensões do gráfico no PDF
        const chartStartY = margin + 25;
        const chartHeight = contentHeight - 60; // Deixa espaço para informações adicionais
        const chartWidth = contentWidth;

        // Capturar o gráfico como imagem
        const chartImage = canvas.toDataURL('image/png', 1.0);
        
        // Adicionar o gráfico ao PDF
        pdf.addImage(chartImage, 'PNG', margin, chartStartY, chartWidth, chartHeight);

        // Adicionar informações sobre configurações dos eixos
        const axisConfig = getAxisConfig();
        const infoStartY = chartStartY + chartHeight + 10;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Configurações dos Eixos:', margin, infoStartY);
        
        pdf.setFont('helvetica', 'normal');
        let currentY = infoStartY + 5;
        
        const axisInfo = [
            `Eixo X - Mínimo: ${axisConfig.xMin !== null ? axisConfig.xMin : 'Automático'}`,
            `Eixo X - Máximo: ${axisConfig.xMax !== null ? axisConfig.xMax : 'Automático'}`,
            `Eixo Y - Mínimo: ${axisConfig.yMin !== null ? new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(axisConfig.yMin) : 'Automático'}`,
            `Eixo Y - Máximo: ${axisConfig.yMax !== null ? new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(axisConfig.yMax) : 'Automático'}`
        ];

        axisInfo.forEach(info => {
            pdf.text(info, margin, currentY);
            currentY += 4;
        });

        // Adicionar informações sobre os arquivos analisados
        const datasetsInfo = mainChart.data.datasets.map(dataset => `• ${dataset.label}`);
        const filesStartX = margin + 120;
        let filesCurrentY = infoStartY;
        
        pdf.setFont('helvetica', 'bold');
        pdf.text('Arquivos Analisados:', filesStartX, filesCurrentY);
        
        pdf.setFont('helvetica', 'normal');
        filesCurrentY += 5;
        
        datasetsInfo.forEach(fileInfo => {
            pdf.text(fileInfo, filesStartX, filesCurrentY);
            filesCurrentY += 4;
        });

        // Adicionar rodapé
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        const footer = 'Gerado pelo LotoPro - Sistema Profissional de Análise de Loterias';
        const footerWidth = pdf.getTextWidth(footer);
        const footerX = (pageWidth - footerWidth) / 2;
        pdf.text(footer, footerX, pageHeight - 5);

        // Salvar o PDF
        const fileName = `Grafico_${tipoJogo}_${now.toISOString().slice(0, 10)}.pdf`;
        pdf.save(fileName);

        console.log('Gráfico impresso em PDF com sucesso');

    } catch (error) {
        console.error('Erro ao imprimir gráfico em PDF:', error);
        alert('Erro ao imprimir gráfico: ' + error.message);
    }
}

/**
 * Formata um valor como moeda brasileira.
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

/**
 * Reseta os sliders para os valores padrão.
 */
function resetAxisSliders() {
    // Limpa os inputs também
    const inputs = ['analise-grafico-eixo-x-min', 'analise-grafico-eixo-x-max', 'analise-grafico-eixo-y-min', 'analise-grafico-eixo-y-max'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) input.value = '';
    });
}

/**
 * Reseta os sliders do gráfico de distribuição para os valores padrão.
 */
function resetDistAxisSliders() {
    const inputs = ['dist-grafico-eixo-x-min', 'dist-grafico-eixo-x-max', 'dist-grafico-eixo-y-min', 'dist-grafico-eixo-y-max'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) input.value = '';
    });
}
/**
 * Função principal para gerar gráficos de resultados.
 */
async function generateResultCharts() {
    const status = document.getElementById('status-graficos');
    const progress = document.getElementById('progress-graficos');
    const loader = document.getElementById('loader-graficos');
    const orderedContainer = document.getElementById('ordenados-chart-container');
    const distContainer = document.getElementById('distribuicao-chart-container');
    const section = document.getElementById('analise-graficos-section');
    const printBtn = document.getElementById('btn-imprimir-grafico-analise');

    // Hide section at the beginning
    if (section) {
        section.style.display = 'none';
    }
    // Hide print button
    if (printBtn) {
        printBtn.style.display = 'none';
    }

    if (!status || !progress || !loader || !orderedContainer || !distContainer) {
        console.error('Elementos de gráficos não encontrados');
        alert('Elementos da interface de gráficos não encontrados');
        return;
    }

    status.textContent = 'Processando arquivos...';
    status.className = 'status-message info';
    status.style.display = 'flex';
    progress.textContent = 'Iniciando...';
    progress.style.display = 'flex';
    loader.style.display = 'flex';
    if (orderedContainer) orderedContainer.innerHTML = '';
    if (distContainer) distContainer.innerHTML = '';

    try {
        // Verificar se XLSX está disponível
        if (!window.XLSX) {
            throw new Error('Biblioteca XLSX não está carregada. Verifique se o script está incluído no HTML.');
        }

        // Verificar se Chart.js está disponível
        if (!window.Chart) {
            throw new Error('Biblioteca Chart.js não está carregada. Verifique se o script está incluído no HTML.');
        }

        // Ler a nova opção de rebaixamento de prêmio
        const downgradeMaxPrize = document.getElementById('downgradeMaxPrize')?.checked || false;

        const tipoJogo = document.getElementById('gameTypeGlobal').value;
        const gameConfig = GAME_ANALYSIS_CONFIG[tipoJogo];
        if (!gameConfig) {
            throw new Error(`Configurações de jogo não encontradas para "${tipoJogo}"`);
        }

        // Coletar arquivos selecionados
        const arquivos = [];
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
                    arquivos.push({
                        gameData: gameData,
                        name: gameData.name.replace(/\.xlsx$/i, ''),
                    });
                }
            }
        });

        if (arquivos.length === 0) {
            throw new Error('Por favor, adicione e selecione pelo menos um arquivo de jogo para análise.');
        }

        // USA OS RESULTADOS DA SIMULAÇÃO JÁ REALIZADA PELA ANÁLISE PRINCIPAL
        progress.textContent = 'Utilizando resultados da simulação principal...';
        const resultadosHistoricos = window.analysisSimulationResults;

        if (!resultadosHistoricos || resultadosHistoricos.length === 0) {
            throw new Error('Nenhum sorteio foi simulado. Verifique as configurações.');
        }

        // Coletar valores de prêmios com verificação segura de elementos
        const premios = {};
        gameConfig.prizeTiers.forEach(tier => {
            const inputEl = document.getElementById(tier.inputId);
            // Use default from constants if input is not found or empty
            premios[tier.key] = inputEl 
                ? (parseBrazilianNumber(inputEl.value) || PRIZE_DEFAULTS[tipoJogo][tier.key]) 
                : PRIZE_DEFAULTS[tipoJogo][tier.key];
        });

        // Processar cada arquivo
        const datasets = [];
        const distributionDatasets = []; // Para o gráfico de distribuição
        const colors = [
            '#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#06b6d4'
        ];
        const costTable = GAME_COSTS[tipoJogo] || {};

        for (let i = 0; i < arquivos.length; i++) {
            const arquivo = arquivos[i];
            progress.textContent = `Processando arquivo ${i + 1} de ${arquivos.length}: ${arquivo.name}...`;

            let jogos;
            if (arquivo.gameData.type === 'external') {
                const fileInfo = await validateAndGetFileInfo(arquivo.gameData.file);
                jogos = fileInfo.games;
            } else if (arquivo.gameData.type === 'generated' && arquivo.gameData.allGames) {
                // The games are already in memory, just need to ensure they are valid for the current context
                jogos = arquivo.gameData.allGames
                    .map(row => row.filter(num => num >= 1 && num <= gameConfig.maxBalls).map(Number))
                    .filter(row => row.length > 0)
                    .map(row => row.sort((a, b) => a - b));
            } else {
                jogos = [];
            }
            
            if (jogos.length === 0) {
                console.warn(`Nenhum jogo válido encontrado no item: ${arquivo.name}`);
                continue;
            }

            // Calcula o custo total para os jogos deste arquivo
            let custoTotalArquivo = 0;
            jogos.forEach(jogo => {
                custoTotalArquivo += costTable[jogo.length] || 0;
            });
            const custoTotalFormatado = formatCurrency(custoTotalArquivo);
            const newLabel = `${arquivo.name} (Custo: ${custoTotalFormatado})`;

            // Dados para o primeiro gráfico (prêmios ordenados), considerando a opção de rebaixamento
            const premiosPorSorteio = calculatePrizes(jogos, resultadosHistoricos, gameConfig, premios, downgradeMaxPrize);
            const dadosOrdenados = premiosPorSorteio
                .map((premio, index) => ({ premio, sorteio: index + 1 }))
                .sort((a, b) => a.premio - b.premio);
            datasets.push({
                label: newLabel,
                data: dadosOrdenados.map(d => d.premio),
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            });

            // Dados para o segundo gráfico (distribuição de prêmios)
            const prizeDistribution = premiosPorSorteio.reduce((acc, prize) => {
                acc[prize] = (acc[prize] || 0) + 1;
                return acc;
            }, {});

            const distributionData = Object.entries(prizeDistribution).map(([prize, count]) => ({
                x: Number(prize),
                y: count
            })).sort((a, b) => a.x - b.x);

            distributionDatasets.push({
                label: newLabel,
                data: distributionData,
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length] + '20',
                fill: false
            });
        }

        if (datasets.length === 0) {
            throw new Error('Nenhum arquivo continha jogos válidos para análise.');
        }

        // Criar labels e canvas
        // Gráfico 1: Prêmios Ordenados
        const maxLength = Math.max(...datasets.map(d => d.data.length));
        const labels = Array.from({ length: maxLength }, (_, i) => i + 1);
        const axisConfig = getAxisConfig();

        // Criar container do gráfico
        const chartContainer = document.createElement('div');
        chartContainer.style.width = '100%';
        chartContainer.style.height = '500px';
        chartContainer.style.position = 'relative';
        chartContainer.style.marginTop = '20px';

        const canvas = document.createElement('canvas');
        canvas.id = 'resultsChart';
        canvas.style.maxHeight = '500px';
        chartContainer.appendChild(canvas);
        if (orderedContainer) orderedContainer.appendChild(chartContainer);

        // Mostrar seção inteira, container e criar gráfico
        if (section) section.style.display = 'block';
        createChart('resultsChart', datasets, labels, 
            `Prêmios por Sorteio (Ordenados por Valor) - ${tipoJogo.toUpperCase()}`, axisConfig);

        // Gráfico 2: Distribuição de Prêmios
        const distAxisConfig = getDistAxisConfig();
        const distChartContainer = document.createElement('div');
        distChartContainer.style.width = '100%';
        distChartContainer.style.height = '500px';
        distChartContainer.style.position = 'relative';
        distChartContainer.style.marginTop = '40px';

        const distCanvas = document.createElement('canvas');
        distCanvas.id = 'distributionChart';
        distCanvas.style.maxHeight = '500px';
        distChartContainer.appendChild(distCanvas);
        if (distContainer) distContainer.appendChild(distChartContainer);

        createPrizeDistributionChart('distributionChart', distributionDatasets, `Distribuição de Prêmios por Sorteio - ${tipoJogo.toUpperCase()}`, distAxisConfig);

        // Preencher sugestões de valores mínimos e máximos
        populateAxisSuggestions();
        populateDistAxisSuggestions();

        // Show print button
        if (printBtn) {
            printBtn.style.display = 'inline-flex';
        }

        status.textContent = `Gráfico gerado com sucesso! ${arquivos.length} arquivo(s) analisado(s).`;
        status.className = 'status-message success';
        progress.style.display = 'none';

    } catch (error) {
        console.error('Erro ao gerar gráficos:', error);
        status.textContent = 'Erro: ' + error.message;
        status.className = 'status-message error';
        progress.style.display = 'none';
    } finally {
        loader.style.display = 'none';
    }
}

export { generateResultCharts, updateChartAxes, printChartToPDF, resetAxisSliders, updateDistChartAxes, resetDistAxisSliders };
