import { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState, showNotification, createSimulationBallPanel, updateSimulationBallPanelStats, showGenerationReport, addManagedGame, setButtonLoading, showEnhancedProgress, showDotsLoader, showEnhancedNotification, updateExternalGamesCheckboxes } from './interface.js';
import { gerarJogosSemAcertosGarantidosRepetidos } from './generate.js';
import { executeAnalysis, saveAnalysisToExcel, printPieChartsToPDF } from './analyze.js';
import { generateVolantePDF, coletarConfiguracoesImpressao, aplicarConfiguracoesImpressao } from './printPdf.js';
import { validateGameConfig, parseBrazilianNumber, validateAndGetFileInfo } from './validators.js';
import { updateProgress, jogosJaGerados, combinations, formatBrazilianCurrency, calcularCustoComCotas } from './utils.js';
import { GAME_DEFAULTS, GAME_COSTS } from './constants.js';
import { updateCotasMaximas, updateCotasCompradas, atualizarExibicoesCusto, getBasicGenerationConfig, setupPrintControls } from './config.js';

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
    // Controles de navegação mobile
    setupMobileNavigation();
    
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

    // Controles de cotas para jogos
    setupCotasControls();

    // Controles de navegação por abas
    setupTabControls();

    // Listener para deleção de jogos das listas unificadas
    document.addEventListener('deleteManagedGame', (e) => {
        deleteManagedGame(e.detail.id);
    });

    // Configurar listener para checkbox de aproveitar jogos
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.addEventListener('change', () => {
            updateExternalGamesCheckboxes();
        });
    }

    // Inicializar estado dos checkboxes
    updateExternalGamesCheckboxes();

    // Inicializar wizard para novos usuários (com delay para aguardar carregamento)
    setTimeout(() => {
        if (window.wizardSystem) {
            window.wizardSystem.start();
        }
    }, 1000);
}

/**
 * Configura os controles de navegação mobile (menu hamburger).
 * @function setupMobileNavigation
 * @returns {void}
 */
function setupMobileNavigation() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const sidebar = document.querySelector('.sidebar');
    
    if (!mobileMenuToggle || !mobileOverlay || !sidebar) return;
    
    // Abrir/fechar menu
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        mobileOverlay.classList.toggle('active');
        
        // Atualizar ícone do botão
        const icon = mobileMenuToggle.querySelector('i');
        if (sidebar.classList.contains('mobile-open')) {
            icon.className = 'fas fa-times';
        } else {
            icon.className = 'fas fa-bars';
        }
    });
    
    // Fechar menu ao clicar no overlay
    mobileOverlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        mobileOverlay.classList.remove('active');
        
        // Resetar ícone
        const icon = mobileMenuToggle.querySelector('i');
        icon.className = 'fas fa-bars';
    });
    
    // Fechar menu ao clicar em uma aba
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Atualizar breadcrumb
            const tabSection = tab.getAttribute('data-tab') || 'dashboard';
            if (window.breadcrumbManager) {
                window.breadcrumbManager.updateBreadcrumb(tabSection);
            }
            
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                mobileOverlay.classList.remove('active');
                
                // Resetar ícone
                const icon = mobileMenuToggle.querySelector('i');
                icon.className = 'fas fa-bars';
            }
        });
    });
    
    // Fechar menu ao redimensionar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.remove('active');
            
            // Resetar ícone
            const icon = mobileMenuToggle.querySelector('i');
            icon.className = 'fas fa-bars';
        }
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

    // Botão para visualizar relatório de geração
    const btnVisualizarRelatorio = document.getElementById('btn-visualizar-relatorio');
    if (btnVisualizarRelatorio) {
        btnVisualizarRelatorio.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.lastGenerationReport) {
                const { reportData, workbook, filename } = window.lastGenerationReport;
                showGenerationReport(reportData, workbook, filename);
            } else {
                showNotification('Nenhum relatório de geração disponível. Gere jogos primeiro.', 'warning');
            }
        });
    }
}

/**
 * Coleta e valida a configuração de geração de jogos a partir da interface do usuário.
 * @returns {object} O objeto de configuração.
 * @throws {Error} Se a configuração for inválida.
 * @private
 */
function _getGenerationConfig() {
    const tipoJogo = document.getElementById('gameTypeGlobal')?.value || 'megasena';
    const defaults = GAME_DEFAULTS[tipoJogo] || GAME_DEFAULTS.megasena;

    const dezenasSelecionadas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.active')).map(b => parseInt(b.dataset.number));
    const dezenasFavoritas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.favorite')).map(b => parseInt(b.dataset.number));

    let algoritmo;
    if (document.getElementById('geracaoAleatoria').checked) {
        algoritmo = 'aleatorio';
    } else if (document.getElementById('geracaoCombinatoriaSequencial').checked) {
        algoritmo = 'combinatorio_sequencial';
    } else {
        algoritmo = 'combinatorio_aleatorio';
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
        incluirAproveitadosNoArquivo: document.getElementById('naoIncluirAproveitadosNoResultado').checked,
        validarRepeticaoJogosAproveitados: document.getElementById('validarRepeticaoJogosAproveitados').checked,
        validarUniversoJogosAproveitados: document.getElementById('validarUniversoJogosAproveitados').checked,
        jogosExistentes: [],
        tipoJogo: tipoJogo,
        dezenasSimples: defaults.dezenasJogadas,
    };

    if (config.usarPesoFavoritas && config.dezenasFavoritas.length === 0) {
        throw new Error("A opção de usar peso para favoritas está marcada, mas nenhuma bola foi marcada como favorita (duplo clique).");
    }

    // A validação completa (validateGameConfig) será chamada após a coleta dos jogos existentes.
    return config;
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

    // Ativar estado de loading no botão
    setButtonLoading('btn-gerar-jogos', true, 'Gerando...');

    // Exibe o modal de progresso
    if (progressModal) progressModal.style.display = 'flex';
    
    // Exibir loading aprimorado
    showEnhancedNotification('status-geracao', 'Preparando para gerar jogos...', 'info');
    showDotsLoader('loader-geracao', 'Inicializando');
    
    status.style.display = 'none'; // Usar o novo sistema
    progress.innerHTML = ''; // Limpa progresso anterior
    progress.style.display = 'block';

    try {
        const startTime = performance.now();
            const config = _getGenerationConfig();        const algoritmoDisplayMap = {
            aleatorio: 'Aleatório',
            combinatorio_sequencial: 'Combinatória em Sequência',
            combinatorio_aleatorio: 'Combinatória Aleatória'
        };
        const algoritmoDisplay = algoritmoDisplayMap[config.algoritmo];
        
        // Coleta jogos externos a partir da nova lista na UI ANTES da validação principal
        if (config.aproveitaJogos) {
            status.textContent = 'Lendo jogos da lista para aproveitamento...';
            await new Promise(resolve => setTimeout(resolve, 0));

            const gamesToProcess = [];
            const checkedItems = document.querySelectorAll('#generation-file-list .file-item-analise-wrapper input[type="checkbox"]:checked');
            config.nomeArquivoAproveitado = ''; // Limpa para construir a nova lista de nomes

            // Filtra para garantir que estamos olhando apenas para os itens visíveis (compatíveis com o tipo de jogo)
            const visibleCheckedItems = Array.from(checkedItems).filter(cb => {
                const wrapper = cb.closest('.file-item-analise-wrapper');
                return wrapper && wrapper.style.display !== 'none';
            });

            if (visibleCheckedItems.length === 0) {
                throw new Error('A opção "Aproveitar Jogos" está marcada, mas nenhum jogo (compatível com o tipo de jogo atual) foi selecionado na lista.');
            }

            for (const checkbox of visibleCheckedItems) {
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

            if (config.jogosExistentes.length === 0) {
                throw new Error('Os arquivos selecionados para aproveitamento não continham jogos válidos.');
            }
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
        
        const tabelaCustos = GAME_COSTS[config.tipoJogo] || {};
        let custoJogosAproveitados = 0;
        let custoJogosNovos = 0;

        jogos.forEach((jogo, index) => {
            const custoJogo = tabelaCustos[jogo.length] || 0;
            // Usar custo real sem aplicar ajustes de cotas
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

        // Coletar informações de cotas
        const calcularCotas = document.getElementById('calcularCotas')?.checked || false;
        const quantidadeCotas = parseInt(document.getElementById('quantidadeCotas')?.value) || 1;
        const cotasCompradas = parseInt(document.getElementById('cotasCompradas')?.value) || 1;
        const pago35Caixa = document.getElementById('pago35Caixa')?.checked || false;
        
        // custoTotalCotas é o valor que o usuário vai pagar baseado nas suas cotas
        const custoTotalCotas = calcularCotas ? 
            custoTotal * (cotasCompradas / quantidadeCotas) : 
            custoTotal;

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
                tipoJogo: config.tipoJogo.charAt(0).toUpperCase() + config.tipoJogo.slice(1),
                universo: config.qtdBolasSelecionadas,
                dezenasJogadas: config.dezenasJogadas,
                acertosGarantidos: config.acertosGarantidos,
                dezenasSimples: config.dezenasSimples,
                algoritmo: algoritmoDisplay,
                timeout: config.maxTime,
                usouPeso: config.usarPesoFavoritas,
                peso: config.pesoFavoritas,
                favoritas: config.dezenasFavoritas,
                aproveitouJogos: config.aproveitaJogos,
                incluirAproveitadosNoArquivo: config.incluirAproveitadosNoArquivo,
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
            // Informações de cotas
            cotas: {
                ativo: calcularCotas,
                quantidadeCotas: quantidadeCotas,
                cotasCompradas: cotasCompradas,
                pago35Caixa: pago35Caixa,
                custoTotalCotas: custoTotalCotas
            },
            jogosEquivalentes: jogos.reduce((acc, jogo) => {
                if (jogo.length > config.dezenasSimples) {
                    return acc + combinations(jogo, config.dezenasSimples).length;
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
            reportSheetData.push(['Incluiu Aproveitados no Arquivo', params.incluirAproveitadosNoArquivo ? 'Sim' : 'Não']);
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

        // Armazenar dados do relatório para acesso posterior
        window.lastGenerationReport = { reportData, workbook: wb, filename: nomeArquivo };
        
        // Mostrar o botão para visualizar o relatório
        const btnVisualizarRelatorio = document.getElementById('btn-visualizar-relatorio');
        if (btnVisualizarRelatorio) {
            btnVisualizarRelatorio.style.display = 'block';
        }

        if (!window.stopGenerationRequested) {
            showEnhancedNotification('status-geracao', 'Concluído! Relatório de geração disponível.', 'success', 5000);
        } else {
            showEnhancedNotification('status-geracao', `Geração interrompida: ${jogos.length} jogos gerados.`, 'warning');
        }
    } catch (error) {
        console.error('Erro ao gerar jogos:', error);
        showEnhancedNotification('status-geracao', 'Erro: ' + error.message, 'error');
    } finally {
        // Remover estado de loading do botão
        setButtonLoading('btn-gerar-jogos', false);
        
        if (progressModal) progressModal.style.display = 'none';
        if (btnGerar) btnGerar.disabled = false;
        if (btnParar) {
            btnParar.onclick = null;
        }
        
        // Limpar loaders
        const loader = document.getElementById('loader-geracao');
        if (loader) loader.style.display = 'none';
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
    // Botão para exportar gráfico em PDF
    const btnImprimirGrafico = document.getElementById('btn-imprimir-grafico-analise');
    if (btnImprimirGrafico) {
        btnImprimirGrafico.addEventListener('click', async function() {
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.printChartToPDF) {
                    chartsModule.printChartToPDF();
                }
            } catch (error) {
                console.error('Erro ao imprimir gráfico:', error);
                alert('Erro ao imprimir gráfico: ' + error.message);
            }
        });
    }

    // --- Controles para o Gráfico de Prêmios Ordenados ---
    const resetButton = document.getElementById('analise-grafico-reset-eixos');
    const updateButton = document.getElementById('analise-grafico-atualizar-eixos');

    const updateOrderedAxes = async () => {
        try {
            const chartsModule = await import('./charts.js');
            if (chartsModule && chartsModule.updateChartAxes) {
                chartsModule.updateChartAxes();
            }
        } catch (error) {
            console.warn('Módulo de gráficos não disponível:', error);
        }
    };

    if (resetButton) {
        resetButton.addEventListener('click', async function() {
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.resetAxisSliders && chartsModule.updateChartAxes) {
                    chartsModule.resetAxisSliders();
                    chartsModule.updateChartAxes();
                }
            } catch (error) {
                console.warn('Módulo de gráficos não disponível:', error);
            }
        });
    }

    if (updateButton) {
        updateButton.addEventListener('click', updateOrderedAxes);
    }

    // Atualização automática quando os valores dos eixos são alterados
    const axisInputs = ['analise-grafico-eixo-x-min', 'analise-grafico-eixo-x-max', 'analise-grafico-eixo-y-min', 'analise-grafico-eixo-y-max'];
    axisInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', updateOrderedAxes);
            input.addEventListener('keypress', e => { if (e.key === 'Enter') updateOrderedAxes(); });
        }
    });

    // --- NOVOS Controles para o Gráfico de Distribuição ---
    const distResetButton = document.getElementById('dist-grafico-reset-eixos');
    const distUpdateButton = document.getElementById('dist-grafico-atualizar-eixos');

    const updateDistAxes = async () => {
        try {
            const chartsModule = await import('./charts.js');
            if (chartsModule && chartsModule.updateDistributionChartAxes) {
                chartsModule.updateDistributionChartAxes();
            }
        } catch (error) {
            console.warn('Módulo de gráficos não disponível:', error);
        }
    };

    if (distResetButton) {
        distResetButton.addEventListener('click', async () => {
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.resetDistAxisSliders && chartsModule.updateDistributionChartAxes) {
                    chartsModule.resetDistAxisSliders();
                    chartsModule.updateDistributionChartAxes();
                }
            } catch (error) {
                console.warn('Módulo de gráficos não disponível:', error);
            }
        });
    }

    if (distUpdateButton) {
        distUpdateButton.addEventListener('click', updateDistAxes);
    }

    const distAxisInputs = ['dist-grafico-eixo-x-min', 'dist-grafico-eixo-x-max', 'dist-grafico-eixo-y-min', 'dist-grafico-eixo-y-max'];
    distAxisInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', updateDistAxes);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    updateDistAxes();
                }
            });
        }
    });

    // --- NOVOS Controles para o Gráfico de ROI ---
    const roiResetButton = document.getElementById('roi-grafico-reset-eixos');
    const roiUpdateButton = document.getElementById('roi-grafico-atualizar-eixos');

    const updateRoiAxes = async () => {
        try {
            const chartsModule = await import('./charts.js');
            if (chartsModule && chartsModule.updateRoiChartAxes) {
                chartsModule.updateRoiChartAxes();
            }
        } catch (error) {
            console.warn('Módulo de gráficos não disponível:', error);
        }
    };

    if (roiResetButton) {
        roiResetButton.addEventListener('click', async () => {
            try {
                const chartsModule = await import('./charts.js');
                if (chartsModule && chartsModule.resetRoiAxisSliders && chartsModule.updateRoiChartAxes) {
                    chartsModule.resetRoiAxisSliders();
                    chartsModule.updateRoiChartAxes();
                }
            } catch (error) {
                console.warn('Módulo de gráficos não disponível:', error);
            }
        });
    }

    if (roiUpdateButton) {
        roiUpdateButton.addEventListener('click', updateRoiAxes);
    }

    const roiAxisInputs = ['roi-grafico-eixo-x-min', 'roi-grafico-eixo-x-max', 'roi-grafico-eixo-y-min', 'roi-grafico-eixo-y-max'];
    roiAxisInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('blur', updateRoiAxes);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    updateRoiAxes();
                }
            });
        }
    });

    // --- Controle para rebaixar prêmio máximo ---
    const downgradeCheckboxes = document.querySelectorAll('.downgrade-max-prize-checkbox');

    const regenerateChartsWithNewSettings = async () => {
        try {
            const chartsModule = await import('./charts.js');
            if (chartsModule && chartsModule.generateResultCharts) {
                await chartsModule.generateResultCharts();
            } else {
                throw new Error('Função generateResultCharts não encontrada.');
            }
        } catch (error) {
            console.error('Erro ao regenerar gráficos:', error);
            showNotification('status-graficos', `Erro ao regenerar gráficos: ${error.message}`, 'error');
        }
    };

    downgradeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            // Sincroniza os dois checkboxes
            downgradeCheckboxes.forEach(cb => {
                if (cb !== e.target) {
                    cb.checked = e.target.checked;
                }
            });
            // Regenera os gráficos com a nova configuração
            regenerateChartsWithNewSettings();
        });
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
        // Após remover, verifica se a lista ficou vazia para mostrar a mensagem de estado vazio
        import('./interface.js').then(module => module.checkAndSetEmptyState());
        // Atualiza os checkboxes de jogos externos
        updateExternalGamesCheckboxes();
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
                    // Adicionado: Pular itens que não estão visíveis (filtrados por tipo de jogo)
                    if (wrapper.style.display === 'none') {
                        return; // 'return' em forEach é como 'continue' em um loop for.
                    }

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
    // Handler para adicionar arquivos nas abas de Análise e Geração
    const addGameInputs = ['userFileAnaliseInput', 'jogosExistentesFile'];
    addGameInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', async function(e) {
                const { addManagedGame } = await import('./interface.js');
                const files = e.target.files;
                for (const file of files) {
                    await addManagedGame(file);
                }
                this.value = ''; // Reseta o input
            });
        }
    });

    // Handler especial para o arquivo da aba de Impressão
    const pdfGameFileInput = document.getElementById('pdfGameFile');
    if (pdfGameFileInput) {
        pdfGameFileInput.addEventListener('change', async (e) => {
            const container = document.getElementById('pdf-file-info-container');
            if (!container) return;
            container.innerHTML = ''; // Limpa info anterior

            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                try {
                    const fileInfo = await validateAndGetFileInfo(file);
                    const gameTypeLabels = { megasena: 'MegaSena', quina: 'Quina', lotofacil: 'Lotofácil' };
                    const currentGameType = document.getElementById('gameTypeGlobal').value;
                    const currentLabel = gameTypeLabels[currentGameType];
                    let typesHTML = fileInfo.inferredTypes.length > 0 ? fileInfo.inferredTypes.map(t => t === currentLabel ? `<b>${t}</b>` : t).join(' / ') : 'N/A';

                    container.innerHTML = `
                        <div class="file-item-analise-wrapper" style="display: block;">
                            <div class="file-item-analise">
                                <i class="fas fa-file-excel" style="margin-right: 8px; color: var(--primary-color);"></i>
                                <span class="file-name">${file.name}</span>
                                <button class="delete-btn" title="Remover arquivo"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="file-item-details-frame">
                                <div class="detail-line game-types"><i class="fas fa-dice detail-icon"></i> <b>Tipo:</b> ${typesHTML}</div>
                                <div class="detail-line"><i class="fas fa-globe detail-icon"></i> <b>Bolas (${fileInfo.uniqueBalls.length}):</b> ${fileInfo.uniqueBalls.join(', ')}</div>
                            </div>
                        </div>`;

                    container.querySelector('.delete-btn')?.addEventListener('click', () => {
                        pdfGameFileInput.value = '';
                        container.innerHTML = '';
                    });
                } catch (error) {
                    container.innerHTML = `<div class="status-message error" style="display:flex;">Erro: ${error.message}</div>`;
                    pdfGameFileInput.value = '';
                }
            }
        });
    }

    // Handler para a imagem de fundo da impressão
    const backgroundInput = document.getElementById('pdfBackgroundImageFile');
    if (backgroundInput) {
        backgroundInput.addEventListener('change', function() {
            const display = document.getElementById('pdfBackgroundImageFileName');
            if (display) {
                display.textContent = this.files.length > 0 ? this.files[0].name : '';
            }
        });
    }
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
 * Configura os controles para salvar e carregar configurações de impressão PDF.
 * @function setupPdfConfigControls
 * @returns {void}
 */
function setupPdfConfigControls() {
    const btnSalvarPadrao = document.getElementById('btn-salvar-config-padrao');
    if (btnSalvarPadrao) {
        btnSalvarPadrao.addEventListener('click', () => {
            const gameType = document.getElementById('gameTypeGlobal').value;
            const config = coletarConfiguracoesImpressao();
            localStorage.setItem(`configPadraoImpressao_${gameType}`, JSON.stringify(config));
            alert(`Configuração padrão para ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} foi salva!`);
        });
    }

    const btnSalvarArquivo = document.getElementById('btn-salvar-config-arquivo');
    if (btnSalvarArquivo) {
        btnSalvarArquivo.addEventListener('click', () => {
            const gameType = document.getElementById('gameTypeGlobal').value;
            const gameTypeLabel = document.querySelector(`#gameTypeGlobal option[value="${gameType}"]`).textContent.trim().split(' ').slice(1).join(' ') || gameType;
            const config = coletarConfiguracoesImpressao();
            const configJson = JSON.stringify(config, null, 2);
            const blob = new Blob([configJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Ajustes de Volantes para ${gameTypeLabel}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    const btnCarregarConfig = document.getElementById('btn-carregar-config');
    const configFile_input = document.getElementById('pdfConfigFile');
    if (btnCarregarConfig && configFile_input) {
        btnCarregarConfig.addEventListener('click', () => {
            configFile_input.click();
        });

        configFile_input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const config = JSON.parse(e.target.result);
                    aplicarConfiguracoesImpressao(config);
                    alert(`Configuração do arquivo "${file.name}" carregada!`);
                } catch (err) {
                    alert('Erro ao ler o arquivo de configuração. Verifique se o arquivo é um JSON válido.');
                    console.error("Erro ao parsear JSON de configuração:", err);
                }
            };
            reader.readAsText(file);
            event.target.value = ''; // Reset input to allow loading the same file again
        });
    }
}

/**
 * Configura os controles de cotas para jogos
 * @function
 * @returns {void}
 */
function setupCotasControls() {
    const calcularCotasCheckbox = document.getElementById('calcularCotas');
    const cotasOptions = document.getElementById('cotas-options');
    const quantidadeCotasSelect = document.getElementById('quantidadeCotas');
    const cotasCompradasSelect = document.getElementById('cotasCompradas');

    if (!calcularCotasCheckbox || !cotasOptions) return;

    // Controla visibilidade das opções de cotas
    calcularCotasCheckbox.addEventListener('change', () => {
        if (calcularCotasCheckbox.checked) {
            cotasOptions.style.display = 'block';
            updateCotasMaximas();
        } else {
            cotasOptions.style.display = 'none';
        }
    });

    // Atualiza máximo de cotas compradas quando mudar quantidade total
    if (quantidadeCotasSelect) {
        quantidadeCotasSelect.addEventListener('change', () => {
            updateCotasCompradas();
        });
    }

    // Atualiza máximos de cotas quando mudar parâmetros do jogo
    const dezenasJogadas = document.getElementById('dezenasJogadas');
    const quantidadeJogos = document.getElementById('quantidadeJogos');
    
    if (dezenasJogadas) {
        dezenasJogadas.addEventListener('change', () => {
            if (calcularCotasCheckbox.checked) {
                updateCotasMaximas();
            }
        });
    }
    
    if (quantidadeJogos) {
        quantidadeJogos.addEventListener('input', () => {
            if (calcularCotasCheckbox.checked) {
                updateCotasMaximas();
            }
        });
    }

    // Listeners para atualizar exibições de custo quando configurações mudarem
    const pago35CaixaCheckbox = document.getElementById('pago35Caixa');
    if (pago35CaixaCheckbox) {
        pago35CaixaCheckbox.addEventListener('change', atualizarExibicoesCusto);
    }
    
    if (cotasCompradasSelect) {
        cotasCompradasSelect.addEventListener('change', atualizarExibicoesCusto);
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

    // Carrega a configuração de impressão padrão para o jogo inicial, se existir.
    // A função handleGlobalGameTypeChange (chamada em init) já define os padrões hardcoded,
    // então aqui nós sobrescrevemos com o que estiver salvo.
    const gameType = document.getElementById('gameTypeGlobal').value;
    const savedDefaultConfig = localStorage.getItem(`configPadraoImpressao_${gameType}`);
    if (savedDefaultConfig) {
        aplicarConfiguracoesImpressao(JSON.parse(savedDefaultConfig));
    }
});