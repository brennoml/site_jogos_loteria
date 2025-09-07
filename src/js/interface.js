/**
 * Inicializa a interface do usuário.
 */
function initializeInterface() {
    console.log('Inicializando interface...');
    
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

    // Formatar inputs numéricos (sem separadores) - limitado a 3 dígitos por padrão
    document.querySelectorAll('.number').forEach(input => {
        // Pular campos de eixo do gráfico que precisam de mais dígitos
        if (input.id === 'graficoEixoXMin' || input.id === 'graficoEixoXMax') {
            return; // Não aplicar formatação Cleave para esses campos
        }
        
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
    
    // Inicializa com base no tipo de jogo global selecionado
    handleGlobalGameTypeChange();
    
    console.log('Interface inicializada com sucesso');
}

/**
 * Configura os event listeners para os controles de geração.
 */
function setupGenerationControls() {
    console.log('Configurando controles de geração...');
    
    // Controles de geração
    const generationControls = [
        'bolasAleatorias',
        'aproveitaJogos', 
        'jogosSorteados',
        'forcarUniversoOriginalParaNovos',
        'dezenasJogadas'
    ];

    generationControls.forEach(controlId => {
        const control = document.getElementById(controlId);
        if (control) {
            control.addEventListener('change', updateGenerationInputsState);
            console.log(`Event listener configurado para ${controlId}`);
        } else {
            console.warn(`Controle ${controlId} não encontrado`);
        }
    });

    // Listener específico para arquivo de jogos existentes
    const jogosExistentesFileInput = document.getElementById('jogosExistentesFile');
    if (jogosExistentesFileInput) {
        jogosExistentesFileInput.addEventListener('change', function(e) {
            const fileNameDisplay = document.getElementById('jogosExistentesFileName');
            if (fileNameDisplay) {
                fileNameDisplay.textContent = e.target.files.length > 0 ? e.target.files[0].name : '';
            }
        });
        console.log('Event listener configurado para jogosExistentesFile');
    }
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

    if (gameType === 'quina') {
        totalBolasInput.value = 80;
        dezenasJogadasInput.value = 5;
        acertosGarantidosInput.value = 3;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 80;
        }
    } else if (gameType === 'lotofacil') {
        totalBolasInput.value = 25;
        dezenasJogadasInput.value = 15;
        acertosGarantidosInput.value = 11;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 25;
        }
    } else { // Mega-Sena ou default
        totalBolasInput.value = 60;
        dezenasJogadasInput.value = 6;
        acertosGarantidosInput.value = 4;
        if (bolasAleatoriasCheckbox.checked) {
            qtdBolasAleatoriasInput.value = 60;
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

    console.log('Mudando tipo de jogo para:', selectedGame);
    
    try {
        updateAnalysisPrizeInputs(selectedGame);
        setGenerationDefaults(selectedGame);
        console.log('Configurações do tipo de jogo atualizadas com sucesso');
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
    }
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

    if (!bolasAleatoriasCheckbox || !dezenasSelecionadasInput || !qtdBolasAleatoriasInput || 
        !aproveitaJogosCheckbox || !jogosExistentesFileInput || !forcarUniversoOriginalCheckbox || 
        !maxTimeInput || !jogosSorteadosCheckbox) {
        console.warn("Alguns elementos de controle não foram encontrados para atualizar estado.");
        return;
    }

    if (bolasAleatoriasCheckbox.checked) {
        dezenasSelecionadasInput.disabled = true;
        dezenasSelecionadasInput.value = '';
        qtdBolasAleatoriasInput.disabled = false;
    } else {
        dezenasSelecionadasInput.disabled = false;
        qtdBolasAleatoriasInput.disabled = true;
    }

    jogosExistentesFileInput.disabled = !aproveitaJogosCheckbox.checked;
    if (!aproveitaJogosCheckbox.checked) {
        jogosExistentesFileInput.value = '';
        const fileNameDisplay = document.getElementById('jogosExistentesFileName');
        if(fileNameDisplay) fileNameDisplay.textContent = '';
    }

    forcarUniversoOriginalCheckbox.disabled = !aproveitaJogosCheckbox.checked;
    if (!aproveitaJogosCheckbox.checked) {
        forcarUniversoOriginalCheckbox.checked = false;
    }
    
    maxTimeInput.disabled = !jogosSorteadosCheckbox.checked;
    
    // Aplica estilos visuais para campos desabilitados
    const disabledInputs = [dezenasSelecionadasInput, qtdBolasAleatoriasInput, jogosExistentesFileInput, maxTimeInput];
    disabledInputs.forEach(input => {
        if (input) {
            if (input.disabled) {
                input.style.backgroundColor = '#f1f5f9';
                input.style.color = '#9ca3af';
            } else {
                input.style.backgroundColor = '';
                input.style.color = '';
            }
        }
    });
}


/**
 * Função para inicializar eventos e estados da interface.
 */
function initInterface() {
    // Inicializa a interface do usuário
    initializeInterface();

    // Adiciona listener para mudança no tipo de jogo global
    const gameTypeSelect = document.getElementById('gameTypeGlobal');
    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', handleGlobalGameTypeChange);
    }

    // Adiciona listener para o checkbox de "Aproveitar Jogos"
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.addEventListener('change', updateGenerationInputsState);
    }

    // Adiciona listener para o checkbox de "Bolas Aleatórias"
    const bolasAleatoriasCheckbox = document.getElementById('bolasAleatorias');
    if (bolasAleatoriasCheckbox) {
        bolasAleatoriasCheckbox.addEventListener('change', updateGenerationInputsState);
    }

    // Adiciona listener para o checkbox de "Jogos Sorteados"
    const jogosSorteadosCheckbox = document.getElementById('jogosSorteados');
    if (jogosSorteadosCheckbox) {
        jogosSorteadosCheckbox.addEventListener('change', updateGenerationInputsState);
    }

    // Adiciona listener para o input de arquivo de jogos existentes
    const jogosExistentesFileInput = document.getElementById('jogosExistentesFile');
    if (jogosExistentesFileInput) {
        jogosExistentesFileInput.addEventListener('change', function(e) {
            const fileNameDisplay = document.getElementById('jogosExistentesFileName');
            if (fileNameDisplay) {
                fileNameDisplay.textContent = e.target.files.length > 0 ? e.target.files[0].name : '';
            }
        });
    }

    // Inicializa o estado da interface com os valores padrão
    handleGlobalGameTypeChange();
}


export { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState };