import { validateGameConfig, parseBrazilianNumber } from './validators.js';
import { updateProgress, jogosJaGerados, getSubconjuntos, combinations, randomChoice } from './utils.js';
import { GAME_DEFAULTS } from './constants.js';

// Flag global para controlar a interrupção da geração
window.stopGenerationRequested = false;

/**
 * Gera jogos sem subconjuntos repetidos para acertos garantidos.
 * @param {Object} config - Configurações do jogo.
 * @returns {Promise<Array>} Lista de jogos gerados.
 */
async function gerarJogosSemAcertosGarantidosRepetidos(config) {
    console.log('Iniciando geração de jogos com config:', config);
    const status = document.getElementById('status-geracao');
    const jogos = [];
    const combinacoesUsadas = new Set(); // Armazena strings JSON de subconjuntos de acertos garantidos
    let jogosAproveitados = 0;
    const quantidadeJogosAlvo = config.quantidadeJogos; // Renomeado para clareza
    // dezenasParaTrabalhar será definida após o processamento dos jogos existentes.
    let frequencia = new Array(config.totalBolas + 1).fill(0); // Baseado no total de bolas do globo

    // Função auxiliar para atualizar frequência e combinações usadas
    function adicionarJogoEAtualizarEstruturas(jogo) {
        jogos.push(jogo);
        const subconjuntos = getSubconjuntos(jogo, config.acertosGarantidos);
        subconjuntos.forEach(sub => combinacoesUsadas.add(sub)); // Adiciona string JSON
        jogo.forEach(num => {
            if (num >= 1 && num <= config.totalBolas) {
                frequencia[num]++;
            }
        });
    }

    // Define o universo de dezenas para validar os JOGOS EXISTENTES
    let dezenasUniversoParaValidacaoExistentes;
    if (config.bolasAleatorias && config.aproveitaJogos) {
        // Se usando bolas aleatórias E aproveitando jogos, os jogos existentes podem conter qualquer dezena válida do globo.
        // O universo para NOVOS jogos será definido pelas dezenas dos jogos efetivamente aproveitados.
        dezenasUniversoParaValidacaoExistentes = Array.from({length: config.totalBolas}, (_, i) => i + 1);
        console.log("Modo 'Bolas Aleatórias' e 'Aproveitar Jogos': Jogos existentes serão validados contra todas as bolas do globo.");
    } else {
        // Caso contrário, os jogos existentes devem estar contidos no universo definido por config.dezenasSelecionadas
        // (que pode ser um conjunto fixo ou o primeiro conjunto aleatório gerado).
        dezenasUniversoParaValidacaoExistentes = [...config.dezenasSelecionadas];
        console.log("Jogos existentes serão validados contra o universo de dezenas da configuração inicial:", dezenasUniversoParaValidacaoExistentes);
    }


    if (config.aproveitaJogos && config.jogosExistentes.length > 0) {
        console.log('Processando jogos existentes...');
        status.textContent = 'Analisando jogos existentes...';
        await new Promise(resolve => setTimeout(resolve, 0)); // Forçar atualização da UI
        for (const jogoExistente of config.jogosExistentes) {
            if (window.stopGenerationRequested) break;
            if (jogos.length >= quantidadeJogosAlvo) break;
            // Validar se o jogo existente usa apenas dezenas do universo selecionado e tem o tamanho correto
            if (jogoExistente.length === config.dezenasJogadas &&
                jogoExistente.every(dezena => dezenasUniversoParaValidacaoExistentes.includes(dezena))) {
                
                const subconjuntos = getSubconjuntos(jogoExistente, config.acertosGarantidos);
                let temIntersecao = false;
                for (const sub of subconjuntos) {
                    if (combinacoesUsadas.has(sub)) {
                        temIntersecao = true;
                        break;
                    }
                }
                if (!temIntersecao) {
                    adicionarJogoEAtualizarEstruturas(jogoExistente);
                    jogosAproveitados++;
                }
            }
        }
        console.log(`${jogosAproveitados} jogos existentes foram aproveitados.`);
        await updateProgress(jogos.length, quantidadeJogosAlvo, config.jogosSorteados, 0, `Aproveitados: ${jogosAproveitados}`);
    }

    // Define o universo de dezenas (dezenasParaTrabalhar) para a geração de NOVOS jogos.
    let dezenasParaTrabalhar;
    if (config.aproveitaJogos && jogosAproveitados > 0 && !config.forcarUniversoOriginalParaNovos) {
        const dezenasDosJogosAproveitados = new Set();
        jogos.forEach(jogo => { // 'jogos' neste ponto contém apenas os jogos aproveitados
            jogo.forEach(dezena => dezenasDosJogosAproveitados.add(dezena));
        });

        if (dezenasDosJogosAproveitados.size > 0) {
            dezenasParaTrabalhar = Array.from(dezenasDosJogosAproveitados).sort((a, b) => a - b);
            console.log(`Universo de dezenas para NOVOS jogos atualizado com base nos ${jogosAproveitados} jogos aproveitados: ${dezenasParaTrabalhar.length} dezenas. Ex: [${dezenasParaTrabalhar.slice(0,10).join(',')}${dezenasParaTrabalhar.length > 10 ? '...' : ''}]`);
        } else { // Entra aqui se jogosAproveitados > 0 mas não conseguiu extrair dezenas (improvável) OU se forcarUniversoOriginalParaNovos = true
            // Fallback improvável se jogosAproveitados > 0 mas nenhuma dezena foi extraída.
            console.warn("Não foi possível derivar dezenas dos jogos aproveitados ou foi forçado o universo original. Usando universo da configuração inicial para novos jogos.");
            dezenasParaTrabalhar = [...config.dezenasSelecionadas];
        }
    } else {
        // Nenhum jogo aproveitado, ou não se está aproveitando jogos, ou forçou o universo original. Usa o universo original.
        dezenasParaTrabalhar = [...config.dezenasSelecionadas];
        console.log(`Universo para NOVOS jogos definido pela configuração inicial: ${dezenasParaTrabalhar.length} dezenas. Ex: [${dezenasParaTrabalhar.slice(0,10).join(',')}${dezenasParaTrabalhar.length > 10 ? '...' : ''}]`);
    }

    // Validação do universo de dezenasParaTrabalhar antes de gerar novos jogos
    if (jogos.length < quantidadeJogosAlvo) { // Apenas se ainda precisamos gerar novos jogos
        if (dezenasParaTrabalhar.length < config.dezenasJogadas) {
            throw new Error(`O universo de dezenas para gerar NOVOS jogos (${dezenasParaTrabalhar.length}) é menor que as dezenas por jogo (${config.dezenasJogadas}). Não é possível gerar mais jogos.`);
        }
        if (config.acertosGarantidos > 0 && dezenasParaTrabalhar.length < config.acertosGarantidos && dezenasParaTrabalhar.length > 0) {
            console.warn(`Atenção: O universo de dezenas para NOVOS jogos (${dezenasParaTrabalhar.length}) é menor que os acertos garantidos (${config.acertosGarantidos}). Pode não ser possível garantir acertos com este universo reduzido.`);
        }
    }

    if (window.stopGenerationRequested) {
        console.log('Geração interrompida pelo usuário antes de iniciar a geração de novos jogos.');
        status.textContent = 'Geração interrompida pelo usuário.';
        return jogos; // Retorna os jogos aproveitados até agora
    }

    console.log('Gerando novos jogos...');
    status.textContent = 'Gerando novos jogos...';
    await new Promise(resolve => setTimeout(resolve, 0));
    // Preparar pesos para escolha aleatória (inverso da frequência)
    // Mapear dezenasParaTrabalhar para seus pesos
    function calcularPesos() {
        return dezenasParaTrabalhar.map(dezena => 1 / (frequencia[dezena] + 1));
    }

    if (config.jogosSorteados) { // Geração Aleatória com Pesos
        const startTime = Date.now();
        console.log(`[generate.js] Random generation started at: ${startTime}`);
        let timeOfLastFind = Date.now(); // Tempo da última vez que um jogo válido foi encontrado
        const maxTimeMs = config.maxTime * 1000;
        let iteracoes = 0;

        console.log(`[generate.js] maxTimeMs set to: ${maxTimeMs} (config.maxTime: ${config.maxTime})`);
        while (jogos.length < quantidadeJogosAlvo) {
            if (window.stopGenerationRequested) {
                console.log('Geração aleatória interrompida pelo usuário.');
                status.textContent = 'Geração interrompida pelo usuário.';
                break;
            }
            const currentTime = Date.now();
            // Verifica se o tempo desde a última descoberta excedeu o limite
            // E se maxTimeMs > 0 (0 significa sem limite de tempo de inatividade)
            if (maxTimeMs > 0 && (currentTime - timeOfLastFind) > maxTimeMs) {
                console.log(`Tempo máximo de ${config.maxTime}s sem encontrar novo jogo atingido.`);
                status.textContent = `Tempo limite de ${config.maxTime}s sem novos jogos atingido. ${jogos.length} jogos gerados.`;
                console.log(`[generate.js] Breaking due to timeout. currentTime: ${currentTime}, timeOfLastFind: ${timeOfLastFind}, elapsed since last find: ${currentTime - timeOfLastFind}ms. Total random gen time: ${currentTime - startTime}ms`);
                break;
            }
            iteracoes++;

            // Calcula pesos dinamicamente ou com menor frequência se a performance for um problema
            const pesos = calcularPesos();
            const jogoGerado = randomChoice(dezenasParaTrabalhar, pesos, config.dezenasJogadas).sort((a, b) => a - b);
            
            const subconjuntos = getSubconjuntos(jogoGerado, config.acertosGarantidos);
            let temIntersecao = false;
            for (const sub of subconjuntos) {
                if (combinacoesUsadas.has(sub)) {
                    temIntersecao = true;
                    break;
                }
            }

            if (!temIntersecao) {
                adicionarJogoEAtualizarEstruturas(jogoGerado);
                console.log(`[generate.js] Game found. Updating timeOfLastFind from ${timeOfLastFind} to ${Date.now()}. Iteration: ${iteracoes}. Games: ${jogos.length}`);
                timeOfLastFind = Date.now(); // Atualiza o tempo da última descoberta
                if (jogos.length % 10 === 0 || jogos.length === quantidadeJogosAlvo) { // Atualiza progresso com menos frequência
                     await updateProgress(jogos.length, quantidadeJogosAlvo, true, null, `Iterações: ${iteracoes}`);
                }
            }
            
            // Para evitar loop infinito se não houver mais combinações possíveis
            // Heurística: se muitas iterações sem adicionar jogo, pode ser que esgotou.
            //if (iteracoes > quantidadeJogosAlvo * 100 && jogos.length < quantidadeJogosAlvo && iteracoes > 10000) { // Limite de tentativas
            //     if ( (Date.now() - startTime) > 5000 && (iteracoes % (quantidadeJogosAlvo * 10) === 0) ){ // Se passou 5s e tentou muito
            //        console.warn("Muitas iterações sem encontrar novo jogo. Pode ter esgotado combinações válidas ou caído em um gargalo.");
            //        status.textContent = `Atenção: Dificuldade em encontrar novos jogos. ${jogos.length} gerados. Verifique configurações.`;
            //        // Poderia parar aqui ou continuar tentando com menos frequência de logs
            //     }
            //}
            // if (iteracoes > quantidadeJogosAlvo * 500 && jogos.length < quantidadeJogosAlvo && iteracoes > 500000){ // Limite mais agressivo
            //    console.error("Parando geração aleatória devido a excesso de iterações sem progresso significativo.");
            //    status.textContent = `Geração interrompida (limite de iterações). ${jogos.length} jogos gerados.`;
            //    console.log(`[generate.js] Breaking due to iteration limit. Total random gen time: ${Date.now() - startTime}ms`);
            //    break;
            // }
        }
    } else { // Geração Combinatória (Busca exaustiva ou até atingir quantidade)
        const todasCombinacoesPossiveis = combinations(dezenasParaTrabalhar, config.dezenasJogadas);
        const totalCombinacoes = todasCombinacoesPossiveis.length;
        console.log(`Total de combinações possíveis: ${totalCombinacoes}`);

        if (totalCombinacoes === 0) {
            throw new Error("Não há combinações possíveis com as dezenas fornecidas e o tamanho do jogo.");
        }
        
        // Embaralhar para não gerar sempre na mesma ordem (opcional, mas bom para "aleatoriedade" percebida)
        for (let i = todasCombinacoesPossiveis.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [todasCombinacoesPossiveis[i], todasCombinacoesPossiveis[j]] = [todasCombinacoesPossiveis[j], todasCombinacoesPossiveis[i]];
        }

        let combinacoesTestadas = 0;
        for (const jogoPotencial of todasCombinacoesPossiveis) {
            if (window.stopGenerationRequested) {
                console.log('Geração combinatória interrompida pelo usuário.');
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
                    break;
                }
            }

            if (!temIntersecao) {
                adicionarJogoEAtualizarEstruturas(jogoPotencial.sort((a,b) => a-b));
            }
            
            if (combinacoesTestadas % Math.max(1, Math.floor(totalCombinacoes / 100)) === 0 || combinacoesTestadas === totalCombinacoes) {
                const percentual = (combinacoesTestadas / totalCombinacoes) * 100;
                await updateProgress(jogos.length, quantidadeJogosAlvo, false, percentual, `Testadas: ${combinacoesTestadas}/${totalCombinacoes}`);
            }
        }
        if (jogos.length < quantidadeJogosAlvo) {
            if (!window.stopGenerationRequested) console.warn(`Não foi possível gerar ${quantidadeJogosAlvo} jogos únicos com as restrições. Gerados: ${jogos.length}`);
            status.textContent = `Atenção: Gerados ${jogos.length} de ${quantidadeJogosAlvo} solicitados. Pode ter esgotado as opções.`;
        }
    }

    console.log(`Geração concluída: ${jogos.length} jogos gerados.`);
    return jogos;
}

/**
 * Gera jogos com base nas configurações do formulário.
 */
async function generateGames() {
    const status = document.getElementById('status-geracao');
    const progress = document.getElementById('progress-geracao');
    const loader = document.getElementById('loader-geracao');
    const btnGerar = document.getElementById('btn-gerar-jogos');
    const btnParar = document.getElementById('btn-parar-geracao');

    status.textContent = 'Preparando para gerar jogos...';
    status.classList.remove('error');
    progress.textContent = ''; // Limpa progresso anterior
    loader.style.display = 'block';

    try {
        console.log('Coletando configurações do formulário...');
        const rawQuantidadeJogos = document.getElementById('quantidadeJogos').value;
        const tipoJogo = document.getElementById('gameTypeGlobal')?.value || 'quina';
        let defaults = GAME_DEFAULTS;
        if (tipoJogo === 'lotofacil' && GAME_DEFAULTS.lotofacil) {
            defaults = GAME_DEFAULTS.lotofacil;
        }
        const config = {
            totalBolas: parseInt(document.getElementById('totalBolas').value) || defaults.totalBolas,
            bolasAleatorias: document.getElementById('bolasAleatorias').checked,
            qtdBolasSelecionadas: parseInt(document.getElementById('qtdBolasAleatorias').value) || defaults.qtdBolasSelecionadas,
            dezenasSelecionadasInput: document.getElementById('dezenasSelecionadas').value,
            jogosSorteados: document.getElementById('jogosSorteados').checked,
            maxTime: parseInt(document.getElementById('maxTime').value) || defaults.maxTime,
            dezenasJogadas: parseInt(document.getElementById('dezenasJogadas').value) || defaults.dezenasJogadas,
            acertosGarantidos: parseInt(document.getElementById('acertosGarantidos').value) || defaults.acertosGarantidos,
            aproveitaJogos: document.getElementById('aproveitaJogos').checked,
            forcarUniversoOriginalParaNovos: document.getElementById('forcarUniversoOriginalParaNovos').checked,
            jogosExistentes: [],
            quantidadeJogos: parseBrazilianNumber(rawQuantidadeJogos) || defaults.quantidadeJogos
        };

        if (config.bolasAleatorias) {
            console.log('Gerando dezenas aleatórias para seleção...');
            status.textContent = 'Selecionando dezenas aleatórias...';
            await new Promise(resolve => setTimeout(resolve, 0));
            const todasDezenasDoGlobo = Array.from({length: config.totalBolas}, (_, i) => i + 1);
            
            // Embaralhar todasDezenasDoGlobo (Fisher-Yates shuffle)
            for (let i = todasDezenasDoGlobo.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [todasDezenasDoGlobo[i], todasDezenasDoGlobo[j]] = [todasDezenasDoGlobo[j], todasDezenasDoGlobo[i]];
            }
            config.dezenasSelecionadas = todasDezenasDoGlobo.slice(0, config.qtdBolasSelecionadas).sort((a, b) => a - b);
        } else {
            config.dezenasSelecionadas = config.dezenasSelecionadasInput
                .split(',')
                .map(x => parseInt(x.trim()))
                .filter(x => !isNaN(x) && Number.isInteger(x) && x >= 1 && x <= config.totalBolas)
                .sort((a,b) => a - b);
            // Remove duplicados, caso o usuário tenha digitado
            config.dezenasSelecionadas = [...new Set(config.dezenasSelecionadas)];
            config.qtdBolasSelecionadas = config.dezenasSelecionadas.length; // Atualiza com o número real de dezenas válidas fornecidas
        }
        
        console.log('Validando configurações...');
        status.textContent = 'Validando configurações...';
        await new Promise(resolve => setTimeout(resolve, 0));
        validateGameConfig(config); // validateGameConfig precisa ser robusta para as dezenasSelecionadas já processadas

        if (config.aproveitaJogos) {
            const fileInput = document.getElementById('jogosExistentesFile');
            if (fileInput.files.length > 0) {
                console.log('Lendo jogos existentes...');
                status.textContent = 'Lendo arquivo de jogos existentes...';
                await new Promise(resolve => setTimeout(resolve, 0));
                config.jogosExistentes = await jogosJaGerados(fileInput.files[0], config.dezenasJogadas);
            } else {
                // Não selecionou arquivo, mas marcou checkbox: pode ser um aviso ou apenas ignorar.
                console.warn("Checkbox 'Aproveitar Jogos Existentes' marcado, mas nenhum arquivo foi selecionado.");
            }
        }

        window.stopGenerationRequested = false; // Reseta a flag
        if (btnGerar) btnGerar.disabled = true;
        if (btnParar) {
            btnParar.style.display = 'block';
            btnParar.disabled = false;
            btnParar.onclick = () => { // Usar onclick para fácil remoção/substituição se necessário
                console.log('Botão Parar Geração clicado');
                window.stopGenerationRequested = true;
                if (status) status.textContent = "Parando geração...";
                if (btnParar) btnParar.disabled = true; // Evita múltiplos cliques
            };
        }

        console.log('Iniciando processo de geração de jogos...');
        status.textContent = 'Gerando jogos... (isso pode levar um tempo)';
        await new Promise(resolve => setTimeout(resolve, 0));
        const jogos = await gerarJogosSemAcertosGarantidosRepetidos(config);

        if (jogos.length === 0) {
            if (!window.stopGenerationRequested) status.textContent = 'Nenhum jogo foi gerado. Verifique as configurações e tente novamente.';
            progress.textContent = '';
            loader.style.display = 'none';
            status.classList.add('error');
            return;
        }

        console.log('Formatando saída para Excel...');
        status.textContent = 'Formatando jogos para download...';
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const dadosJogos = [
            [...Array.from({length: config.dezenasJogadas}, (_, i) => `Dezena ${i + 1}`)] // Cabeçalho com base em dezenasJogadas
        ].concat(jogos.map(jogo => [...jogo.sort((a,b) => a - b)])); // Garante que cada jogo está ordenado

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dadosJogos);
        
        // Formatar células como número com dois dígitos (ex: 01, 02, ...)
        for (let r = 1; r < dadosJogos.length; r++) { // Começa da linha 1 (dados)
            for (let c = 0; c < config.dezenasJogadas; c++) { // Itera pelas colunas de dezenas
                const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                if (ws[cellRef] && ws[cellRef].v !== undefined && ws[cellRef].v !== null && ws[cellRef].v !== '') {
                    ws[cellRef].t = 'n'; // Define o tipo da célula como número
                    ws[cellRef].z = '00'; // Define o formato do número
                }
            }
        }
        ws['!cols'] = Array(config.dezenasJogadas).fill({ wch: 10 });
        XLSX.utils.book_append_sheet(wb, ws, 'Jogos Gerados');
        
        const tipoJogoNome = config.dezenasJogadas === 6 ? 'MegaSena' : (config.dezenasJogadas === 5 ? 'Quina' : `Custom${config.dezenasJogadas}dz`);
        XLSX.writeFile(wb, `Jogos_${tipoJogoNome}_${jogos.length}x${config.dezenasJogadas}dz_Garant${config.acertosGarantidos}.xlsx`);

        if (!window.stopGenerationRequested) {
            status.textContent = `Concluído: ${jogos.length} jogos gerados! O download deve iniciar em breve.`;
        } else {
            status.textContent = `Geração interrompida: ${jogos.length} jogos gerados! O download deve iniciar em breve.`;
        }
        progress.textContent = '';
    } catch (error) {
        console.error('Erro ao gerar jogos:', error);
        status.textContent = 'Erro ao gerar jogos: ' + error.message;
        progress.textContent = '';
        status.classList.add('error');
    } finally {
        loader.style.display = 'none';
        if (btnGerar) btnGerar.disabled = false;
        if (btnParar) {
            btnParar.style.display = 'none';
            btnParar.onclick = null; // Limpa o handler
        }
    }
}

export { generateGames };