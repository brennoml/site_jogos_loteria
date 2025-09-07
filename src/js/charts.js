// Função local para parsear números brasileiros (cópia da validators.js)
function parseBrazilianNumber(value) {
    if (typeof value !== 'string' || !value) return NaN;
    
    const cleaned = value
        .replace(/\s*R\$\s*/g, '')
        .replace(/\./g, (match, offset, fullString) => {
            if (fullString.indexOf(',') !== -1) {
                return '';
            }
            return '';
        })
        .replace(',', '.');

    const number = parseFloat(cleaned);
    return number;
}

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

// Variável global para armazenar a instância do gráfico atual
let currentChart = null;
let currentChartData = null;

/**
 * Lê jogos de um arquivo Excel.
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
 * Carrega os resultados históricos para análise.
 */
async function loadHistoricalResults(tipoJogo) {
    const nomeArquivo = tipoJogo === 'quina' ? 'jogos_quina_passados.xlsx' :
        (tipoJogo === 'lotofacil' ? 'jogos_lotofacil_passados.xlsx' : 'jogos_megasena_passados.xlsx');

    try {
        const response = await fetch(nomeArquivo);
        if (!response.ok) {
            throw new Error(`Arquivo histórico "${nomeArquivo}" não encontrado.`);
        }

        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        const numerosEsperados = tipoJogo === 'quina' ? 5 : (tipoJogo === 'lotofacil' ? 15 : 6);
        const maxBalls = tipoJogo === 'quina' ? 80 : (tipoJogo === 'lotofacil' ? 25 : 60);

        return jsonData
            .map(row => row.filter(num => num !== null && !isNaN(Number(num)) && 
                Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBalls).map(Number))
            .filter(row => row.length === numerosEsperados);

    } catch (error) {
        console.error('Erro ao carregar resultados históricos:', error);
        throw new Error(`Erro ao carregar "${nomeArquivo}". Certifique-se de que o arquivo está na mesma pasta do index.html.`);
    }
}

/**
 * Calcula os prêmios para cada sorteio histórico.
 */
function calculatePrizes(jogos, resultadosHistoricos, tipoJogo, premios) {
    return resultadosHistoricos.map(resultado => {
        const numerosHistoricos = new Set(resultado);
        let premioTotal = 0;

        jogos.forEach(jogo => {
            const acertos = jogo.filter(num => numerosHistoricos.has(num)).length;

            if (tipoJogo === 'quina') {
                if (acertos === 2) premioTotal += premios.duque;
                else if (acertos === 3) premioTotal += premios.terno;
                else if (acertos === 4) premioTotal += premios.quadra;
                else if (acertos === 5) premioTotal += premios.quina;
            } else if (tipoJogo === 'lotofacil') {
                if (acertos === 11) premioTotal += premios.onze;
                else if (acertos === 12) premioTotal += premios.doze;
                else if (acertos === 13) premioTotal += premios.treze;
                else if (acertos === 14) premioTotal += premios.quatorze;
                else if (acertos === 15) premioTotal += premios.quinze;
            } else { // megasena
                if (acertos === 4) premioTotal += premios.quadra;
                else if (acertos === 5) premioTotal += premios.quina;
                else if (acertos === 6) premioTotal += premios.sena;
            }
        });

        return premioTotal;
    });
}

/**
 * Obtém as configurações dos eixos do gráfico.
 */
function getAxisConfig() {
    const xMinElement = document.getElementById('graficoEixoXMin');
    const xMaxElement = document.getElementById('graficoEixoXMax');
    const yMinElement = document.getElementById('graficoEixoYMin');
    const yMaxElement = document.getElementById('graficoEixoYMax');

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
                callback: function(value, index, ticks) {
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

    const xMinInput = document.getElementById('graficoEixoXMin');
    const xMaxInput = document.getElementById('graficoEixoXMax');
    const yMinInput = document.getElementById('graficoEixoYMin');
    const yMaxInput = document.getElementById('graficoEixoYMax');

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
 * Inicializa os sliders dos eixos do gráfico.
 */
function initializeAxisSliders() {
    // Configurar sliders X (percentuais)
    const xMinSlider = document.getElementById('graficoEixoXMinSlider');
    const xMaxSlider = document.getElementById('graficoEixoXMaxSlider');
    const xMinInput = document.getElementById('graficoEixoXMin');
    const xMaxInput = document.getElementById('graficoEixoXMax');

    // Configurar sliders Y (valores monetários)
    const yMinSlider = document.getElementById('graficoEixoYMinSlider');
    const yMaxSlider = document.getElementById('graficoEixoYMaxSlider');
    const yMinInput = document.getElementById('graficoEixoYMin');
    const yMaxInput = document.getElementById('graficoEixoYMax');

    if (!xMinSlider || !xMaxSlider || !yMinSlider || !yMaxSlider) {
        console.warn('Sliders dos eixos não encontrados');
        return;
    }

    // Configurar ranges dos sliders Y com máximo fixo de 100.000
    yMinSlider.min = 0;
    yMinSlider.max = 100000;
    yMinSlider.step = 100;
    yMinSlider.value = 0;

    yMaxSlider.min = 0;
    yMaxSlider.max = 100000;
    yMaxSlider.step = 100;
    yMaxSlider.value = 50000;

    // Sincronizar slider X Min com input (percentual)
    xMinSlider.addEventListener('input', function() {
        xMinInput.value = this.value;
        updateChartAxes();
    });

    xMinInput.addEventListener('input', function() {
        const value = parseFloat(this.value) || 0;
        xMinSlider.value = Math.max(0, Math.min(100, value));
        updateChartAxes();
    });

    // Sincronizar slider X Max com input (percentual)
    xMaxSlider.addEventListener('input', function() {
        xMaxInput.value = this.value;
        updateChartAxes();
    });

    xMaxInput.addEventListener('input', function() {
        const value = parseFloat(this.value) || 100;
        xMaxSlider.value = Math.max(0, Math.min(100, value));
        updateChartAxes();
    });

    // Sincronizar slider Y Min com input
    yMinSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        yMinInput.value = formatCurrency(value);
        updateChartAxes();
    });

    yMinInput.addEventListener('input', function() {
        const value = parseBrazilianNumber(this.value) || 0;
        yMinSlider.value = Math.max(0, Math.min(100000, value));
        updateChartAxes();
    });

    // Sincronizar slider Y Max com input
    yMaxSlider.addEventListener('input', function() {
        const value = parseFloat(this.value);
        yMaxInput.value = formatCurrency(value);
        updateChartAxes();
    });

    yMaxInput.addEventListener('input', function() {
        const value = parseBrazilianNumber(this.value) || 0;
        yMaxSlider.value = Math.max(0, Math.min(100000, value));
        updateChartAxes();
    });
}

/**
 * Atualiza os ranges dos sliders Y baseados nos dados do gráfico atual.
 */
function updateSliderRanges() {
    if (!currentChartData) return;

    let minY = Infinity, maxY = -Infinity;

    currentChartData.datasets.forEach(dataset => {
        dataset.data.forEach(value => {
            if (typeof value === 'number' && !isNaN(value)) {
                minY = Math.min(minY, value);
                maxY = Math.max(maxY, value);
            }
        });
    });

    const yMinSlider = document.getElementById('graficoEixoYMinSlider');
    const yMaxSlider = document.getElementById('graficoEixoYMaxSlider');

    if (yMinSlider && yMaxSlider && minY !== Infinity && maxY !== -Infinity) {
        // Manter o máximo fixo em 100.000, mas ajustar o step se necessário
        const dataRange = maxY - minY;
        const step = Math.max(1, Math.floor(dataRange / 1000));
        
        yMinSlider.min = 0;
        yMinSlider.max = 100000; // Máximo fixo
        yMinSlider.step = step;
        
        yMaxSlider.min = 0;
        yMaxSlider.max = 100000; // Máximo fixo
        yMaxSlider.step = step;

        // Ajustar valores iniciais se estiverem fora do range dos dados
        if (!yMinSlider.value || yMinSlider.value == "0") {
            const suggestedMin = Math.max(0, Math.floor(minY));
            yMinSlider.value = Math.min(suggestedMin, 100000);
        }
        if (!yMaxSlider.value || yMaxSlider.value == "50000") {
            const suggestedMax = Math.min(Math.ceil(maxY), 100000);
            yMaxSlider.value = Math.max(suggestedMax, yMinSlider.value);
        }
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
    const xMinSlider = document.getElementById('graficoEixoXMinSlider');
    const xMaxSlider = document.getElementById('graficoEixoXMaxSlider');
    const yMinSlider = document.getElementById('graficoEixoYMinSlider');
    const yMaxSlider = document.getElementById('graficoEixoYMaxSlider');

    if (xMinSlider) xMinSlider.value = 0;
    if (xMaxSlider) xMaxSlider.value = 100;
    if (yMinSlider) yMinSlider.value = 0;
    if (yMaxSlider) yMaxSlider.value = 50000; // Valor padrão dentro do range de 100.000

    // Limpa os inputs também
    const inputs = ['graficoEixoXMin', 'graficoEixoXMax', 'graficoEixoYMin', 'graficoEixoYMax'];
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
        const numerosEsperados = tipoJogo === 'quina' ? 5 : (tipoJogo === 'lotofacil' ? 15 : 6);
        const maxBalls = tipoJogo === 'quina' ? 80 : (tipoJogo === 'lotofacil' ? 25 : 60);

        // Coletar arquivos selecionados
        const arquivos = [];
        for (let i = 1; i <= 6; i++) {
            const fileInput = document.getElementById(`graficoFile${i}`);
            if (fileInput && fileInput.files[0]) {
                arquivos.push({
                    file: fileInput.files[0],
                    name: fileInput.files[0].name.replace('.xlsx', ''),
                    index: i
                });
            }
        }

        if (arquivos.length === 0) {
            throw new Error('Por favor, selecione pelo menos um arquivo para análise.');
        }

        // Carregar resultados históricos
        progress.textContent = 'Carregando resultados históricos...';
        const resultadosHistoricos = await loadHistoricalResults(tipoJogo);

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

        for (let i = 0; i < arquivos.length; i++) {
            const arquivo = arquivos[i];
            progress.textContent = `Processando arquivo ${i + 1} de ${arquivos.length}: ${arquivo.name}...`;

            const jogos = await readGamesFromFile(arquivo.file, numerosEsperados, maxBalls);
            
            if (jogos.length === 0) {
                console.warn(`Nenhum jogo válido encontrado no arquivo: ${arquivo.name}`);
                continue;
            }

            const premiosPorSorteio = calculatePrizes(jogos, resultadosHistoricos, tipoJogo, premios);
            const dadosOrdenados = premiosPorSorteio
                .map((premio, index) => ({ premio, sorteio: index + 1 }))
                .sort((a, b) => a.premio - b.premio);

            datasets.push({
                label: arquivo.name,
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

        // Mostrar container e criar gráfico
        container.style.display = 'block';
        createChart('resultsChart', datasets, labels, 
            `Prêmios por Sorteio (Ordenados por Valor) - ${tipoJogo.toUpperCase()}`, axisConfig);

        // Preencher sugestões de valores mínimos e máximos
        populateAxisSuggestions();

        // Inicializar sliders após criar o gráfico
        initializeAxisSliders();

        // Mostrar botão de imprimir gráfico
        const btnImprimirGrafico = document.getElementById('btn-imprimir-grafico');
        if (btnImprimirGrafico) {
            btnImprimirGrafico.style.display = 'inline-flex';
        }

        status.textContent = `Gráfico gerado com sucesso! ${arquivos.length} arquivo(s) analisado(s).`;
        status.className = 'status-message success';
        progress.style.display = 'none';

    } catch (error) {
        console.error('Erro ao gerar gráficos:', error);
        status.textContent = 'Erro: ' + error.message;
        status.className = 'status-message error';
        progress.style.display = 'none';
        
        // Esconder botão de imprimir em caso de erro
        const btnImprimirGrafico = document.getElementById('btn-imprimir-grafico');
        if (btnImprimirGrafico) {
            btnImprimirGrafico.style.display = 'none';
        }
    } finally {
        loader.style.display = 'none';
    }
}

export { generateResultCharts, updateChartAxes, printChartToPDF, resetAxisSliders };
