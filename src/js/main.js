import { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState, showNotification, createSimulationBallPanel, updateSimulationBallPanelStats, showGenerationReport, addManagedGame } from './interface.js';
import { gerarJogosSemAcertosGarantidosRepetidos } from './generate.js';
import { executeAnalysis, saveAnalysisToExcel, printPieChartsToPDF } from './analyze.js';
import { generateVolantePDF, coletarConfiguracoesImpressao, aplicarConfiguracoesImpressao, atualizarComboConfigs } from './printPdf.js';
import { validateGameConfig, parseBrazilianNumber } from './validators.js';
import { updateProgress, jogosJaGerados, combinations } from './utils.js';
import { GAME_DEFAULTS, GAME_COSTS } from './constants.js';

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

    // Listener para deleção de jogos das listas unificadas
    document.addEventListener('deleteManagedGame', (e) => {
        deleteManagedGame(e.detail.id);
    });
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
            handleGenerateGamesClick();
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
 * Orquestra a geração de jogos quando o botão "Gerar Jogos" é clicado.
 * Esta função atua como um "controller", lendo a UI, chamando a lógica de geração,
 * e atualizando a UI com os resultados e progresso.
 */
async function handleGenerateGamesClick() {
    const progressModal = document.getElementById('generation-progress-modal');
    const status = document.getElementById('status-geracao');
    const progress = document.getElementById('progress-geracao');
    const loader = document.getElementById('loader-geracao');
    const btnGerar = document.getElementById('btn-gerar-jogos');
    const btnParar = document.getElementById('btn-parar-geracao');

    // Exibe o modal de progresso
    if (progressModal) progressModal.style.display = 'flex';
    
    status.textContent = 'Preparando para gerar jogos...';
    status.style.display = 'flex';
    status.classList.remove('error');
    progress.innerHTML = ''; // Limpa progresso anterior
    progress.style.display = 'block';
    loader.style.display = 'block';

    try {
        const startTime = performance.now();

        const tipoJogo = document.getElementById('gameTypeGlobal')?.value || 'megasena';
        const defaults = GAME_DEFAULTS[tipoJogo] || GAME_DEFAULTS.megasena;

        // Coleta de dezenas do novo painel
        const dezenasSelecionadas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.active')).map(b => parseInt(b.dataset.number));
        const dezenasFavoritas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.favorite')).map(b => parseInt(b.dataset.number));

        let algoritmo;
        let algoritmoDisplay;
        if (document.getElementById('geracaoAleatoria').checked) {
            algoritmo = 'aleatorio';
            algoritmoDisplay = 'Aleatório';
        } else if (document.getElementById('geracaoCombinatoriaSequencial').checked) {
            algoritmo = 'combinatorio_sequencial';
            algoritmoDisplay = 'Combinatória em Sequência';
        } else { // Default ou geracaoCombinatoriaAleatoria is checked
            algoritmo = 'combinatorio_aleatorio';
            algoritmoDisplay = 'Combinatória Aleatória';
        }

        const config = {
            totalBolas: defaults.totalBolas,
            dezenasSelecionadas: dezenasSelecionadas,
            dezenasFavoritas: dezenasFavoritas,
            qtdBolasSelecionadas: dezenasSelecionadas.length,
            algoritmo: algoritmo,
            maxTime: parseInt(document.getElementById('maxTimeSelect').value) || 30,
            usarPesoFavoritas: document.getElementById('usarPesoFavoritas').checked,
            pesoFavoritas: parseInt(document.getElementById('pesoFavoritasSelect').value) || 10,

            dezenasJogadas: parseInt(document.getElementById('dezenasJogadas').value),
            acertosGarantidos: parseInt(document.getElementById('acertosGarantidos').value),
            quantidadeJogos: parseBrazilianNumber(document.getElementById('quantidadeJogos').value) || defaults.quantidadeJogos,
            
            aproveitaJogos: document.getElementById('aproveitaJogos').checked,
            forcarUniversoJogosAproveitados: document.getElementById('forcarUniversoJogosAproveitados').checked,
            validarRepeticaoJogosAproveitados: document.getElementById('validarRepeticaoJogosAproveitados').checked,
            validarUniversoJogosAproveitados: document.getElementById('validarUniversoJogosAproveitados').checked,
            jogosExistentes: [],
        };

        // Adiciona validação para o painel de bolas
        if (config.dezenasSelecionadas.length === 0) {
            throw new Error("Nenhuma dezena foi selecionada no painel. Clique nas bolas para formar seu universo de jogo.");
        }
        if (config.dezenasSelecionadas.length < config.dezenasJogadas) {
            throw new Error(`O número de dezenas selecionadas (${config.dezenasSelecionadas.length}) é menor que as dezenas por jogo (${config.dezenasJogadas}).`);
        }
        if (config.usarPesoFavoritas && config.dezenasFavoritas.length === 0) {
            throw new Error("A opção de usar peso para favoritas está marcada, mas nenhuma bola foi marcada como favorita (duplo clique).");
        }
        
        // Coleta jogos externos a partir da nova lista na UI ANTES da validação principal
        if (config.aproveitaJogos) {
            status.textContent = 'Lendo jogos da lista para aproveitamento...';
            await new Promise(resolve => setTimeout(resolve, 0));

            const gamesToProcess = [];
            const checkedItems = document.querySelectorAll('#generation-file-list .file-item-analise-wrapper input[type="checkbox"]:checked');
            config.nomeArquivoAproveitado = ''; // Limpa para construir a nova lista de nomes

            for (const checkbox of checkedItems) {
                const wrapper = checkbox.closest('.file-item-analise-wrapper');
                const itemId = wrapper.dataset.itemId;
                const gameData = window.managedGames[itemId];

                if (gameData) {
                    if (gameData.type === 'external') {
                        const gamesFromFile = await jogosJaGerados(gameData.file);
                        gamesToProcess.push(...gamesFromFile);
                        config.nomeArquivoAproveitado += `${gameData.name} (Externo); `;
                    } else if (gameData.type === 'generated' && gameData.allGames) {
                        gamesToProcess.push(...gameData.allGames);
                        config.nomeArquivoAproveitado += `${gameData.name} (Gerado); `;
                    }
                }
            }
            config.jogosExistentes = gamesToProcess;
        }

        status.textContent = 'Validando configurações...';
        await new Promise(resolve => setTimeout(resolve, 0));
        validateGameConfig(config);

        window.stopGenerationRequested = false; // Reseta a flag
        if (btnGerar) btnGerar.disabled = true;
        if (btnParar) {
            btnParar.disabled = false;
            btnParar.onclick = () => {
                window.stopGenerationRequested = true;
                if (status) status.textContent = "Parando geração...";
                if (btnParar) btnParar.disabled = true; // Evita múltiplos cliques
            };
        }

        status.textContent = 'Gerando jogos... (isso pode levar um tempo)';
        await new Promise(resolve => setTimeout(resolve, 0));

        const progressCallback = async (progressData) => {
            if (progressData.statusText) {
                status.textContent = progressData.statusText;
                await new Promise(resolve => setTimeout(resolve, 0));
            } else {
                await updateProgress(
                    progressData.elementId, progressData.currentCount, progressData.totalCount,
                    progressData.isAleatorio, progressData.progressPercent, progressData.info,
                    progressData.countLabel, progressData.tempoDecorrido, progressData.tempoRestante
                );
            }
        };

        const { jogos, jogosAproveitadosDescartados, jogosNovosDescartados, frequencia, jogosAproveitados, universoUtilizadoParaNovosJogos } = await gerarJogosSemAcertosGarantidosRepetidos(config, progressCallback);

        if (jogos.length === 0) {
            if (!window.stopGenerationRequested) status.textContent = 'Nenhum jogo foi gerado. Verifique as configurações e tente novamente.';
            loader.style.display = 'none';
            status.classList.add('error');
            return;
        }

        const endTime = performance.now();

        status.textContent = 'Formatando jogos para download...';
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const maxDezenasNoResultado = Math.max(config.dezenasJogadas, ...jogos.map(j => j.length));

        const dadosJogos = [
            [...Array.from({length: maxDezenasNoResultado}, (_, i) => `Dezena ${i + 1}`)]
        ].concat(jogos.map(jogo => {
            const jogoOrdenado = [...jogo].sort((a,b) => a - b);
            return [...jogoOrdenado, ...Array(Math.max(0, maxDezenasNoResultado - jogoOrdenado.length)).fill('')];
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dadosJogos);
        
        for (let r = 1; r < dadosJogos.length; r++) {
            for (let c = 0; c < maxDezenasNoResultado; c++) {
                const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                if (ws[cellRef] && ws[cellRef].v !== undefined && ws[cellRef].v !== null && ws[cellRef].v !== '') {
                    ws[cellRef].t = 'n';
                    ws[cellRef].z = '00';
                }
            }
        }
        ws['!cols'] = Array(maxDezenasNoResultado).fill({ wch: 10 });
        XLSX.utils.book_append_sheet(wb, ws, 'Jogos Gerados');
        
        const tabelaCustos = GAME_COSTS[tipoJogo] || {};
        let custoJogosAproveitados = 0;
        let custoJogosNovos = 0;

        jogos.forEach((jogo, index) => {
            const custoJogo = tabelaCustos[jogo.length] || 0;
            if (index < jogosAproveitados) {
                custoJogosAproveitados += custoJogo;
            } else {
                custoJogosNovos += custoJogo;
            }
        });
        const custoTotal = custoJogosAproveitados + custoJogosNovos;

        const totalDezenasSorteadas = jogos.length * config.dezenasJogadas;

        const dezenasDosJogosAproveitadosSet = new Set();
        if (config.aproveitaJogos && jogosAproveitados > 0) {
            jogos.slice(0, jogosAproveitados).forEach(jogo => {
                jogo.forEach(dezena => dezenasDosJogosAproveitadosSet.add(dezena));
            });
        }
        const dezenasDosJogosAproveitadosList = Array.from(dezenasDosJogosAproveitadosSet).sort((a, b) => a - b);

        const reportData = {
            jogosSolicitados: config.quantidadeJogos,
            jogosGerados: jogos.length,
            jogosAproveitados: jogosAproveitados,
            jogosDescartados: jogosAproveitadosDescartados + jogosNovosDescartados,
            jogosAproveitadosDescartados: jogosAproveitadosDescartados,
            jogosNovosDescartados: jogosNovosDescartados,
            jogosNovos: jogos.length - jogosAproveitados,
            tempoGeracao: ((endTime - startTime) / 1000).toFixed(2),
            parametros: {
                tipoJogo: tipoJogo.charAt(0).toUpperCase() + tipoJogo.slice(1),
                universo: config.qtdBolasSelecionadas,
                dezenasJogadas: config.dezenasJogadas,
                acertosGarantidos: config.acertosGarantidos,
                dezenasSimples: defaults.dezenasJogadas,
                algoritmo: algoritmoDisplay,
                timeout: config.maxTime,
                usouPeso: config.usarPesoFavoritas,
                peso: config.pesoFavoritas,
                favoritas: config.dezenasFavoritas,
                aproveitouJogos: config.aproveitaJogos,
                nomeArquivoAproveitado: config.nomeArquivoAproveitado || '',
                totalJogosNoArquivo: config.jogosExistentes.length,
                jogosAproveitadosInfo: { dezenas: dezenasDosJogosAproveitadosList },
                universoNovosJogos: universoUtilizadoParaNovosJogos,
                selecaoUsuario: { dezenas: config.dezenasSelecionadas },
                forcouUniversoAproveitados: config.forcarUniversoJogosAproveitados,
                validouRepeticaoAproveitados: config.validarRepeticaoJogosAproveitados,
                validouUniversoAproveitados: config.validarUniversoJogosAproveitados,
                interrompido: window.stopGenerationRequested,
            },
            custoTotal: custoTotal,
            custoJogosAproveitados: custoJogosAproveitados,
            custoJogosNovos: custoJogosNovos,
            jogosEquivalentes: jogos.reduce((acc, jogo) => {
                if (jogo.length > defaults.dezenasJogadas) {
                    return acc + combinations(jogo, defaults.dezenasJogadas).length;
                }
                return acc + 1;
            }, 0),
            frequenciaBolas: config.dezenasSelecionadas.map(bola => {
                const abs = frequencia[bola] || 0;
                return { bola: bola, abs: abs, rel: totalDezenasSorteadas > 0 ? (abs / totalDezenasSorteadas) * 100 : 0 };
            }).sort((a, b) => b.abs - a.abs)
        };
        window.currentGeneratedGames = jogos;

        const sequence = String(window.generatedGameSequence++).padStart(2, '0');
        const nomeArquivo = `G${sequence}_${jogos.length}jogos_${config.dezenasJogadas}dez_${config.qtdBolasSelecionadas}de${config.totalBolas}b_${config.acertosGarantidos}dez_garantidas.xlsx`;

        await addManagedGame({
            name: nomeArquivo,
            reportData: reportData,
            workbook: wb,
            filename: nomeArquivo,
            allGames: jogos
        });

        // Adicionar abas de relatório ao workbook do Excel
        const params = reportData.parametros;
        const reportSheetData = [
            ['Relatório de Geração de Jogos - LotoPro'], [],
            ['Estatísticas Gerais', 'Valor'],
            ['Jogos Solicitados', reportData.jogosSolicitados],
            ['Jogos Aproveitados', reportData.jogosAproveitados],
            ['Novos Jogos Gerados', reportData.jogosNovos],
            ['Total de Jogos', reportData.jogosGerados],
            ['Descartados (Aproveitados)', reportData.jogosAproveitadosDescartados],
            ['Descartados (Novos)', reportData.jogosNovosDescartados],
            ['Total Descartados', reportData.jogosDescartados],
            [`Jogos simples de ${params.dezenasSimples} dezenas`, reportData.jogosEquivalentes],
            ['Custo Total Estimado', reportData.custoTotal],
            ['Tempo de Geração (s)', reportData.tempoGeracao], [],
            ['Parâmetros Utilizados', 'Configuração'],
            ['Tipo de Jogo', params.tipoJogo],
            ['Universo de Bolas (Seleção do Usuário)', params.universo],
            ['Dezenas por Jogo', params.dezenasJogadas],
            ['Acertos Garantidos', params.acertosGarantidos],
            ['Algoritmo', params.algoritmo],
        ];
        if (config.algoritmo === 'aleatorio') {
            reportSheetData.push(['Timeout (s)', params.timeout]);
            reportSheetData.push(['Peso Favoritas', params.usouPeso ? `${params.peso}x` : 'Não']);
            if (params.favoritas.length > 0) { reportSheetData.push(['Bolas Favoritas', params.favoritas.join(', ')]); }
        }
        reportSheetData.push(['Aproveitou Jogos', params.aproveitouJogos ? 'Sim' : 'Não']);
        if (params.aproveitouJogos) {
            reportSheetData.push(['Validou Repetição (Aproveitados)', params.validouRepeticaoAproveitados ? 'Sim' : 'Não']);
            reportSheetData.push(['Validou Universo (Aproveitados)', params.validouUniversoAproveitados ? 'Sim' : 'Não']);
            reportSheetData.push(['Forçou usar universo dos jogos aproveitados', params.forcouUniversoAproveitados ? 'Sim' : 'Não']);
            if (params.jogosAproveitadosInfo.dezenas.length > 0) {
                reportSheetData.push(['Bolas contidas nos jogos aproveitados', params.jogosAproveitadosInfo.dezenas.join(', ')]);
            }
        }
        if (params.interrompido) { reportSheetData.push(['Status', 'Interrompido pelo usuário']); }

        reportSheetData.push([]);
        reportSheetData.push(['Universo para Novos Jogos', `Utilizado: ${params.universoNovosJogos.tipo === 'selecao_usuario' ? 'Seleção do Usuário' : 'Bolas dos Jogos Aproveitados'}`]);
        reportSheetData.push(['Bolas do Universo Utilizado', params.universoNovosJogos.dezenas.join(', ')]);

        const wsReport = XLSX.utils.aoa_to_sheet(reportSheetData);
        wsReport['!cols'] = [{ wch: 35 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsReport, 'Relatório de Geração');

        const frequenciaSheetData = [
            ['Frequência das Bolas'], [],
            ['Bola', 'Frequência Absoluta', 'Frequência Relativa (%)']
        ];
        reportData.frequenciaBolas.sort((a, b) => a.bola - b.bola).forEach(item => {
            frequenciaSheetData.push([item.bola, item.abs, item.rel.toFixed(2).replace('.', ',')]);
        });
        const wsFrequencia = XLSX.utils.aoa_to_sheet(frequenciaSheetData);
        wsFrequencia['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsFrequencia, 'Frequência das Bolas');

        showGenerationReport(reportData, wb, nomeArquivo);

        if (!window.stopGenerationRequested) {
            status.textContent = `Concluído! Relatório de geração disponível.`;
        } else {
            status.textContent = `Geração interrompida: ${jogos.length} jogos gerados! O download deve iniciar em breve.`;
        }
    } catch (error) {
        console.error('Erro ao gerar jogos:', error);
        alert('Erro: ' + error.message);
        status.textContent = 'Erro: ' + error.message;
        status.classList.add('error');
    } finally {
        if (progressModal) progressModal.style.display = 'none';
        if (btnGerar) btnGerar.disabled = false;
        if (btnParar) {
            btnParar.onclick = null;
        }
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
 * Remove um jogo da lista unificada (estado e UI).
 * @param {string} gameId - O ID do jogo a ser removido.
 */
function deleteManagedGame(gameId) {
    if (window.managedGames[gameId]) {
        delete window.managedGames[gameId];
        document.querySelectorAll(`[data-item-id="${gameId}"]`).forEach(el => el.remove());
    }
}


/**
 * Configura os controles específicos da aba de Análise de Jogos.
 * @function setupAnalysisTabControls
 * @returns {void}
 */
function setupAnalysisTabControls() {
    const fileInput = document.getElementById('userFileAnaliseInput');
    const adjustPrizeCheckbox = document.getElementById('adjustPrizeValues');
    const prizeContainer = document.getElementById('prize-values-container');

    // Inicializa o estado unificado
    window.managedGames = {};
    window.managedGameCounter = 0;
    window.generatedGameSequence = 1;

    if (adjustPrizeCheckbox && prizeContainer) {
        adjustPrizeCheckbox.addEventListener('change', function() {
            prizeContainer.style.display = this.checked ? 'block' : 'none';
        });
    }

    // Listeners for the simulation ball panel
    const btnSelectAllSim = document.getElementById('btn-select-all-sim-balls');
    const btnDeselectAllSim = document.getElementById('btn-deselect-all-sim-balls');
    const useOnlyTestGamesCheckbox = document.getElementById('useOnlyBallsFromTestGames');

    if (btnSelectAllSim) {
        btnSelectAllSim.addEventListener('click', () => {
            document.querySelectorAll('#simulation-ball-panel .ball').forEach(b => b.classList.add('active'));
            updateSimulationBallPanelStats();
            if (useOnlyTestGamesCheckbox) {
                useOnlyTestGamesCheckbox.checked = false;
            }
        });
    }
    if (btnDeselectAllSim) {
        btnDeselectAllSim.addEventListener('click', () => {
            document.querySelectorAll('#simulation-ball-panel .ball').forEach(b => b.classList.remove('active'));
            updateSimulationBallPanelStats();
            if (useOnlyTestGamesCheckbox) {
                useOnlyTestGamesCheckbox.checked = false;
            }
        });
    }

    // Listener for "Usar apenas bolas..."
    if (useOnlyTestGamesCheckbox) {
        useOnlyTestGamesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                const allBallsFromCheckedFiles = new Set();
                document.querySelectorAll('#analise-file-list .file-item-analise-wrapper').forEach(wrapper => {
                    const checkbox = wrapper.querySelector('.file-item-analise input[type="checkbox"]');
                    const button = wrapper.querySelector('.btn-add-balls');
                    const gameId = wrapper.dataset.itemId;

                    if (checkbox.checked && gameId) {
                        const gameData = window.managedGames[gameId];
                        if (gameData && gameData.uniqueBalls)
                            gameData.uniqueBalls.forEach(ball => allBallsFromCheckedFiles.add(ball));
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
    const userFileAnaliseInput = document.getElementById('userFileAnaliseInput');
    if (userFileAnaliseInput) {
        userFileAnaliseInput.addEventListener('change', async function(e) {
            const { addManagedGame } = await import('./interface.js');
            const files = e.target.files;
            for (const file of files) {
                await addManagedGame(file);
            }
            this.value = ''; // Reseta o input
        });
    }

    const fileControls = [
        { inputId: 'pdfGameFile', displayId: 'pdfGameFileName' },
        { inputId: 'pdfBackgroundImageFile', displayId: 'pdfBackgroundImageFileName' }
    ];

    // Listener para o input de jogos externos na aba Geração
    const jogosExistentesInput = document.getElementById('jogosExistentesFile');
    if (jogosExistentesInput) {
        jogosExistentesInput.addEventListener('change', async function(e) {
            const { addManagedGame } = await import('./interface.js');
            if (e.target.files.length > 0) {
                await addManagedGame(e.target.files[0]);
            }
            this.value = ''; // Reset input
        });
    }

    // Configura listeners para outros arquivos individuais (PDF)
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