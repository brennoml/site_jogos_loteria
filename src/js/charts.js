import { parseBrazilianNumber } from './validators.js';
import { randomChoice, combinationsCount } from './utils.js';

// Constantes locais de prêmios padrão (cópia da constants.js)
const PRIZE_DEFAULTS = {
    megasena: {
        quadra: 1000,
        quina: 80000,
        sena: 500000000
    },
    quina: {
        duque: 6,
        terno: 120,
        quadra: 7000,
        quina: 230000000
    },
    lotofacil: {
        onze: 7,
        doze: 14,
        treze: 35,
        quatorze: 2000,
        quinze: 1000000
    }
};

// Configurações de jogo para os gráficos, similar ao analyze.js
const GAME_CHART_CONFIG = {
    megasena: {
        expectedNumbers: 6,
        maxBalls: 60,
        prizeTiers: [
            { key: 'quadra', hits: 4 },
            { key: 'quina', hits: 5 },
            { key: 'sena', hits: 6 }
        ]
    },
    quina: {
        expectedNumbers: 5,
        maxBalls: 80,
        prizeTiers: [
            { key: 'duque', hits: 2 },
            { key: 'terno', hits: 3 },
            { key: 'quadra', hits: 4 },
            { key: 'quina', hits: 5 }
        ]
    },
    lotofacil: {
        expectedNumbers: 15,
        maxBalls: 25,
        prizeTiers: [
            { key: 'onze', hits: 11 }, { key: 'doze', hits: 12 }, { key: 'treze', hits: 13 },
            { key: 'quatorze', hits: 14 }, { key: 'quinze', hits: 15 }
        ]
    }
};

// Tabela de custos por quantidade de dezenas jogadas.
// Fonte: Caixa Econômica Federal (valores de exemplo).
const GAME_COSTS = {
    megasena: {
        6: 6.00, 7: 42.00, 8: 168.00, 9: 504.00, 10: 1260.00,
        11: 2772.00, 12: 5544.00, 13: 10296.00, 14: 18018.00, 15: 30030.00,
        16: 48048.00, 17: 74256.00, 18: 111384.00, 19: 162792.00, 20: 232560.00
    },
    quina: {
        5: 3.00, 6: 18.00, 7: 63.00, 8: 168.00, 9: 378.00,
        10: 756.00, 11: 1386.00, 12: 2376.00, 13: 3861.00, 14: 6006.00, 15: 9009.00
    },
    lotofacil: {
        15: 3.50, 16: 56.00, 17: 476.00, 18: 2856.00, 19: 13566.00, 20: 54264.00
    }
};

// Variável global para armazenar a instância do gráfico atual
let currentChart = null;
let currentChartData = null;

/**
 * Lê jogos de um arquivo Excel para análise gráfica
 * @param {File} file - Arquivo Excel contendo os jogos
 * @param {number} numerosEsperados - Quantidade esperada de números por jogo (não utilizado)
 * @param {number} maxBalls - Valor máximo válido para as bolas
 * @returns {Promise<Array<Array<number>>>} Array de jogos válidos
 */
async function readGamesFromFile(file, numerosEsperados, maxBalls) {
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        return jsonData
            .map(row => row.filter(num => num !== null && !isNaN(Number(num)) && 
                Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBalls).map(Number))
            .filter(row => row.length > 0)
            .map(row => row.sort((a, b) => a - b));

    } catch (error) {
        console.error('Erro ao ler arquivo de jogos:', error);
        throw new Error('Erro ao processar o arquivo. Verifique o formato.');
    }
}

/**
 * Calcula os prêmios para cada sorteio histórico.
 */
function calculatePrizes(jogos, resultadosHistoricos, gameConfig, premios) {
    return resultadosHistoricos.map(resultado => {
        const numerosHistoricos = new Set(resultado);
        let premioTotal = 0;

        jogos.forEach(jogo => {
            const dezenasDoJogo = jogo;
            const acertosNoJogo = dezenasDoJogo.filter(num => numerosHistoricos.has(num)).length;

            gameConfig.prizeTiers.forEach(tier => {
                // tier.hits é o número de acertos para um prêmio (ex: 4 para quadra)
                // gameConfig.expectedNumbers é o tamanho de um jogo simples (ex: 6 para megasena)
                if (acertosNoJogo >= tier.hits && dezenasDoJogo.length >= tier.hits) {
                    const dezenasNaoSorteadasNoJogo = dezenasDoJogo.length - acertosNoJogo;
                    const dezenasASeremSorteadasDasNaoSorteadas = gameConfig.expectedNumbers - tier.hits;

                    if (dezenasNaoSorteadasNoJogo >= dezenasASeremSorteadasDasNaoSorteadas && dezenasASeremSorteadasDasNaoSorteadas >= 0) {
                        const combinacoesDeAcertos = combinationsCount(acertosNoJogo, tier.hits);
                        const combinacoesDeNaoAcertos = combinationsCount(dezenasNaoSorteadasNoJogo, dezenasASeremSorteadasDasNaoSorteadas);
                        const totalPremiosDesteTipo = combinacoesDeAcertos * combinacoesDeNaoAcertos;

                        if (totalPremiosDesteTipo > 0 && premios[tier.key] !== undefined) {
                            premioTotal += totalPremiosDesteTipo * premios[tier.key];
                        }
                    }
                }
            });
        });

        return premioTotal;
    });
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
 * Cria um gráfico usando Chart.js.
 */
function createChart(canvasId, datasets, labels, title, axisConfig = {}) {
    if (currentChart) {
        currentChart.destroy();
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
    
    currentChart = new Chart(context, {
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

    currentChartData = { datasets, labels, title };
}

/**
 * Atualiza os eixos do gráfico atual.
 */
function updateChartAxes() {
    if (!currentChart || !currentChartData) {
        console.warn('Nenhum gráfico ativo para atualizar');
        return;
    }

    const axisConfig = getAxisConfig();
    
    // Atualizar configurações dos eixos
    if (axisConfig.xMin !== undefined && axisConfig.xMin !== null && axisConfig.xMin !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = currentChart.data.labels.length;
        currentChart.options.scales.x.min = Math.floor((axisConfig.xMin / 100) * totalItems) - 1;
    } else {
        delete currentChart.options.scales.x.min;
    }
    
    if (axisConfig.xMax !== undefined && axisConfig.xMax !== null && axisConfig.xMax !== '') {
        // Para eixo X, converter de percentual para índice
        const totalItems = currentChart.data.labels.length;
        currentChart.options.scales.x.max = Math.floor((axisConfig.xMax / 100) * totalItems) - 1;
    } else {
        delete currentChart.options.scales.x.max;
    }
    
    if (axisConfig.yMin !== undefined && axisConfig.yMin !== null && axisConfig.yMin !== '') {
        currentChart.options.scales.y.min = axisConfig.yMin;
    } else {
        delete currentChart.options.scales.y.min;
    }
    
    if (axisConfig.yMax !== undefined && axisConfig.yMax !== null && axisConfig.yMax !== '') {
        currentChart.options.scales.y.max = axisConfig.yMax;
    } else {
        delete currentChart.options.scales.y.max;
    }

    currentChart.update();
}

/**
 * Preenche sugestões automáticas nos campos de eixos.
 */
function populateAxisSuggestions() {
    if (!currentChartData) return;

    let minX = 0, maxX = 100; // Para percentuais
    let minY = Infinity, maxY = -Infinity;

    currentChartData.datasets.forEach(dataset => {
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
 * Imprime o gráfico atual em PDF.
 */
function printChartToPDF() {
    if (!currentChart || !currentChartData) {
        alert('Nenhum gráfico disponível para imprimir. Gere um gráfico primeiro.');
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
        const datasetsInfo = currentChartData.datasets.map(dataset => `• ${dataset.label}`);
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
 * Função principal para gerar gráficos de resultados.
 */
async function generateResultCharts() {
    const status = document.getElementById('status-graficos');
    const progress = document.getElementById('progress-graficos');
    const loader = document.getElementById('loader-graficos');
    const container = document.getElementById('graficos-container');
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

    if (!status || !progress || !loader || !container) {
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
    container.innerHTML = '';
    container.style.display = 'none';

    try {
        // Verificar se XLSX está disponível
        if (!window.XLSX) {
            throw new Error('Biblioteca XLSX não está carregada. Verifique se o script está incluído no HTML.');
        }

        // Verificar se Chart.js está disponível
        if (!window.Chart) {
            throw new Error('Biblioteca Chart.js não está carregada. Verifique se o script está incluído no HTML.');
        }

        const tipoJogo = document.getElementById('gameTypeGlobal').value;
        const gameConfig = GAME_CHART_CONFIG[tipoJogo];
        if (!gameConfig) {
            throw new Error(`Configurações de jogo não encontradas para "${tipoJogo}"`);
        }

        // Coletar arquivos selecionados
        const arquivos = [];
        document.querySelectorAll('#analise-file-list .file-item-analise-wrapper').forEach(wrapper => {
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
        if (tipoJogo === 'quina') {
            const quinaDuqueElement = document.getElementById('quinaDuqueAnalise');
            const quinaTernoElement = document.getElementById('quinaTernoAnalise');
            const quinaQuadraElement = document.getElementById('quinaQuadraAnalise');
            const quinaQuinaElement = document.getElementById('quinaQuinaAnalise');

            premios.duque = quinaDuqueElement ? (parseBrazilianNumber(quinaDuqueElement.value) || PRIZE_DEFAULTS.quina.duque) : PRIZE_DEFAULTS.quina.duque;
            premios.terno = quinaTernoElement ? (parseBrazilianNumber(quinaTernoElement.value) || PRIZE_DEFAULTS.quina.terno) : PRIZE_DEFAULTS.quina.terno;
            premios.quadra = quinaQuadraElement ? (parseBrazilianNumber(quinaQuadraElement.value) || PRIZE_DEFAULTS.quina.quadra) : PRIZE_DEFAULTS.quina.quadra;
            premios.quina = quinaQuinaElement ? (parseBrazilianNumber(quinaQuinaElement.value) || PRIZE_DEFAULTS.quina.quina) : PRIZE_DEFAULTS.quina.quina;

        } else if (tipoJogo === 'lotofacil') {
            const lotofacilOnzeElement = document.getElementById('lotofacilOnzeAnalise');
            const lotofacilDozeElement = document.getElementById('lotofacilDozeAnalise');
            const lotofacilTrezeElement = document.getElementById('lotofacilTrezeAnalise');
            const lotofacilQuatorzeElement = document.getElementById('lotofacilQuatorzeAnalise');
            const lotofacilQuinzeElement = document.getElementById('lotofacilQuinzeAnalise');

            premios.onze = lotofacilOnzeElement ? (parseBrazilianNumber(lotofacilOnzeElement.value) || PRIZE_DEFAULTS.lotofacil.onze) : PRIZE_DEFAULTS.lotofacil.onze;
            premios.doze = lotofacilDozeElement ? (parseBrazilianNumber(lotofacilDozeElement.value) || PRIZE_DEFAULTS.lotofacil.doze) : PRIZE_DEFAULTS.lotofacil.doze;
            premios.treze = lotofacilTrezeElement ? (parseBrazilianNumber(lotofacilTrezeElement.value) || PRIZE_DEFAULTS.lotofacil.treze) : PRIZE_DEFAULTS.lotofacil.treze;
            premios.quatorze = lotofacilQuatorzeElement ? (parseBrazilianNumber(lotofacilQuatorzeElement.value) || PRIZE_DEFAULTS.lotofacil.quatorze) : PRIZE_DEFAULTS.lotofacil.quatorze;
            premios.quinze = lotofacilQuinzeElement ? (parseBrazilianNumber(lotofacilQuinzeElement.value) || PRIZE_DEFAULTS.lotofacil.quinze) : PRIZE_DEFAULTS.lotofacil.quinze;

        } else { // megasena
            const megasenaQuadraElement = document.getElementById('megasenaQuadraAnalise');
            const megasenaQuinaElement = document.getElementById('megasenaQuinaAnalise');
            const megasenaSenaElement = document.getElementById('megasenaSenaAnalise');

            premios.quadra = megasenaQuadraElement ? (parseBrazilianNumber(megasenaQuadraElement.value) || PRIZE_DEFAULTS.megasena.quadra) : PRIZE_DEFAULTS.megasena.quadra;
            premios.quina = megasenaQuinaElement ? (parseBrazilianNumber(megasenaQuinaElement.value) || PRIZE_DEFAULTS.megasena.quina) : PRIZE_DEFAULTS.megasena.quina;
            premios.sena = megasenaSenaElement ? (parseBrazilianNumber(megasenaSenaElement.value) || PRIZE_DEFAULTS.megasena.sena) : PRIZE_DEFAULTS.megasena.sena;
        }

        // Processar cada arquivo
        const datasets = [];
        const colors = [
            '#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#06b6d4'
        ];
        const costTable = GAME_COSTS[tipoJogo] || {};

        for (let i = 0; i < arquivos.length; i++) {
            const arquivo = arquivos[i];
            progress.textContent = `Processando arquivo ${i + 1} de ${arquivos.length}: ${arquivo.name}...`;

            let jogos;
            if (arquivo.gameData.type === 'external') {
                jogos = await readGamesFromFile(arquivo.gameData.file, gameConfig.expectedNumbers, gameConfig.maxBalls);
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

            const premiosPorSorteio = calculatePrizes(jogos, resultadosHistoricos, gameConfig, premios);
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
        }

        if (datasets.length === 0) {
            throw new Error('Nenhum arquivo continha jogos válidos para análise.');
        }

        // Criar labels e canvas
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
        container.appendChild(chartContainer);

        // Mostrar seção inteira, container e criar gráfico
        if (section) section.style.display = 'block';
        container.style.display = 'block';
        createChart('resultsChart', datasets, labels, 
            `Prêmios por Sorteio (Ordenados por Valor) - ${tipoJogo.toUpperCase()}`, axisConfig);

        // Preencher sugestões de valores mínimos e máximos
        populateAxisSuggestions();

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

export { generateResultCharts, updateChartAxes, printChartToPDF, resetAxisSliders };
