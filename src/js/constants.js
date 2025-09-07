export const GAME_DEFAULTS = {
    totalBolas: 60, // Padrão Mega-Sena
    qtdBolasSelecionadas: 60, // Padrão Mega-Sena
    maxTime: 30,
    dezenasJogadas: 6, // Padrão Mega-Sena
    acertosGarantidos: 4, // Padrão Mega-Sena
    quantidadeJogos: 100,
    // Quina (usado apenas se selecionado)
    quina: {
        totalBolas: 80,
        qtdBolasSelecionadas: 80,
        dezenasJogadas: 5,
        acertosGarantidos: 3,
        quantidadeJogos: 100,
        maxTime: 30
    },
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