import { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState, showGenerationReport, showNotification, createSimulationBallPanel, updateSimulationBallPanelStats } from './interface.js';
import { generateGames } from './generate.js';
import { executeAnalysis, saveAnalysisToExcel, printPieChartsToPDF } from './analyze.js';
import { validateAndGetFileInfo } from './validators.js';
import { generateVolantePDF, coletarConfiguracoesImpressao, aplicarConfiguracoesImpressao, atualizarComboConfigs } from './printPdf.js';

/**
 * Inicializa a aplicação LotoPro - Sistema Profissional de Análise de Loterias.
 * Verifica dependências externas, configura interface e event listeners.
 * @function
 * @returns {void}
 */
function init() {
    if (!window.XLSX || !window.Cleave) {
        // Exibe erro na UI se as dependências principais não carregarem.
        // Idealmente, isso não deve acontecer se os CDNs estiverem online.
        showNotification('status-geracao', 'Erro: Dependências não carregadas.', 'error');
        showNotification('status-analise', 'Erro: Dependências não carregadas.', 'error');
        return;
    }

    // Inicializa a interface do usuário primeiro
    initializeInterface();
    
    // Configura todos os event listeners após a interface estar pronta
    setupEventListeners();
}

/**
 * Configura todos os event listeners da aplicação de forma modular.
 * Organiza os listeners por funcionalidade para melhor manutenção.
 * @function
 * @returns {void}
 */
function setupEventListeners() {
    // Botões principais (gerar jogos, relatórios, PDFs, gráficos)
    setupMainButtons();
    
    // Controle global de tipo de jogo (Mega-Sena, Quina, Lotofácil)
    setupGameTypeControl();
    
    // Controles de upload e seleção de arquivos
    setupFileControls();

    // Controles específicos da aba de Análise
    setupAnalysisTabControls();

    // Controles de gráficos (agora na aba de análise)
    setupAnalysisChartControls();

    // Controles específicos de impressão em PDF
    setupPrintControls();

    // Controles de salvamento e carregamento de configurações de PDF
    setupPdfConfigControls();

    // Controles de navegação por abas
    setupTabControls();

    // Botão para re-exibir o último relatório de geração
    const btnShowLastReport = document.getElementById('btn-show-last-report');
    if (btnShowLastReport) {
        btnShowLastReport.addEventListener('click', (e) => {
            e.preventDefault();
            // window.currentReportData é definido dentro de showGenerationReport
            if (window.currentReportData && window.lastWorkbook && window.lastFilename) {
                showGenerationReport(window.currentReportData, window.lastWorkbook, window.lastFilename);
            } else {
                alert('Nenhum relatório recente para exibir. Gere um novo conjunto de jogos primeiro.');
            }
        });
    }
}

/**
 * Configura os event listeners dos botões principais da aplicação.
 * Inclui handlers para geração de jogos, relatórios, PDFs e gráficos.
 * Utiliza importação dinâmica para módulos opcionais como gráficos.
 * @function setupMainButtons
 * @returns {void} 
 */
function setupMainButtons() {
    // Botão Gerar Jogos
    const btnGerarJogos = document.getElementById('btn-gerar-jogos');
    if (btnGerarJogos) {
        btnGerarJogos.addEventListener('click', (e) => {
            e.preventDefault();
            generateGames();
        });
    }

    // Botão Gerar Relatório
    const btnExecutarAnalise = document.getElementById('btn-executar-analise');
    if (btnExecutarAnalise) {
        btnExecutarAnalise.addEventListener('click', async (e) => {
            e.preventDefault();
            // Run main analysis and generate pie charts
            await executeAnalysis(); 
            
            // Run comparative chart analysis
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.generateResultCharts) {
                    // This function is async, so we await it
                    await chartsModule.generateResultCharts();
                } else {
                    throw new Error('Função generateResultCharts não encontrada.');
                }
            } catch (error) {
                console.error('Erro ao gerar gráfico comparativo:', error);
                // Use a non-blocking alert or a more subtle notification
                showNotification('status-graficos', `Erro ao gerar gráfico comparativo: ${error.message}`, 'error');
            }
        });
    }

    // Botão para salvar o relatório Excel gerado pela análise
    const btnSalvarExcel = document.getElementById('btn-gerar-relatorio-excel');
    if (btnSalvarExcel) {
        btnSalvarExcel.addEventListener('click', (e) => {
            e.preventDefault();
            saveAnalysisToExcel();
        });
    }

    const btnSalvarPizzaPdf = document.getElementById('btn-imprimir-graficos-pizza');
    if(btnSalvarPizzaPdf) {
        btnSalvarPizzaPdf.addEventListener('click', (e) => {
            e.preventDefault();
            printPieChartsToPDF();
        });
    }

    // Botão Gerar PDF
    const btnGerarPdf = document.getElementById('btn-gerar-pdf-volantes');
    if (btnGerarPdf) {
        btnGerarPdf.addEventListener('click', (e) => {
            e.preventDefault();
            generateVolantePDF();
        });
    }
}

/**
 * Configura o event listener do seletor global de tipo de jogo.
 * Permite alternar entre Mega-Sena, Quina e Lotofácil dinamicamente.
 * @function setupGameTypeControl
 * @returns {void}
 */
function setupGameTypeControl() {
    const gameTypeSelect = document.getElementById('gameTypeGlobal');
    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', (e) => {
            handleGlobalGameTypeChange();
        });
    } else {
        console.error('Select de tipo de jogo global não encontrado!');
    }
}

/**
 * Configura os controles de gráficos que foram movidos para a aba de Análise.
 * @function setupAnalysisChartControls
 * @returns {void}
 */
function setupAnalysisChartControls() {
    // Controle de personalização dos eixos do gráfico
    const customizeCheckbox = document.getElementById('analise-grafico-personalizar-eixos');
    const configPanel = document.getElementById('analise-grafico-eixos-config');
    
    if (customizeCheckbox && configPanel) {
        customizeCheckbox.addEventListener('change', function() {
            configPanel.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Botão para exportar gráfico em PDF
    const btnImprimirGrafico = document.getElementById('btn-imprimir-grafico-analise');
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
    }

    // Botões para controle dos eixos personalizados (reset e atualizar)
    const resetButton = document.getElementById('analise-grafico-reset-eixos');
    const updateButton = document.getElementById('analise-grafico-atualizar-eixos');

    const updateAxes = async () => {
        try {
            const chartsModule = await import('./charts.js');
            chartsModule.updateChartAxes();
        } catch (error) {
            console.warn('Módulo de gráficos não disponível:', error);
        }
    };

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
        updateButton.addEventListener('click', updateAxes);
    }

    // Atualização automática quando os valores dos eixos são alterados
    const axisInputs = ['analise-grafico-eixo-x-min', 'analise-grafico-eixo-x-max', 'analise-grafico-eixo-y-min', 'analise-grafico-eixo-y-max'];
    axisInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', updateAxes);
            input.addEventListener('keypress', e => { if (e.key === 'Enter') updateAxes(); });
        }
    });
}

/**
 * Adiciona um arquivo (real ou gerado em memória) à lista de análise.
 * @param {File} file - O objeto File a ser adicionado.
 */
export async function addFileToAnalysisList(file) {
    const fileListContainer = document.getElementById('analise-file-list');
    if (!fileListContainer) return;

    const currentFileCount = fileListContainer.children.length;
    if (currentFileCount >= 20) {
        alert('Você pode adicionar no máximo 20 arquivos.');
        return;
    }

    try {
        const currentGameType = document.getElementById('gameTypeGlobal').value;
        const fileInfo = await validateAndGetFileInfo(file, currentGameType);

        const fileId = `file_${window.analysisFileCounter++}`;
        window.analiseFiles[fileId] = { file: file, name: file.name, uniqueBalls: fileInfo.uniqueBalls };

        const fileItemWrapper = document.createElement('div');
        fileItemWrapper.className = 'file-item-analise-wrapper';
        
        const hint = `Arquivo: ${file.name}\nBolas usadas (${fileInfo.uniqueBalls.length}): ${fileInfo.uniqueBalls.join(', ')}`;

        fileItemWrapper.innerHTML = `
            <div class="file-item-analise" title="${hint}" data-file-id="${fileId}">
                <input type="checkbox" checked title="Incluir este arquivo na análise">
                <span class="file-name">${file.name}</span>
                <button class="delete-btn" title="Remover arquivo"><i class="fas fa-times"></i></button>
            </div>
            <button class="btn btn-ghost btn-add-balls" data-file-id="${fileId}" style="margin-top: 0.5rem; width: 100%; font-size: 0.75rem; padding: 0.5rem;">
                <i class="fas fa-plus-circle"></i> Adicionar bolas deste jogo à seleção
            </button>
        `;

        fileListContainer.appendChild(fileItemWrapper);

        fileItemWrapper.querySelector('.delete-btn').addEventListener('click', () => {
            delete window.analiseFiles[fileId];
            fileItemWrapper.remove();
        });

        fileItemWrapper.querySelector('.btn-add-balls').addEventListener('click', (evt) => {
            const clickedFileId = evt.currentTarget.dataset.fileId;
            const ballsToAdd = window.analiseFiles[clickedFileId]?.uniqueBalls;
            if (ballsToAdd) {
                document.querySelectorAll('#simulation-ball-panel .ball').forEach(ballEl => {
                    const ballNum = parseInt(ballEl.dataset.number, 10);
                    if (ballsToAdd.includes(ballNum)) {
                        ballEl.classList.add('active');
                    }
                });
                updateSimulationBallPanelStats();
            }
        });

    } catch (error) {
        alert(error.message);
    }
}

/**
 * Configura os controles específicos da aba de Análise de Jogos.
 * @function setupAnalysisTabControls
 * @returns {void}
 */
function setupAnalysisTabControls() {
    const fileInput = document.getElementById('userFileAnaliseInput');
    const fileListContainer = document.getElementById('analise-file-list');
    const adjustPrizeCheckbox = document.getElementById('adjustPrizeValues');
    const prizeContainer = document.getElementById('prize-values-container');

    window.analiseFiles = {}; // Store file objects
    window.analysisFileCounter = 0; // Global counter for unique file IDs

    if (fileInput && fileListContainer) {
        fileInput.addEventListener('change', async function(e) {
            const files = e.target.files;
            for (const file of files) {
                await addFileToAnalysisList(file);
            }

            this.value = ''; // Reset input after adding
        });
    }

    if (adjustPrizeCheckbox && prizeContainer) {
        adjustPrizeCheckbox.addEventListener('change', function() {
            prizeContainer.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Listeners for the simulation ball panel
    const btnSelectAllSim = document.getElementById('btn-select-all-sim-balls');
    const btnDeselectAllSim = document.getElementById('btn-deselect-all-sim-balls');

    if (btnSelectAllSim) {
        btnSelectAllSim.addEventListener('click', () => {
            document.querySelectorAll('#simulation-ball-panel .ball').forEach(b => b.classList.add('active'));
            updateSimulationBallPanelStats();
        });
    }
    if (btnDeselectAllSim) {
        btnDeselectAllSim.addEventListener('click', () => {
            document.querySelectorAll('#simulation-ball-panel .ball').forEach(b => b.classList.remove('active'));
            updateSimulationBallPanelStats();
        });
    }

    // Listener for "Usar apenas bolas..."
    const useOnlyTestGamesCheckbox = document.getElementById('useOnlyBallsFromTestGames');
    if (useOnlyTestGamesCheckbox) {
        useOnlyTestGamesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                const allBallsFromCheckedFiles = new Set();
                document.querySelectorAll('#analise-file-list .file-item-analise-wrapper').forEach(wrapper => {
                    const checkbox = wrapper.querySelector('.file-item-analise input[type="checkbox"]');
                    const button = wrapper.querySelector('.btn-add-balls');
                    if (checkbox.checked && button) {
                        const fileId = button.dataset.fileId;
                        const fileData = window.analiseFiles[fileId];
                        if (fileData && fileData.uniqueBalls) {
                            fileData.uniqueBalls.forEach(ball => allBallsFromCheckedFiles.add(ball));
                        }
                    }
                });

                document.querySelectorAll('#simulation-ball-panel .ball').forEach(ballEl => {
                    const ballNum = parseInt(ballEl.dataset.number, 10);
                    if (allBallsFromCheckedFiles.has(ballNum)) {
                        ballEl.classList.add('active');
                    } else {
                        ballEl.classList.remove('active');
                    }
                });
            } else {
                // If unchecked, select all balls
                document.querySelectorAll('#simulation-ball-panel .ball').forEach(b => b.classList.add('active'));
            }
            updateSimulationBallPanelStats();
        });
    }
}

/**
 * Configura event listeners para todos os inputs de arquivo da aplicação.
 * Gerencia tanto arquivos individuais quanto múltiplos arquivos de gráficos.
 * Atualiza os displays de nome de arquivo em tempo real.
 * @function setupFileControls
 * @returns {void}
 */
function setupFileControls() {
    const fileControls = [
        { inputId: 'jogosExistentesFile', displayId: 'jogosExistentesFileName' },
        { inputId: 'pdfGameFile', displayId: 'pdfGameFileName' },
        { inputId: 'pdfBackgroundImageFile', displayId: 'pdfBackgroundImageFileName' }
    ];

    // Configura listeners para arquivos individuais (jogos, análise, PDF)
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
}

/**
 * Configura os event listeners para os botões de navegação das abas.
 * Isso substitui os atributos `onclick` no HTML, tornando o código mais robusto e desacoplado.
 * @function setupTabControls
 * @returns {void}
 */
function setupTabControls() {
    document.querySelectorAll('.nav-tab').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.id.replace('tab-', '');
            if (tabId) toggleTab(tabId);
        });
    });
}

/**
 * Configura controles específicos para geração de PDFs.
 * Gerencia habilitação/desabilitação de imagem de fundo.
 * @function setupPrintControls
 * @returns {void}
 */
function setupPrintControls() {
    // Controle para habilitar/desabilitar imagem de fundo no PDF
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
 * Configura os controles para salvar e carregar configurações de impressão PDF.
 * @function setupPdfConfigControls
 * @returns {void}
 */
function setupPdfConfigControls() {
    // Botão para salvar a configuração atual como padrão no localStorage
    const btnSalvarPadrao = document.getElementById('btn-salvar-config-padrao');
    if (btnSalvarPadrao) {
        btnSalvarPadrao.onclick = function() {
            const config = coletarConfiguracoesImpressao();
            localStorage.setItem('configPadraoImpressao', JSON.stringify(config));
            alert('Configuração padrão salva!');
            atualizarComboConfigs();
        };
    }

    // Botão para salvar a configuração atual com um nome personalizado
    const btnSalvarArquivo = document.getElementById('btn-salvar-config-arquivo');
    if (btnSalvarArquivo) {
        btnSalvarArquivo.onclick = function() {
            const nome = document.getElementById('nome-config-personalizada').value.trim();
            if (!nome) {
                alert('Digite um nome para a configuração.');
                return;
            }
            const config = coletarConfiguracoesImpressao();
            localStorage.setItem('configImpressao_' + nome, JSON.stringify(config));
            alert(`Configuração "${nome}" salva!`);
            atualizarComboConfigs();
        };
    }

    // Botão para carregar uma configuração selecionada no combobox
    const btnCarregarConfig = document.getElementById('btn-carregar-config');
    if (btnCarregarConfig) {
        btnCarregarConfig.onclick = function() {
            const combo = document.getElementById('combo-configs-salvas');
            const key = combo.value;
            if (!key) {
                alert('Selecione uma configuração para carregar.');
                return;
            }
            const config = JSON.parse(localStorage.getItem(key));
            aplicarConfiguracoesImpressao(config);
            alert('Configuração carregada!');
        };
    }
}

/**
 * Alterna entre abas da interface do usuário.
 * Esta função é exposta globalmente (`window.toggleTab`) para ser acessível
 * pelos atributos `onclick` no HTML.
 * Remove classe 'active' de todas as abas e ativa a aba selecionada.
 * @function toggleTab
 * @param {string} tabId - ID da aba a ser ativada
 * @returns {void}
 */
function toggleTab(tabId) {
    // Remove active de todas as abas
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Ativa a aba selecionada
    const tabButton = document.getElementById(`tab-${tabId}`);
    const tabContent = document.getElementById(tabId);

    if (tabButton) tabButton.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
}

/* A função `toggleTab` agora é chamada apenas de dentro deste módulo, não sendo mais necessário expô-la globalmente. */

// Inicializa a aplicação e carrega configurações salvas quando o DOM estiver pronto.
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Carrega a configuração de impressão padrão, se existir
    const configPadrao = localStorage.getItem('configPadraoImpressao');
    if (configPadrao) {
        aplicarConfiguracoesImpressao(JSON.parse(configPadrao));
    }
    // Popula o combobox com as configurações salvas
    atualizarComboConfigs();
});