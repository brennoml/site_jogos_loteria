import { validateGameConfig, parseBrazilianNumber } from './validators.js';
import { jogosJaGerados, getSubconjuntos, combinations, randomChoice, combinationsCount, combinationsGenerator } from './utils.js';
import { showGenerationReport } from './interface.js';
import { GAME_DEFAULTS, PRIZE_DEFAULTS, GAME_COSTS } from './constants.js';

// Flag global para controlar a interrupção da geração
window.stopGenerationRequested = false;

/**
 * ALGORITMO PRINCIPAL DE GERAÇÃO DE JOGOS
 * 
 * Esta função orquestra a geração de jogos com base em uma configuração detalhada,
 * garantindo que as combinações que asseguram o prêmio mínimo (ex: quadra) não se repitam.
 * 
 * ETAPAS:
 * 1.  **Aproveitamento de Jogos Existentes**: Se a opção for marcada, a função primeiro processa
 *     um arquivo de jogos fornecido pelo usuário. Ela adiciona os jogos válidos que não entram
 *     em conflito com as combinações de "acertos garantidos" já utilizadas.
 * 2.  **Definição do Universo de Dezenas**: O universo de dezenas para gerar NOVOS jogos é definido.
 *     Pode ser o universo original (fornecido na configuração) ou um universo derivado das dezenas
 *     presentes nos jogos aproveitados (para manter a consistência).
 * 3.  **Geração de Novos Jogos**: A função entra em um loop para gerar os jogos restantes até
 *     atingir a quantidade solicitada. Existem duas estratégias de geração:
 *     a) **Geração Aleatória com Pesos (`jogosSorteados: true`)**: Gera jogos aleatoriamente a partir
 *        do universo de dezenas. Para evitar a repetição e promover a distribuição, as dezenas
 *        menos utilizadas recebem um "peso" maior, aumentando sua probabilidade de serem escolhidas.
 *        Esta abordagem é mais rápida para universos grandes, mas não garante que todas as
 *        combinações possíveis serão encontradas.
 *     b) **Geração Combinatória (`jogosSorteados: false`)**: Gera TODAS as combinações possíveis de
 *        jogos a partir do universo de dezenas, embaralha-as e testa uma a uma, adicionando
 *        apenas as que não conflitam com as garantias já cobertas. É exaustiva e garante a melhor
 *        cobertura, mas pode ser extremamente lenta para universos grandes.
 * 
 * @param {object} config - Objeto com as configurações completas do jogo.
 * @returns {Promise<Array<Array<number>>>} Uma promessa que resolve para uma lista de jogos gerados.
 */
async function gerarJogosSemAcertosGarantidosRepetidos(config, progressCallback) {
    const jogos = [];
    let jogosAproveitadosDescartados = 0, jogosNovosDescartados = 0;
    const combinacoesUsadas = new Set(); // Armazena combinações de acertos já utilizadas (formato JSON)
    let jogosAproveitados = 0;
    const quantidadeJogosAlvo = config.quantidadeJogos;
    // Array para controlar frequência de uso de cada dezena (índice = número da bola)
    let frequencia = new Array(config.totalBolas + 1).fill(0);

    /**
     * Adiciona um jogo válido à lista de resultados e atualiza as estruturas de controle.
     * @param {number[]} jogo - O jogo a ser adicionado (array de dezenas).
     * @private
     */
    function adicionarJogoEAtualizarEstruturas(jogo) {
        jogos.push(jogo);
        
        // Registra todas as combinações de acertos garantidos deste jogo
        const subconjuntos = getSubconjuntos(jogo, config.acertosGarantidos);
        subconjuntos.forEach(sub => combinacoesUsadas.add(sub));
        
        // Incrementa frequência de uso de cada dezena
        jogo.forEach(num => {
            if (num >= 1 && num <= config.totalBolas) {
                frequencia[num]++;
            }
        });
    }

    /**
     * ETAPA 1: Processar jogos existentes, se houver.
     */
    let dezenasUniversoParaValidacaoExistentes;
    if (config.bolasAleatorias && config.aproveitaJogos) {
        dezenasUniversoParaValidacaoExistentes = Array.from({length: config.totalBolas}, (_, i) => i + 1);
    } else {
        dezenasUniversoParaValidacaoExistentes = [...config.dezenasSelecionadas];
    }


    if (config.aproveitaJogos && config.jogosExistentes.length > 0) {
        await progressCallback({ statusText: 'Analisando jogos existentes...' });
        for (const jogoExistente of config.jogosExistentes) {
            if (window.stopGenerationRequested) break;
            if (jogos.length >= quantidadeJogosAlvo) break;

            // Validação opcional: o jogo aproveitado deve conter apenas dezenas do universo selecionado na tela.
            if (config.validarUniversoJogosAproveitados) {
                if (!jogoExistente.every(dezena => dezenasUniversoParaValidacaoExistentes.includes(dezena))) {
                    jogosAproveitadosDescartados++;
                    continue; // Pula o jogo se ele contiver dezenas fora do universo.
                }
            }

            // O usuário solicitou que o jogo original seja aproveitado, sem desdobramento.
            // Apenas validamos se o jogo tem dezenas suficientes para a garantia de acertos.
            if (jogoExistente.length < config.acertosGarantidos) {
                console.warn(`Jogo [${jogoExistente.join(',')}] ignorado pois tem menos dezenas (${jogoExistente.length}) que os acertos garantidos (${config.acertosGarantidos}).`);
                continue;
            }

            let deveAdicionar = true;
            // Validação opcional: o jogo aproveitado não pode repetir combinações de acertos já usadas.
            if (config.validarRepeticaoJogosAproveitados) {
                const subconjuntos = getSubconjuntos(jogoExistente, config.acertosGarantidos);
                let temIntersecao = false;
                for (const sub of subconjuntos) {
                    if (combinacoesUsadas.has(sub)) {
                        temIntersecao = true;
                        jogosAproveitadosDescartados++;
                        break;
                    }
                }
                if (temIntersecao) {
                    deveAdicionar = false;
                }
            }

            if (deveAdicionar) {
                // Adiciona o jogo original, com sua quantidade de dezenas original.
                // A função também atualiza 'combinacoesUsadas' para que os novos jogos respeitem este.
                adicionarJogoEAtualizarEstruturas(jogoExistente.sort((a, b) => a - b));
                jogosAproveitados++;
            }
        }
        await progressCallback({
            elementId: 'progress-geracao',
            currentCount: jogos.length,
            totalCount: quantidadeJogosAlvo,
            isAleatorio: config.jogosSorteados,
            progressPercent: 0,
            info: `Aproveitados: ${jogosAproveitados}`,
            countLabel: "Gerados"
        });
    }

    /**
     * ETAPA 2: Definir o universo de dezenas para a geração de NOVOS jogos.
     */
    let dezenasParaTrabalhar;
    let universoUtilizadoParaNovosJogos; // Para o relatório

    // Se a opção "Forçar usar apenas as bolas contidas nos jogos selecionados" estiver MARCADA
    if (config.aproveitaJogos && jogosAproveitados > 0 && config.forcarUniversoJogosAproveitados) {
        const dezenasDosJogosAproveitados = new Set();
        jogos.forEach(jogo => { // 'jogos' neste ponto contém apenas os jogos aproveitados
            jogo.forEach(dezena => dezenasDosJogosAproveitados.add(dezena));
        });

        if (dezenasDosJogosAproveitados.size > 0) {
            dezenasParaTrabalhar = Array.from(dezenasDosJogosAproveitados).sort((a, b) => a - b);
            universoUtilizadoParaNovosJogos = { tipo: 'aproveitado', dezenas: [...dezenasParaTrabalhar] };
        } else { 
            // Fallback: se por algum motivo não foi possível extrair dezenas, usa o universo da tela.
            dezenasParaTrabalhar = [...config.dezenasSelecionadas];
            universoUtilizadoParaNovosJogos = { tipo: 'selecao_usuario', dezenas: [...dezenasParaTrabalhar] };
        }
    } else {
        // Comportamento Padrão: usa o universo de dezenas definido na tela.
        dezenasParaTrabalhar = [...config.dezenasSelecionadas];
        universoUtilizadoParaNovosJogos = { tipo: 'selecao_usuario', dezenas: [...dezenasParaTrabalhar] };
    }

    // Validação do universo de dezenasParaTrabalhar antes de gerar novos jogos
    // Apenas se ainda for necessário gerar novos jogos
    if (jogos.length < quantidadeJogosAlvo) { 
        if (dezenasParaTrabalhar.length < config.dezenasJogadas) {
            throw new Error(`O universo de dezenas para gerar NOVOS jogos (${dezenasParaTrabalhar.length}) é menor que as dezenas por jogo (${config.dezenasJogadas}). Não é possível gerar mais jogos.`);
        }
        if (config.acertosGarantidos > 0 && dezenasParaTrabalhar.length < config.acertosGarantidos && dezenasParaTrabalhar.length > 0) {
            console.warn(`Atenção: O universo de dezenas para NOVOS jogos (${dezenasParaTrabalhar.length}) é menor que os acertos garantidos (${config.acertosGarantidos}). Pode não ser possível garantir acertos com este universo reduzido.`);
        }
    }

    if (window.stopGenerationRequested) {
        await progressCallback({ statusText: 'Geração interrompida pelo usuário.' });
        return { jogos, jogosAproveitadosDescartados, jogosNovosDescartados, frequencia, jogosAproveitados, universoUtilizadoParaNovosJogos };
    }

    /**
     * ETAPA 3: Gerar novos jogos usando uma das duas estratégias.
     */

    await progressCallback({ statusText: 'Gerando novos jogos...' });

    if (config.algoritmo === 'aleatorio') { // Geração Aleatória com Pesos
        let timeOfLastFind = Date.now(); // Tempo da última vez que um jogo válido foi encontrado
        const maxTimeMs = config.maxTime * 1000;
        let iteracoes = 0;
        const startTime = performance.now();

        while (jogos.length < quantidadeJogosAlvo) {
            if (window.stopGenerationRequested) {
                await progressCallback({ statusText: 'Geração interrompida pelo usuário.' });
                break;
            }
            const currentTime = Date.now();
            // Verifica se o tempo desde a última descoberta excedeu o limite
            // E se maxTimeMs > 0 (0 significa sem limite de tempo de inatividade)
            if (maxTimeMs > 0 && (currentTime - timeOfLastFind) > maxTimeMs) {
                await progressCallback({ statusText: `Tempo limite de ${config.maxTime}s sem novos jogos atingido. ${jogos.length} jogos gerados.` });
                break;
            }
            iteracoes++;

            // Atualiza o progresso a cada segundo, mesmo que não encontre jogos
            if (iteracoes % 1000 === 0) { // Check a cada 1000 iterações para não sobrecarregar
                const tempoDecorrido = (performance.now() - startTime) / 1000;
                const tempoRestanteTimeout = maxTimeMs > 0 ? Math.max(0, (maxTimeMs - (currentTime - timeOfLastFind)) / 1000) : Infinity;
                await progressCallback({
                    elementId: 'progress-geracao',
                    currentCount: jogos.length,
                    totalCount: quantidadeJogosAlvo,
                    isAleatorio: true,
                    progressPercent: null,
                    info: `Testadas: ${iteracoes.toLocaleString('pt-BR')}`,
                    countLabel: "Gerados",
                    tempoDecorrido,
                    tempoRestante: tempoRestanteTimeout
                });
            }

            // GERAÇÃO DO JOGO: Lógica corrigida para garantir dezenas únicas com pesos.
            let jogoGerado;
            if (config.usarPesoFavoritas && config.dezenasFavoritas.length > 0) {
                // Cria um array de pesos correspondente ao dezenasParaTrabalhar
                const peso = config.pesoFavoritas;
                const dezenasFavoritasSet = new Set(config.dezenasFavoritas);
                const weights = dezenasParaTrabalhar.map(dezena => dezenasFavoritasSet.has(dezena) ? peso : 1);
                
                // Usa a amostragem com pesos, que garante dezenas únicas quando replace=false
                jogoGerado = randomChoice(dezenasParaTrabalhar, weights, config.dezenasJogadas, false).sort((a, b) => a - b);
            } else {
                // Geração aleatória simples sem pesos
                jogoGerado = randomChoice(dezenasParaTrabalhar, null, config.dezenasJogadas, false).sort((a, b) => a - b);
            }
            
            const subconjuntos = getSubconjuntos(jogoGerado, config.acertosGarantidos);
            let temIntersecao = false;
            for (const sub of subconjuntos) {
                if (combinacoesUsadas.has(sub)) {
                    temIntersecao = true;
                    jogosNovosDescartados++;
                    break;
                }
            }

            if (!temIntersecao) {
                adicionarJogoEAtualizarEstruturas(jogoGerado);
                timeOfLastFind = Date.now(); // Atualiza o tempo da última descoberta
                if (jogos.length % 10 === 0 || jogos.length === quantidadeJogosAlvo) { // Atualiza progresso com menos frequência
                    const tempoDecorrido = (performance.now() - startTime) / 1000;
                    const tempoRestanteTimeout = maxTimeMs > 0 ? Math.max(0, (maxTimeMs - (Date.now() - timeOfLastFind)) / 1000) : Infinity;
                    await progressCallback({
                        elementId: 'progress-geracao',
                        currentCount: jogos.length,
                        totalCount: quantidadeJogosAlvo,
                        isAleatorio: true,
                        progressPercent: null,
                        info: `Testadas: ${iteracoes.toLocaleString('pt-BR')}`,
                        countLabel: "Gerados",
                        tempoDecorrido,
                        tempoRestante: tempoRestanteTimeout
                    });
                }
            }
        }
    } else if (config.algoritmo === 'combinatorio_aleatorio') { // Geração Combinatória Aleatória (em memória)
        const n = dezenasParaTrabalhar.length;
        const k = config.dezenasJogadas;

        // Limite prático para evitar estouro de memória.
        // ATENÇÃO: valores muito altos podem travar o navegador.
        const COMBINATION_MEMORY_LIMIT = 400000000; // 400 milhões
        const totalCombinacoes = combinationsCount(n, k);

        if (totalCombinacoes > COMBINATION_MEMORY_LIMIT) {
            throw new Error(`O modo "Combinatória Aleatória" não é viável. O número de combinações (${totalCombinacoes.toLocaleString('pt-BR')}) excede o limite de memória de ${COMBINATION_MEMORY_LIMIT.toLocaleString('pt-BR')}. Por favor, use a "Combinatória em Sequência" ou a "Geração Aleatória".`);
        }

        if (totalCombinacoes === 0) {
            throw new Error("Não há combinações possíveis com as dezenas fornecidas e o tamanho do jogo.");
        }

        await progressCallback({ statusText: 'Gerando todas as combinações (pode usar muita memória)...' });

        let todasCombinacoes = combinations(dezenasParaTrabalhar, config.dezenasJogadas);

        await progressCallback({ statusText: 'Embaralhando combinações...' });

        // Fisher-Yates shuffle
        for (let i = todasCombinacoes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [todasCombinacoes[i], todasCombinacoes[j]] = [todasCombinacoes[j], todasCombinacoes[i]];
        }

        const startTime = performance.now();
        let combinacoesTestadas = 0;
        for (const jogoPotencial of todasCombinacoes) {
            if (window.stopGenerationRequested) {
                await progressCallback({ statusText: 'Geração interrompida pelo usuário.' });
                break;
            }
            if (jogos.length >= quantidadeJogosAlvo) break;
            combinacoesTestadas++;

            const subconjuntos = getSubconjuntos(jogoPotencial.sort((a,b) => a-b), config.acertosGarantidos);
            let temIntersecao = false;
            for (const sub of subconjuntos) {
                if (combinacoesUsadas.has(sub)) {
                    temIntersecao = true;
                    jogosNovosDescartados++;
                    break;
                }
            }

            if (!temIntersecao) {
                adicionarJogoEAtualizarEstruturas(jogoPotencial.sort((a,b) => a-b));
            }

            if (combinacoesTestadas % Math.max(1, Math.floor(totalCombinacoes / 100)) === 0 || combinacoesTestadas === totalCombinacoes) {
                const tempoDecorrido = (performance.now() - startTime) / 1000;
                let tempoRestanteEstimado = 0;
                if (combinacoesTestadas > 0 && tempoDecorrido > 0) {
                    const combinacoesRestantes = totalCombinacoes - combinacoesTestadas;
                    const velocidade = combinacoesTestadas / tempoDecorrido; // combinações por segundo
                    tempoRestanteEstimado = combinacoesRestantes / velocidade;
                }
                const info = `Testadas: ${combinacoesTestadas.toLocaleString('pt-BR')} / ${totalCombinacoes.toLocaleString('pt-BR')}`;
                await progressCallback({
                    elementId: 'progress-geracao',
                    currentCount: jogos.length,
                    totalCount: null,
                    isAleatorio: false,
                    progressPercent: (combinacoesTestadas / totalCombinacoes) * 100,
                    info,
                    countLabel: "Gerados",
                    tempoDecorrido,
                    tempoRestante: tempoRestanteEstimado
                });
            }
        }
        if (jogos.length < quantidadeJogosAlvo) {
            if (!window.stopGenerationRequested)
                await progressCallback({ statusText: `Atenção: Gerados ${jogos.length} de ${quantidadeJogosAlvo} solicitados. Pode ter esgotado as combinações válidas.` });
        }
    } else { // 'combinatorio_sequencial' - Geração Combinatória com Gerador
        const n = dezenasParaTrabalhar.length;
        const k = config.dezenasJogadas;
        
        // Limite prático para evitar travamentos do navegador. Aumentado para 1 bilhão.
        // O uso de um gerador (iterator) evita o consumo excessivo de memória.
        const COMBINATION_LIMIT = 1000000000; 
        const totalCombinacoes = combinationsCount(n, k);

        if (totalCombinacoes > COMBINATION_LIMIT) {
            throw new Error(`O modo combinatório não é viável para esta seleção. O número de combinações possíveis (${totalCombinacoes.toLocaleString('pt-BR')}) excede o limite de ${COMBINATION_LIMIT.toLocaleString('pt-BR')}. Por favor, use a "Geração Aleatória".`);
        }

        // A geração agora usa um iterador para não estourar a memória.
        const combinacoesIterator = combinationsGenerator(dezenasParaTrabalhar, config.dezenasJogadas);

        if (totalCombinacoes === 0) {
            throw new Error("Não há combinações possíveis com as dezenas fornecidas e o tamanho do jogo.");
        }
        
        // O embaralhamento foi removido, pois não é viável para um grande número de combinações
        // que não são mantidas em memória. As combinações serão testadas em ordem lexicográfica.

        const startTime = performance.now();
        let combinacoesTestadas = 0;
        for (const jogoPotencial of combinacoesIterator) {
            if (window.stopGenerationRequested) {
                await progressCallback({ statusText: 'Geração interrompida pelo usuário.' });
                break;
            }
            if (jogos.length >= quantidadeJogosAlvo) break;
            combinacoesTestadas++;

            const subconjuntos = getSubconjuntos(jogoPotencial.sort((a,b) => a-b), config.acertosGarantidos);
            let temIntersecao = false;
            for (const sub of subconjuntos) {
                if (combinacoesUsadas.has(sub)) {
                    temIntersecao = true;
                    jogosNovosDescartados++;
                    break;
                }
            }

            if (!temIntersecao) {
                adicionarJogoEAtualizarEstruturas(jogoPotencial.sort((a,b) => a-b));
            }
            
            if (combinacoesTestadas % Math.max(1, Math.floor(totalCombinacoes / 100)) === 0 || combinacoesTestadas === totalCombinacoes) {
                const tempoDecorrido = (performance.now() - startTime) / 1000;
                let tempoRestanteEstimado = 0;
                if (combinacoesTestadas > 0 && tempoDecorrido > 0) {
                    const combinacoesRestantes = totalCombinacoes - combinacoesTestadas;
                    const velocidade = combinacoesTestadas / tempoDecorrido; // combinações por segundo
                    tempoRestanteEstimado = combinacoesRestantes / velocidade;
                }
                const info = `Testadas: ${combinacoesTestadas.toLocaleString('pt-BR')} / ${totalCombinacoes.toLocaleString('pt-BR')}`;
                await progressCallback({
                    elementId: 'progress-geracao',
                    currentCount: jogos.length,
                    totalCount: null,
                    isAleatorio: false,
                    progressPercent: (combinacoesTestadas / totalCombinacoes) * 100,
                    info,
                    countLabel: "Gerados",
                    tempoDecorrido,
                    tempoRestante: tempoRestanteEstimado
                });
            }
        }
        if (jogos.length < quantidadeJogosAlvo) {
            if (!window.stopGenerationRequested)
                await progressCallback({ statusText: `Atenção: Gerados ${jogos.length} de ${quantidadeJogosAlvo} solicitados. Pode ter esgotado as combinações válidas.` });
        }
    }

    return { jogos, jogosAproveitadosDescartados, jogosNovosDescartados, frequencia, jogosAproveitados, universoUtilizadoParaNovosJogos };
}

export { gerarJogosSemAcertosGarantidosRepetidos };