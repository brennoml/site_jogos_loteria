/**
 * Valida o objeto de configuração do jogo antes da geração.
 * @param {object} config - O objeto com as configurações do jogo.
 * @param {number} config.totalBolas - O número total de bolas no globo (ex: 60 para Mega-Sena).
 * @param {number} config.qtdBolasSelecionadas - A quantidade de dezenas que formarão o universo de geração.
 * @param {number[]} config.dezenasSelecionadas - O array de dezenas que compõem o universo de geração.
 * @param {boolean} config.bolasAleatorias - Flag que indica se o universo de dezenas foi gerado aleatoriamente.
 * @param {number} config.dezenasJogadas - A quantidade de dezenas em cada jogo a ser gerado (ex: 6).
 * @param {number} config.acertosGarantidos - A garantia mínima de acertos desejada (ex: 4 para quadra).
 * @param {boolean} config.aproveitaJogos - Flag que indica se jogos de um arquivo existente devem ser aproveitados.
 * @param {number} config.quantidadeJogos - O número total de jogos a serem gerados.
 * @throws {Error} Lança um erro se qualquer validação falhar.
 */
function validateGameConfig(config) {
    if (isNaN(config.totalBolas) || config.totalBolas <= 0) {
        throw new Error('Total de bolas no globo deve ser um número positivo.');
    }
    if (isNaN(config.dezenasJogadas) || config.dezenasJogadas <= 0) {
        throw new Error('Dezenas por jogo deve ser um número positivo.');
    }
    if (config.totalBolas < config.dezenasJogadas) {
        throw new Error('Total de bolas no globo deve ser maior ou igual ao número de dezenas por jogo.');
    }

    // Validações para o universo de dezenas
    if (config.bolasAleatorias) {
        if (isNaN(config.qtdBolasSelecionadas) || config.qtdBolasSelecionadas <= 0) {
            throw new Error('Quantidade de bolas para seleção (aleatória) deve ser um número positivo.');
        }
        if (config.qtdBolasSelecionadas < config.dezenasJogadas) {
            throw new Error('Quantidade de bolas para seleção (aleatória) deve ser maior ou igual às dezenas por jogo.');
        }
        if (config.qtdBolasSelecionadas > config.totalBolas) {
            throw new Error('Quantidade de bolas para seleção (aleatória) não pode exceder o total de bolas no globo.');
        }
    } else { // Dezenas fixas selecionadas pelo usuário
        if (!Array.isArray(config.dezenasSelecionadas) || config.dezenasSelecionadas.length === 0) {
            throw new Error('Se "Usar Bolas Aleatórias" está desmarcado, forneça as dezenas fixas.');
        }
        if (config.dezenasSelecionadas.length < config.dezenasJogadas) {
            throw new Error('O número de dezenas fixas selecionadas deve ser maior ou igual ao número de dezenas por jogo.');
        }
        if (new Set(config.dezenasSelecionadas).size !== config.dezenasSelecionadas.length) {
            throw new Error('As dezenas fixas selecionadas contêm números duplicados.');
        }
        for (const dezena of config.dezenasSelecionadas) {
            if (isNaN(dezena) || !Number.isInteger(dezena) || dezena < 1 || dezena > config.totalBolas) {
                throw new Error(`Dezena fixa "${dezena}" é inválida. Deve ser um inteiro entre 1 e ${config.totalBolas}.`);
            }
        }
    }
    
    // Validações para a garantia de acertos
    if (isNaN(config.acertosGarantidos) || config.acertosGarantidos < 0) { // 0 pode ser válido se a intenção é apenas gerar jogos
        throw new Error('Acertos garantidos deve ser um número não negativo.');
    }
    if (config.acertosGarantidos > config.dezenasJogadas) {
        throw new Error('Acertos garantidos não podem exceder o número de dezenas por jogo.');
    }
    if (config.dezenasSelecionadas && config.acertosGarantidos > config.dezenasSelecionadas.length) { // Nova validação
        throw new Error('Acertos garantidos não podem exceder o total de dezenas disponíveis para seleção.');
    }

    // Validação para aproveitamento de jogos
    if (config.aproveitaJogos && config.jogosExistentes.length === 0) {
        throw new Error('A opção "Aproveitar Jogos da lista" está marcada, mas nenhum jogo foi marcado na lista para ser aproveitado.');
    }

    // Validações para a quantidade de jogos
    if (isNaN(config.quantidadeJogos) || config.quantidadeJogos <= 0) {
        throw new Error('Número de jogos a gerar deve ser um número positivo.');
    }
    if (config.quantidadeJogos > 10000000) { // Limite prático
        throw new Error('Número de jogos excede o limite prático (10 milhões). Reduza a quantidade.');
    }

    // Validação para o tempo máximo na geração aleatória
    if (config.jogosSorteados) {
        if (isNaN(config.maxTime) || config.maxTime < 0) {
            throw new Error('Tempo máximo para geração aleatória deve ser um número não negativo (0 para sem limite).');
        }
    }
}

/**
 * Converte um número no formato brasileiro (ex.: 1.234,56 ou 1234,56 ou R$ 1.234,56) para float.
 * @param {string} value - O valor em formato de string a ser convertido.
 * @returns {number} O valor convertido para número, ou NaN se a entrada for inválida.
 */
function parseBrazilianNumber(value) {
    if (typeof value !== 'string' || !value) return NaN;
    
    // 1. Remove o símbolo 'R$' e espaços adjacentes.
    // 2. Remove os pontos (separadores de milhar).
    // 3. Substitui a vírgula (separador decimal) por um ponto.
    const cleaned = value
        .replace(/\s*R\$\s*/g, '') 
        .replace(/\./g, '')        
        .replace(',', '.');        

    const number = parseFloat(cleaned);
    return number;
}

/**
 * Validates an analysis file, infers its game type, and extracts its data.
 * @param {File} file - The Excel file to validate.
 * @returns {Promise<{games: Array<Array<number>>, uniqueBalls: Array<number>, inferredTypes: Array<string>}>}
 * @throws {Error} If the file is invalid.
 */
async function validateAndGetFileInfo(file) {
    if (!window.XLSX) throw new Error("Biblioteca XLSX não carregada.");

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    const validGames = [];
    const uniqueBalls = new Set();
    let maxBall = 0;
    let minGameLen = Infinity;
    let maxGameLen = 0;

    for (const row of jsonData) {
        if (!row) continue;
        const gameNumbers = row.filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && num >= 1).map(Number);
        
        if (gameNumbers.length > 0) {
            validGames.push(gameNumbers);
            minGameLen = Math.min(minGameLen, gameNumbers.length);
            maxGameLen = Math.max(maxGameLen, gameNumbers.length);
            gameNumbers.forEach(n => {
                uniqueBalls.add(n);
                if (n > maxBall) maxBall = n;
            });
        }
    }
    if (validGames.length === 0) {
        throw new Error(`O arquivo "${file.name}" não contém jogos válidos.`);
    }

    // Infer game type based on all games in the file
    const inferredTypes = [];
    const gameTypeRules = {
        megasena: { dezenas: { min: 6, max: 20 }, bolas: 60, label: 'MegaSena' },
        quina: { dezenas: { min: 5, max: 15 }, bolas: 80, label: 'Quina' },
        lotofacil: { dezenas: { min: 15, max: 20 }, bolas: 25, label: 'Lotofácil' }
    };

    for (const type in gameTypeRules) {
        const rules = gameTypeRules[type];
        // The file is a candidate for this type if all its games fit the rules
        if (minGameLen >= rules.dezenas.min && maxGameLen <= rules.dezenas.max && maxBall <= rules.bolas) {
            inferredTypes.push(rules.label);
        }
    }

    return { 
        games: validGames, 
        uniqueBalls: Array.from(uniqueBalls).sort((a, b) => a - b), 
        inferredTypes: inferredTypes 
    };
}

export { validateGameConfig, parseBrazilianNumber, validateAndGetFileInfo };