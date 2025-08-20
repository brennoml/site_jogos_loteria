export const GAME_DEFAULTS = {
    totalBolas: 80, // Padrão Quina
    qtdBolasSelecionadas: 80, // Padrão Quina
    maxTime: 30,
    dezenasJogadas: 5, // Padrão Quina
    acertosGarantidos: 3, // Padrão Quina
    quantidadeJogos: 100,
    // Lotofácil (usado apenas se selecionado)
    lotofacil: {
        totalBolas: 25,
        qtdBolasSelecionadas: 25,
        dezenasJogadas: 15,
        acertosGarantidos: 11,
        quantidadeJogos: 100,
        maxTime: 30
    }
};

export const PRIZE_DEFAULTS = {
    megasena: {
        quadra: 1000,
        quina: 80000,
        sena: 500000000,
        custoAposta: 6.25 // Valor oficial atual da aposta simples de 6 dezenas
    },
    quina: {
        duque: 6,    // Valores aproximados com base em sorteios recentes (podem variar)
        terno: 120,  // Valores aproximados
        quadra: 7000, // Valores aproximados
        quina: 230000000, // Valor base, varia muito
        custoAposta: 3.125 // Valor oficial atual da aposta simples de 5 dezenas
    },
    lotofacil: {
        onze: 7,
        doze: 14,
        treze: 35,
        quatorze: 2000,
        quinze: 1000000,
        custoAposta: 3.50 // Valor oficial atual da aposta simples de 15 dezenas
    }
};