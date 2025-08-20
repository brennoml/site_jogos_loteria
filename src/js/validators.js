/**
 * Valida as configurações do jogo.
 * @param {Object} config - Configurações do jogo.
 * @param {number} config.totalBolas - Total de bolas no globo.
 * @param {number} config.qtdBolasSelecionadas - Quantidade de bolas do universo a ser usado.
 * @param {Array<number>} config.dezenasSelecionadas - Array de dezenas escolhidas pelo usuário (se não bolasAleatorias).
 * @param {boolean} config.bolasAleatorias - Se as dezenas do universo são escolhidas aleatoriamente.
 * @param {number} config.dezenasJogadas - Quantidade de dezenas por jogo.
 * @param {number} config.acertosGarantidos - Quantidade de acertos a garantir.
 * @param {boolean} config.aproveitaJogos - Se usa arquivo de jogos existentes.
 * @param {number} config.quantidadeJogos - Quantidade de jogos a gerar.
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
        // config.qtdBolasSelecionadas é atualizado em generate.js para refletir o length de dezenasSelecionadas válidas
    }
    
    // Após a lógica acima, config.qtdBolasSelecionadas (seja da entrada direta ou do length de dezenasSelecionadas)
    // deve ser o número de bolas que compõem o universo de onde os jogos serão gerados.
    // Essa validação é redundante se as anteriores passaram, mas para garantir:
    if (config.dezenasSelecionadas.length < config.dezenasJogadas) {
         throw new Error('O universo de dezenas disponíveis para gerar jogos é menor que o número de dezenas por jogo.');
    }


    if (isNaN(config.acertosGarantidos) || config.acertosGarantidos < 0) { // 0 pode ser válido se a intenção é apenas gerar jogos
        throw new Error('Acertos garantidos deve ser um número não negativo.');
    }
    if (config.acertosGarantidos > config.dezenasJogadas) {
        throw new Error('Acertos garantidos não podem exceder o número de dezenas por jogo.');
    }
     if (config.acertosGarantidos > config.dezenasSelecionadas.length) { // Nova validação
        throw new Error('Acertos garantidos não podem exceder o total de dezenas disponíveis para seleção.');
    }


    if (config.aproveitaJogos && !document.getElementById('jogosExistentesFile').files[0] && config.jogosExistentes.length === 0) {
        // Relaxar esta validação aqui, pois generateGames pode lidar com isso.
        // Apenas logar um aviso se for o caso.
        console.warn('Opção "Aproveitar Jogos Existentes" marcada, mas nenhum arquivo selecionado ou jogos carregados.');
    }

    if (isNaN(config.quantidadeJogos) || config.quantidadeJogos <= 0) {
        throw new Error('Número de jogos a gerar deve ser um número positivo.');
    }
    if (config.quantidadeJogos > 10000000) { // Limite prático
        throw new Error('Número de jogos excede o limite prático (10 milhões). Reduza a quantidade.');
    }

    if (config.jogosSorteados) {
        if (isNaN(config.maxTime) || config.maxTime < 0) {
            throw new Error('Tempo máximo para geração aleatória deve ser um número não negativo (0 para sem limite).');
        }
    }
}

/**
 * Converte um número no formato brasileiro (ex.: 1.234,56 ou 1234,56 ou R$ 1.234,56) para float.
 * @param {string} value - Valor no formato brasileiro.
 * @returns {number} Valor convertido, ou NaN se inválido.
 */
function parseBrazilianNumber(value) {
    if (typeof value !== 'string' || !value) return NaN;
    
    // Remove 'R$', espaços em branco, e usa ponto como separador de milhar (se houver) e vírgula como decimal.
    const cleaned = value
        .replace(/\s*R\$\s*/g, '') // Remove 'R$' e espaços ao redor
        .replace(/\./g, (match, offset, fullString) => {
            // Se o ponto for seguido por 3 dígitos e depois (fim da string ou não-dígito), é milhar.
            // Ou se o ponto está antes de uma vírgula decimal.
            // Esta lógica é um pouco complexa devido à ambiguidade.
            // Ex: 1.234,56 (ponto é milhar) vs 1234.56 (ponto é decimal se não houver vírgula)
            // A biblioteca Cleave.js já formata para "1.234,56", então o parse deve esperar isso.
            // Se vier "1234.56" direto, pode ser interpretado errado se não houver vírgula.
            // Assumindo que o Cleave.js formatou: pontos são milhares, vírgula é decimal.
            if (fullString.indexOf(',') !== -1) { // Se tem vírgula, ponto é milhar
                return '';
            }
            // Se não tem vírgula, um único ponto é decimal
            // Se múltiplos pontos e sem vírgula, é ambíguo. Cleave não deve gerar isso.
            // Para robustez, se não há vírgula e há ponto, assumimos que o último ponto é decimal.
            // Esta heurística é falha. Melhor confiar que Cleave.js padroniza.
            return ''; // Remover todos os pontos (separadores de milhar)
        })
        .replace(',', '.'); // Troca vírgula (decimal) por ponto

    const number = parseFloat(cleaned);
    // Não lançar erro aqui, apenas retornar NaN para que o chamador decida.
    // if (isNaN(number)) {
    //     throw new Error(`Formato de número inválido: "${value}" resultou em "${cleaned}"`);
    // }
    return number;
}

export { validateGameConfig, parseBrazilianNumber };