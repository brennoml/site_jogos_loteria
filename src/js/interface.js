/**
 * Inicializa a interface do usuário.
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

    // Formatar inputs numéricos (sem separadores)
    document.querySelectorAll('.number').forEach(input => {
        new Cleave(input, {
            numeral: true,
            numeralDecimalScale: 0,
            numeralPositiveOnly: true,
            // No thousands separator for plain numbers
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

    // Inicializa com base no tipo de jogo global selecionado
    handleGlobalGameTypeChange();
}

/**
 * Define os valores padrão na aba de Geração com base no tipo de jogo.
 * @param {string} gameType - O tipo de jogo ('megasena', 'quina', 'lotofacil').
 */
function setGenerationDefaults(gameType) {
    const totalBolasInput = document.getElementById('totalBolas');
    const qtdBolasAleatoriasInput = document.getElementById('qtdBolasAleatorias');
    const dezenasJogadasInput = document.getElementById('dezenasJogadas');
    const acertosGarantidosInput = document.getElementById('acertosGarantidos');
    const bolasAleatoriasCheckbox = document.getElementById('bolasAleatorias');

    if (!totalBolasInput || !qtdBolasAleatoriasInput || !dezenasJogadasInput || !acertosGarantidosInput || !bolasAleatoriasCheckbox) {
        console.warn("Elementos da aba de geração não encontrados para definir padrões.");
        return;
    }

    if (gameType === 'megasena') {
        totalBolasInput.value = 60;
        dezenasJogadasInput.value = 6;
        acertosGarantidosInput.value = 4;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 60;
        }
    } else if (gameType === 'lotofacil') {
        totalBolasInput.value = 25;
        dezenasJogadasInput.value = 15;
        acertosGarantidosInput.value = 11;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 25;
        }
    } else { // Quina ou default
        totalBolasInput.value = 80;
        dezenasJogadasInput.value = 5;
        acertosGarantidosInput.value = 3;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 80;
        }
    }
    // Após definir os valores, é importante atualizar o estado dos inputs (disabled/enabled)
    updateGenerationInputsState();

    // --- NOVO: Atualiza os campos da aba de impressão de volantes conforme o tipo de jogo ---
    setPrintDefaults(gameType);
}

/**
 * Define os valores padrão dos campos de impressão de volantes conforme o tipo de jogo.
 * @param {string} gameType - O tipo de jogo ('megasena', 'quina', 'lotofacil').
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
 * Atualiza os inputs de prêmios visíveis na aba Análise.
 * @param {string} gameType - O tipo de jogo ('megasena' ou 'quina').
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
 * Lida com a mudança do tipo de jogo global, atualizando ambas as abas.
 */
function handleGlobalGameTypeChange() {
    const gameTypeSelect = document.getElementById('gameTypeGlobal');
    if (!gameTypeSelect) {
        console.warn('Seletor de tipo de jogo global não encontrado.');
        return;
    }
    const selectedGame = gameTypeSelect.value;

    updateAnalysisPrizeInputs(selectedGame);
    setGenerationDefaults(selectedGame);
}

/**
 * Atualiza o estado (habilitado/desabilitado) dos inputs na aba de Geração
 * com base nos checkboxes selecionados.
 */
function updateGenerationInputsState() {
    const bolasAleatoriasCheckbox = document.getElementById('bolasAleatorias');
    const dezenasSelecionadasInput = document.getElementById('dezenasSelecionadas');
    const qtdBolasAleatoriasInput = document.getElementById('qtdBolasAleatorias');
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    const jogosExistentesFileInput = document.getElementById('jogosExistentesFile');
    const forcarUniversoOriginalCheckbox = document.getElementById('forcarUniversoOriginalParaNovos');
    const maxTimeInput = document.getElementById('maxTime');
    const jogosSorteadosCheckbox = document.getElementById('jogosSorteados');

    // Pode ser que esses elementos não existam se a aba de Geração não estiver ativa/montada
    // Adicionar verificações para evitar erros no console se os elementos não forem encontrados
    if (!bolasAleatoriasCheckbox || !dezenasSelecionadasInput || !qtdBolasAleatoriasInput || 
        !aproveitaJogosCheckbox || !jogosExistentesFileInput || !forcarUniversoOriginalCheckbox || 
        !maxTimeInput || !jogosSorteadosCheckbox) {
        // console.warn("Um ou mais elementos da aba de geração não foram encontrados. Estado dos inputs não atualizado.");
        return;
    }

    if (bolasAleatoriasCheckbox.checked) {
        dezenasSelecionadasInput.disabled = true;
        dezenasSelecionadasInput.style.backgroundColor = '#e9ecef';
        dezenasSelecionadasInput.value = ''; // Limpa o campo
        qtdBolasAleatoriasInput.disabled = false;
        qtdBolasAleatoriasInput.style.backgroundColor = '';
    } else {
        dezenasSelecionadasInput.disabled = false;
        dezenasSelecionadasInput.style.backgroundColor = '';
        qtdBolasAleatoriasInput.disabled = true;
        qtdBolasAleatoriasInput.style.backgroundColor = '#e9ecef';
        // qtdBolasAleatoriasInput.value = ''; // Não limpar, pode ser útil manter para alternar
    }

    jogosExistentesFileInput.disabled = !aproveitaJogosCheckbox.checked;
    jogosExistentesFileInput.style.backgroundColor = aproveitaJogosCheckbox.checked ? '' : '#e9ecef';
    if (!aproveitaJogosCheckbox.checked) {
        jogosExistentesFileInput.value = ''; // Limpa o arquivo selecionado se desmarcado
        const fileNameDisplay = document.getElementById('jogosExistentesFileName');
        if(fileNameDisplay) fileNameDisplay.textContent = '';
    }

    forcarUniversoOriginalCheckbox.disabled = !aproveitaJogosCheckbox.checked;
    if (!aproveitaJogosCheckbox.checked) {
        forcarUniversoOriginalCheckbox.checked = false; // Desmarca se "Aproveitar Jogos" for desmarcado
    }

    
    maxTimeInput.disabled = !jogosSorteadosCheckbox.checked;
    maxTimeInput.style.backgroundColor = jogosSorteadosCheckbox.checked ? '' : '#e9ecef';

    // A lógica de presets baseada em dezenasJogadas foi movida para setGenerationDefaults
    // para ser controlada pelo seletor global de tipo de jogo.
}


export { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState };