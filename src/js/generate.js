import { validateGameConfig, parseBrazilianNumber } from './validators.js';
import { updateProgress, jogosJaGerados, getSubconjuntos, combinations, randomChoice, combinationsCount, combinationsGenerator } from './utils.js';
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
async function gerarJogosSemAcertosGarantidosRepetidos(config) { // Note: a quantidade de jogosAproveitados é calculada aqui e retornada
    const status = document.getElementById('status-geracao');
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
        status.textContent = 'Analisando jogos existentes...';
        await new Promise(resolve => setTimeout(resolve, 0)); // Forçar atualização da UI
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
        await updateProgress(jogos.length, quantidadeJogosAlvo, config.jogosSorteados, 0, `Aproveitados: ${jogosAproveitados}`);
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
        status.textContent = 'Geração interrompida pelo usuário.';
        return jogos; // Retorna os jogos aproveitados até agora
    }

    /**
     * ETAPA 3: Gerar novos jogos usando uma das duas estratégias.
     */
    status.textContent = 'Gerando novos jogos...';
    await new Promise(resolve => setTimeout(resolve, 0));

    if (config.algoritmo === 'aleatorio') { // Geração Aleatória com Pesos
        let timeOfLastFind = Date.now(); // Tempo da última vez que um jogo válido foi encontrado
        const maxTimeMs = config.maxTime * 1000;
        let iteracoes = 0;
        const startTime = performance.now();

        while (jogos.length < quantidadeJogosAlvo) {
            if (window.stopGenerationRequested) {
                status.textContent = 'Geração interrompida pelo usuário.';
                break;
            }
            const currentTime = Date.now();
            // Verifica se o tempo desde a última descoberta excedeu o limite
            // E se maxTimeMs > 0 (0 significa sem limite de tempo de inatividade)
            if (maxTimeMs > 0 && (currentTime - timeOfLastFind) > maxTimeMs) {
                status.textContent = `Tempo limite de ${config.maxTime}s sem novos jogos atingido. ${jogos.length} jogos gerados.`;
                break;
            }
            iteracoes++;

            // Atualiza o progresso a cada segundo, mesmo que não encontre jogos
            if (iteracoes % 1000 === 0) { // Check a cada 1000 iterações para não sobrecarregar
                const tempoDecorrido = (performance.now() - startTime) / 1000;
                const tempoRestanteTimeout = maxTimeMs > 0 ? Math.max(0, (maxTimeMs - (currentTime - timeOfLastFind)) / 1000) : Infinity;
                await updateProgress(jogos.length, quantidadeJogosAlvo, true, null, `Testadas: ${iteracoes.toLocaleString('pt-BR')}`, tempoDecorrido, tempoRestanteTimeout);
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
                    await updateProgress(jogos.length, quantidadeJogosAlvo, true, null, `Testadas: ${iteracoes.toLocaleString('pt-BR')}`, tempoDecorrido, tempoRestanteTimeout);
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

        status.textContent = 'Gerando todas as combinações (pode usar muita memória)...';
        await new Promise(resolve => setTimeout(resolve, 0));

        let todasCombinacoes = combinations(dezenasParaTrabalhar, config.dezenasJogadas);

        status.textContent = 'Embaralhando combinações...';
        await new Promise(resolve => setTimeout(resolve, 0));

        // Fisher-Yates shuffle
        for (let i = todasCombinacoes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [todasCombinacoes[i], todasCombinacoes[j]] = [todasCombinacoes[j], todasCombinacoes[i]];
        }

        const startTime = performance.now();
        let combinacoesTestadas = 0;
        for (const jogoPotencial of todasCombinacoes) {
            if (window.stopGenerationRequested) {
                status.textContent = 'Geração interrompida pelo usuário.';
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
                await updateProgress(jogos.length, quantidadeJogosAlvo, false, (combinacoesTestadas / totalCombinacoes) * 100, info, tempoDecorrido, tempoRestanteEstimado);
            }
        }
        if (jogos.length < quantidadeJogosAlvo) {
            if (!window.stopGenerationRequested) 
                status.textContent = `Atenção: Gerados ${jogos.length} de ${quantidadeJogosAlvo} solicitados. Pode ter esgotado as combinações válidas.`;
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
                status.textContent = 'Geração interrompida pelo usuário.';
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
                await updateProgress(jogos.length, quantidadeJogosAlvo, false, (combinacoesTestadas / totalCombinacoes) * 100, info, tempoDecorrido, tempoRestanteEstimado);
            }
        }
        if (jogos.length < quantidadeJogosAlvo) {
            if (!window.stopGenerationRequested) 
                status.textContent = `Atenção: Gerados ${jogos.length} de ${quantidadeJogosAlvo} solicitados. Pode ter esgotado as combinações válidas.`;
        }
    }

    return { jogos, jogosAproveitadosDescartados, jogosNovosDescartados, frequencia, jogosAproveitados, universoUtilizadoParaNovosJogos };
}

/**
 * Gera jogos com base nas configurações do formulário.
 */
async function generateGames() {
    const progressModal = document.getElementById('generation-progress-modal');
    const status = document.getElementById('status-geracao');
    const progress = document.getElementById('progress-geracao');
    const loader = document.getElementById('loader-geracao');
    const btnGerar = document.getElementById('btn-gerar-jogos');
    const btnParar = document.getElementById('btn-parar-geracao');
    const btnShowLastReport = document.getElementById('btn-show-last-report');

    // Esconde o botão de re-exibir relatório no início de uma nova geração
    if (btnShowLastReport) {
        btnShowLastReport.style.display = 'none';
    }

    // Exibe o modal de progresso
    if (progressModal) progressModal.style.display = 'flex';
    
    status.textContent = 'Preparando para gerar jogos...';
    status.style.display = 'flex';
    status.classList.remove('error');
    progress.innerHTML = ''; // Limpa progresso anterior
    progress.style.display = 'block';
    loader.style.display = 'block';

    try {
        const startTime = performance.now();

        const tipoJogo = document.getElementById('gameTypeGlobal')?.value || 'megasena';
        const defaults = GAME_DEFAULTS[tipoJogo] || GAME_DEFAULTS.megasena;

        // Coleta de dezenas do novo painel
        const dezenasSelecionadas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.active')).map(b => parseInt(b.dataset.number));
        const dezenasFavoritas = Array.from(document.querySelectorAll('#ball-selection-panel .ball.favorite')).map(b => parseInt(b.dataset.number));

        let algoritmo;
        let algoritmoDisplay;
        if (document.getElementById('geracaoAleatoria').checked) {
            algoritmo = 'aleatorio';
            algoritmoDisplay = 'Aleatório';
        } else if (document.getElementById('geracaoCombinatoriaSequencial').checked) {
            algoritmo = 'combinatorio_sequencial';
            algoritmoDisplay = 'Combinatória em Sequência';
        } else { // Default ou geracaoCombinatoriaAleatoria is checked
            algoritmo = 'combinatorio_aleatorio';
            algoritmoDisplay = 'Combinatória Aleatória';
        }

        const config = {
            totalBolas: defaults.totalBolas,
            dezenasSelecionadas: dezenasSelecionadas,
            dezenasFavoritas: dezenasFavoritas,
            qtdBolasSelecionadas: dezenasSelecionadas.length,
            algoritmo: algoritmo,
            maxTime: parseInt(document.getElementById('maxTimeSelect').value) || 30,
            usarPesoFavoritas: document.getElementById('usarPesoFavoritas').checked,
            pesoFavoritas: parseInt(document.getElementById('pesoFavoritasSelect').value) || 10,

            dezenasJogadas: parseInt(document.getElementById('dezenasJogadas').value),
            acertosGarantidos: parseInt(document.getElementById('acertosGarantidos').value),
            quantidadeJogos: parseBrazilianNumber(document.getElementById('quantidadeJogos').value) || defaults.quantidadeJogos,
            
            aproveitaJogos: document.getElementById('aproveitaJogos').checked,
            forcarUniversoJogosAproveitados: document.getElementById('forcarUniversoJogosAproveitados').checked,
            validarRepeticaoJogosAproveitados: document.getElementById('validarRepeticaoJogosAproveitados').checked,
            validarUniversoJogosAproveitados: document.getElementById('validarUniversoJogosAproveitados').checked,
            jogosExistentes: [],
        };

        // Adiciona validação para o painel de bolas
        if (config.dezenasSelecionadas.length === 0) {
            throw new Error("Nenhuma dezena foi selecionada no painel. Clique nas bolas para formar seu universo de jogo.");
        }
        if (config.dezenasSelecionadas.length < config.dezenasJogadas) {
            throw new Error(`O número de dezenas selecionadas (${config.dezenasSelecionadas.length}) é menor que as dezenas por jogo (${config.dezenasJogadas}).`);
        }
        if (config.usarPesoFavoritas && config.dezenasFavoritas.length === 0) {
            throw new Error("A opção de usar peso para favoritas está marcada, mas nenhuma bola foi marcada como favorita (duplo clique).");
        }
        
        status.textContent = 'Validando configurações...';
        await new Promise(resolve => setTimeout(resolve, 0));
        validateGameConfig(config);

        if (config.aproveitaJogos) {
            const fileInput = document.getElementById('jogosExistentesFile');
            if (fileInput.files.length > 0) {
                status.textContent = 'Lendo arquivo de jogos existentes...';
                await new Promise(resolve => setTimeout(resolve, 0));
                // Não filtra por tamanho aqui, pois a lógica de desdobramento lida com isso.
                // A função `jogosJaGerados` com `expectedLength = 0` (padrão) retorna todos os jogos válidos.
                config.jogosExistentes = await jogosJaGerados(fileInput.files[0]);
                config.nomeArquivoAproveitado = fileInput.files[0].name;
            } else {
                // A validação em `validators.js` já emite um `console.warn` para este caso.
                console.warn("Checkbox 'Aproveitar Jogos Existentes' marcado, mas nenhum arquivo foi selecionado.");
            }
        }

        window.stopGenerationRequested = false; // Reseta a flag
        if (btnGerar) btnGerar.disabled = true;
        if (btnParar) {
            btnParar.disabled = false;
            btnParar.onclick = () => {
                window.stopGenerationRequested = true;
                if (status) status.textContent = "Parando geração...";
                if (btnParar) btnParar.disabled = true; // Evita múltiplos cliques
            };
        }

        status.textContent = 'Gerando jogos... (isso pode levar um tempo)';
        await new Promise(resolve => setTimeout(resolve, 0));
        const { jogos, jogosAproveitadosDescartados, jogosNovosDescartados, frequencia, jogosAproveitados, universoUtilizadoParaNovosJogos } = await gerarJogosSemAcertosGarantidosRepetidos(config);

        if (jogos.length === 0) {
            // Se não gerou jogos, não mostra o botão de relatório
            if (!window.stopGenerationRequested) status.textContent = 'Nenhum jogo foi gerado. Verifique as configurações e tente novamente.';
            loader.style.display = 'none';
            status.classList.add('error');
            return;
        }

        const endTime = performance.now();

        status.textContent = 'Formatando jogos para download...';
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Encontra o jogo com o maior número de dezenas para definir o cabeçalho do Excel
        const maxDezenasNoResultado = Math.max(config.dezenasJogadas, ...jogos.map(j => j.length));

        const dadosJogos = [
            [...Array.from({length: maxDezenasNoResultado}, (_, i) => `Dezena ${i + 1}`)]
        ].concat(jogos.map(jogo => {
            const jogoOrdenado = [...jogo].sort((a,b) => a - b);
            // Preenche com strings vazias para alinhar as colunas se o jogo for mais curto
            return [...jogoOrdenado, ...Array(Math.max(0, maxDezenasNoResultado - jogoOrdenado.length)).fill('')];
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dadosJogos);
        
        // Formatar células como número com dois dígitos (ex: 01, 02, ...)
        for (let r = 1; r < dadosJogos.length; r++) { // Começa da linha 1 (dados)
            for (let c = 0; c < maxDezenasNoResultado; c++) { // Itera por todas as colunas possíveis
                const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                if (ws[cellRef] && ws[cellRef].v !== undefined && ws[cellRef].v !== null && ws[cellRef].v !== '') {
                    ws[cellRef].t = 'n'; // Define o tipo da célula como número
                    ws[cellRef].z = '00'; // Define o formato do número
                }
            }
        }
        ws['!cols'] = Array(maxDezenasNoResultado).fill({ wch: 10 });
        XLSX.utils.book_append_sheet(wb, ws, 'Jogos Gerados');
        
        // Preparar e exibir relatório
        const tabelaCustos = GAME_COSTS[tipoJogo] || {};
        let custoJogosAproveitados = 0;
        let custoJogosNovos = 0;

        jogos.forEach((jogo, index) => {
            const custoJogo = tabelaCustos[jogo.length] || 0;
            if (index < jogosAproveitados) {
                custoJogosAproveitados += custoJogo;
            } else {
                custoJogosNovos += custoJogo;
            }
        });
        const custoTotal = custoJogosAproveitados + custoJogosNovos;

        const totalDezenasSorteadas = jogos.length * config.dezenasJogadas;

        const dezenasDosJogosAproveitadosSet = new Set();
        if (config.aproveitaJogos && jogosAproveitados > 0) {
            // Usa os jogos que foram efetivamente aproveitados (os primeiros 'jogosAproveitados' em 'jogos')
            jogos.slice(0, jogosAproveitados).forEach(jogo => {
                jogo.forEach(dezena => dezenasDosJogosAproveitadosSet.add(dezena));
            });
        }
        const dezenasDosJogosAproveitadosList = Array.from(dezenasDosJogosAproveitadosSet).sort((a, b) => a - b);

        const reportData = {
            jogosSolicitados: config.quantidadeJogos,
            jogosGerados: jogos.length,
            jogosAproveitados: jogosAproveitados,
            jogosDescartados: jogosAproveitadosDescartados + jogosNovosDescartados,
            jogosAproveitadosDescartados: jogosAproveitadosDescartados,
            jogosNovosDescartados: jogosNovosDescartados,
            jogosNovos: jogos.length - jogosAproveitados,
            tempoGeracao: ((endTime - startTime) / 1000).toFixed(2),
            parametros: {
                tipoJogo: tipoJogo.charAt(0).toUpperCase() + tipoJogo.slice(1),
                universo: config.qtdBolasSelecionadas,
                dezenasJogadas: config.dezenasJogadas,
                acertosGarantidos: config.acertosGarantidos,
                dezenasSimples: defaults.dezenasJogadas,
                algoritmo: algoritmoDisplay,
                timeout: config.maxTime,
                usouPeso: config.usarPesoFavoritas,
                peso: config.pesoFavoritas,
                favoritas: config.dezenasFavoritas,
                aproveitouJogos: config.aproveitaJogos,
                nomeArquivoAproveitado: config.nomeArquivoAproveitado || '',
                totalJogosNoArquivo: config.jogosExistentes.length,
                jogosAproveitadosInfo: {
                    dezenas: dezenasDosJogosAproveitadosList
                },
                universoNovosJogos: universoUtilizadoParaNovosJogos,
                selecaoUsuario: { dezenas: config.dezenasSelecionadas },
                forcouUniversoAproveitados: config.forcarUniversoJogosAproveitados,
                validouRepeticaoAproveitados: config.validarRepeticaoJogosAproveitados,
                validouUniversoAproveitados: config.validarUniversoJogosAproveitados,
                interrompido: window.stopGenerationRequested,
            },
            custoTotal: custoTotal,
            custoJogosAproveitados: custoJogosAproveitados,
            custoJogosNovos: custoJogosNovos,
            jogosEquivalentes: jogos.reduce((acc, jogo) => {
                // Se o jogo tem mais dezenas que o mínimo, calcula o desdobramento
                if (jogo.length > defaults.dezenasJogadas) {
                    return acc + combinations(jogo, defaults.dezenasJogadas).length;
                }
                return acc + 1;
            }, 0),
            frequenciaBolas: config.dezenasSelecionadas.map(bola => {
                const abs = frequencia[bola] || 0;
                return {
                    bola: bola,
                    abs: abs,
                    rel: totalDezenasSorteadas > 0 ? (abs / totalDezenasSorteadas) * 100 : 0
                };
            }).sort((a, b) => b.abs - a.abs) // Ordena pela frequência absoluta
        };
        window.currentGeneratedGames = jogos; // Salva os jogos para o novo PDF

        // Adicionar aba de relatório ao workbook do Excel
        const params = reportData.parametros;
        const reportSheetData = [
            ['Relatório de Geração de Jogos - LotoPro'],
            [],
            ['Estatísticas Gerais', 'Valor'],
            ['Jogos Solicitados', reportData.jogosSolicitados],
            ['Jogos Aproveitados', reportData.jogosAproveitados],
            ['Novos Jogos Gerados', reportData.jogosNovos],
            ['Total de Jogos', reportData.jogosGerados],
            ['Descartados (Aproveitados)', reportData.jogosAproveitadosDescartados],
            ['Descartados (Novos)', reportData.jogosNovosDescartados],
            ['Total Descartados', reportData.jogosDescartados],
            [`Jogos simples de ${params.dezenasSimples} dezenas`, reportData.jogosEquivalentes],
            ['Custo Total Estimado', reportData.custoTotal],
            ['Tempo de Geração (s)', reportData.tempoGeracao],
            [],
            ['Parâmetros Utilizados', 'Configuração'],
            ['Tipo de Jogo', params.tipoJogo],
            ['Universo de Bolas (Seleção do Usuário)', params.universo],
            ['Dezenas por Jogo', params.dezenasJogadas],
            ['Acertos Garantidos', params.acertosGarantidos],
            ['Algoritmo', params.algoritmo],
        ];
        if (config.algoritmo === 'aleatorio') {
            reportSheetData.push(['Timeout (s)', params.timeout]);
            reportSheetData.push(['Peso Favoritas', params.usouPeso ? `${params.peso}x` : 'Não']);
            if (params.favoritas.length > 0) { reportSheetData.push(['Bolas Favoritas', params.favoritas.join(', ')]); }
        }
        reportSheetData.push(['Aproveitou Jogos', params.aproveitouJogos ? 'Sim' : 'Não']);
        if (params.aproveitouJogos) {
            reportSheetData.push(['Validou Repetição (Aproveitados)', params.validouRepeticaoAproveitados ? 'Sim' : 'Não']);
            reportSheetData.push(['Validou Universo (Aproveitados)', params.validouUniversoAproveitados ? 'Sim' : 'Não']);
            reportSheetData.push(['Forçou usar universo dos jogos aproveitados', params.forcouUniversoAproveitados ? 'Sim' : 'Não']);
            if (params.jogosAproveitadosInfo.dezenas.length > 0) {
                reportSheetData.push(['Bolas contidas nos jogos aproveitados', params.jogosAproveitadosInfo.dezenas.join(', ')]);
            }
        }
        if (params.interrompido) { reportSheetData.push(['Status', 'Interrompido pelo usuário']); }

        reportSheetData.push([]);
        reportSheetData.push(['Universo para Novos Jogos', `Utilizado: ${params.universoNovosJogos.tipo === 'selecao_usuario' ? 'Seleção do Usuário' : 'Bolas dos Jogos Aproveitados'}`]);
        reportSheetData.push(['Bolas do Universo Utilizado', params.universoNovosJogos.dezenas.join(', ')]);

        const wsReport = XLSX.utils.aoa_to_sheet(reportSheetData);
        wsReport['!cols'] = [{ wch: 35 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsReport, 'Relatório de Geração');

        // Adicionar aba de Frequência de Bolas
        const frequenciaSheetData = [
            ['Frequência das Bolas'],
            [],
            ['Bola', 'Frequência Absoluta', 'Frequência Relativa (%)']
        ];
        reportData.frequenciaBolas.sort((a, b) => a.bola - b.bola).forEach(item => {
            frequenciaSheetData.push([item.bola, item.abs, item.rel.toFixed(2).replace('.', ',')]);
        });
        const wsFrequencia = XLSX.utils.aoa_to_sheet(frequenciaSheetData);
        wsFrequencia['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsFrequencia, 'Frequência das Bolas');

        const nomeArquivo = `${jogos.length} jogos de ${config.dezenasJogadas} dezenas com ${config.qtdBolasSelecionadas} de ${config.totalBolas} bolas sem repetir ${config.acertosGarantidos} dez.xlsx`;

        showGenerationReport(reportData, wb, nomeArquivo);

        // Armazena dados do último relatório para poder reabri-lo
        // showGenerationReport já armazena reportData em window.currentReportData
        window.lastWorkbook = wb;
        window.lastFilename = nomeArquivo;

        // Exibe o botão para reabrir o relatório
        if (btnShowLastReport) {
            btnShowLastReport.style.display = 'block';
        }

        if (!window.stopGenerationRequested) {
            status.textContent = `Concluído! Relatório de geração disponível.`;
        } else {
            status.textContent = `Geração interrompida: ${jogos.length} jogos gerados! O download deve iniciar em breve.`;
        }
    } catch (error) {
        console.error('Erro ao gerar jogos:', error);
        alert('Erro: ' + error.message);
        status.textContent = 'Erro: ' + error.message; // Mantém a mensagem no modal também
        status.classList.add('error');
    } finally {
        if (progressModal) progressModal.style.display = 'none'; // Esconde o modal ao finalizar
        if (btnGerar) btnGerar.disabled = false;
        if (btnParar) {
            btnParar.onclick = null; // Limpa o handler
        }
    }
}

export { generateGames };