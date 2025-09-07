import { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState } from './interface.js';
import { generateGames } from './generate.js';
import { processFiles } from './analyze.js';
import { generateVolantePDF } from './printPdf.js';

/**
 * Inicializa a aplicação LotoPro.
 */
function init() {
    console.log('Inicializando LotoPro...');

    if (!window.XLSX || !window.Cleave) {
        console.error('Dependências XLSX ou Cleave.js não carregadas.');
        showNotification('status-geracao', 'Erro: Dependências não carregadas.', 'error');
        showNotification('status-analise', 'Erro: Dependências não carregadas.', 'error');
        return;
    }

    // Primeiro inicializa a interface
    initializeInterface();
    
    // Depois configura os event listeners
    setupEventListeners();
    
    console.log('LotoPro inicializado com sucesso!');
}

/**
 * Configura todos os event listeners da aplicação.
 */
function setupEventListeners() {
    // Event listeners para botões principais
    setupMainButtons();
    
    // Event listeners para o tipo de jogo global
    setupGameTypeControl();
    
    // Event listeners para arquivos
    setupFileControls();
    
    // Event listeners para gráficos
    setupChartControls();
    
    // Event listeners para impressão
    setupPrintControls();
}

/**
 * Configura os botões principais da aplicação.
 */
function setupMainButtons() {
    // Botão Gerar Jogos
    const btnGerarJogos = document.getElementById('btn-gerar-jogos');
    if (btnGerarJogos) {
        btnGerarJogos.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Gerar Jogos iniciado...');
            generateGames();
        });
        console.log('Event listener configurado para btn-gerar-jogos');
    } else {
        console.warn('Botão btn-gerar-jogos não encontrado');
    }

    // Botão Gerar Relatório
    const btnGerarRelatorio = document.getElementById('btn-gerar-relatorio');
    if (btnGerarRelatorio) {
        btnGerarRelatorio.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Gerar Relatório iniciado...');
            processFiles();
        });
        console.log('Event listener configurado para btn-gerar-relatorio');
    } else {
        console.warn('Botão btn-gerar-relatorio não encontrado');
    }

    // Botão Gerar PDF
    const btnGerarPdf = document.getElementById('btn-gerar-pdf-volantes');
    if (btnGerarPdf) {
        btnGerarPdf.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Gerar PDF iniciado...');
            generateVolantePDF();
        });
        console.log('Event listener configurado para btn-gerar-pdf-volantes');
    } else {
        console.warn('Botão btn-gerar-pdf-volantes não encontrado');
    }

    // Botão Gerar Gráficos - importação dinâmica com melhor tratamento de erro
    const btnGerarGraficos = document.getElementById('btn-gerar-graficos');
    if (btnGerarGraficos) {
        btnGerarGraficos.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Gerar Gráficos iniciado...');
            
            // Verificar dependências antes de tentar importar
            if (!window.XLSX) {
                alert('Erro: Biblioteca XLSX não carregada. Recarregue a página.');
                return;
            }
            
            if (!window.Chart) {
                alert('Erro: Biblioteca Chart.js não carregada. Recarregue a página.');
                return;
            }
            
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.generateResultCharts) {
                    chartsModule.generateResultCharts();
                } else {
                    throw new Error('Função generateResultCharts não encontrada no módulo');
                }
            } catch (error) {
                console.error('Erro detalhado ao carregar módulo de gráficos:', error);
                alert(`Erro ao carregar funcionalidade de gráficos: ${error.message}\n\nDetalhes: ${error.stack || 'Não disponível'}`);
            }
        });
        console.log('Event listener configurado para btn-gerar-graficos');
    } else {
        console.warn('Botão btn-gerar-graficos não encontrado');
    }
}

/**
 * Configura o controle de tipo de jogo.
 */
function setupGameTypeControl() {
    const gameTypeSelect = document.getElementById('gameTypeGlobal');
    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', (e) => {
            console.log('Tipo de jogo alterado para:', e.target.value);
            handleGlobalGameTypeChange();
        });
        console.log('Event listener configurado para gameTypeGlobal');
    } else {
        console.error('Select de tipo de jogo global não encontrado!');
    }
}

/**
 * Configura controles de arquivo.
 */
function setupFileControls() {
    const fileControls = [
        { inputId: 'jogosExistentesFile', displayId: 'jogosExistentesFileName' },
        { inputId: 'userFileAnalise', displayId: 'userFileAnaliseName' },
        { inputId: 'pdfGameFile', displayId: 'pdfGameFileName' },
        { inputId: 'pdfBackgroundImageFile', displayId: 'pdfBackgroundImageFileName' }
    ];

    // Arquivos individuais
    fileControls.forEach(({ inputId, displayId }) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', function() {
                const display = document.getElementById(displayId);
                if (display) {
                    display.textContent = this.files.length > 0 ? this.files[0].name : '';
                }
            });
        }
    });

    // Arquivos de gráficos (múltiplos)
    for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(`graficoFile${i}`);
        if (input) {
            input.addEventListener('change', function() {
                const display = document.getElementById(`graficoFileName${i}`);
                if (display) {
                    display.textContent = this.files.length > 0 ? this.files[0].name : '';
                }
            });
        }
    }
}

/**
 * Configura controles de gráficos.
 */
function setupChartControls() {
    // Checkbox de personalização
    const customizeCheckbox = document.getElementById('graficoPersonalizarEixos');
    const configPanel = document.getElementById('graficoEixosConfig');
    
    if (customizeCheckbox && configPanel) {
        customizeCheckbox.addEventListener('change', function() {
            configPanel.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Botão de imprimir gráfico
    const btnImprimirGrafico = document.getElementById('btn-imprimir-grafico');
    if (btnImprimirGrafico) {
        btnImprimirGrafico.addEventListener('click', async function() {
            try {
                const chartsModule = await import('./charts.js');
                chartsModule.printChartToPDF();
            } catch (error) {
                console.error('Erro ao imprimir gráfico:', error);
                alert('Erro ao imprimir gráfico: ' + error.message);
            }
        });
        console.log('Event listener configurado para btn-imprimir-grafico');
    }

    // Botões de controle dos eixos - importação dinâmica
    const resetButton = document.getElementById('graficoResetEixos');
    const updateButton = document.getElementById('graficoAtualizarEixos');

    if (resetButton) {
        resetButton.addEventListener('click', async function() {
            try {
                const chartsModule = await import('./charts.js');
                chartsModule.resetAxisSliders();
                chartsModule.updateChartAxes();
            } catch (error) {
                console.warn('Módulo de gráficos não disponível:', error);
            }
        });
    }

    if (updateButton) {
        updateButton.addEventListener('click', async function() {
            try {
                const chartsModule = await import('./charts.js');
                chartsModule.updateChartAxes();
            } catch (error) {
                console.warn('Módulo de gráficos não disponível:', error);
            }
        });
    }

    // Auto-update nos campos de eixo
    const axisInputs = ['graficoEixoXMin', 'graficoEixoXMax', 'graficoEixoYMin', 'graficoEixoYMax'];
    axisInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', async function() {
                try {
                    const chartsModule = await import('./charts.js');
                    chartsModule.updateChartAxes();
                } catch (error) {
                    console.warn('Módulo de gráficos não disponível:', error);
                }
            });
            input.addEventListener('keypress', async function(e) {
                if (e.key === 'Enter') {
                    try {
                        const chartsModule = await import('./charts.js');
                        chartsModule.updateChartAxes();
                    } catch (error) {
                        console.warn('Módulo de gráficos não disponível:', error);
                    }
                }
            });
        }
    });
}

/**
 * Configura controles de impressão.
 */
function setupPrintControls() {
    // Controle de imagem de fundo
    const backgroundCheckbox = document.getElementById('pdfPrintBackgroundImage');
    const backgroundFileInput = document.getElementById('pdfBackgroundImageFile');
    
    if (backgroundCheckbox && backgroundFileInput) {
        backgroundCheckbox.addEventListener('change', function() {
            backgroundFileInput.disabled = !this.checked;
            if (!this.checked) {
                backgroundFileInput.value = '';
                const display = document.getElementById('pdfBackgroundImageFileName');
                if (display) display.textContent = '';
            }
        });
    }
}

/**
 * Mostra uma notificação de status.
 */
function showNotification(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `status-message ${type}`;
        element.style.display = 'flex';
        element.classList.add('fade-in');
    }
}

/**
 * Esconde uma notificação de status.
 */
function hideNotification(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
        element.classList.remove('fade-in');
    }
}

/**
 * Alterna entre abas (função global necessária para o HTML).
 */
function toggleTab(tabId) {
    console.log(`Alternando para aba: ${tabId}`);
    
    // Remove active de todas as abas
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativa a aba selecionada
    const tabButton = document.getElementById(`tab-${tabId}`);
    const tabContent = document.getElementById(tabId);

    if (tabButton) tabButton.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
}

// Torna a função toggleTab global para uso no HTML
window.toggleTab = toggleTab;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);