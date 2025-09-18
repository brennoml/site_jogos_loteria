import { GAME_DEFAULTS } from './constants.js';
import { generateReportPDF, generateReportWithGamesPDF } from './reportPdf.js';
import { aplicarConfiguracoesImpressao } from './printPdf.js';
import { combinationsCount, calculateInternalRepetitions, formatCurrency } from './utils.js';
import { validateAndGetFileInfo } from './validators.js';

/**
 * Inicializa a interface do usuário do LotoPro.
 * Configura formatadores de moeda, campos numéricos e validações personalizadas.
 * Aplica máscaras de entrada usando Cleave.js para melhor UX.
 * @function initializeInterface
 * @returns {void}
 */
function initializeInterface() {
    // Formatar inputs de moeda
    document.querySelectorAll('.currency').forEach(input => {
        new Cleave(input, {
            numeral: true,
            numeralThousandsGroupStyle: 'thousand',
            prefix: 'R$ ',
            numeralDecimalScale: 2,
            numeralPositiveOnly: true,
            numeralDecimalMark: ',',
            delimiter: '.'
        });
    });

    // Formatar inputs numéricos com 2 casas decimais (para mm, etc.)
    document.querySelectorAll('.number-2dp').forEach(input => {
        new Cleave(input, {
            numeral: true,
            numeralDecimalScale: 2,
            numeralPositiveOnly: true,
            numeralDecimalMark: ',',
            delimiter: '.', // Milhar
            // No thousands separator for plain numbers if delimiter is not set or different
        });
    });

    // Formatar inputs de quantidade (com separadores de milhares)
    document.querySelectorAll('.quantity').forEach(input => {
        new Cleave(input, {
            numeral: true,
            numeralThousandsGroupStyle: 'thousand',
            numeralDecimalScale: 0,
            numeralPositiveOnly: true,
            numeralDecimalMark: ',', // Not really used for scale 0, but good to have
            delimiter: '.'
        });
    });

    // Configurar validação manual para campos de eixo X do gráfico (agora para percentuais)
    const axisXInputs = document.querySelectorAll('#graficoEixoXMin, #graficoEixoXMax');
    axisXInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            // Permite números decimais para percentuais
            let value = e.target.value.replace(/[^0-9.,]/g, '');
            // Substitui vírgula por ponto para validação
            value = value.replace(',', '.');
            // Valida o range de 0 a 100
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                if (numValue < 0) value = '0';
                if (numValue > 100) value = '100';
            }
            e.target.value = value;
        });
        
        // Permitir números e vírgulas/pontos
        input.addEventListener('keypress', function(e) {
            if (!/[0-9.,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
    });

    // Configurar event listeners para controles de estado
    setupGenerationControls();
    
    populateCotasDropdown();
    populateGridSpacingDropdowns();

    checkAndSetEmptyState(); // Checagem inicial

    handleGlobalGameTypeChange();
}

/**
 * Popula o menu de seleção de cotas do bolão.
 */
function populateCotasDropdown() {
    const cotasSelect = document.getElementById('pdfCotas');
    if (!cotasSelect) return;

    cotasSelect.innerHTML = '';
    cotasSelect.add(new Option('Nenhuma', 0)); // Opção padrão para não marcar

    for (let i = 1; i <= 99; i++) {
        cotasSelect.add(new Option(i, i));
    }
}

/**
 * Popula os menus de seleção de espaçamento da grade de alinhamento.
 */
function populateGridSpacingDropdowns() {
    const colSelect = document.getElementById('pdfGridLineColSpacing');
    const rowSelect = document.getElementById('pdfGridLineRowSpacing');

    if (!colSelect || !rowSelect) return;

    colSelect.innerHTML = '';
    rowSelect.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        colSelect.add(new Option(`${i} mm`, i));
        rowSelect.add(new Option(`${i} mm`, i));
    }
    colSelect.value = '1';
    rowSelect.value = '1';
}

/**
 * Configura event listeners para controles da aba de geração de jogos.
 * Monitora alterações em checkboxes e campos que afetam o estado da interface.
 * @function setupGenerationControls
 * @returns {void}
 */
function setupGenerationControls() {
    const generationRadios = document.querySelectorAll('input[name="generationAlgorithm"]');
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    const usarPesoFavoritasCheckbox = document.getElementById('usarPesoFavoritas');
    const selectAllBtn = document.getElementById('btn-select-all-balls');
    const deselectAllBtn = document.getElementById('btn-deselect-all-balls');
    const randomSelector = document.getElementById('random-ball-selector');
    const convertToFavoriteBtn = document.getElementById('btn-convert-to-favorite');
    generationRadios.forEach(radio => radio.addEventListener('change', updateGenerationInputsState));

    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.addEventListener('change', updateGenerationInputsState);
        
        // Event listener adicional para garantir que as opções apareçam corretamente
        aproveitaJogosCheckbox.addEventListener('change', function() {
            const aproveitarOptions = document.getElementById('aproveitar-options');
            if (aproveitarOptions) {
                if (this.checked) {
                    aproveitarOptions.style.display = 'block';
                    // Forçar recalculo da altura da seção colapsável se necessário
                    const collapsibleContent = aproveitarOptions.closest('.collapsible-content');
                    if (collapsibleContent && collapsibleContent.classList.contains('active')) {
                        setTimeout(() => {
                            collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + 'px';
                        }, 50);
                    }
                } else {
                    aproveitarOptions.style.display = 'none';
                }
            }
        });
    }

    if (usarPesoFavoritasCheckbox) {
        usarPesoFavoritasCheckbox.addEventListener('change', updateGenerationInputsState);
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#ball-selection-panel .ball').forEach(ball => {
                ball.classList.add('active');
            });
            updateBallStats();
        });
    }

    if (convertToFavoriteBtn) {
        convertToFavoriteBtn.addEventListener('click', () => {
            document.querySelectorAll('#ball-selection-panel .ball.active').forEach(ball => {
                ball.classList.add('favorite');
            });
            updateBallStats();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#ball-selection-panel .ball').forEach(ball => {
                ball.classList.remove('active', 'favorite');
            });
            updateBallStats();
        });
    }

    if (randomSelector) {
        randomSelector.addEventListener('change', (e) => {
            const quantity = parseInt(e.target.value, 10);
            if (!isNaN(quantity) && quantity > 0) {
                const allBalls = Array.from(document.querySelectorAll('#ball-selection-panel .ball'));
                allBalls.forEach(ball => ball.classList.remove('active', 'favorite'));
                
                // Fisher-Yates shuffle
                for (let i = allBalls.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
                }
                
                allBalls.slice(0, quantity).forEach(ball => ball.classList.add('active'));
                updateBallStats();
                e.target.value = ""; // Reset selector
            }
        });
    }

    // Listener para o modal de relatório
    const modal = document.getElementById('generation-report-modal');
    if (modal) {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => modal.style.display = 'none';
        }
    }

    // Listener para o novo modal de frequência de prêmios
    const prizeFreqModal = document.getElementById('prize-frequency-modal');
    if (prizeFreqModal) {
        const closeButton = prizeFreqModal.querySelector('.close-button');
        const closeFooterButton = document.getElementById('close-prize-frequency-modal');
        const closeModal = () => prizeFreqModal.style.display = 'none';
 
        if (closeButton) closeButton.onclick = closeModal;
        if (closeFooterButton) closeFooterButton.onclick = closeModal;
    }
 
    // Listener global para fechar modais ao clicar fora (substitui o antigo window.onclick)
    window.addEventListener('click', (event) => {
        if (modal && event.target == modal) {
            modal.style.display = 'none';
        }
        if (prizeFreqModal && event.target == prizeFreqModal) {
            prizeFreqModal.style.display = 'none';
        }
    });
}

/**
 * Checks if the managed game lists are empty and displays a placeholder message.
 */
function checkAndSetEmptyState() {
    const lists = [
        { container: document.getElementById('generation-file-list'), message: 'Nenhum jogo na lista. Gere ou adicione um arquivo para começar.' },
        { container: document.getElementById('analise-file-list'), message: 'Nenhum jogo na lista. Adicione um arquivo para começar a análise.' }
    ];

    lists.forEach(({ container, message }) => {
        if (container && container.children.length === 0) {
            container.innerHTML = `<div class="empty-state-message">${message}</div>`;
        } else if (container && container.querySelector('.empty-state-message')) {
            container.querySelector('.empty-state-message').remove();
        }
    });
}

/**
 * Creates the interactive ball panel for simulation parameter selection.
 * @param {string} gameType - The type of game ('megasena', 'quina', 'lotofacil').
 */
function createSimulationBallPanel(gameType) {
    const panel = document.getElementById('simulation-ball-panel');
    if (!panel) return;

    const totalBolas = GAME_DEFAULTS[gameType]?.totalBolas || 60;
    panel.innerHTML = ''; // Clear the panel

    for (let i = 1; i <= totalBolas; i++) {
        const ball = document.createElement('div');
        ball.className = 'ball active'; // Balls start selected
        ball.textContent = String(i).padStart(2, '0');
        ball.dataset.number = i;

        ball.addEventListener('click', () => {
            ball.classList.toggle('active');
            updateSimulationBallPanelStats();
            // Desmarca a caixa "Usar apenas bolas contidas nos jogos testados"
            const useOnlyTestGamesCheckbox = document.getElementById('useOnlyBallsFromTestGames');
            if (useOnlyTestGamesCheckbox) {
                useOnlyTestGamesCheckbox.checked = false;
            }
        });

        panel.appendChild(ball);
    }
    updateSimulationBallPanelStats();
}

/**
 * Updates the statistics for the simulation ball panel.
 */
function updateSimulationBallPanelStats() {
    const selectedBalls = document.querySelectorAll('#simulation-ball-panel .ball.active');
    document.getElementById('stats-sim-selected-count').textContent = selectedBalls.length;
}

/**
 * Cria o painel de bolas interativo para seleção de dezenas.
 * @param {string} gameType - O tipo de jogo ('megasena', 'quina', 'lotofacil').
 */
function createBallPanel(gameType) {
    const panel = document.getElementById('ball-selection-panel');
    if (!panel) return;

    const totalBolas = GAME_DEFAULTS[gameType]?.totalBolas || 60;
    panel.innerHTML = ''; // Limpa o painel

    for (let i = 1; i <= totalBolas; i++) {
        const ball = document.createElement('div');
        ball.className = 'ball active'; // Bolas iniciam selecionadas
        ball.textContent = String(i).padStart(2, '0');
        ball.dataset.number = i;

        // Clique simples para selecionar/deselecionar
        ball.addEventListener('click', () => {
            ball.classList.toggle('active');
            if (!ball.classList.contains('active')) ball.classList.remove('favorite'); // Desmarca favorita se a bola for desativada
            updateBallStats();
        });

        // Duplo clique para favoritar/desfavoritar
        ball.addEventListener('dblclick', (e) => {
            e.preventDefault(); // Previne seleção de texto
            ball.classList.toggle('favorite');
            // Uma bola favorita também deve ser ativa
            if (ball.classList.contains('favorite')) {
                ball.classList.add('active');
            }
            updateBallStats();
        });

        panel.appendChild(ball);
    }
    updateBallStats();
}

/**
 * Atualiza as estatísticas de bolas selecionadas e favoritas.
 */
function updateBallStats() {
    const allBalls = document.querySelectorAll('#ball-selection-panel .ball');
    const selectedBalls = document.querySelectorAll('#ball-selection-panel .ball.active');
    const favoriteBalls = document.querySelectorAll('#ball-selection-panel .ball.favorite');
    const selectAllBtn = document.getElementById('btn-select-all-balls');
    const deselectAllBtn = document.getElementById('btn-deselect-all-balls');
    const usarPesoCheckbox = document.getElementById('usarPesoFavoritas');

    if (usarPesoCheckbox) {
        usarPesoCheckbox.disabled = favoriteBalls.length === 0;
        if (usarPesoCheckbox.disabled) {
            usarPesoCheckbox.checked = false;
        }
    }

    document.getElementById('stats-selected-count').textContent = selectedBalls.length;
    document.getElementById('stats-favorite-count').textContent = favoriteBalls.length;

    if (selectAllBtn && deselectAllBtn) {
        // Botão "Limpar" ativo se houver alguma bola selecionada
        deselectAllBtn.disabled = selectedBalls.length === 0;
        // Botão "Selecionar Todas" ativo se houver alguma bola não selecionada
        selectAllBtn.disabled = selectedBalls.length === allBalls.length;
    }

    // Atualiza o estado dos controles dependentes, como a visibilidade do seletor de peso
    updateGenerationInputsState();
    updateCombinatorialGenerationState();
}

/**
 * Popula os menus suspensos de parâmetros do jogo com base no tipo de loteria.
 * @param {string} gameType - O tipo de jogo.
 */
function populateGameParameterDropdowns(gameType) {
    const dezenasSelect = document.getElementById('dezenasJogadas');
    const acertosSelect = document.getElementById('acertosGarantidos');
    if (!dezenasSelect || !acertosSelect) return;

    const rules = {
        megasena: { dezenas: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], acertos: [4, 5, 6] },
        quina: { dezenas: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], acertos: [2, 3, 4, 5] },
        lotofacil: { dezenas: [15, 16, 17, 18, 19, 20], acertos: [11, 12, 13, 14, 15] }
    };

    const gameRules = rules[gameType];

    // Popula "Dezenas por Jogo"
    dezenasSelect.innerHTML = '';
    gameRules.dezenas.forEach(d => {
        const option = new Option(`${d} dezenas`, d);
        dezenasSelect.add(option);
    });

    // Atualiza "Acertos Garantidos" com base na seleção de dezenas
    const updateAcertos = () => {
        const valorAtual = acertosSelect.value; // Salva o valor atual
        const dezenasSelecionadas = parseInt(dezenasSelect.value);
        acertosSelect.innerHTML = '';
        const novasOpcoes = gameRules.acertos.filter(a => a <= dezenasSelecionadas);
        
        novasOpcoes.forEach(a => {
            const option = new Option(`${a} acertos`, a);
            acertosSelect.add(option);
        });

        // Tenta restaurar o valor anterior se ele ainda for uma opção válida
        if (novasOpcoes.includes(parseInt(valorAtual))) {
            acertosSelect.value = valorAtual;
        } else if (acertosSelect.options.length > 0) {
            // Se não for válido, seleciona o maior acerto possível como padrão
            acertosSelect.value = acertosSelect.options[acertosSelect.options.length - 1].value;
        }
    };

    dezenasSelect.addEventListener('change', () => {
        updateAcertos();
        updateCombinatorialGenerationState();
    });
    updateAcertos(); // Chamada inicial
    updateCombinatorialGenerationState(); // Chamada inicial
}

/**
 * Popula o seletor de quantidade de bolas aleatórias.
 * @param {string} gameType - O tipo de jogo.
 */
function populateRandomBallSelector(gameType) {
    const selector = document.getElementById('random-ball-selector');
    if (!selector) return;

    const defaults = GAME_DEFAULTS[gameType];
    if (!defaults) return;

    const minSelection = rules[gameType].dezenas[0]; // Mínimo de dezenas para um jogo
    const maxSelection = defaults.totalBolas;

    selector.innerHTML = '<option value="">Selecionar bolas aleatoriamente...</option>';

    for (let i = minSelection; i <= maxSelection; i++) {
        const option = new Option(`${i} bolas`, i);
        selector.add(option);
    }
}

// Adicionado para ser usado em populateRandomBallSelector
const rules = {
    megasena: { dezenas: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], acertos: [4, 5, 6] },
    quina: { dezenas: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], acertos: [2, 3, 4, 5] },
    lotofacil: { dezenas: [15, 16, 17, 18, 19, 20], acertos: [11, 12, 13, 14, 15] }
};

/**
 * Atualiza o estado (habilitado/desabilitado) dos checkboxes de geração combinatória.
 * Desabilita as opções se o número de combinações for muito alto, para evitar travamentos.
 * @function updateCombinatorialGenerationState
 * @returns {void}
 */
function updateCombinatorialGenerationState() {
    const selectedBallsCount = document.querySelectorAll('#ball-selection-panel .ball.active').length;
    const dezenasJogadas = parseInt(document.getElementById('dezenasJogadas').value, 10);
    const combinatoriaAleatoriaRadio = document.getElementById('geracaoCombinatoriaAleatoria');
    const combinatoriaSequencialRadio = document.getElementById('geracaoCombinatoriaSequencial');

    if (!combinatoriaAleatoriaRadio || !combinatoriaSequencialRadio || isNaN(dezenasJogadas) || selectedBallsCount < dezenasJogadas) {
        if (combinatoriaAleatoriaRadio) combinatoriaAleatoriaRadio.disabled = true;
        if (combinatoriaSequencialRadio) combinatoriaSequencialRadio.disabled = true;
        return;
    }

    const totalCombinations = combinationsCount(selectedBallsCount, dezenasJogadas);
    
    const COMBINATION_MEMORY_LIMIT = 400000000; // Limite para "Aleatória"
    const COMBINATION_LIMIT = 1000000000;      // Limite para "Sequencial"

    // Lógica para Combinatória Aleatória
    if (totalCombinations > COMBINATION_MEMORY_LIMIT) {
        combinatoriaAleatoriaRadio.disabled = true;
        if (combinatoriaAleatoriaRadio.checked) combinatoriaAleatoriaRadio.checked = false;
        combinatoriaAleatoriaRadio.parentElement.title = `Muitas combinações (${totalCombinations.toLocaleString('pt-BR')}) para este método. Use "Combinatória em Sequência" ou "Geração Aleatória".`;
    } else {
        combinatoriaAleatoriaRadio.disabled = false;
        combinatoriaAleatoriaRadio.parentElement.title = '';
    }

    // Lógica para Combinatória Sequencial
    if (totalCombinations > COMBINATION_LIMIT) {
        combinatoriaSequencialRadio.disabled = true;
        if (combinatoriaSequencialRadio.checked) combinatoriaSequencialRadio.checked = false;
        combinatoriaSequencialRadio.parentElement.title = `Muitas combinações (${totalCombinations.toLocaleString('pt-BR')}). Use "Geração Aleatória".`;
    } else {
        combinatoriaSequencialRadio.disabled = false;
        combinatoriaSequencialRadio.parentElement.title = '';
    }

    // Garante que pelo menos uma opção de geração esteja marcada se as outras forem desabilitadas
    const generationRadios = [combinatoriaAleatoriaRadio, combinatoriaSequencialRadio, document.getElementById('geracaoAleatoria')];
    if (!generationRadios.some(cb => cb.checked)) {
        const firstEnabled = generationRadios.find(cb => !cb.disabled);
        if (firstEnabled) firstEnabled.checked = true;
    }
}

/**
 * Define valores padrão otimizados para cada tipo de jogo na aba de geração.
 * Configura automaticamente total de bolas, dezenas por jogo e acertos garantidos.
 * Também define parâmetros de impressão específicos para cada modalidade.
 * @function setGenerationDefaults
 * @param {string} gameType - Tipo de jogo ('megasena', 'quina', 'lotofacil')
 * @returns {void}
 */
function setGenerationDefaults(gameType) {
    createBallPanel(gameType);
    populateGameParameterDropdowns(gameType);
    populateRandomBallSelector(gameType);

    // --- NOVO: Atualiza os campos da aba de impressão de volantes conforme o tipo de jogo ---
    setPrintDefaults(gameType);
}

/**
 * Configura parâmetros de impressão PDF otimizados para cada modalidade de loteria.
 * Define dimensões, margens e posicionamentos específicos dos volantes oficiais.
 * @function setPrintDefaults
 * @param {string} gameType - Tipo de jogo ('megasena', 'quina', 'lotofacil')
 * @returns {void}
 */
function setPrintDefaults(gameType) {
    // Valores de exemplo, altere conforme necessário para cada tipo de jogo
    const defaults = {
        quina: {
            pdfPageWidthMm: '81',
            pdfPageHeightMm: '186',
            pdfGlobalOffsetX: '0',
            pdfGlobalOffsetY: '0',
            pdfStartXMm: '10,4',
            pdfFirstGameYFromTopMm: '66',
            pdfMarkWidthMm: '4,14',
            pdfMarkHeightMm: '2,08',
            pdfHorizontalSpacingMm: '2,2',
            pdfVerticalSpacingMm: '1,2',
            pdfDistanceBetweenGamesMm: '6,7',
            // Dezenas Jogadas
            pdfDezenasMarkXPosMm: '10,4',
            pdfDezenasMarkYPosMm: '134,2',
            pdfDezenasMarkCellWidthMm: '4,14',
            pdfDezenasMarkCellHeightMm: '2,08',
            pdfDezenasMarkHorizontalSpacingMm: '2,2',
            // Bolão
            pdfBolaoMarkXPosMm: '10,4',
            pdfBolaoMarkYPosMm: '133,5',
            pdfBolaoCellWidthMm: '6,5',
            pdfBolaoCellHeightMm: '3',
            pdfBolaoHorizontalSpacingMm: '0',
            pdfBolaoVerticalSpacingMm: '0,7',
            // Número do Volante
            pdfPageNumberXPosMm: '35,4', pdfPageNumberYPosMm: '170,5', pdfPageNumberFontSize: '18',
            // Números das Bolas
            pdfGamesNumbersXPosMm: '25,4', pdfGamesNumbersYPosMm: '179', pdfGamesNumbersLineSpacingMm: '4', pdfGamesNumbersFontSize: '10',
            // Linhas de Grade
            pdfShowGridLines: false,
            pdfGridLineColSpacing: '1',
            pdfGridLineRowSpacing: '1'
        },
        megasena: {
            pdfPageWidthMm: '81',
            pdfPageHeightMm: '186',
            pdfGlobalOffsetX: '0',
            pdfGlobalOffsetY: '0',
            pdfStartXMm: '10,4',
            pdfFirstGameYFromTopMm: '66',
            pdfMarkWidthMm: '4,14',
            pdfMarkHeightMm: '2,08',
            pdfHorizontalSpacingMm: '2,2',
            pdfVerticalSpacingMm: '1,2',
            pdfDistanceBetweenGamesMm: '6,7',
            // Dezenas Jogadas
            pdfDezenasMarkXPosMm: '10,4',
            pdfDezenasMarkYPosMm: '134,2',
            pdfDezenasMarkCellWidthMm: '4,14',
            pdfDezenasMarkCellHeightMm: '2,08',
            pdfDezenasMarkHorizontalSpacingMm: '2,2',
            // Bolão
            pdfBolaoMarkXPosMm: '10,4',
            pdfBolaoMarkYPosMm: '133,5',
            pdfBolaoCellWidthMm: '6,5',
            pdfBolaoCellHeightMm: '3',
            pdfBolaoHorizontalSpacingMm: '0',
            pdfBolaoVerticalSpacingMm: '0,7',
            // Número do Volante
            pdfPageNumberXPosMm: '35,4', pdfPageNumberYPosMm: '170,5', pdfPageNumberFontSize: '18',
            // Números das Bolas
            pdfGamesNumbersXPosMm: '25,4', pdfGamesNumbersYPosMm: '179', pdfGamesNumbersLineSpacingMm: '4', pdfGamesNumbersFontSize: '10',
            // Linhas de Grade
            pdfShowGridLines: false,
            pdfGridLineColSpacing: '1',
            pdfGridLineRowSpacing: '1'
        },
        lotofacil: {
            pdfPageWidthMm: '81',
            pdfPageHeightMm: '186',
            pdfGlobalOffsetX: '0',
            pdfGlobalOffsetY: '0',
            pdfStartXMm: '8',
            pdfFirstGameYFromTopMm: '45,6',
            pdfMarkWidthMm: '5,0',
            pdfMarkHeightMm: '3,0',
            pdfHorizontalSpacingMm: '7,45',
            pdfVerticalSpacingMm: '1,6',
            pdfDistanceBetweenGamesMm: '2,7',
            // Dezenas Jogadas
            pdfDezenasMarkXPosMm: '8',
            pdfDezenasMarkYPosMm: '101,8',
            pdfDezenasMarkCellWidthMm: '5,0',
            pdfDezenasMarkCellHeightMm: '3,0',
            pdfDezenasMarkHorizontalSpacingMm: '7,45',
            // Bolão
            pdfBolaoMarkXPosMm: '8',
            pdfBolaoMarkYPosMm: '159,8',
            pdfBolaoCellWidthMm: '6,5',
            pdfBolaoCellHeightMm: '3',
            pdfBolaoHorizontalSpacingMm: '0',
            pdfBolaoVerticalSpacingMm: '0,7',
            // Número do Volante
            pdfPageNumberXPosMm: '15', pdfPageNumberYPosMm: '180', pdfPageNumberFontSize: '18',
            // Números das Bolas
            pdfGamesNumbersXPosMm: '0', pdfGamesNumbersYPosMm: '170', pdfGamesNumbersLineSpacingMm: '5', pdfGamesNumbersFontSize: '10',
            // Linhas de Grade
            pdfShowGridLines: false,
            pdfGridLineColSpacing: '1',
            pdfGridLineRowSpacing: '1'
        }
    };

    const d = defaults[gameType] || defaults['quina'];
    // Atualiza os campos de impressão
    document.getElementById('pdfPageWidthMm').value = d.pdfPageWidthMm;
    document.getElementById('pdfPageHeightMm').value = d.pdfPageHeightMm;

    // Substituído 'pdfMarginMm' por 'pdfGlobalOffsetX' e 'pdfGlobalOffsetY'
    const offsetXEl = document.getElementById('pdfGlobalOffsetX');
    const offsetYEl = document.getElementById('pdfGlobalOffsetY');
    if (offsetXEl) offsetXEl.value = d.pdfGlobalOffsetX;
    if (offsetYEl) offsetYEl.value = d.pdfGlobalOffsetY;

    document.getElementById('pdfStartXMm').value = d.pdfStartXMm;
    document.getElementById('pdfFirstGameYFromTopMm').value = d.pdfFirstGameYFromTopMm;
    document.getElementById('pdfMarkWidthMm').value = d.pdfMarkWidthMm;
    document.getElementById('pdfMarkHeightMm').value = d.pdfMarkHeightMm;
    document.getElementById('pdfHorizontalSpacingMm').value = d.pdfHorizontalSpacingMm;
    document.getElementById('pdfVerticalSpacingMm').value = d.pdfVerticalSpacingMm;
    document.getElementById('pdfDistanceBetweenGamesMm').value = d.pdfDistanceBetweenGamesMm;
    
    // Dezenas Jogadas
    document.getElementById('pdfDezenasMarkXPosMm').value = d.pdfDezenasMarkXPosMm;
    document.getElementById('pdfDezenasMarkYPosMm').value = d.pdfDezenasMarkYPosMm;
    document.getElementById('pdfDezenasMarkCellWidthMm').value = d.pdfDezenasMarkCellWidthMm;
    document.getElementById('pdfDezenasMarkCellHeightMm').value = d.pdfDezenasMarkCellHeightMm;
    document.getElementById('pdfDezenasMarkHorizontalSpacingMm').value = d.pdfDezenasMarkHorizontalSpacingMm;

    // Bolões
    document.getElementById('pdfBolaoMarkXPosMm').value = d.pdfBolaoMarkXPosMm;
    document.getElementById('pdfBolaoMarkYPosMm').value = d.pdfBolaoMarkYPosMm;
    document.getElementById('pdfBolaoCellWidthMm').value = d.pdfBolaoCellWidthMm;
    document.getElementById('pdfBolaoCellHeightMm').value = d.pdfBolaoCellHeightMm;
    document.getElementById('pdfBolaoHorizontalSpacingMm').value = d.pdfBolaoHorizontalSpacingMm;
    document.getElementById('pdfBolaoVerticalSpacingMm').value = d.pdfBolaoVerticalSpacingMm;
    
    // Número do Volante
    document.getElementById('pdfPageNumberXPosMm').value = d.pdfPageNumberXPosMm;
    document.getElementById('pdfPageNumberYPosMm').value = d.pdfPageNumberYPosMm;
    document.getElementById('pdfPageNumberFontSize').value = d.pdfPageNumberFontSize;

    // Números das bolas marcadas
    document.getElementById('pdfGamesNumbersXPosMm').value = d.pdfGamesNumbersXPosMm;
    document.getElementById('pdfGamesNumbersYPosMm').value = d.pdfGamesNumbersYPosMm;
    document.getElementById('pdfGamesNumbersLineSpacingMm').value = d.pdfGamesNumbersLineSpacingMm;
    document.getElementById('pdfGamesNumbersFontSize').value = d.pdfGamesNumbersFontSize;

    // Linhas de Grade
    const gridCheckbox = document.getElementById('pdfShowGridLines');
    if (gridCheckbox) {
        gridCheckbox.checked = d.pdfShowGridLines;
        gridCheckbox.dispatchEvent(new Event('change')); // Atualiza a visibilidade das opções
    }
    document.getElementById('pdfGridLineColSpacing').value = d.pdfGridLineColSpacing;
    document.getElementById('pdfGridLineRowSpacing').value = d.pdfGridLineRowSpacing;
}

/**
 * Controla a visibilidade dos inputs de premiação na aba de análise.
 * Exibe apenas os campos relevantes para o tipo de jogo selecionado.
 * @function updateAnalysisPrizeInputs
 * @param {string} gameType - Tipo de jogo ('megasena', 'quina', 'lotofacil')
 * @returns {void}
 */
function updateAnalysisPrizeInputs(gameType) {
    const megasenaInputs = document.getElementById('megasenaInputs');
    const quinaInputs = document.getElementById('quinaInputs');
    const lotofacilInputs = document.getElementById('lotofacilInputs');

    if (!megasenaInputs || !quinaInputs || !lotofacilInputs) {
        console.error('Elementos de inputs de prêmios não encontrados.');
        return;
    }

    megasenaInputs.classList.remove('active');
    quinaInputs.classList.remove('active');
    lotofacilInputs.classList.remove('active');

    if (gameType === 'megasena') {
        megasenaInputs.classList.add('active');
    } else if (gameType === 'lotofacil') {
        lotofacilInputs.classList.add('active');
    } else {
        quinaInputs.classList.add('active');
    }
}

/**
 * Gerencia mudanças no seletor global de tipo de jogo.
 * Sincroniza automaticamente todas as abas com os parâmetros do jogo selecionado.
 * Atualiza campos de análise, geração e impressão simultaneamente.
 * @function handleGlobalGameTypeChange
 * @returns {void}
 */
function handleGlobalGameTypeChange() {
    const gameTypeSelect = document.getElementById('gameTypeGlobal');
    if (!gameTypeSelect) {
        console.warn('Seletor de tipo de jogo global não encontrado.');
        return;
    }
    const selectedGame = gameTypeSelect.value;

    try {
        updateAnalysisPrizeInputs(selectedGame);
        setGenerationDefaults(selectedGame);
        filterAndRefreshManagedGamesList(selectedGame);
        createSimulationBallPanel(selectedGame);

        // Atualizar cotas máximas quando o tipo de jogo mudar
        const calcularCotasCheckbox = document.getElementById('calcularCotas');
        if (calcularCotasCheckbox && calcularCotasCheckbox.checked) {
            // Importar e chamar updateCotasMaximas do config.js
            import('./config.js').then(configModule => {
                configModule.updateCotasMaximas();
            }).catch(error => {
                console.error('Erro ao carregar módulo config:', error);
            });
        }

        // Após definir os padrões hardcoded, tenta carregar a configuração
        // padrão salva pelo usuário para este tipo de jogo.
        const savedDefaultConfig = localStorage.getItem(`configPadraoImpressao_${selectedGame}`);
        if (savedDefaultConfig) {
            aplicarConfiguracoesImpressao(JSON.parse(savedDefaultConfig));
        }
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
    }
}

/**
 * Gerencia o estado (habilitado/desabilitado) dos campos na aba de geração.
 * Aplica lógica condicional baseada nas opções selecionadas pelo usuário.
 * Inclui feedback visual para campos desabilitados.
 * @function updateGenerationInputsState
 * @returns {void}
 */
function updateGenerationInputsState() {
    const combinatoriaAleatoriaCheckbox = document.getElementById('geracaoCombinatoriaAleatoria');
    const combinatoriaSequencialCheckbox = document.getElementById('geracaoCombinatoriaSequencial');
    const aleatoriaCheckbox = document.getElementById('geracaoAleatoria');
    const aleatorioOptions = document.getElementById('aleatorio-options');
    const usarPesoFavoritasCheckbox = document.getElementById('usarPesoFavoritas');
    const pesoFavoritasOptions = document.getElementById('peso-favoritas-options');
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');

    if (!combinatoriaAleatoriaCheckbox || !combinatoriaSequencialCheckbox || !aleatoriaCheckbox || !aleatorioOptions || !aproveitaJogosCheckbox || !usarPesoFavoritasCheckbox || !pesoFavoritasOptions) {
        console.warn("Alguns elementos de controle não foram encontrados para atualizar estado.");
        return;
    }

    // Lógica para opções de geração (Aleatória vs. Combinatória)
    if (aleatoriaCheckbox.checked) {
        aleatorioOptions.style.display = 'block';
    } else {
        aleatorioOptions.style.display = 'none';
        usarPesoFavoritasCheckbox.checked = false; // Desmarca ao esconder
    }

    // Lógica para peso de favoritas
    if (aleatoriaCheckbox.checked && usarPesoFavoritasCheckbox.checked) {
        pesoFavoritasOptions.style.display = 'block';
    } else {
        pesoFavoritasOptions.style.display = 'none';
    }

    // A lógica para aproveitar jogos agora é controlada pela função updateExternalGamesCheckboxes()
    // que é chamada quando necessário
}

/**
 * Atualiza o conteúdo de um item de jogo na lista (tipo, repetições) com base no tipo de jogo selecionado.
 * @param {HTMLElement} wrapper - O elemento wrapper do item do jogo.
 * @param {string} gameType - O tipo de jogo atual ('megasena', 'quina', 'lotofacil').
 */
function updateManagedGameItemContent(wrapper, gameType) {
    const itemId = wrapper.dataset.itemId;
    const itemData = window.managedGames[itemId];
    if (!itemData) return;

    const gameTypeLabels = { megasena: 'MegaSena', quina: 'Quina', lotofacil: 'Lotofácil' };
    const currentLabel = gameTypeLabels[gameType];

    // Atualiza a string do tipo de jogo, destacando o tipo atual
    const typeLine = wrapper.querySelector('.detail-line.game-types');
    if (typeLine && itemData.inferredTypes && itemData.inferredTypes.length > 0) {
        const typesHTML = itemData.inferredTypes.map(t => {
            return t === currentLabel ? `<b>${t}</b>` : t;
        }).join(' / ');
        typeLine.innerHTML = `<i class="fas fa-dice detail-icon"></i> <b>Tipo:</b> ${typesHTML}`;
    }

    // Atualiza a string de repetições para mostrar apenas as relevantes
    const repetitionLine = wrapper.querySelector('.detail-line.repetitions');
    if (repetitionLine) {
        const prizeTiersForType = {
            megasena: [4, 5, 6],
            quina: [2, 3, 4, 5],
            lotofacil: [11, 12, 13, 14, 15]
        };
        const relevantTiers = prizeTiersForType[gameType] || [];
        const groupSizeToName = {
            2: 'duques', 3: 'ternos', 4: 'quadras', 5: 'quinas', 6: 'senas',
            11: 'onzes', 12: 'dozes', 13: 'trezes', 14: 'quatorzes', 15: 'quinzes'
        };

        let newRepetitionHTML = '';
        if (itemData.repetitionCounts && Object.keys(itemData.repetitionCounts).length > 0) {
            const parts = Object.entries(itemData.repetitionCounts)
                .filter(([size]) => relevantTiers.includes(parseInt(size)))
                .map(([size, count]) => `${count.toLocaleString('pt-BR')} ${groupSizeToName[size] || `grupos de ${size}`}`)
                .join(', ');
            if (parts) {
                newRepetitionHTML = `<i class="fas fa-clone detail-icon"></i> <b>Repetidos:</b> ${parts}`;
            }
        }
        repetitionLine.innerHTML = newRepetitionHTML;
        repetitionLine.style.display = newRepetitionHTML ? 'block' : 'none';
    }
}

/**
 * Filtra a lista de jogos gerenciados para mostrar apenas aqueles compatíveis com o tipo de jogo selecionado.
 * Também atualiza o conteúdo dos itens visíveis.
 * @param {string} gameType - O tipo de jogo selecionado.
 */
function filterAndRefreshManagedGamesList(gameType) {
    const gameTypeLabels = {
        megasena: 'MegaSena',
        quina: 'Quina',
        lotofacil: 'Lotofácil'
    };
    const requiredLabel = gameTypeLabels[gameType];

    document.querySelectorAll('.file-item-analise-wrapper').forEach(wrapper => {
        const gameTypes = wrapper.dataset.gameTypes || '';
        if (gameTypes.includes(requiredLabel)) {
            wrapper.style.display = 'block';
            updateManagedGameItemContent(wrapper, gameType); // Atualiza o conteúdo dos itens visíveis
        } else {
            wrapper.style.display = 'none';
        }
    });
}

/**
 * Adiciona um novo jogo (de arquivo ou gerado) à lista unificada de jogos.
 * A função valida o jogo, adiciona-o ao estado global e renderiza-o nas UIs das abas 'Geração' e 'Análise'.
 * @param {File|object} source - O objeto File do Excel ou um objeto com dados de um jogo gerado.
 */
export async function addManagedGame(source) {
    const genListContainer = document.getElementById('generation-file-list');
    const fileListContainer = document.getElementById('analise-file-list');
    if (!genListContainer || !fileListContainer) return;

    if (Object.keys(window.managedGames).length >= 20) {
        showNotification('status-geracao', 'Você pode adicionar no máximo 20 arquivos.', 'warning');
        return;
    }

    try {
        const currentGameType = document.getElementById('gameTypeGlobal').value;
        const gameId = `game_${window.managedGameCounter++}`;
        let itemData;

        if (source instanceof File) {
            const fileInfo = await validateAndGetFileInfo(source);
            
            const gameTypeRules = { megasena: { label: 'MegaSena' }, quina: { label: 'Quina' }, lotofacil: { label: 'Lotofácil' } };
            const currentGameLabel = gameTypeRules[currentGameType]?.label;

            if (fileInfo.inferredTypes.length > 0 && !fileInfo.inferredTypes.includes(currentGameLabel)) {
                const statusId = document.querySelector('.tab-content.active').id === 'geracao' ? 'status-geracao' : 'status-analise';
                showNotification(statusId, `Aviso: O arquivo "${source.name}" parece ser do tipo "${fileInfo.inferredTypes.join(' / ')}", diferente do selecionado.`, 'warning');
            }

            const repetitionGroupSizes = [2, 3, 4, 5, 6, 11, 12, 13, 14, 15];
            const repetitionCounts = calculateInternalRepetitions(fileInfo.games, repetitionGroupSizes);

            itemData = { id: gameId, type: 'external', name: source.name, file: source, games: fileInfo.games, uniqueBalls: fileInfo.uniqueBalls, inferredTypes: fileInfo.inferredTypes, repetitionCounts: repetitionCounts };
        } else { // É um jogo gerado
            const uniqueBalls = Array.from(source.allGames.reduce((acc, game) => { game.forEach(ball => acc.add(ball)); return acc; }, new Set())).sort((a, b) => a - b);
            const repetitionGroupSizes = [2, 3, 4, 5, 6, 11, 12, 13, 14, 15];
            const repetitionCounts = calculateInternalRepetitions(source.allGames, repetitionGroupSizes);
            const gameTypeRules = { megasena: { label: 'MegaSena' }, quina: { label: 'Quina' }, lotofacil: { label: 'Lotofácil' } };
            const inferredTypes = [gameTypeRules[currentGameType]?.label || 'Desconhecido'];

            // Coletar informações de cotas se estiverem ativas
            let quotaInfo = null;
            
            // Primeiro, verificar se já existe informação de cotas no reportData
            if (source.reportData && source.reportData.cotas && source.reportData.cotas.ativo) {
                quotaInfo = {
                    ativo: source.reportData.cotas.ativo,
                    quantidadeCotas: source.reportData.cotas.quantidadeCotas,
                    cotasCompradas: source.reportData.cotas.cotasCompradas,
                    pago35Caixa: source.reportData.cotas.pago35Caixa,
                    custoTotalCotas: source.reportData.cotas.custoTotalCotas
                };
            } else {
                // Fallback: coletar das informações da interface (caso não esteja no reportData)
                const calcularCotasCheckbox = document.getElementById('calcularCotas');
                if (calcularCotasCheckbox && calcularCotasCheckbox.checked) {
                    const quantidadeCotas = parseInt(document.getElementById('quantidadeCotas').value) || 1;
                    const cotasCompradas = parseInt(document.getElementById('cotasCompradas').value) || 1;
                    const pago35Caixa = document.getElementById('pago35Caixa').checked;
                    
                    // Usar o custo total do reportData se disponível
                    const custoTotalCotas = source.reportData?.custoTotal || 0;
                    
                    quotaInfo = {
                        ativo: true,
                        quantidadeCotas: quantidadeCotas,
                        cotasCompradas: cotasCompradas,
                        pago35Caixa: pago35Caixa,
                        custoTotalCotas: custoTotalCotas
                    };
                }
            }

            itemData = { ...source, id: gameId, type: 'generated', games: source.allGames, uniqueBalls: uniqueBalls, inferredTypes: inferredTypes, repetitionCounts: repetitionCounts, quotaInfo: quotaInfo };
        }

        window.managedGames[gameId] = itemData;

        // Antes de adicionar, remove a mensagem de "estado vazio" se existir
        checkAndSetEmptyState();

        // Renderiza o item em ambas as listas
        const genItem = createManagedGameItem(itemData, 'generation');
        const analysisItem = createManagedGameItem(itemData, 'analysis');

        genListContainer.appendChild(genItem);
        fileListContainer.appendChild(analysisItem);

        // Aplica o filtro e atualiza o conteúdo dos itens recém-criados
        filterAndRefreshManagedGamesList(currentGameType);

        // Atualiza o estado dos checkboxes de jogos externos
        updateExternalGamesCheckboxes();

    } catch (error) {
        const statusId = document.querySelector('.tab-content.active').id === 'geracao' ? 'status-geracao' : 'status-analise';
        showNotification(statusId, `Erro ao adicionar jogo: ${error.message}`, 'error');
    }
}

/**
 * Cria o conteúdo HTML para um item de jogo gerenciado.
 * @param {object} itemData - Os dados do jogo.
 * @param {string} context - O contexto de renderização ('generation' ou 'analysis').
 * @returns {string} A string HTML para o item.
 * @private
 */
function _createManagedGameItemHTML(itemData, context) {
    const isExternal = itemData.type === 'external';
    const isGenerated = itemData.type === 'generated';
    const iconClass = isExternal ? 'fa-file-excel' : 'fa-magic';

    const ballInfoString = `<div class="detail-line"><i class="fas fa-globe detail-icon"></i> <b>Bolas (${itemData.uniqueBalls.length}):</b> ${itemData.uniqueBalls.join(', ')}</div>`;

    // Informações das cotas
    let cotasInfoString = '';
    if (itemData.quotaInfo && itemData.quotaInfo.ativo) {
        // Custo total real dos jogos (sem divisão por cotas)
        const custoTotalReal = itemData.reportData?.custoTotal || itemData.quotaInfo.custoTotalCotas;
        
        // Valor de cada cota individual
        const valorPorCota = custoTotalReal / itemData.quotaInfo.quantidadeCotas;
        
        // Valor que o usuário deve pagar pelas suas cotas
        const valorTotalUsuario = valorPorCota * itemData.quotaInfo.cotasCompradas;
        
        // Valor pago (135% se a opção estiver marcada, senão 100% do valor das cotas)
        const valorPago = itemData.quotaInfo.pago35Caixa ? 
            valorTotalUsuario * 1.35 : 
            valorTotalUsuario;
        
        cotasInfoString = `
            <div class="detail-line" style="background-color: rgba(74, 144, 226, 0.1); padding: 0.5rem; border-radius: 4px; margin: 0.5rem 0;">
                <i class="fas fa-calculator detail-icon" style="color: #4a90e2;"></i> 
                <b>Cotas:</b> ${itemData.quotaInfo.quantidadeCotas}x com ${itemData.quotaInfo.cotasCompradas} comprada(s)
                <br><span style="margin-left: 1.2rem; font-size: 0.9em;">
                    Custo Total: ${formatCurrency(custoTotalReal)} | 
                    Valor Pago: ${formatCurrency(valorPago)}
                    ${itemData.quotaInfo.pago35Caixa ? ' (35% antecipado)' : ''}
                </span>
            </div>`;
    }

    const reportButtonHTML = (context === 'generation' && isGenerated)
        ? `<button class="btn btn-secondary btn-show-report" title="Visualizar Relatório de Geração" style="margin-right: 0.5rem; padding: 0.4rem 0.8rem; font-size: 0.8rem;">
               <i class="fas fa-chart-bar"></i> Visualizar Relatório de Geração
           </button>`
        : '';

    const deleteButtonHTML = `<button class="btn btn-danger delete-btn" title="Excluir" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
        <i class="fas fa-trash"></i> Excluir
    </button>`;

    const addBallsButtonHTML = (context === 'analysis')
        ? `<button class="btn btn-ghost btn-add-balls" data-file-id="${itemData.id}" style="margin-top: 0.5rem; width: 100%; font-size: 0.75rem; padding: 0.5rem;">
               <i class="fas fa-plus-circle"></i> Adicionar bolas deste jogo à seleção
           </button>`
        : '';

    return `
        <div class="file-item-analise">
            <input type="checkbox" checked title="Incluir este jogo na análise/aproveitamento">
            <i class="fas ${iconClass}" style="margin-right: 8px; color: var(--primary-color);"></i>
            <span class="file-name">${itemData.name}</span>
            <div class="action-buttons" style="margin-left: auto; display: flex; gap: 0.5rem;">
                ${reportButtonHTML}
                ${deleteButtonHTML}
            </div>
        </div>
        <div class="file-item-details-frame">
            <div class="detail-line game-types"></div>
            <div class="detail-line repetitions" style="display: none;"></div>
            ${ballInfoString}
            ${cotasInfoString}
        </div>
        ${addBallsButtonHTML}
    `;
}

/**
 * Anexa os event listeners a um elemento de item de jogo gerenciado.
 * @param {HTMLElement} itemWrapper - O elemento wrapper do item.
 * @param {object} itemData - Os dados do jogo.
 * @param {string} context - O contexto de renderização.
 * @private
 */
function _attachManagedGameItemListeners(itemWrapper, itemData, context) {
    const deleteBtn = itemWrapper.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const event = new CustomEvent('deleteManagedGame', { detail: { id: itemData.id } });
            document.dispatchEvent(event);
        });
    }

    // Adicionar listener para o checkbox de seleção
    const checkbox = itemWrapper.querySelector('input[type="checkbox"]');
    if (checkbox && context === 'generation') {
        checkbox.addEventListener('change', () => {
            updateExternalGamesCheckboxes();
        });
    }

    if (context === 'generation' && itemData.type === 'generated') {
        const reportButton = itemWrapper.querySelector('.btn-show-report');
        if (reportButton) {
            reportButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const storedData = window.managedGames[itemData.id];
                if (storedData && storedData.reportData) {
                    window.currentGeneratedGames = storedData.allGames;
                    showGenerationReport(storedData.reportData, storedData.workbook, storedData.filename);
                }
            });
        }
    }

    if (context === 'analysis') {
        const addBallsButton = itemWrapper.querySelector('.btn-add-balls');
        if (addBallsButton) {
            addBallsButton.addEventListener('click', () => {
                const ballsToAdd = window.managedGames[itemData.id]?.uniqueBalls;
                if (ballsToAdd) {
                    document.querySelectorAll('#simulation-ball-panel .ball').forEach(ballEl => {
                        const ballNum = parseInt(ballEl.dataset.number, 10);
                        if (ballsToAdd.includes(ballNum)) {
                            ballEl.classList.add('active');
                        }
                    });
                    updateSimulationBallPanelStats();
                    const useOnlyTestGamesCheckbox = document.getElementById('useOnlyBallsFromTestGames');
                    if (useOnlyTestGamesCheckbox) useOnlyTestGamesCheckbox.checked = false;
                }
            });
        }
    }
}

/**
 * Cria o elemento HTML para um item da lista de jogos gerenciados.
 * A aparência do item pode variar dependendo do contexto (aba 'Geração' ou 'Análise').
 * @param {object} itemData - Os dados do jogo (arquivo ou gerado).
 * @param {string} context - O contexto de renderização ('generation' ou 'analysis').
 * @returns {HTMLElement} O elemento wrapper do item da lista.
 */

function createManagedGameItem(itemData, context) {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'file-item-analise-wrapper';
    itemWrapper.dataset.itemId = itemData.id;
    itemWrapper.dataset.gameTypes = itemData.inferredTypes.join(',');
    
    itemWrapper.innerHTML = _createManagedGameItemHTML(itemData, context);
    _attachManagedGameItemListeners(itemWrapper, itemData, context);

    return itemWrapper;
}

/**
 * Exibe o relatório de geração em um modal.
 * @param {object} reportData - Os dados para popular o relatório.
 * @param {object} workbook - O workbook do Excel gerado.
 * @param {string} filename - O nome do arquivo Excel.
 */
function showGenerationReport(reportData, workbook, filename) {
    // Armazena os dados para re-ordenar
    window.currentReportData = reportData;
    const modal = document.getElementById('generation-report-modal');
    const statsContainer = document.getElementById('report-stats');
    const frequencyContainer = document.getElementById('report-frequency');
    const saveExcelButton = document.getElementById('save-games-excel');
    const printButton = document.getElementById('print-report-pdf');
    const printWithGamesButton = document.getElementById('print-report-with-games-pdf');

    if (!modal || !statsContainer || !frequencyContainer) {
        console.error("Elementos do modal de relatório não encontrados.");
        return;
    }

    // Popula as estatísticas
    let statsHTML = `<div><span>Jogos Solicitados</span><b>${reportData.jogosSolicitados.toLocaleString('pt-BR')}</b></div>`;

    if (reportData.jogosAproveitados > 0) {
        statsHTML += `
            <div><span>Jogos Aproveitados</span><b>${reportData.jogosAproveitados.toLocaleString('pt-BR')}</b></div>
            <div><span>Novos Jogos Gerados</span><b>${reportData.jogosNovos.toLocaleString('pt-BR')}</b></div>
            <div><span>Total de Jogos</span><b>${reportData.jogosGerados.toLocaleString('pt-BR')}</b></div>
            <div><span>Descartados (Aproveitados)</span><b class="text-warning">${reportData.jogosAproveitadosDescartados.toLocaleString('pt-BR')}</b></div>
            <div><span>Descartados (Novos)</span><b class="text-warning">${reportData.jogosNovosDescartados.toLocaleString('pt-BR')}</b></div>
            <div><span>Custo (Aproveitados)</span><b>${reportData.custoJogosAproveitados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
            <div><span>Custo (Novos)</span><b>${reportData.custoJogosNovos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
            <div><span>Custo Total</span><b>${reportData.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
        `;
    } else {
        statsHTML += `
            <div><span>Total de Jogos Gerados</span><b>${reportData.jogosGerados.toLocaleString('pt-BR')}</b></div>
            <div><span>Jogos Descartados</span><b class="text-warning">${reportData.jogosDescartados.toLocaleString('pt-BR')}</b></div>
            <div><span>Custo Total Estimado</span><b>${reportData.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
        `;
    }

    statsHTML += `
        <div><span>Jogos simples de ${reportData.parametros.dezenasSimples} dezenas</span><b>${reportData.jogosEquivalentes.toLocaleString('pt-BR')}</b></div>
        <div><span>Tempo de Geração</span><b>${reportData.tempoGeracao} s</b></div>
    `;
    statsContainer.innerHTML = statsHTML;

    // Popula os parâmetros
    const paramsContainer = document.getElementById('report-params-content');
    const params = reportData.parametros;
    paramsContainer.innerHTML = `
        <div>Universo: <b>${params.universo} bolas</b></div>
        <div>Algoritmo: <b>${params.algoritmo}</b></div>
        ${params.algoritmo === 'Aleatório' ? `
            <div>Timeout: <b>${params.timeout}s</b></div>
            <div>Peso Favoritas: <b>${params.usouPeso ? `${params.peso}x` : 'Não'}</b></div>
        ` : ''}
        <div>Aproveitou Jogos: <b>${params.aproveitouJogos ? 'Sim' : 'Não'}</b></div>
        ${params.interrompido ? `<div>Status: <b style="color: var(--danger-color);">Interrompido pelo usuário</b></div>` : ''}
    `;

    // Popula as informações de cotas se estiver ativo
    const cotasSection = document.getElementById('report-cotas-section');
    const cotasContainer = document.getElementById('report-cotas-content');
    if (reportData.cotas && reportData.cotas.ativo) {
        cotasContainer.innerHTML = `
            <div>Quantidade de Cotas: <b>${reportData.cotas.quantidadeCotas}</b></div>
            <div>Cotas Compradas: <b>${reportData.cotas.cotasCompradas}</b></div>
            <div>Custo das Cotas Compradas: <b>${reportData.cotas.custoTotalCotas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
            <div>Taxa de 35% Aplicada: <b>${reportData.cotas.pago35Caixa ? 'Sim' : 'Não'}</b></div>
        `;
        cotasSection.style.display = 'block';
    } else {
        cotasSection.style.display = 'none';
    }

    // Detalhes dos Jogos Aproveitados
    const aproveitadosContainer = document.getElementById('report-aproveitados-details');
    if (params.aproveitouJogos) {
        let aproveitadosHTML = `<h4><i class="fas fa-recycle"></i> Jogos Aproveitados</h4>`;
        aproveitadosHTML += `<p>Foram aproveitados <b>${reportData.jogosAproveitados}</b> jogos de <b>${params.totalJogosNoArquivo}</b> totais do arquivo "<b>${params.nomeArquivoAproveitado}</b>".</p>`;
        const dezenasAproveitadas = params.jogosAproveitadosInfo.dezenas;
        if (dezenasAproveitadas.length > 0) {
            const dezenasSelecaoUsuarioSet = new Set(params.selecaoUsuario.dezenas);
            const dezenasHTML = dezenasAproveitadas.map(b => {
                let ballClass = 'ball';
                if (dezenasSelecaoUsuarioSet.has(b)) {
                    ballClass += ' active'; // Bola do arquivo também está na seleção do usuário
                } else {
                    ballClass += ' inactive-red'; // Bola do arquivo NÃO está na seleção do usuário
                }
                return `<div class="${ballClass}">${String(b).padStart(2, '0')}</div>`;
            }).join('');
            aproveitadosHTML += `<p>Bolas contidas nestes jogos (${dezenasAproveitadas.length}). Em vermelho, as que não estavam na sua seleção:</p><div class="ball-display-panel">${dezenasHTML}</div>`;
        }
        aproveitadosContainer.innerHTML = aproveitadosHTML;
        aproveitadosContainer.style.display = 'block';
    } else {
        aproveitadosContainer.style.display = 'none';
    }

    // Detalhes da Geração de Novos Jogos
    const novosJogosContainer = document.getElementById('report-new-games-details');
    let novosJogosHTML = `<h4><i class="fas fa-magic"></i> Geração de Novos Jogos (${reportData.jogosNovos})</h4>`;
    const universo = params.universoNovosJogos;
    const tipoUniverso = universo.tipo === 'selecao_usuario' ? 'a Seleção do Usuário' : 'as bolas dos jogos aproveitados';
    novosJogosHTML += `<p>O universo de bolas utilizado para gerar os novos jogos foi <b>${tipoUniverso}</b>.</p>`;
    
    const dezenasAproveitadasSet = new Set(params.jogosAproveitadosInfo.dezenas);
    const dezenasFavoritasSet = new Set(params.favoritas);

    const universoHTML = universo.dezenas.map(b => {
        let ballClass = 'ball active';
        if (params.aproveitouJogos && dezenasAproveitadasSet.has(b)) {
            ballClass += ' new-from-aproveitado'; // Verde para bolas que também estavam nos aproveitados
        }
        if (universo.tipo === 'selecao_usuario' && dezenasFavoritasSet.has(b)) {
            ballClass += ' favorite';
        }
        return `<div class="${ballClass}">${String(b).padStart(2, '0')}</div>`;
    }).join('');

    let subtitle = `Bolas utilizadas (${universo.dezenas.length})`;
    const legendItems = [];
    if (params.aproveitouJogos && universo.dezenas.some(d => dezenasAproveitadasSet.has(d))) {
        legendItems.push('em verde as que também estavam nos jogos aproveitados');
    }
    if (universo.tipo === 'selecao_usuario' && params.favoritas.length > 0) { // Replaced <i> tag with Unicode star
        legendItems.push(`com ★ as favoritas`);
    }
    novosJogosHTML += `<p>${subtitle}${legendItems.length > 0 ? ` (${legendItems.join('; ')}):` : ':'}</p><div class="ball-display-panel">${universoHTML}</div>`;
    novosJogosContainer.innerHTML = novosJogosHTML;

    // Lógica de ordenação e renderização da frequência
    const renderFrequency = (sortBy = 'freq') => {
        const sortedData = [...reportData.frequenciaBolas];
        if (sortBy === 'freq') {
            sortedData.sort((a, b) => b.abs - a.abs || a.bola - b.bola);
        } else { // 'num'
            sortedData.sort((a, b) => a.bola - b.bola);
        }

        frequencyContainer.innerHTML = '';
        sortedData.forEach(item => {
            const ballClass = item.abs > 0 ? 'ball active' : 'ball inactive';
            const ballContainer = document.createElement('div');
            ballContainer.className = 'freq-ball';
            ballContainer.innerHTML = `
                <div class="${ballClass}">${String(item.bola).padStart(2, '0')}</div>
                <div class="freq-abs"><b>${item.abs.toLocaleString('pt-BR')}</b></div>
                <div class="freq-rel">${item.rel.toFixed(2).replace('.', ',')}%</div>
            `;
            frequencyContainer.appendChild(ballContainer);
        });
    };

    // Listeners dos botões de ordenação
    document.getElementById('sort-by-freq').onclick = () => { renderFrequency('freq'); document.getElementById('sort-by-freq').classList.add('active'); document.getElementById('sort-by-num').classList.remove('active'); };
    document.getElementById('sort-by-num').onclick = () => { renderFrequency('num'); document.getElementById('sort-by-num').classList.add('active'); document.getElementById('sort-by-freq').classList.remove('active'); };

    // Renderização inicial
    renderFrequency('freq');

    // Função de salvar em Excel
    if (saveExcelButton && workbook && filename) {
        saveExcelButton.onclick = () => {
            XLSX.writeFile(workbook, filename);
        };
    }

    // Função de impressão
    printButton.onclick = () => {
        generateReportPDF(reportData);
    };

    // Função de impressão com jogos
    if (printWithGamesButton) {
        printWithGamesButton.onclick = () => {
            generateReportWithGamesPDF(reportData, window.currentGeneratedGames);
        };
    }

    modal.style.display = 'flex';
}

/**
 * Exibe uma notificação de status com animação e estilo apropriado.
 * @function showNotification
 * @param {string} elementId - ID do elemento que receberá a notificação
 * @param {string} message - Mensagem a ser exibida
 * @param {string} [type='info'] - Tipo da notificação (info, error, warning, success)
 * @returns {void}
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
 * Exibe um skeleton loader em um elemento específico.
 * @function showSkeletonLoader
 * @param {string} elementId - ID do elemento onde exibir o skeleton
 * @param {string} [type='card'] - Tipo do skeleton (card, text, button, ball)
 * @param {number} [count=1] - Quantidade de elementos skeleton
 * @returns {void}
 */
function showSkeletonLoader(elementId, type = 'card', count = 1) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let skeletonHTML = '';
    
    for (let i = 0; i < count; i++) {
        switch (type) {
            case 'text':
                skeletonHTML += `
                    <div class="skeleton skeleton-text short"></div>
                    <div class="skeleton skeleton-text medium"></div>
                    <div class="skeleton skeleton-text long"></div>
                `;
                break;
            case 'button':
                skeletonHTML += `<div class="skeleton skeleton-button"></div>`;
                break;
            case 'ball':
                skeletonHTML += `<div class="skeleton skeleton-ball"></div>`;
                break;
            case 'card':
            default:
                skeletonHTML += `<div class="skeleton skeleton-card"></div>`;
                break;
        }
    }
    
    element.innerHTML = skeletonHTML;
    element.style.display = 'block';
}

/**
 * Remove o skeleton loader e restaura o conteúdo original.
 * @function hideSkeletonLoader
 * @param {string} elementId - ID do elemento
 * @returns {void}
 */
function hideSkeletonLoader(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
        element.style.display = 'none';
    }
}

/**
 * Define o estado de loading de um botão.
 * @function setButtonLoading
 * @param {string} buttonId - ID do botão
 * @param {boolean} isLoading - Se deve exibir estado de loading
 * @param {string} [loadingText='Carregando...'] - Texto a exibir durante loading
 * @returns {void}
 */
function setButtonLoading(buttonId, isLoading, loadingText = 'Carregando...') {
    const button = document.getElementById(buttonId);
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

/**
 * Exibe um indicador de progresso avançado.
 * @function showEnhancedProgress
 * @param {string} containerId - ID do container
 * @param {number} progress - Progresso de 0 a 100
 * @param {string} [message=''] - Mensagem de status
 * @returns {void}
 */
function showEnhancedProgress(containerId, progress, message = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const progressHTML = `
        <div class="loader-enhanced">
            <div class="spinner"></div>
            <div>
                <div style="font-weight: 500; margin-bottom: 0.5rem;">${message}</div>
                <div class="progress-enhanced">
                    <div class="progress-bar" style="width: ${progress}%"></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                    ${progress}% concluído
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = progressHTML;
    container.style.display = 'block';
}

/**
 * Exibe um loader com dots animados.
 * @function showDotsLoader
 * @param {string} elementId - ID do elemento
 * @param {string} [message='Processando'] - Mensagem a exibir
 * @returns {void}
 */
function showDotsLoader(elementId, message = 'Processando') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const loaderHTML = `
        <div class="loader-enhanced">
            <div class="dots-loader">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
            <span>${message}</span>
        </div>
    `;
    
    element.innerHTML = loaderHTML;
    element.style.display = 'block';
}

/**
 * Exibe uma notificação de status aprimorada.
 * @function showEnhancedNotification
 * @param {string} elementId - ID do elemento
 * @param {string} message - Mensagem
 * @param {string} [type='info'] - Tipo (info, success, warning, error)
 * @param {number} [duration=0] - Duração em ms (0 = não remove automaticamente)
 * @returns {void}
 */
function showEnhancedNotification(elementId, message, type = 'info', duration = 0) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const icons = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        error: 'fas fa-times-circle'
    };

    const notificationHTML = `
        <div class="status-message-enhanced ${type}">
            <i class="${icons[type]}"></i>
            <span>${message}</span>
        </div>
    `;
    
    element.innerHTML = notificationHTML;
    element.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }
}

// === Breadcrumbs System ===
class BreadcrumbManager {
    constructor() {
        this.breadcrumbs = [];
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.updateBreadcrumb(this.currentSection);
        this.updateCurrentContext(this.currentSection);
    }

    updateBreadcrumb(section) {
        const breadcrumbContainer = document.querySelector('.breadcrumb');
        if (!breadcrumbContainer) return;

        this.currentSection = section;
        const breadcrumbMap = {
            'dashboard': ['Dashboard'],
            'generator': ['Dashboard', 'Gerador de Jogos'],
            'analyzer': ['Dashboard', 'Análise de Jogos'],
            'statistics': ['Dashboard', 'Estatísticas'],
            'history': ['Dashboard', 'Histórico'],
            'settings': ['Dashboard', 'Configurações']
        };

        const items = breadcrumbMap[section] || ['Dashboard'];
        
        breadcrumbContainer.innerHTML = items.map((item, index) => {
            const isLast = index === items.length - 1;
            const itemClass = isLast ? 'breadcrumb-item active' : 'breadcrumb-item';
            const onClick = isLast ? '' : `onclick="window.breadcrumbManager.navigateToSection('${this.getSectionFromName(item)}')"`;
            
            return `
                <span class="${itemClass}" ${onClick}>
                    <i class="${this.getIconForSection(item)}"></i>
                    ${item}
                </span>
                ${!isLast ? '<i class="fas fa-chevron-right breadcrumb-separator"></i>' : ''}
            `;
        }).join('');

        this.updateCurrentContext(section);
    }

    getSectionFromName(name) {
        const nameMap = {
            'Dashboard': 'dashboard',
            'Gerador de Jogos': 'generator',
            'Análise de Jogos': 'analyzer',
            'Estatísticas': 'statistics',
            'Histórico': 'history',
            'Configurações': 'settings'
        };
        return nameMap[name] || 'dashboard';
    }

    getIconForSection(name) {
        const iconMap = {
            'Dashboard': 'fas fa-home',
            'Gerador de Jogos': 'fas fa-dice',
            'Análise de Jogos': 'fas fa-chart-line',
            'Estatísticas': 'fas fa-chart-bar',
            'Histórico': 'fas fa-history',
            'Configurações': 'fas fa-cog'
        };
        return iconMap[name] || 'fas fa-home';
    }

    updateCurrentContext(section) {
        const contextElement = document.querySelector('.current-context');
        if (!contextElement) return;

        const contextMap = {
            'dashboard': 'Visão Geral',
            'generator': 'Gerando Jogos',
            'analyzer': 'Analisando Resultados',
            'statistics': 'Visualizando Dados',
            'history': 'Navegando Histórico',
            'settings': 'Configurações do Sistema'
        };

        const contextText = contextMap[section] || 'Navegando';
        contextElement.innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>${contextText}</span>
        `;
    }

    navigateToSection(section) {
        // Ativar a aba correspondente
        const tabButton = document.querySelector(`[data-tab="${section}"]`);
        if (tabButton) {
            tabButton.click();
        }
        
        this.updateBreadcrumb(section);
    }
}

// === Wizard System for New Users ===
class WizardSystem {
    constructor() {
        this.currentStep = 0;
        this.steps = [
            {
                title: 'Bem-vindo ao LotoPro!',
                content: 'Vamos configurar sua experiência personalizada.',
                target: '.sidebar',
                position: 'right'
            },
            {
                title: 'Gerador de Jogos',
                content: 'Aqui você pode gerar jogos inteligentes baseados em análises.',
                target: '[data-tab="generator"]',
                position: 'bottom'
            },
            {
                title: 'Análise de Jogos',
                content: 'Analise seus jogos e veja estatísticas detalhadas.',
                target: '[data-tab="analyzer"]',
                position: 'bottom'
            },
            {
                title: 'Configurações',
                content: 'Personalize suas preferências e estratégias.',
                target: '[data-tab="settings"]',
                position: 'bottom'
            }
        ];
        this.isActive = false;
    }

    start() {
        if (this.hasSeenWizard()) return;
        
        this.isActive = true;
        this.currentStep = 0;
        this.createWizardOverlay();
        this.showStep(0);
    }

    hasSeenWizard() {
        return localStorage.getItem('lotopro_wizard_completed') === 'true';
    }

    createWizardOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'wizard-overlay';
        overlay.innerHTML = `
            <div class="wizard-tooltip">
                <div class="wizard-header">
                    <h3 class="wizard-title"></h3>
                    <button class="wizard-close" onclick="window.wizardSystem.close()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="wizard-content"></div>
                <div class="wizard-footer">
                    <button class="wizard-btn wizard-prev" onclick="window.wizardSystem.prevStep()">
                        <i class="fas fa-chevron-left"></i> Anterior
                    </button>
                    <div class="wizard-progress">
                        <span class="wizard-step-counter"></span>
                    </div>
                    <button class="wizard-btn wizard-next" onclick="window.wizardSystem.nextStep()">
                        Próximo <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) return;
        
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];
        const tooltip = document.querySelector('.wizard-tooltip');
        const overlay = document.querySelector('.wizard-overlay');
        
        if (!tooltip || !overlay) return;

        // Atualizar conteúdo
        tooltip.querySelector('.wizard-title').textContent = step.title;
        tooltip.querySelector('.wizard-content').textContent = step.content;
        tooltip.querySelector('.wizard-step-counter').textContent = `${stepIndex + 1} de ${this.steps.length}`;
        
        // Atualizar botões
        const prevBtn = tooltip.querySelector('.wizard-prev');
        const nextBtn = tooltip.querySelector('.wizard-next');
        
        prevBtn.style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
        nextBtn.textContent = stepIndex === this.steps.length - 1 ? 'Finalizar' : 'Próximo ';
        if (stepIndex < this.steps.length - 1) {
            nextBtn.innerHTML = 'Próximo <i class="fas fa-chevron-right"></i>';
        }

        // Posicionar tooltip
        this.positionTooltip(step.target, step.position);
        
        // Destacar elemento alvo
        this.highlightTarget(step.target);
    }

    positionTooltip(target, position) {
        const targetElement = document.querySelector(target);
        const tooltip = document.querySelector('.wizard-tooltip');
        
        if (!targetElement || !tooltip) return;

        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top, left;
        
        switch (position) {
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.right + 20;
                break;
            case 'bottom':
                top = targetRect.bottom + 20;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left - tooltipRect.width - 20;
                break;
            default: // top
                top = targetRect.top - tooltipRect.height - 20;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        }
        
        // Manter dentro da viewport
        top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));
        left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    highlightTarget(target) {
        // Remover highlight anterior
        document.querySelectorAll('.wizard-highlight').forEach(el => {
            el.classList.remove('wizard-highlight');
        });
        
        // Adicionar novo highlight
        const targetElement = document.querySelector(target);
        if (targetElement) {
            targetElement.classList.add('wizard-highlight');
        }
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.complete();
        }
    }

    prevStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    complete() {
        localStorage.setItem('lotopro_wizard_completed', 'true');
        this.close();
        showEnhancedNotification('Configuração concluída! Aproveite o LotoPro.', 'success');
    }

    close() {
        this.isActive = false;
        const overlay = document.querySelector('.wizard-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Remover highlights
        document.querySelectorAll('.wizard-highlight').forEach(el => {
            el.classList.remove('wizard-highlight');
        });
    }
}

// Instanciar os sistemas
const breadcrumbManager = new BreadcrumbManager();
const wizardSystem = new WizardSystem();

// Disponibilizar globalmente para uso em onclick
window.breadcrumbManager = breadcrumbManager;
window.wizardSystem = wizardSystem;

// === Collapsible Sections ===
function toggleCollapsible(header) {
    const content = header.nextElementSibling;
    const section = header.parentElement;
    const icon = header.querySelector('.collapsible-icon');
    
    // Toggle classes
    header.classList.toggle('active');
    content.classList.toggle('active');
    
    // Update max-height for smooth animation
    if (content.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + 'px';
        
        // Após expandir, aguardar a animação e atualizar estados
        setTimeout(() => {
            // Verificar se esta seção contém o aproveitamento de jogos
            const aproveitaCheckbox = content.querySelector('#aproveitaJogos');
            if (aproveitaCheckbox) {
                // Forçar atualização do estado das opções de aproveitamento
                updateGenerationInputsState();
            }
        }, 300); // Aguardar fim da animação CSS (300ms)
    } else {
        content.style.maxHeight = '0px';
    }
    
    // Save state to localStorage
    const sectionId = section.id || header.querySelector('.collapsible-title span').textContent;
    const isExpanded = content.classList.contains('active');
    localStorage.setItem(`collapsible_${sectionId}`, isExpanded);
}

// Initialize collapsible sections on load
function initializeCollapsibleSections() {
    document.querySelectorAll('.collapsible-section').forEach((section, index) => {
        const header = section.querySelector('.collapsible-header');
        const content = section.querySelector('.collapsible-content');
        const sectionId = section.id || header.querySelector('.collapsible-title span').textContent;
        
        // Check saved state
        const savedState = localStorage.getItem(`collapsible_${sectionId}`);
        const shouldExpand = savedState === 'true';
        
        if (shouldExpand) {
            header.classList.add('active');
            content.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            
            // Se esta seção contém o aproveitamento de jogos, atualizar estado
            const aproveitaCheckbox = content.querySelector('#aproveitaJogos');
            if (aproveitaCheckbox) {
                // Aguardar um pouco para garantir que todos os elementos estejam prontos
                setTimeout(() => {
                    updateGenerationInputsState();
                }, 100);
            }
        }
    });
}

// Make functions available globally
window.toggleCollapsible = toggleCollapsible;
window.showKeyboardShortcutsHelp = showKeyboardShortcutsHelp;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initializeCollapsibleSections();
    initializeKeyboardShortcuts();
});

// === Keyboard Shortcuts System ===
function initializeKeyboardShortcuts() {
    const shortcuts = {
        'ctrl+g': () => {
            const generateBtn = document.getElementById('btn-gerar-jogos');
            if (generateBtn && !generateBtn.disabled) {
                generateBtn.click();
                showEnhancedNotification('Gerando jogos via atalho Ctrl+G', 'info', 2000);
            }
        },
        'ctrl+a': (e) => {
            e.preventDefault();
            const analyzeBtn = document.getElementById('btn-executar-analise');
            if (analyzeBtn && !analyzeBtn.disabled) {
                analyzeBtn.click();
                showEnhancedNotification('Executando análise via atalho Ctrl+A', 'info', 2000);
            }
        },
        'ctrl+s': (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('btn-salvar-excel');
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
                showEnhancedNotification('Salvando Excel via atalho Ctrl+S', 'info', 2000);
            }
        },
        'ctrl+p': (e) => {
            e.preventDefault();
            const printBtn = document.getElementById('btn-gerar-pdf');
            if (printBtn && !printBtn.disabled) {
                printBtn.click();
                showEnhancedNotification('Gerando PDF via atalho Ctrl+P', 'info', 2000);
            }
        },
        'ctrl+h': (e) => {
            e.preventDefault();
            showKeyboardShortcutsHelp();
        },
        'ctrl+1': (e) => {
            e.preventDefault();
            switchToTab('generator');
        },
        'ctrl+2': (e) => {
            e.preventDefault();
            switchToTab('analyzer');
        },
        'ctrl+3': (e) => {
            e.preventDefault();
            switchToTab('statistics');
        },
        'ctrl+4': (e) => {
            e.preventDefault();
            switchToTab('history');
        },
        'ctrl+5': (e) => {
            e.preventDefault();
            switchToTab('settings');
        },
        'f1': (e) => {
            e.preventDefault();
            if (window.wizardSystem) {
                window.wizardSystem.start();
                showEnhancedNotification('Reiniciando wizard de configuração', 'info', 2000);
            }
        },
        'escape': () => {
            // Fechar modais ou overlays
            const wizard = document.querySelector('.wizard-overlay');
            if (wizard) {
                window.wizardSystem.close();
                return;
            }
            
            // Fechar menu mobile se estiver aberto
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.getElementById('mobile-overlay');
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
                const mobileToggle = document.getElementById('mobile-menu-toggle');
                if (mobileToggle) {
                    mobileToggle.querySelector('i').className = 'fas fa-bars';
                }
            }
        }
    };

    document.addEventListener('keydown', (e) => {
        const key = [];
        
        if (e.ctrlKey) key.push('ctrl');
        if (e.altKey) key.push('alt');
        if (e.shiftKey) key.push('shift');
        
        if (e.key === 'Escape') {
            key.push('escape');
        } else if (e.key === 'F1') {
            key.push('f1');
        } else if (e.key >= '1' && e.key <= '9') {
            key.push(e.key);
        } else if (e.key.length === 1) {
            key.push(e.key.toLowerCase());
        }
        
        const shortcut = key.join('+');
        
        if (shortcuts[shortcut]) {
            // Verificar se não estamos em um input/textarea
            const activeElement = document.activeElement;
            const isInputActive = activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true'
            );
            
            // Permitir alguns atalhos mesmo em inputs
            const allowedInInputs = ['escape', 'f1', 'ctrl+h'];
            
            if (!isInputActive || allowedInInputs.includes(shortcut)) {
                shortcuts[shortcut](e);
            }
        }
    });
}

function switchToTab(tabName) {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabButton) {
        tabButton.click();
        showEnhancedNotification(`Mudando para aba: ${getTabDisplayName(tabName)}`, 'info', 2000);
    }
}

function getTabDisplayName(tabName) {
    const names = {
        'generator': 'Gerador de Jogos',
        'analyzer': 'Análise de Jogos',
        'statistics': 'Estatísticas',
        'history': 'Histórico',
        'settings': 'Configurações'
    };
    return names[tabName] || tabName;
}

function showKeyboardShortcutsHelp() {
    const helpContent = `
        <div class="shortcuts-help">
            <h3><i class="fas fa-keyboard"></i> Atalhos de Teclado</h3>
            <div class="shortcuts-grid">
                <div class="shortcut-group">
                    <h4>Ações Principais</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl + G</kbd>
                        <span>Gerar Jogos</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + A</kbd>
                        <span>Executar Análise</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + S</kbd>
                        <span>Salvar Excel</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + P</kbd>
                        <span>Gerar PDF</span>
                    </div>
                </div>
                
                <div class="shortcut-group">
                    <h4>Navegação</h4>
                    <div class="shortcut-item">
                        <kbd>Ctrl + 1</kbd>
                        <span>Gerador</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + 2</kbd>
                        <span>Análise</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + 3</kbd>
                        <span>Estatísticas</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + 4</kbd>
                        <span>Histórico</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + 5</kbd>
                        <span>Configurações</span>
                    </div>
                </div>
                
                <div class="shortcut-group">
                    <h4>Utilitários</h4>
                    <div class="shortcut-item">
                        <kbd>F1</kbd>
                        <span>Reiniciar Wizard</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl + H</kbd>
                        <span>Ajuda de Atalhos</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Esc</kbd>
                        <span>Fechar Modais</span>
                    </div>
                </div>
            </div>
            <div class="shortcuts-footer">
                <p><i class="fas fa-info-circle"></i> Os atalhos ficam disponíveis quando não há campos de texto ativos.</p>
            </div>
        </div>
    `;
    
    // Criar modal personalizado para atalhos
    const modal = document.createElement('div');
    modal.className = 'shortcuts-modal';
    modal.innerHTML = `
        <div class="shortcuts-modal-content">
            ${helpContent}
            <button class="shortcuts-close-btn" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i> Fechar
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fechar com Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Fechar clicando fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

/**
 * Controla o estado dos checkboxes de jogos externos baseado na seleção de jogos
 * e na configuração principal de aproveitar jogos.
 */
export function updateExternalGamesCheckboxes() {
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    const checkboxes = [
        'forcarUniversoJogosAproveitados',
        'naoIncluirAproveitadosNoResultado', 
        'validarRepeticaoJogosAproveitados',
        'validarUniversoJogosAproveitados'
    ];

    // Verifica se há jogos selecionados na lista
    const selectedGames = document.querySelectorAll('#generation-file-list .file-item-analise input[type="checkbox"]:checked');
    const hasSelectedGames = selectedGames.length > 0;

    // Habilita/desabilita o checkbox principal baseado na seleção
    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.disabled = !hasSelectedGames;
        
        if (!hasSelectedGames) {
            aproveitaJogosCheckbox.checked = false;
        }
    }

    // Habilita/desabilita os outros checkboxes baseado no estado do principal
    const isMainChecked = aproveitaJogosCheckbox && aproveitaJogosCheckbox.checked;
    
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.disabled = !isMainChecked;
            if (!isMainChecked) {
                checkbox.checked = false;
            }
        }
    });
}

export { 
    initializeInterface, 
    handleGlobalGameTypeChange, 
    updateGenerationInputsState, 
    showGenerationReport, 
    showNotification, 
    createSimulationBallPanel, 
    updateSimulationBallPanelStats, 
    checkAndSetEmptyState,
    showSkeletonLoader,
    hideSkeletonLoader,
    setButtonLoading,
    showEnhancedProgress,
    showDotsLoader,
    showEnhancedNotification,
    breadcrumbManager,
    wizardSystem,
    toggleCollapsible,
    initializeKeyboardShortcuts
};