import { combinations } from './utils.js';
import { parseBrazilianNumber } from './validators.js';
import { PRIZE_DEFAULTS } from './constants.js';

/**
 * Processa arquivos de jogos e gera relatório de análise.
 */
async function processFiles() {
    const status = document.getElementById('status-analise');
    const progress = document.getElementById('progress-analise');
    const loader = document.getElementById('loader-analise');
    status.textContent = 'Processando...';
    status.classList.remove('error');
    progress.textContent = 'Iniciando...';
    loader.style.display = 'block';

    try {
        console.log('Coletando tipo de jogo...');
        const tipoJogo = document.getElementById('gameTypeGlobal').value; // Corrigido para usar o ID global
        const arquivoUsuario = document.getElementById('userFileAnalise').files[0];

        if (!arquivoUsuario) {
            throw new Error('Por favor, selecione o arquivo dos seus jogos.');
        }

        console.log('Carregando arquivo histórico...');
        const nomeArquivoHistorico = tipoJogo === 'quina' ? 'jogos_quina_passados.xlsx' :
            (tipoJogo === 'lotofacil' ? 'jogos_lotofacil_passados.xlsx' : 'jogos_megasena_passados.xlsx');
        const numerosEsperados = tipoJogo === 'quina' ? 5 : (tipoJogo === 'lotofacil' ? 15 : 6);

        let respostaHistorico;
        try {
            respostaHistorico = await fetch(nomeArquivoHistorico);
            if (!respostaHistorico.ok) {
                throw new Error(`Arquivo histórico "${nomeArquivoHistorico}" não encontrado. Verifique se ele está na raiz do projeto.`);
            }
        } catch (error) {
            throw new Error(`Erro ao carregar "${nomeArquivoHistorico}". Certifique-se de que o arquivo está na mesma pasta do index.html.`);
        }

        console.log('Lendo arquivos...');
        progress.textContent = 'Lendo arquivos...';
        const dadosUsuario = await arquivoUsuario.arrayBuffer();
        const dadosHistorico = await respostaHistorico.arrayBuffer();
        
        const planilhaUsuario = XLSX.read(dadosUsuario, { type: 'array' });
        const planilhaHistorico = XLSX.read(dadosHistorico, { type: 'array' });
        
        const folhaUsuario = planilhaUsuario.Sheets[planilhaUsuario.SheetNames[0]];
        const folhaHistorico = planilhaHistorico.Sheets[planilhaHistorico.SheetNames[0]];
        
        console.log('Processando jogos do usuário...');
        progress.textContent = 'Processando jogos do usuário...';
        let jogosUsuario = XLSX.utils.sheet_to_json(folhaUsuario, { header: 1, defval: null });
        let resultadosHistoricos = XLSX.utils.sheet_to_json(folhaHistorico, { header: 1, defval: null });

        const maxBalls = tipoJogo === 'quina' ? 80 : (tipoJogo === 'lotofacil' ? 25 : 60);
        jogosUsuario = jogosUsuario.map(row => 
            row.filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBalls).map(Number)
        ).filter(row => row.length > 0);


        resultadosHistoricos = resultadosHistoricos.map(row => 
            row.filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBalls).map(Number)
        ).filter(row => row.length === numerosEsperados);


        if (jogosUsuario.length === 0) {
            throw new Error('Nenhum jogo válido encontrado no arquivo de jogos do usuário.');
        }
        if (resultadosHistoricos.length === 0) {
            throw new Error(`Nenhum sorteio válido encontrado em ${nomeArquivoHistorico}. Verifique o formato e o conteúdo do arquivo.`);
        }

        console.log('Expandindo jogos do usuário...');
        progress.textContent = 'Expandindo jogos do usuário (se necessário)...';
        let jogosUsuarioExpandidos = [];
        let temJogosExpandidos = false;
        let indiceAtual = 1;
        jogosUsuario.forEach(jogoOriginal => {
            const numeros = jogoOriginal.map(Number); 
            if (numeros.length > numerosEsperados) {
                temJogosExpandidos = true;
                const combinacoes = combinations(numeros, numerosEsperados);
                combinacoes.forEach(combinacao => {
                    jogosUsuarioExpandidos.push([indiceAtual++, ...combinacao.sort((a,b) => a - b)]);
                });
            } else if (numeros.length === numerosEsperados) {
                 jogosUsuarioExpandidos.push([indiceAtual++, ...numeros.sort((a,b) => a - b)]);
            } else {
                console.warn(`Jogo [${numeros.join(',')}] com ${numeros.length} dezenas ignorado pois o esperado são ${numerosEsperados}.`);
            }
        });

        if (jogosUsuarioExpandidos.length === 0) {
            throw new Error('Nenhum jogo válido para análise após expansão/filtragem.');
        }

        // Coletar todas as dezenas únicas dos jogos do usuário (após expansão)
        const todasDezenasUnicasUsuario = new Set();
        jogosUsuarioExpandidos.forEach(jogoComIndice => {
            const dezenasDoJogo = jogoComIndice.slice(1); // Pega só as dezenas
            dezenasDoJogo.forEach(dezena => todasDezenasUnicasUsuario.add(dezena));
        });
        const arrayDezenasUnicasUsuario = Array.from(todasDezenasUnicasUsuario).sort((a, b) => a - b);
        const stringDezenasUnicasUsuario = arrayDezenasUnicasUsuario.map(d => String(d).padStart(2, '0')).join(', ');

        const resultadosHistoricosComIndice = resultadosHistoricos.map((resultado, indice) => [indice + 1, ...resultado]);

        console.log('Coletando valores de prêmios...');
        const premios = {
            megasena: {
                quadra: parseBrazilianNumber(document.getElementById('megasenaQuadraAnalise').value) || PRIZE_DEFAULTS.megasena.quadra,
                quina: parseBrazilianNumber(document.getElementById('megasenaQuinaAnalise').value) || PRIZE_DEFAULTS.megasena.quina,
                sena: parseBrazilianNumber(document.getElementById('megasenaSenaAnalise').value) || PRIZE_DEFAULTS.megasena.sena
            },
            quina: {
                duque: parseBrazilianNumber(document.getElementById('quinaDuqueAnalise').value) || PRIZE_DEFAULTS.quina.duque,
                terno: parseBrazilianNumber(document.getElementById('quinaTernoAnalise').value) || PRIZE_DEFAULTS.quina.terno,
                quadra: parseBrazilianNumber(document.getElementById('quinaQuadraAnalise').value) || PRIZE_DEFAULTS.quina.quadra,
                quina: parseBrazilianNumber(document.getElementById('quinaQuinaAnalise').value) || PRIZE_DEFAULTS.quina.quina
            },
            lotofacil: {
                onze: parseBrazilianNumber(document.getElementById('lotofacilOnzeAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.onze,
                doze: parseBrazilianNumber(document.getElementById('lotofacilDozeAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.doze,
                treze: parseBrazilianNumber(document.getElementById('lotofacilTrezeAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.treze,
                quatorze: parseBrazilianNumber(document.getElementById('lotofacilQuatorzeAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.quatorze,
                quinze: parseBrazilianNumber(document.getElementById('lotofacilQuinzeAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.quinze
            }
        };
        // Lê o custo da aposta do input correspondente
        const custoAposta = tipoJogo === 'quina' ?
            (parseBrazilianNumber(document.getElementById('quinaCustoApostaAnalise').value) || PRIZE_DEFAULTS.quina.custoAposta) :
            (tipoJogo === 'lotofacil' ?
                (parseBrazilianNumber(document.getElementById('lotofacilCustoApostaAnalise')?.value) || PRIZE_DEFAULTS.lotofacil.custoAposta) :
                (parseBrazilianNumber(document.getElementById('megasenaCustoApostaAnalise').value) || PRIZE_DEFAULTS.megasena.custoAposta)
            );

        console.log('Calculando resultados...');
        progress.textContent = 'Calculando resultados...';
        const resultados = [];
        let totalDuques = 0, totalTernos = 0, totalQuadras = 0, totalQuinas = 0, totalSenas = 0, totalOnzes = 0, totalDozes = 0, totalTrezes = 0, totalQuatorzes = 0, totalQuinzes = 0;
        let totalJogosSemDuques = 0, totalJogosSemTernos = 0, totalJogosSemQuadras = 0, totalJogosSemQuinas = 0, totalJogosSemSenas = 0, totalJogosSemOnzes = 0, totalJogosSemDozes = 0, totalJogosSemTrezes = 0, totalJogosSemQuatorzes = 0, totalJogosSemQuinzes = 0; // Para Quina e Mega-Sena (Quadras)
        let totalPremio = 0, totalPremioSemMaximo = 0;
        let minimoDuques = Infinity, maximoDuques = 0;
        let minimoTernos = Infinity, maximoTernos = 0;
        let minimoQuadras = Infinity, maximoQuadras = 0;
        let minimoQuinas = Infinity, maximoQuinas = 0;
        let minimoSenas = Infinity, maximoSenas = 0; // Para Mega-Sena
        let minimoOnzes = Infinity, maximoOnzes = 0;
        let minimoDozes = Infinity, maximoDozes = 0;
        let minimoTrezes = Infinity, maximoTrezes = 0;
        let minimoQuatorzes = Infinity, maximoQuatorzes = 0;
        let minimoQuinzes = Infinity, maximoQuinzes = 0;
        

        // Para a nova planilha de Frequência de Prêmios
        const frequenciaPremiosPorSorteio = { duque: {}, terno: {}, quadra: {}, quina: {}, sena: {}, onze: {}, doze: {}, treze: {}, quatorze: {}, quinze: {} };

        resultadosHistoricosComIndice.forEach((jogoHistorico, indiceLoop) => {
            if (indiceLoop > 0 && indiceLoop % 100 === 0) { 
                 progress.textContent = `Analisando sorteio ${indiceLoop + 1} de ${resultadosHistoricosComIndice.length}...`;
            }
            const numerosHistoricos = new Set(jogoHistorico.slice(1).map(Number).filter(num => !isNaN(num)));
            
            // Contadores de prêmios para ESTE sorteio histórico
            let premiosDuqueNesteSorteio = 0, premiosTernoNesteSorteio = 0, premiosQuadraNesteSorteio = 0, premiosQuinaNesteSorteio = 0, premiosSenaNesteSorteio = 0;

            // --- INÍCIO DA CORREÇÃO PARA LOTOFÁCIL ---
            let premiosOnzeNesteSorteio = 0, premiosDozeNesteSorteio = 0, premiosTrezeNesteSorteio = 0, premiosQuatorzeNesteSorteio = 0, premiosQuinzeNesteSorteio = 0;
            // --- FIM DA CORREÇÃO PARA LOTOFÁCIL ---

            // Contadores para estatísticas gerais (mínimo/máximo de acertos considerando sub-prêmios)
            let acertosDuqueConsiderandoSubPremios = 0;
            let acertosTernoConsiderandoSubPremios = 0;
            let acertosQuadraConsiderandoSubPremios = 0;
            let acertosQuinaConsiderandoSubPremios = 0; // Para Mega-Sena
            let acertosSenaConsiderandoSubPremios = 0; // Para Mega-Sena
            let acertosOnzeConsiderandoSubPremios = 0; // Para Lotofácil
            let acertosDozeConsiderandoSubPremios = 0; // Para Lotofácil
            let acertosTrezeConsiderandoSubPremios = 0; // Para Lotofácil
            let acertosQuatorzeConsiderandoSubPremios = 0; // Para Lotofácil
            let acertosQuinzeConsiderandoSubPremios = 0; // Para Lotofácil
            

            jogosUsuarioExpandidos.forEach(jogoDoUsuario => {
                const numerosJogoDoUsuario = jogoDoUsuario.slice(1).map(Number);
                const acertosCount = numerosJogoDoUsuario.filter(num => numerosHistoricos.has(num)).length;

                if (tipoJogo === 'quina') {
                    if (acertosCount === 2) premiosDuqueNesteSorteio++;
                    else if (acertosCount === 3) premiosTernoNesteSorteio++;
                    else if (acertosCount === 4) premiosQuadraNesteSorteio++;
                    else if (acertosCount === 5) premiosQuinaNesteSorteio++;
                    
                    if (acertosCount === 2) acertosDuqueConsiderandoSubPremios++;
                    if (acertosCount === 3) acertosTernoConsiderandoSubPremios++;
                    if (acertosCount === 4) acertosQuadraConsiderandoSubPremios++;
                    if (acertosCount === 5) acertosQuinaConsiderandoSubPremios++;

                } else if (tipoJogo === 'lotofacil') {
                    if (acertosCount === 11) premiosOnzeNesteSorteio++;
                    else if (acertosCount === 12) premiosDozeNesteSorteio++;
                    else if (acertosCount === 13) premiosTrezeNesteSorteio++;
                    else if (acertosCount === 14) premiosQuatorzeNesteSorteio++;
                    else if (acertosCount === 15) premiosQuinzeNesteSorteio++;

                    if (acertosCount === 11) acertosOnzeConsiderandoSubPremios++;
                    if (acertosCount === 12) acertosDozeConsiderandoSubPremios++;
                    if (acertosCount === 13) acertosTrezeConsiderandoSubPremios++;
                    if (acertosCount === 14) acertosQuatorzeConsiderandoSubPremios++;
                    if (acertosCount === 15) acertosQuinzeConsiderandoSubPremios++;

                } else { // Mega-Sena
                    if (acertosCount === 4) premiosQuadraNesteSorteio++;
                    else if (acertosCount === 5) premiosQuinaNesteSorteio++;
                    else if (acertosCount === 6) premiosSenaNesteSorteio++;

                    if (acertosCount === 4) acertosQuadraConsiderandoSubPremios++;
                    if (acertosCount === 5) acertosQuinaConsiderandoSubPremios++;
                }
            });

            // Registrar frequência de prêmios para a nova planilha
            if (tipoJogo === 'quina') {
                frequenciaPremiosPorSorteio.duque[premiosDuqueNesteSorteio] = (frequenciaPremiosPorSorteio.duque[premiosDuqueNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.terno[premiosTernoNesteSorteio] = (frequenciaPremiosPorSorteio.terno[premiosTernoNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.quadra[premiosQuadraNesteSorteio] = (frequenciaPremiosPorSorteio.quadra[premiosQuadraNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.quina[premiosQuinaNesteSorteio] = (frequenciaPremiosPorSorteio.quina[premiosQuinaNesteSorteio] || 0) + 1;
            } else if (tipoJogo === 'lotofacil') {
                frequenciaPremiosPorSorteio.onze[premiosOnzeNesteSorteio] = (frequenciaPremiosPorSorteio.onze[premiosOnzeNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.doze[premiosDozeNesteSorteio] = (frequenciaPremiosPorSorteio.doze[premiosDozeNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.treze[premiosTrezeNesteSorteio] = (frequenciaPremiosPorSorteio.treze[premiosTrezeNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.quatorze[premiosQuatorzeNesteSorteio] = (frequenciaPremiosPorSorteio.quatorze[premiosQuatorzeNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.quinze[premiosQuinzeNesteSorteio] = (frequenciaPremiosPorSorteio.quinze[premiosQuinzeNesteSorteio] || 0) + 1;
            } else { // Mega-Sena
                frequenciaPremiosPorSorteio.quadra[premiosQuadraNesteSorteio] = (frequenciaPremiosPorSorteio.quadra[premiosQuadraNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.quina[premiosQuinaNesteSorteio] = (frequenciaPremiosPorSorteio.quina[premiosQuinaNesteSorteio] || 0) + 1;
                frequenciaPremiosPorSorteio.sena[premiosSenaNesteSorteio] = (frequenciaPremiosPorSorteio.sena[premiosSenaNesteSorteio] || 0) + 1;
            }

            let premioTotalNesteSorteio = 0, premioSemMaximoNesteSorteio = 0;
            if (tipoJogo === 'quina') {
                premioTotalNesteSorteio = (premiosDuqueNesteSorteio * premios.quina.duque) + 
                                         (premiosTernoNesteSorteio * premios.quina.terno) + 
                                         (premiosQuadraNesteSorteio * premios.quina.quadra) + 
                                         (premiosQuinaNesteSorteio * premios.quina.quina);
                premioSemMaximoNesteSorteio = (premiosDuqueNesteSorteio * premios.quina.duque) + 
                                             (premiosTernoNesteSorteio * premios.quina.terno) + 
                                             (premiosQuadraNesteSorteio * premios.quina.quadra);
            } else if (tipoJogo === 'lotofacil') {
                // Corrigido: soma todos os prêmios de 11 a 15 acertos
                premioTotalNesteSorteio =
                    (premiosOnzeNesteSorteio * premios.lotofacil.onze) +
                    (premiosDozeNesteSorteio * premios.lotofacil.doze) +
                    (premiosTrezeNesteSorteio * premios.lotofacil.treze) +
                    (premiosQuatorzeNesteSorteio * premios.lotofacil.quatorze) +
                    (premiosQuinzeNesteSorteio * premios.lotofacil.quinze);
                premioSemMaximoNesteSorteio =
                    (premiosOnzeNesteSorteio * premios.lotofacil.onze) +
                    (premiosDozeNesteSorteio * premios.lotofacil.doze) +
                    (premiosTrezeNesteSorteio * premios.lotofacil.treze) +
                    (premiosQuatorzeNesteSorteio * premios.lotofacil.quatorze);
            } else { // Mega-Sena
                premioTotalNesteSorteio = (premiosQuadraNesteSorteio * premios.megasena.quadra) + 
                                         (premiosQuinaNesteSorteio * premios.megasena.quina) + 
                                         (premiosSenaNesteSorteio * premios.megasena.sena);
                premioSemMaximoNesteSorteio = (premiosQuadraNesteSorteio * premios.megasena.quadra) +
                                             (premiosQuinaNesteSorteio * premios.megasena.quina);
            }

            // --- INÍCIO DA CORREÇÃO PARA LOTOFÁCIL ---
            if (tipoJogo === 'lotofacil') {
                totalOnzes += premiosOnzeNesteSorteio;
                totalDozes += premiosDozeNesteSorteio;
                totalTrezes += premiosTrezeNesteSorteio;
                totalQuatorzes += premiosQuatorzeNesteSorteio;
                totalQuinzes += premiosQuinzeNesteSorteio;
            } else {
                totalDuques += premiosDuqueNesteSorteio;
                totalTernos += premiosTernoNesteSorteio;
                totalQuadras += premiosQuadraNesteSorteio;
                totalQuinas += premiosQuinaNesteSorteio;
                totalSenas += premiosSenaNesteSorteio;
            }
            // --- FIM DA CORREÇÃO PARA LOTOFÁCIL ---

            totalPremio += premioTotalNesteSorteio;
            totalPremioSemMaximo += premioSemMaximoNesteSorteio;

            if (tipoJogo === 'quina') {
                minimoDuques = Math.min(minimoDuques, acertosDuqueConsiderandoSubPremios);
                maximoDuques = Math.max(maximoDuques, acertosDuqueConsiderandoSubPremios);
                minimoTernos = Math.min(minimoTernos, acertosTernoConsiderandoSubPremios);
                maximoTernos = Math.max(maximoTernos, acertosTernoConsiderandoSubPremios);
                minimoQuadras = Math.min(minimoQuadras, acertosQuadraConsiderandoSubPremios);
                maximoQuadras = Math.max(maximoQuadras, acertosQuadraConsiderandoSubPremios);

                if (acertosDuqueConsiderandoSubPremios === 0) totalJogosSemDuques++;
                if (acertosTernoConsiderandoSubPremios === 0) totalJogosSemTernos++;
                if (acertosQuadraConsiderandoSubPremios === 0) totalJogosSemQuadras++;
            } else if (tipoJogo === 'lotofacil') {
                minimoOnzes = Math.min(minimoOnzes, acertosOnzeConsiderandoSubPremios);
                maximoOnzes = Math.max(maximoOnzes, acertosOnzeConsiderandoSubPremios);
                minimoDozes = Math.min(minimoDozes, acertosDozeConsiderandoSubPremios);
                maximoDozes = Math.max(maximoDozes, acertosDozeConsiderandoSubPremios);
                minimoTrezes = Math.min(minimoTrezes, acertosTrezeConsiderandoSubPremios);
                maximoTrezes = Math.max(maximoTrezes, acertosTrezeConsiderandoSubPremios);
                minimoQuatorzes = Math.min(minimoQuatorzes, acertosQuatorzeConsiderandoSubPremios);
                maximoQuatorzes = Math.max(maximoQuatorzes, acertosQuatorzeConsiderandoSubPremios);
                minimoQuinzes = Math.min(minimoQuinzes, acertosQuinzeConsiderandoSubPremios);
                maximoQuinzes = Math.max(maximoQuinzes, acertosQuinzeConsiderandoSubPremios);

                if (acertosOnzeConsiderandoSubPremios === 0) totalJogosSemOnzes++;
                if (acertosDozeConsiderandoSubPremios === 0) totalJogosSemDozes++;
                if (acertosTrezeConsiderandoSubPremios === 0) totalJogosSemTrezes++;
                if (acertosQuatorzeConsiderandoSubPremios === 0) totalJogosSemQuatorzes++;
                if (acertosQuinzeConsiderandoSubPremios === 0) totalJogosSemQuinzes++;
            } else { // Mega-Sena
                minimoQuadras = Math.min(minimoQuadras, acertosQuadraConsiderandoSubPremios);
                maximoQuadras = Math.max(maximoQuadras, acertosQuadraConsiderandoSubPremios);
                minimoQuinas = Math.min(minimoQuinas, acertosQuinaConsiderandoSubPremios); 
                maximoQuinas = Math.max(maximoQuinas, acertosQuinaConsiderandoSubPremios); 
                if (acertosQuadraConsiderandoSubPremios === 0) totalJogosSemQuadras++;
            }

            if (tipoJogo === 'quina') {
                resultados.push([
                    jogoHistorico[0], // Concurso
                    premiosDuqueNesteSorteio, premiosTernoNesteSorteio, premiosQuadraNesteSorteio, premiosQuinaNesteSorteio,
                    premioTotalNesteSorteio
                ]);
            } else if (tipoJogo === 'lotofacil') {
                // Corrigido: adiciona prêmios de 11 a 15 acertos
                resultados.push([
                    jogoHistorico[0], // Concurso
                    premiosOnzeNesteSorteio, premiosDozeNesteSorteio, premiosTrezeNesteSorteio, premiosQuatorzeNesteSorteio, premiosQuinzeNesteSorteio,
                    premioTotalNesteSorteio
                ]);
            } else { // Mega-Sena
                resultados.push([
                    jogoHistorico[0], // Concurso
                    premiosQuadraNesteSorteio, premiosQuinaNesteSorteio, premiosSenaNesteSorteio,
                    premioTotalNesteSorteio
                ]);
            }
        });

        // Contadores para as faixas de percentual de prêmio vs custo
        const faixasCusto = {
            abaixo10: 0,
            entre10e20: 0,
            entre20e30: 0,
            entre30e40: 0,
            entre40e50: 0,
            entre50e60: 0,
            entre60e70: 0,
            entre70e80: 0,
            entre80e90: 0,
            entre90e100: 0,
            acima100: 0,
        };
        // Analisando repetições de agrupamentos internos nos jogos do usuário
        // Este bloco foi movido para cima para que frequenciaAgrupamentosInternos seja inicializado
        // antes de ser usado para calcular totalDuquesRepetidosUser, etc.
        console.log('Analisando repetições internas nos jogos do usuário...');
        progress.textContent = 'Analisando repetições internas...';
        const frequenciaAgrupamentosInternos = {
            duques: {},
            ternos: {},
            quadras: {},
            quinas: {},
            senas: {}, // Para Mega-Sena
            onzes: {}, // Para Lotofácil
            dozes: {}, // Para Lotofácil
            trezes: {}, // Para Lotofácil
            quatorzes: {}, // Para Lotofácil
            quinzes: {}  // Para Lotofácil
        };

        jogosUsuarioExpandidos.forEach(jogoComIndice => {
            const dezenasDoJogo = jogoComIndice.slice(1); // Remove o índice, já estão ordenadas

            const processarAgrupamentoInterno = (groupSize, groupTypeKey) => {
                if (dezenasDoJogo.length >= groupSize) {
                    const combos = combinations(dezenasDoJogo, groupSize); // dezenasDoJogo is already sorted
                    combos.forEach(combo => { // combo também estará ordenado
                        const comboKey = JSON.stringify(combo);
                        frequenciaAgrupamentosInternos[groupTypeKey][comboKey] = (frequenciaAgrupamentosInternos[groupTypeKey][comboKey] || 0) + 1;
                    });
                }
            };
            if (tipoJogo === 'quina') {
                processarAgrupamentoInterno(2, 'duques'); // Process 2-number groups (duques)
                processarAgrupamentoInterno(3, 'ternos'); // Process 3-number groups (ternos)
                processarAgrupamentoInterno(4, 'quadras'); // Process 4-number groups (quadras)
                processarAgrupamentoInterno(5, 'quinas');  // Process 5-number groups (quinas)
            } else if (tipoJogo === 'megasena') { // Mega-Sena
                processarAgrupamentoInterno(3, 'ternos'); // Process 3-number groups (ternos)
                processarAgrupamentoInterno(4, 'quadras'); // Process 4-number groups (quadras)
                processarAgrupamentoInterno(5, 'quinas');  // Process 5-number groups (quinas)
                processarAgrupamentoInterno(6, 'senas'); // Process 6-number groups (penas) - Mega-Sena
            } else { // Loto-Fácil
                processarAgrupamentoInterno(11, 'onzes'); // Lotofácil
                processarAgrupamentoInterno(12, 'dozes'); // Lotofácil
                processarAgrupamentoInterno(13, 'trezes'); // Lotofácil
                processarAgrupamentoInterno(14, 'quatorzes'); // Lotofácil
                processarAgrupamentoInterno(15, 'quinzes'); // Lotofácil
            };
        });


        console.log('Calculando estatísticas...');
        progress.textContent = 'Calculando estatísticas finais...';
        const numeroJogosHistoricos = resultadosHistoricosComIndice.length;
        const numeroApostasUsuario = jogosUsuarioExpandidos.length;

        const mediaPremioPorSorteio = numeroJogosHistoricos > 0 ? totalPremio / numeroJogosHistoricos : 0;
        const mediaPremioSemMaximoPorSorteio = numeroJogosHistoricos > 0 ? totalPremioSemMaximo / numeroJogosHistoricos : 0;
        const custoTotalDasApostasPorSorteio = numeroApostasUsuario * custoAposta;

        // Calcular distribuição de prêmios vs custo
        if (custoTotalDasApostasPorSorteio > 0 && numeroJogosHistoricos > 0) {
            resultados.forEach(resultadoSorteio => { // 'resultados' já contém o premioTotalNesteSorteio
                const premioNesteSorteio = resultadoSorteio[resultadoSorteio.length -1]; // Última coluna é o prêmio total
                const ratio = premioNesteSorteio / custoTotalDasApostasPorSorteio;

                if (ratio < 0.1) faixasCusto.abaixo10++;
                else if (ratio < 0.2) faixasCusto.entre10e20++;
                else if (ratio < 0.3) faixasCusto.entre20e30++;
                else if (ratio < 0.4) faixasCusto.entre30e40++;
                else if (ratio < 0.5) faixasCusto.entre40e50++;
                else if (ratio < 0.6) faixasCusto.entre50e60++;
                else if (ratio < 0.7) faixasCusto.entre60e70++;
                else if (ratio < 0.8) faixasCusto.entre70e80++;
                else if (ratio < 0.9) faixasCusto.entre80e90++;
                else if (ratio < 1.0) faixasCusto.entre90e100++;
                else faixasCusto.acima100++;
            });
        }
        const percFaixa = (count) => numeroJogosHistoricos > 0 ? count / numeroJogosHistoricos : 0;



        // ROI Corrigido: (Média de Prêmio por Sorteio) / (Custo Total das Apostas do Usuário por Sorteio)
        const roiTotal = custoTotalDasApostasPorSorteio > 0 ? mediaPremioPorSorteio / custoTotalDasApostasPorSorteio : 0;
        const roiSemMaximo = custoTotalDasApostasPorSorteio > 0 ? mediaPremioSemMaximoPorSorteio / custoTotalDasApostasPorSorteio : 0;
        
        const mediaDuques = numeroJogosHistoricos > 0 ? totalDuques / numeroJogosHistoricos : 0;
        const mediaTernos = numeroJogosHistoricos > 0 ? totalTernos / numeroJogosHistoricos : 0;
        const mediaQuadras = numeroJogosHistoricos > 0 ? totalQuadras / numeroJogosHistoricos : 0;
        const mediaQuinas = numeroJogosHistoricos > 0 ? totalQuinas / numeroJogosHistoricos : 0;
        const mediaSenas = numeroJogosHistoricos > 0 ? totalSenas / numeroJogosHistoricos : 0;
        const mediaOnzes = numeroJogosHistoricos > 0 ? totalOnzes / numeroJogosHistoricos : 0;
        const mediaDozes = numeroJogosHistoricos > 0 ? totalDozes / numeroJogosHistoricos : 0;
        const mediaTrezes = numeroJogosHistoricos > 0 ? totalTrezes / numeroJogosHistoricos : 0;
        const mediaQuatorzes = numeroJogosHistoricos > 0 ? totalQuatorzes / numeroJogosHistoricos : 0;
        const mediaQuinzes = numeroJogosHistoricos > 0 ? totalQuinzes / numeroJogosHistoricos : 0;


        // Calcular totais de agrupamentos repetidos no jogo do usuário
        let totalDuquesRepetidosUser = 0;
        let totalTernosRepetidosUser = 0;
        let totalQuadrasRepetidasUser = 0;
        let totalQuinasRepetidasUser = 0;
        let totalSenasRepetidasUser = 0; // Para Mega-Sena
        let totalOnzesRepetidasUser = 0;
        let totalDozesRepetidasUser = 0;
        let totalTrezesRepetidasUser = 0;
        let totalQuatorzesRepetidasUser = 0;
        let totalQuinzesRepetidasUser = 0;
        

        for (const key in frequenciaAgrupamentosInternos.duques) {
            if (frequenciaAgrupamentosInternos.duques[key] > 1) totalDuquesRepetidosUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.ternos) {
            if (frequenciaAgrupamentosInternos.ternos[key] > 1) totalTernosRepetidosUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quadras) {
            if (frequenciaAgrupamentosInternos.quadras[key] > 1) totalQuadrasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quinas) {
            if (frequenciaAgrupamentosInternos.quinas[key] > 1) totalQuinasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.senas) {
            if (frequenciaAgrupamentosInternos.senas[key] > 1) totalSenasRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.onzes) {
            if (frequenciaAgrupamentosInternos.onzes[key] > 1) totalOnzesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.dozes) {
            if (frequenciaAgrupamentosInternos.dozes[key] > 1) totalDozesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.trezes) {
            if (frequenciaAgrupamentosInternos.trezes[key] > 1) totalTrezesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quatorzes) {
            if (frequenciaAgrupamentosInternos.quatorzes[key] > 1) totalQuatorzesRepetidasUser++;
        }
        for (const key in frequenciaAgrupamentosInternos.quinzes) {
            if (frequenciaAgrupamentosInternos.quinzes[key] > 1) totalQuinzesRepetidasUser++;
        }

        let dadosResumo = [];
        if (tipoJogo === 'quina') {
            dadosResumo = [
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoAposta],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de Duque por Sorteio', mediaDuques],
                ['Média de Prêmios de Terno por Sorteio', mediaTernos],
                ['Média de Prêmios de Quadra por Sorteio', mediaQuadras],
                ['Média de Prêmios de Quina por Sorteio', mediaQuinas],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem Quina)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem Quina %)', roiSemMaximo],
                ['Mínimo de Acertos de Duque em um Sorteio', minimoDuques === Infinity ? 0 : minimoDuques],
                ['Máximo de Acertos de Duque em um Sorteio', maximoDuques],
                ['Mínimo de Acertos de Terno em um Sorteio', minimoTernos === Infinity ? 0 : minimoTernos],
                ['Máximo de Acertos de Terno em um Sorteio', maximoTernos],
                ['Mínimo de Acertos de Quadra em um Sorteio', minimoQuadras === Infinity ? 0 : minimoQuadras],
                ['Máximo de Acertos de Quadra em um Sorteio', maximoQuadras],
                ['Sorteios sem Nenhum Acerto de Duque', totalJogosSemDuques],
                ['Sorteios sem Nenhum Acerto de Terno', totalJogosSemTernos],
                ['Sorteios sem Nenhum Acerto de Quadra', totalJogosSemQuadras],
                ['Total de Duques Distintos Repetidos (nos seus jogos)', totalDuquesRepetidosUser],
                ['Total de Ternos Distintos Repetidos (nos seus jogos)', totalTernosRepetidosUser],
                ['Total de Quadras Distintas Repetidas (nos seus jogos)', totalQuadrasRepetidasUser],
                ['Total de Quinas Distintas Repetidas (nos seus jogos)', totalQuinasRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        } else if (tipoJogo === 'lotofacil') {
            dadosResumo = [
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoAposta],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de 11 Acertos por Sorteio', mediaOnzes],
                ['Média de Prêmios de 12 Acertos por Sorteio', mediaDozes],
                ['Média de Prêmios de 13 Acertos por Sorteio', mediaTrezes],
                ['Média de Prêmios de 14 Acertos por Sorteio', mediaQuatorzes],
                ['Média de Prêmios de 15 Acertos por Sorteio', mediaQuinzes],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem 15 Acertos)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem 15 Acertos %)', roiSemMaximo],
                ['Mínimo de Acertos de 11 em um Sorteio', minimoOnzes === Infinity ? 0 : minimoOnzes],
                ['Máximo de Acertos de 11 em um Sorteio', maximoOnzes],
                ['Mínimo de Acertos de 12 em um Sorteio', minimoDozes === Infinity ? 0 : minimoDozes],
                ['Máximo de Acertos de 12 em um Sorteio', maximoDozes],
                ['Mínimo de Acertos de 13 em um Sorteio', minimoTrezes === Infinity ? 0 : minimoTrezes],
                ['Máximo de Acertos de 13 em um Sorteio', maximoTrezes],
                ['Mínimo de Acertos de 14 em um Sorteio', minimoQuatorzes === Infinity ? 0 : minimoQuatorzes],
                ['Máximo de Acertos de 14 em um Sorteio', maximoQuatorzes],
                ['Mínimo de Acertos de 15 em um Sorteio', minimoQuinzes === Infinity ? 0 : minimoQuinzes],
                ['Máximo de Acertos de 15 em um Sorteio', maximoQuinzes],
                ['Sorteios sem Nenhum Acerto de 11', totalJogosSemOnzes],
                ['Sorteios sem Nenhum Acerto de 12', totalJogosSemDozes],
                ['Sorteios sem Nenhum Acerto de 13', totalJogosSemTrezes],
                ['Sorteios sem Nenhum Acerto de 14', totalJogosSemQuatorzes],
                ['Sorteios sem Nenhum Acerto de 15', totalJogosSemQuinzes],
                ['Total de Onzes Distintos Repetidos (nos seus jogos)', totalOnzesRepetidasUser],
                ['Total de Dozes Distintos Repetidos (nos seus jogos)', totalDozesRepetidasUser],
                ['Total de Trezes Distintos Repetidos (nos seus jogos)', totalTrezesRepetidasUser],
                ['Total de Quatorzes Distintos Repetidos (nos seus jogos)', totalQuatorzesRepetidasUser],
                ['Total de Quinzes Distintos Repetidos (nos seus jogos)', totalQuinzesRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        } else { // Mega-Sena
            dadosResumo = [
                ['Descrição', 'Valor'],
                ['Quantidade dos Meus Jogos (Simples)', numeroApostasUsuario],
                ['Quantidade de Sorteios Históricos Analisados', numeroJogosHistoricos],
                ['Custo Total das Minhas Apostas (por sorteio)', custoTotalDasApostasPorSorteio],
                ['Custo de uma Aposta Simples', custoAposta],
                ['Bolas Utilizadas nos Meus Jogos (após expansão)', stringDezenasUnicasUsuario],
                ['Média de Prêmios de Quadra por Sorteio', mediaQuadras],
                ['Média de Prêmios de Quina por Sorteio', mediaQuinas],
                ['Média de Prêmios de Sena por Sorteio', mediaSenas],
                ['Média de Valor Total de Prêmio por Sorteio', mediaPremioPorSorteio],
                ['Média de Valor Total de Prêmio por Sorteio (Sem Sena)', mediaPremioSemMaximoPorSorteio],
                ['Retorno Sobre Investimento (ROI Total %)', roiTotal],
                ['Retorno Sobre Investimento (ROI Sem Sena %)', roiSemMaximo],
                ['Mínimo de Acertos de Quadra em um Sorteio', minimoQuadras === Infinity ? 0 : minimoQuadras],
                ['Máximo de Acertos de Quadra em um Sorteio', maximoQuadras],
                ['Mínimo de Acertos de Quina em um Sorteio', minimoQuinas === Infinity ? 0 : minimoQuinas],
                ['Máximo de Acertos de Quina em um Sorteio', maximoQuinas],
                ['Sorteios sem Nenhum Acerto de Quadra', totalJogosSemQuadras],
                // Para Mega-Sena, faz sentido mostrar apenas a partir de Quadras repetidas, mas podemos manter a estrutura
                ['Total de Quadras Distintas Repetidas (nos seus jogos)', totalQuadrasRepetidasUser],
                ['Total de Quinas Distintas Repetidas (nos seus jogos)', totalQuinasRepetidasUser],
                ['% Sorteios com Prêmio < 10% do Custo', percFaixa(faixasCusto.abaixo10)],
                ['% Sorteios com Prêmio entre 10%-20% do Custo', percFaixa(faixasCusto.entre10e20)],
                ['% Sorteios com Prêmio entre 20%-30% do Custo', percFaixa(faixasCusto.entre20e30)],
                ['% Sorteios com Prêmio entre 30%-40% do Custo', percFaixa(faixasCusto.entre30e40)],
                ['% Sorteios com Prêmio entre 40%-50% do Custo', percFaixa(faixasCusto.entre40e50)],
                ['% Sorteios com Prêmio entre 50%-60% do Custo', percFaixa(faixasCusto.entre50e60)],
                ['% Sorteios com Prêmio entre 60%-70% do Custo', percFaixa(faixasCusto.entre60e70)],
                ['% Sorteios com Prêmio entre 70%-80% do Custo', percFaixa(faixasCusto.entre70e80)],
                ['% Sorteios com Prêmio entre 80%-90% do Custo', percFaixa(faixasCusto.entre80e90)],
                ['% Sorteios com Prêmio entre 90%-100% do Custo', percFaixa(faixasCusto.entre90e100)],
                ['% Sorteios com Prêmio >= 100% do Custo', percFaixa(faixasCusto.acima100)],
            ];
        }

        // Criação do workbook (deixe apenas UMA vez, ANTES de qualquer uso de XLSX.utils.book_append_sheet)
        const wb = XLSX.utils.book_new();

        // Criação da planilha de Resumo
        const planilhaResumo = XLSX.utils.aoa_to_sheet(dadosResumo);
        planilhaResumo['!cols'] = [{ wch: 50 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, planilhaResumo, 'Resumo');

        console.log('Gerando planilhas...');
        progress.textContent = 'Gerando arquivo Excel...';
        let dadosDetalhado = [];
        if (tipoJogo === 'quina') {
            dadosDetalhado = [
                ['Sorteio Histórico', 'Prêmios de Duque', 'Prêmios de Terno', 'Prêmios de Quadra', 'Prêmios de Quina', 'Valor Total de Prêmio no Sorteio']
            ].concat(resultados);
        } else if (tipoJogo === 'lotofacil') {
            dadosDetalhado = [
                ['Sorteio Histórico', 'Prêmios de 11 Acertos', 'Prêmios de 12 Acertos', 'Prêmios de 13 Acertos', 'Prêmios de 14 Acertos', 'Prêmios de 15 Acertos', 'Valor Total de Prêmio no Sorteio']
            ].concat(resultados);
        } else { // Mega-Sena
            dadosDetalhado = [
                ['Sorteio Histórico', 'Prêmios de Quadra', 'Prêmios de Quina', 'Prêmios de Sena', 'Valor Total de Prêmio no Sorteio']
            ].concat(resultados);
        }

        // CORREÇÃO: criar a planilha antes de formatar as células
        const planilhaDetalhado = XLSX.utils.aoa_to_sheet(dadosDetalhado);

        // Remova esta linha duplicada (NÃO declare novamente o wb!):
        // const wb = XLSX.utils.book_new();

        // Corrige o índice da coluna de prêmio para Lotofácil
        const premioColIndex = tipoJogo === 'quina' ? 5 : (tipoJogo === 'lotofacil' ? 6 : 4); 
        for (let r = 1; r < dadosDetalhado.length; r++) { 
            for (let c = 0; c < dadosDetalhado[0].length; c++) { 
                const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                if (!planilhaDetalhado[cellRef] || planilhaDetalhado[cellRef].v === undefined || planilhaDetalhado[cellRef].v === null) continue;
                
                planilhaDetalhado[cellRef].t = 'n'; // Todos os dados aqui são numéricos
                if (c === premioColIndex) {
                    planilhaDetalhado[cellRef].z = 'R$ #,##0.00'; 
                } else if (c > 0) { 
                    planilhaDetalhado[cellRef].z = '#,##0';
                } else { // Coluna do Sorteio Histórico (Concurso)
                    planilhaDetalhado[cellRef].z = '0'; 
                }
            }
        }
        planilhaDetalhado['!cols'] = (tipoJogo === 'quina' ? 
            [{wch: 15}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 25}] :
            (tipoJogo === 'lotofacil' ?
                [{wch: 15}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 25}] :
                [{wch: 15}, {wch: 18}, {wch: 18}, {wch: 18}, {wch: 25}] 
            )
        );
        XLSX.utils.book_append_sheet(wb, planilhaDetalhado, 'Prêmios por Sorteio');

        // Remova esta linha duplicada (NÃO declare novamente o wb!):
        // const wb = XLSX.utils.book_new();

        // Adicione esta linha para definir dadosOriginais antes de usá-lo:
        const maxDezenasOriginais = Math.max(0, ...jogosUsuario.map(jogo => jogo.length));
        const dadosOriginais = [
            ['Índice Original', ...Array.from({length: maxDezenasOriginais}, (_, i) => `Dezena ${i + 1}`)]
        ].concat(jogosUsuario.map((jogo, indice) => {
            const dezenasOrdenadas = [...jogo].sort((a, b) => a - b);
            return [indice + 1, ...dezenasOrdenadas, ...Array(Math.max(0, maxDezenasOriginais - dezenasOrdenadas.length)).fill('')];
        }));

        const planilhaOriginais = XLSX.utils.aoa_to_sheet(dadosOriginais);
        if (dadosOriginais.length > 1 && dadosOriginais[0].length > 1) {
            for (let r = 1; r < dadosOriginais.length; r++) {
                for (let c = 1; c < dadosOriginais[0].length; c++) {
                    const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                    if (planilhaOriginais[cellRef] && planilhaOriginais[cellRef].v !== '' && planilhaOriginais[cellRef].v !== null) {
                        planilhaOriginais[cellRef].t = 'n';
                        planilhaOriginais[cellRef].z = '00';
                    }
                }
            }
        }
        planilhaOriginais['!cols'] = [{wch:15}, ...Array(maxDezenasOriginais).fill({ wch: 10 })];
        XLSX.utils.book_append_sheet(wb, planilhaOriginais, 'Meus Jogos Originais');

        if (temJogosExpandidos) {
            const dadosModificados = [
                ['Índice Expandido', ...Array.from({length: numerosEsperados}, (_, i) => `Dezena ${i + 1}`)]
            ].concat(jogosUsuarioExpandidos.map(jogo => {
                const [indice, ...dezenas] = jogo;
                return [indice, ...dezenas.sort((a,b) => a - b)];
            }));
            const planilhaModificados = XLSX.utils.aoa_to_sheet(dadosModificados);
             for (let r = 1; r < dadosModificados.length; r++) {
                for (let c = 1; c < dadosModificados[0].length; c++) { 
                    const cellRef = XLSX.utils.encode_cell({r: r, c: c});
                     if (planilhaModificados[cellRef] && planilhaModificados[cellRef].v !== '' && planilhaModificados[cellRef].v !== null) {
                        planilhaModificados[cellRef].t = 'n';
                        planilhaModificados[cellRef].z = '00';
                    }
                }
            }
            planilhaModificados['!cols'] = [{wch:15}, ...Array(numerosEsperados).fill({ wch: 10 })];
            XLSX.utils.book_append_sheet(wb, planilhaModificados, 'Meus Jogos Expandidos');
        }

        // Nova Planilha: Frequência de Prêmios por Sorteio
        const dadosFrequencia = [];
        dadosFrequencia.push(['Análise de Frequência de Prêmios por Sorteio']); // Título Geral
        dadosFrequencia.push([]); // Linha em branco

        const processarFrequenciaTipo = (tipoNomeAmigavel, freqObj, nomeChaveFrequencia) => {
            if (Object.keys(freqObj).length === 0 && !(freqObj[0] > 0) ) { // Se não houve prêmios OU se não há contagem para 0 prêmios
                 // Verificar se existe a chave "0" com contagem, pois ela é válida (0 prêmios daquele tipo)
                let temContagemParaZero = false;
                if (frequenciaPremiosPorSorteio[nomeChaveFrequencia] && frequenciaPremiosPorSorteio[nomeChaveFrequencia][0] !== undefined) {
                    temContagemParaZero = true;
                }
                if (!temContagemParaZero && Object.keys(frequenciaPremiosPorSorteio[nomeChaveFrequencia]).length === 0) {
                    return; // Pula se realmente não há dados para este tipo de prêmio
                }
            }

            dadosFrequencia.push([`Frequência de Prêmios de ${tipoNomeAmigavel}`]);
            dadosFrequencia.push([`Número Exato de Prêmios de ${tipoNomeAmigavel} Obtidos em um Sorteio`, 'Quantidade de Sorteios']);
            
            const chavesOrdenadas = Object.keys(frequenciaPremiosPorSorteio[nomeChaveFrequencia]).map(Number).sort((a, b) => a - b);
            
            // Garante que o "0" apareça se não estiver presente mas deveria (todos os sorteios)
            if (!chavesOrdenadas.includes(0) && numeroJogosHistoricos > 0) {
                let totalSorteiosComAlgumPremioDesseTipo = 0;
                chavesOrdenadas.forEach(key => {
                    if (key > 0) {
                        totalSorteiosComAlgumPremioDesseTipo += frequenciaPremiosPorSorteio[nomeChaveFrequencia][key];
                    }
                });
                 // Só adiciona o 0 se a contagem para 0 explícita não existir e o total de sorteios for maior que os sorteios com prêmios
                if (frequenciaPremiosPorSorteio[nomeChaveFrequencia][0] === undefined && numeroJogosHistoricos > totalSorteiosComAlgumPremioDesseTipo) {
                    dadosFrequencia.push([0, numeroJogosHistoricos - totalSorteiosComAlgumPremioDesseTipo]);
                }
            }

            for (const numPremios of chavesOrdenadas) {
                dadosFrequencia.push([numPremios, frequenciaPremiosPorSorteio[nomeChaveFrequencia][numPremios]]);
            }
            dadosFrequencia.push([]); // Linha em branco para separar seções
        };

        if (tipoJogo === 'quina') {
            processarFrequenciaTipo('Duque', frequenciaPremiosPorSorteio.duque, 'duque');
            processarFrequenciaTipo('Terno', frequenciaPremiosPorSorteio.terno, 'terno');
            processarFrequenciaTipo('Quadra', frequenciaPremiosPorSorteio.quadra, 'quadra');
            processarFrequenciaTipo('Quina (Prêmio Máximo)', frequenciaPremiosPorSorteio.quina, 'quina');
        } else if (tipoJogo === 'lotofacil') {
            processarFrequenciaTipo('11 Acertos', frequenciaPremiosPorSorteio.onze, 'onze');
            processarFrequenciaTipo('12 Acertos', frequenciaPremiosPorSorteio.doze, 'doze');
            processarFrequenciaTipo('13 Acertos', frequenciaPremiosPorSorteio.treze, 'treze');
            processarFrequenciaTipo('14 Acertos', frequenciaPremiosPorSorteio.quatorze, 'quatorze');
            processarFrequenciaTipo('15 Acertos (Prêmio Máximo)', frequenciaPremiosPorSorteio.quinze, 'quinze');

        } else { // Mega-Sena
            processarFrequenciaTipo('Quadra', frequenciaPremiosPorSorteio.quadra, 'quadra');
            processarFrequenciaTipo('Quina', frequenciaPremiosPorSorteio.quina, 'quina');
            processarFrequenciaTipo('Sena (Prêmio Máximo)', frequenciaPremiosPorSorteio.sena, 'sena');
        }
        
        if (dadosFrequencia.length > 2) { 
            const planilhaFrequencia = XLSX.utils.aoa_to_sheet(dadosFrequencia);
            // Formatação da planilha de frequência
            for (let r = 0; r < dadosFrequencia.length; r++) {
                const linhaAtual = dadosFrequencia[r];
                if (linhaAtual.length === 2 && typeof linhaAtual[0] === 'number' && typeof linhaAtual[1] === 'number') { // Linhas de dados [numPremios, qtdSorteios]
                    const cellA = XLSX.utils.encode_cell({r: r, c: 0});
                    const cellB = XLSX.utils.encode_cell({r: r, c: 1});
                    if(planilhaFrequencia[cellA]) { planilhaFrequencia[cellA].t = 'n'; planilhaFrequencia[cellA].z = '#,##0'; }
                    if(planilhaFrequencia[cellB]) { planilhaFrequencia[cellB].t = 'n'; planilhaFrequencia[cellB].z = '#,##0'; }
                } else if (linhaAtual.length === 1 && r > 0) { // Títulos de seção (ex: "Frequência de Prêmios de Duque")
                    // Pode adicionar formatação de negrito ou mesclagem aqui se desejar
                    // Exemplo de mesclagem:
                    // if (!planilhaFrequencia['!merges']) planilhaFrequencia['!merges'] = [];
                    // planilhaFrequencia['!merges'].push({ s: { r: r, c: 0 }, e: { r: r, c: 1 } }); // Mescla A e B
                }
            }
            planilhaFrequencia['!cols'] = [{ wch: 50 }, { wch: 20 }]; // Ajustar larguras
            XLSX.utils.book_append_sheet(wb, planilhaFrequencia, 'Frequência de Prêmios');
        }

        // Criação da Planilha "Repetidos no Meu Jogo" (usa frequenciaAgrupamentosInternos já populado)
        const dadosRepetidosInternos = [['Tipo de Agrupamento', 'Dezenas', 'Quantidade de Repetições']];
        const addRepetidosParaTipo = (tipoNomeAmigavel, freqMap) => {
            for (const comboKey in freqMap) {
                if (freqMap[comboKey] > 1) { // Apenas os repetidos
                    const dezenasArray = JSON.parse(comboKey);
                    const dezenasStr = dezenasArray.map(d => String(d).padStart(2, '0')).join(', ');
                    dadosRepetidosInternos.push([tipoNomeAmigavel, dezenasStr, freqMap[comboKey]]);
                }
            }
        };
        addRepetidosParaTipo('Duque', frequenciaAgrupamentosInternos.duques);
        addRepetidosParaTipo('Terno', frequenciaAgrupamentosInternos.ternos);
        addRepetidosParaTipo('Quadra', frequenciaAgrupamentosInternos.quadras);
        addRepetidosParaTipo('Quina', frequenciaAgrupamentosInternos.quinas);
        addRepetidosParaTipo('Sena', frequenciaAgrupamentosInternos.senas);
        addRepetidosParaTipo('Onze', frequenciaAgrupamentosInternos.onzes);
        addRepetidosParaTipo('Doze', frequenciaAgrupamentosInternos.dozes);
        addRepetidosParaTipo('Treze', frequenciaAgrupamentosInternos.trezes);
        addRepetidosParaTipo('Quatorze', frequenciaAgrupamentosInternos.quatorzes);
        addRepetidosParaTipo('Quinze', frequenciaAgrupamentosInternos.quinzes);

        if (dadosRepetidosInternos.length > 1) {
            const planilhaRepetidosInternos = XLSX.utils.aoa_to_sheet(dadosRepetidosInternos);
            for (let r = 1; r < dadosRepetidosInternos.length; r++) {
                const cellDezenas = XLSX.utils.encode_cell({r: r, c: 1});
                if (planilhaRepetidosInternos[cellDezenas]) {
                    planilhaRepetidosInternos[cellDezenas].t = 's'; // Forçar como string para manter formatação "01, 02"
                }
                const cellQuantidade = XLSX.utils.encode_cell({r: r, c: 2});
                if (planilhaRepetidosInternos[cellQuantidade]) {
                    planilhaRepetidosInternos[cellQuantidade].t = 'n';
                    planilhaRepetidosInternos[cellQuantidade].z = '#,##0';
                }
            }
            planilhaRepetidosInternos['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }];
            XLSX.utils.book_append_sheet(wb, planilhaRepetidosInternos, 'Repetidos no Meu Jogo');
        }

        console.log('Escrevendo arquivo Excel...');
        let nomeOriginalArquivoUsuario = document.getElementById('userFileAnalise').files[0].name;
        if (nomeOriginalArquivoUsuario.toLowerCase().endsWith('.xlsx')) {
            nomeOriginalArquivoUsuario = nomeOriginalArquivoUsuario.slice(0, -5);
        }
        XLSX.writeFile(wb, `Relatorio_${tipoJogo}_${nomeOriginalArquivoUsuario}.xlsx`);
        status.textContent = 'Relatório gerado com sucesso!';
        progress.textContent = '';
    } catch (error) {
        console.error('Erro ao processar arquivos:', error);
        status.textContent = 'Erro: ' + error.message;
        progress.textContent = '';
        status.classList.add('error');
    } finally {
        loader.style.display = 'none';
    }
}

export { processFiles };