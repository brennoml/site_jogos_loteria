/**
 * Constantes e configurações padrão da aplicação LotoPro
 * Define parâmetros específicos para cada modalidade de loteria
 */

/**
 * Configurações padrão por tipo de jogo
 * - totalBolas: Total de números disponíveis no globo
 * - qtdBolasSelecionadas: Quantidade padrão de números a selecionar (deve ser menor que totalBolas)
 * - dezenasJogadas: Quantidade de números por aposta
 * - acertosGarantidos: Mínimo de acertos garantidos no algoritmo
 * - quantidadeJogos: Quantidade padrão de jogos a gerar
 * - maxTime: Tempo limite em segundos para geração aleatória
 */
const GAME_DEFAULTS = {
    megasena: {
        totalBolas: 60,
        qtdBolasSelecionadas: 25,  // Corrigido: deve ser menor que totalBolas
        dezenasJogadas: 6,
        acertosGarantidos: 4,
        quantidadeJogos: 100,
        maxTime: 30
    },
    quina: {
        totalBolas: 80,
        qtdBolasSelecionadas: 40,  // Corrigido: deve ser menor que totalBolas
        dezenasJogadas: 5,
        acertosGarantidos: 3,
        quantidadeJogos: 100,
        maxTime: 30
    },
    lotofacil: {
        totalBolas: 25,
        qtdBolasSelecionadas: 20,  // Corrigido: deve ser menor que totalBolas
        dezenasJogadas: 15,
        acertosGarantidos: 11,
        quantidadeJogos: 100,
        maxTime: 30
    }
};

/**
 * Valores padrão de prêmios por modalidade
 * Define os valores monetários para cada faixa de premiação
 */
const PRIZE_DEFAULTS = {
    megasena: {
        custoAposta: 6.00,
        quadra: 1000,
        quina: 80000,
        sena: 50000000
    },
    quina: {
        custoAposta: 3.00,
        duque: 6,
        terno: 120,
        quadra: 7000,
        quina: 230000000
    },
    lotofacil: {
        custoAposta: 3.50,
        onze: 7,
        doze: 14,
        treze: 35,
        quatorze: 2000,
        quinze: 1000000
    }
};

/**
 * Tabela de custos por quantidade de dezenas jogadas.
 * Fonte: Caixa Econômica Federal (valores atualizados em julho/2025).
 */
const GAME_COSTS = {
    megasena: {
        6: 6.00, 7: 42.00, 8: 168.00, 9: 504.00, 10: 1260.00,
        11: 2772.00, 12: 5544.00, 13: 10296.00, 14: 18018.00, 15: 30030.00,
        16: 48048.00, 17: 74256.00, 18: 111384.00, 19: 162792.00, 20: 232560.00
    },
    quina: {
        5: 3.00, 6: 18.00, 7: 63.00, 8: 168.00, 9: 378.00,
        10: 756.00, 11: 1386.00, 12: 2376.00, 13: 3861.00, 14: 6006.00, 15: 9009.00
    },
    lotofacil: {
        15: 3.50, 16: 56.00, 17: 476.00, 18: 2856.00, 19: 13566.00, 20: 54264.00
    }
};

export { GAME_DEFAULTS, PRIZE_DEFAULTS, GAME_COSTS };