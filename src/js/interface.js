import { GAME_DEFAULTS } from './constants.js';
import { generateReportPDF, generateReportWithGamesPDF } from './reportPdf.js';
import { combinationsCount, calculateInternalRepetitions } from './utils.js';
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
    
    handleGlobalGameTypeChange();
}

/**
 * Configura event listeners para controles da aba de geração de jogos.
 * Monitora alterações em checkboxes e campos que afetam o estado da interface.
 * @function setupGenerationControls
 * @returns {void}
 */
function setupGenerationControls() {
    const combinatoriaAleatoriaCheckbox = document.getElementById('geracaoCombinatoriaAleatoria');
    const combinatoriaSequencialCheckbox = document.getElementById('geracaoCombinatoriaSequencial');
    const aleatoriaCheckbox = document.getElementById('geracaoAleatoria');
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    const usarPesoFavoritasCheckbox = document.getElementById('usarPesoFavoritas');
    const selectAllBtn = document.getElementById('btn-select-all-balls');
    const deselectAllBtn = document.getElementById('btn-deselect-all-balls');
    const randomSelector = document.getElementById('random-ball-selector');
    const convertToFavoriteBtn = document.getElementById('btn-convert-to-favorite');

    const generationCheckboxes = [combinatoriaAleatoriaCheckbox, combinatoriaSequencialCheckbox, aleatoriaCheckbox];

    generationCheckboxes.forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    // Uncheck others
                    generationCheckboxes.forEach(otherCheckbox => {
                        if (otherCheckbox && otherCheckbox !== checkbox) {
                            otherCheckbox.checked = false;
                        }
                    });
                }
                // Ensure at least one is checked. If user unchecks the last one, re-check it.
                if (!generationCheckboxes.some(cb => cb && cb.checked)) {
                    checkbox.checked = true;
                }
                updateGenerationInputsState();
            });
        }
    });

    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.addEventListener('change', updateGenerationInputsState);
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
    const combinatoriaAleatoriaCheckbox = document.getElementById('geracaoCombinatoriaAleatoria');
    const combinatoriaSequencialCheckbox = document.getElementById('geracaoCombinatoriaSequencial');

    if (!combinatoriaAleatoriaCheckbox || !combinatoriaSequencialCheckbox || isNaN(dezenasJogadas) || selectedBallsCount < dezenasJogadas) {
        if (combinatoriaAleatoriaCheckbox) combinatoriaAleatoriaCheckbox.disabled = true;
        if (combinatoriaSequencialCheckbox) combinatoriaSequencialCheckbox.disabled = true;
        return;
    }

    const totalCombinations = combinationsCount(selectedBallsCount, dezenasJogadas);
    
    const COMBINATION_MEMORY_LIMIT = 400000000; // Limite para "Aleatória"
    const COMBINATION_LIMIT = 1000000000;      // Limite para "Sequencial"

    // Lógica para Combinatória Aleatória
    if (totalCombinations > COMBINATION_MEMORY_LIMIT) {
        combinatoriaAleatoriaCheckbox.disabled = true;
        combinatoriaAleatoriaCheckbox.checked = false;
        combinatoriaAleatoriaCheckbox.parentElement.title = `Muitas combinações (${totalCombinations.toLocaleString('pt-BR')}) para este método. Use "Combinatória em Sequência" ou "Geração Aleatória".`;
    } else {
        combinatoriaAleatoriaCheckbox.disabled = false;
        combinatoriaAleatoriaCheckbox.parentElement.title = '';
    }

    // Lógica para Combinatória Sequencial
    if (totalCombinations > COMBINATION_LIMIT) {
        combinatoriaSequencialCheckbox.disabled = true;
        combinatoriaSequencialCheckbox.checked = false;
        combinatoriaSequencialCheckbox.parentElement.title = `Muitas combinações (${totalCombinations.toLocaleString('pt-BR')}). Use "Geração Aleatória".`;
    } else {
        combinatoriaSequencialCheckbox.disabled = false;
        combinatoriaSequencialCheckbox.parentElement.title = '';
    }

    // Garante que pelo menos uma opção de geração esteja marcada se as outras forem desabilitadas
    const generationCheckboxes = [combinatoriaAleatoriaCheckbox, combinatoriaSequencialCheckbox, document.getElementById('geracaoAleatoria')];
    if (!generationCheckboxes.some(cb => cb.checked)) {
        const firstEnabled = generationCheckboxes.find(cb => !cb.disabled);
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
            pdfMarginMm: '0',
            pdfStartXMm: '10,4',
            pdfFirstGameYFromTopMm: '66',
            pdfCellWidthMm: '6,34',
            pdfCellHeightMm: '3,28',
            pdfBorderWidthMm: '1,1',
            pdfBorderHeightMm: '0,6',
            pdfDistanceBetweenGamesMm: '6,7',
            pdfAfterGameOffsetMm: '9',
            pdfBolaoOffsetMm: '28,4',
            pdfPageNumberXOffsetMm: '25',
            pdfPageNumberYOffsetMm: '15,5',
            pdfGamesNumbersXOffsetMm: '15',
            pdfGamesNumbersYOffsetMm: '7',
            pdfGamesNumbersLineSpacingMm: '4'
        },
        megasena: {
            pdfPageWidthMm: '81',
            pdfPageHeightMm: '186',
            pdfMarginMm: '0',
            pdfStartXMm: '10,4',
            pdfFirstGameYFromTopMm: '66',
            pdfCellWidthMm: '6,34',
            pdfCellHeightMm: '3,28',
            pdfBorderWidthMm: '1,1',
            pdfBorderHeightMm: '0,6',
            pdfDistanceBetweenGamesMm: '6,7',
            pdfAfterGameOffsetMm: '9',
            pdfBolaoOffsetMm: '28,4',
            pdfPageNumberXOffsetMm: '25',
            pdfPageNumberYOffsetMm: '15,5',
            pdfGamesNumbersXOffsetMm: '15',
            pdfGamesNumbersYOffsetMm: '7',
            pdfGamesNumbersLineSpacingMm: '4'
        },
        lotofacil: {
            pdfPageWidthMm: '81',
            pdfPageHeightMm: '186',
            pdfMarginMm: '0',
            pdfStartXMm: '8',
            pdfFirstGameYFromTopMm: '45,6',
            pdfCellWidthMm: '12,45',
            pdfCellHeightMm: '4,6',
            pdfBorderWidthMm: '3,8',
            pdfBorderHeightMm: '0,8',
            pdfDistanceBetweenGamesMm: '2,7',
            pdfAfterGameOffsetMm: '3,3',
            pdfBolaoOffsetMm: '58,2',
            pdfPageNumberXOffsetMm: '15',
            pdfPageNumberYOffsetMm: '180',
            pdfGamesNumbersXOffsetMm: '0',
            pdfGamesNumbersYOffsetMm: '170',
            pdfGamesNumbersLineSpacingMm: '5'
        }
    };

    const d = defaults[gameType] || defaults['quina'];
    // Atualiza os campos de impressão
    document.getElementById('pdfPageWidthMm').value = d.pdfPageWidthMm;
    document.getElementById('pdfPageHeightMm').value = d.pdfPageHeightMm;
    document.getElementById('pdfMarginMm').value = d.pdfMarginMm;
    document.getElementById('pdfStartXMm').value = d.pdfStartXMm;
    document.getElementById('pdfFirstGameYFromTopMm').value = d.pdfFirstGameYFromTopMm;
    document.getElementById('pdfCellWidthMm').value = d.pdfCellWidthMm;
    document.getElementById('pdfCellHeightMm').value = d.pdfCellHeightMm;
    document.getElementById('pdfBorderWidthMm').value = d.pdfBorderWidthMm;
    document.getElementById('pdfBorderHeightMm').value = d.pdfBorderHeightMm;
    document.getElementById('pdfDistanceBetweenGamesMm').value = d.pdfDistanceBetweenGamesMm;
    document.getElementById('pdfAfterGameOffsetMm').value = d.pdfAfterGameOffsetMm;
    document.getElementById('pdfBolaoOffsetMm').value = d.pdfBolaoOffsetMm;
    document.getElementById('pdfPageNumberXOffsetMm').value = d.pdfPageNumberXOffsetMm;
    document.getElementById('pdfPageNumberYOffsetMm').value = d.pdfPageNumberYOffsetMm;
    document.getElementById('pdfGamesNumbersXOffsetMm').value = d.pdfGamesNumbersXOffsetMm;
    document.getElementById('pdfGamesNumbersYOffsetMm').value = d.pdfGamesNumbersYOffsetMm;
    document.getElementById('pdfGamesNumbersLineSpacingMm').value = d.pdfGamesNumbersLineSpacingMm;
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
    const aproveitarOptions = document.getElementById('aproveitar-options');

    if (!combinatoriaAleatoriaCheckbox || !combinatoriaSequencialCheckbox || !aleatoriaCheckbox || !aleatorioOptions || !aproveitaJogosCheckbox || !aproveitarOptions || !usarPesoFavoritasCheckbox || !pesoFavoritasOptions) {
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

    // Lógica para aproveitar jogos
    if (aproveitaJogosCheckbox.checked) {
        aproveitarOptions.style.display = 'block';
    } else {
        aproveitarOptions.style.display = 'none';
    }
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
        alert('Você pode adicionar no máximo 20 arquivos.');
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
                const confirmation = confirm(`Este jogo parece ser do tipo "${fileInfo.inferredTypes.join(' / ')}", que é diferente do tipo selecionado ("${currentGameLabel}"). Deseja adicioná-lo mesmo assim?`);
                if (!confirmation) {
                    return; // Para de adicionar o jogo
                }
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

            itemData = { ...source, id: gameId, type: 'generated', games: source.allGames, uniqueBalls: uniqueBalls, inferredTypes: inferredTypes, repetitionCounts: repetitionCounts };
        }

        window.managedGames[gameId] = itemData;

        // Renderiza o item em ambas as listas
        const genItem = createManagedGameItem(itemData, 'generation');
        const analysisItem = createManagedGameItem(itemData, 'analysis');

        genListContainer.appendChild(genItem);
        fileListContainer.appendChild(analysisItem);

        // Aplica o filtro e atualiza o conteúdo dos itens recém-criados
        filterAndRefreshManagedGamesList(currentGameType);

    } catch (error) {
        alert(`Erro ao adicionar jogo: ${error.message}`);
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

    const reportButtonHTML = (context === 'generation' && isGenerated)
        ? `<button class="btn-show-report" title="Exibir Relatório"><i class="fas fa-eye"></i></button>`
        : '';

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
            ${reportButtonHTML}
            <button class="delete-btn" title="Remover item"><i class="fas fa-times"></i></button>
        </div>
        <div class="file-item-details-frame">
            <div class="detail-line game-types"></div>
            <div class="detail-line repetitions" style="display: none;"></div>
            ${ballInfoString}
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
    itemWrapper.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const event = new CustomEvent('deleteManagedGame', { detail: { id: itemData.id } });
        document.dispatchEvent(event);
    });

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

export { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState, showGenerationReport, showNotification, createSimulationBallPanel, updateSimulationBallPanelStats };