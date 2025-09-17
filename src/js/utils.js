/**
 * Gera combinações de tamanho k a partir de um array.
 * @param {Array} arr - Array de entrada.
 * @param {number} k - Tamanho das combinações.
 * @returns {Array<Array<number>>} Lista de combinações.
 */
function combinations(arr, k) {
    const result = [];
    if (k < 0 || k > arr.length) return result;
    if (k === 0) { // Combinação de 0 elementos é um conjunto vazio
        result.push([]);
        return result;
    }
    if (k === arr.length) { // Combinação de todos os elementos é o próprio array
        result.push([...arr]);
        return result;
    }

    function combine(temp, start) {
        if (temp.length === k) {
            result.push([...temp]);
            return;
        }
        // Otimização: se os elementos restantes não são suficientes para formar k itens
        if ( (arr.length - start) < (k - temp.length) ) {
            return;
        }
        for (let i = start; i < arr.length; i++) {
            temp.push(arr[i]);
            combine(temp, i + 1);
            temp.pop();
        }
    }
    combine([], 0);
    return result;
}

/**
 * Realiza amostragem aleatória com pesos.
 * @param {Array} arr - Array de entrada.
 * @param {Array<number>} weights - Pesos para cada elemento. Deve ter o mesmo tamanho de arr.
 * @param {number} size - Tamanho da amostra.
 * @param {boolean} [replace=false] - Se permite reposição.
 * @returns {Array} Elementos selecionados.
 */
function randomChoice(arr, weights, size, replace = false) {    
    if (arr.length === 0 || size === 0) return [];

    // Caso 1: Amostragem simples (sem pesos)
    if (!weights) {
        const result = [];
        const arrCopy = [...arr];
        const len = arrCopy.length;
        const numToSample = Math.min(size, len);

        for (let i = 0; i < numToSample; i++) {
            const randomIndex = Math.floor(Math.random() * (replace ? len : arrCopy.length));
            const picked = replace ? arrCopy[randomIndex] : arrCopy.splice(randomIndex, 1)[0];
            result.push(picked);
        }
        return result;
    }

    // Caso 2: Amostragem com pesos
    if (arr.length !== weights.length) {
        console.error("Array e pesos devem ter o mesmo tamanho para randomChoice com pesos.");
        return randomChoice(arr, null, size, replace); // Fallback para amostragem simples
    }

    const result = [];
    const arrCopy = [...arr];
    const weightsCopy = [...weights];
    let totalWeight = weightsCopy.reduce((a, b) => a + b, 0);

    for (let i = 0; i < size; i++) {
        if (arrCopy.length === 0 || totalWeight <= 0) break;
        const r = Math.random() * totalWeight;
        let acc = 0;
        for (let j = 0; j < arrCopy.length; j++) {
            acc += weightsCopy[j];
            if (r <= acc) {
                result.push(arrCopy[j]);
                if (!replace) {
                    totalWeight -= weightsCopy[j];
                    arrCopy.splice(j, 1);
                    weightsCopy.splice(j, 1);
                }
                break; // Sai do loop interno e vai para a próxima amostragem
            }
        }
    }
    return result;
}

/**
 * Gera combinações de tamanho k a partir de um array de forma iterativa,
 * sem armazenar todas em memória. Ideal para grandes volumes de combinações.
 * @param {Array} arr - Array de entrada.
 * @param {number} k - Tamanho das combinações.
 * @returns {Generator<Array<number>>} Um gerador que produz cada combinação.
 */
function* combinationsGenerator(arr, k) {
    if (k < 0 || k > arr.length || k === 0) {
        if (k === 0) yield [];
        return;
    }

    const n = arr.length;
    const indices = Array.from({ length: k }, (_, i) => i);

    while (true) {
        yield indices.map(i => arr[i]);

        let i = k - 1;
        while (i >= 0 && indices[i] === i + n - k) {
            i--;
        }

        if (i < 0) {
            return;
        }

        indices[i]++;
        for (let j = i + 1; j < k; j++) {
            indices[j] = indices[j - 1] + 1;
        }
    }
}

/**
 * Calcula o número de combinações (n choose k) sem gerar as combinações.
 * @param {number} n - O tamanho total do conjunto.
 * @param {number} k - O tamanho do subconjunto.
 * @returns {number} O número de combinações possíveis.
 */
function combinationsCount(n, k) {
    if (k < 0 || k > n) {
        return 0;
    }
    if (k === 0 || k === n) {
        return 1;
    }
    // Otimização: C(n, k) === C(n, n-k)
    if (k > n / 2) {
        k = n - k;
    }
    let res = 1;
    for (let i = 1; i <= k; i++) {
        res = res * (n - i + 1) / i;
    }
    return Math.round(res); // Usa Math.round para lidar com imprecisões de ponto flutuante
}

/**
 * Obtém subconjuntos de tamanho k de um jogo.
 * @param {Array<number>} jogo - Jogo (array de números).
 * @param {number} k - Tamanho do subconjunto.
 * @returns {Set<string>} Conjunto de subconjuntos (como strings JSON ordenadas).
 */
function getSubconjuntos(jogo, k) {
    if (jogo.length < k || k <= 0) return new Set();
    // Garante que o jogo está ordenado antes de gerar combinações para consistência na string JSON
    const jogoOrdenado = [...jogo].sort((a, b) => a - b);
    return new Set(combinations(jogoOrdenado, k).map(c => JSON.stringify(c))); // Não precisa ordenar `c` aqui se `jogoOrdenado` já está
}

/**
 * Lê jogos de um arquivo Excel.
 * @param {File} file - Arquivo Excel.
 * @param {number} expectedLength - O número esperado de dezenas por jogo para filtrar.
 * @returns {Promise<Array<Array<number>>>} Lista de jogos (arrays de números ordenados).
 */
async function jogosJaGerados(file, expectedLength = 0) {
    try {
        const dados = await file.arrayBuffer();
        const planilha = XLSX.read(dados, { type: 'array' });
        const folha = planilha.Sheets[planilha.SheetNames[0]];
        // header: 1 para array de arrays, defval: '' para tratar células vazias
        const jogosJson = XLSX.utils.sheet_to_json(folha, { header: 1, defval: null }); 
        
        return jogosJson
            .map(row => 
                row.filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1)
                   .map(Number)
            )
            .filter(row => row.length > 0 && (expectedLength === 0 || row.length === expectedLength) ) // Filtra por tamanho se especificado
            .map(row => row.sort((a, b) => a - b));
    } catch (error) {
        console.error('Erro ao ler jogos existentes:', error);
        throw new Error('Erro ao processar o arquivo de jogos existentes. Verifique o formato.');
    }
}

/**
 * Formata um número no padrão monetário brasileiro (R$ 1.234,56).
 * @param {number} value - Valor a formatar.
 * @returns {string} Valor formatado.
 */
function formatBrazilianCurrency(value) {
    if (isNaN(value) || value === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Formata um número como percentual no padrão brasileiro (12,34%).
 * @param {number} value - Valor a formatar.
 * @returns {string} Percentual formatado.
 */
function formatBrazilianPercentage(value) {
    if (isNaN(value) || value === null) return '0,00%';
    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Atualiza o progresso da geração de jogos.
 * @param {number} jogosGerados - Quantidade de jogos gerados.
 * @param {number} totalJogosAlvo - Total de jogos a gerar.
 * @param {boolean} isAleatorio - Se está usando geração aleatória.
 * @param {number | null} [progressPercent] - Percentual de progresso para combinatória.
 * @param {string} [info] - Informação adicional (ex: combinações testadas).
 * @param {number} [tempoDecorrido] - Tempo total decorrido em segundos.
 * @param {number} [tempoRestante] - Tempo restante estimado/timeout em segundos.
 */
async function updateProgress(elementId, currentCount, totalCount, isAleatorio, progressPercent = null, info = "", countLabel = "Gerados", tempoDecorrido = 0, tempoRestante = 0) {
    const progressElement = document.getElementById(elementId);
    if (!progressElement) return;

    const formatTime = (seconds) => {
        if (seconds === Infinity) return '∞';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        if (h !== '00') {
            return `${h}:${m}:${s}`;
        }
        return `${m}:${s}`;
    };

    return new Promise(resolve => {
        requestAnimationFrame(() => {
            let html;
            if (isAleatorio) {
                const percentualGerados = totalCount > 0 ? (currentCount / totalCount) * 100 : 0;
                html = `
                    <div class="progress-bar-modern">
                        <div class="progress-fill" style="width: ${percentualGerados.toFixed(2)}%;"></div>
                        <span class="progress-label">${countLabel}: ${currentCount.toLocaleString('pt-BR')} / ${totalCount.toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="progress-details">
                        <span>${info}</span>
                        <span>Tempo: ${formatTime(tempoDecorrido)}</span>
                        <span>Restante: ~${formatTime(tempoRestante)}</span>
                    </div>
                `;
            } else {
                const percentText = progressPercent !== null ? `${progressPercent.toFixed(2)}%` : '0.00%';
                let countHtml = '';
                if (countLabel && currentCount !== null) {
                    countHtml = `<span>${countLabel}: ${currentCount.toLocaleString('pt-BR')}</span>`;
                }
                html = `
                    <div class="progress-bar-modern">
                        <div class="progress-fill" style="width: ${percentText};"></div>
                        <span class="progress-label">${percentText}</span>
                    </div>
                    <div class="progress-details">
                        <span>${info}</span>
                        ${countHtml}
                        <span>Tempo: ${formatTime(tempoDecorrido)} / ~${formatTime(tempoRestante)}</span>
                    </div>
                `;
            }
            progressElement.innerHTML = html;
            resolve();
        });
    });
}

/**
 * Calculates internal repetitions of combinations within a set of games for various group sizes.
 * @param {Array<Array<number>>} games - The list of games to analyze.
 * @param {Array<number>} groupSizes - An array of combination sizes to check for (e.g., [4, 5, 6]).
 * @returns {object} An object with counts of repeated combinations (e.g., { 4: 10, 5: 2 }).
 */
function calculateInternalRepetitions(games, groupSizes) {
    const repetitions = {};
    
    groupSizes.forEach(size => {
        const combinationCounts = {};
        let repeatedCount = 0;

        games.forEach(game => {
            if (game.length >= size) {
                // Ensure game is sorted for consistent combination keys
                const sortedGame = [...game].sort((a, b) => a - b);
                const combos = combinations(sortedGame, size);
                combos.forEach(combo => {
                    // The combo from `combinations` will be sorted if the input is sorted.
                    const key = JSON.stringify(combo);
                    combinationCounts[key] = (combinationCounts[key] || 0) + 1;
                });
            }
        });

        for (const key in combinationCounts) {
            if (combinationCounts[key] > 1) {
                repeatedCount++;
            }
        }
        
        if (repeatedCount > 0) {
            repetitions[size] = repeatedCount;
        }
    });

    return repetitions;
}

/**
 * Calculates the counts of each prize tier won for a set of user games against a single draw.
 * Handles "desdobramento" for games with more numbers than the standard.
 * @param {Array<Array<number>>} userGames - Array of user's games (can have variable lengths).
 * @param {Array<number>} drawNumbers - The numbers from a single lottery draw.
 * @param {object} gameConfig - The configuration for the game type (from GAME_ANALYSIS_CONFIG).
 * @returns {object} An object with prize keys and their counts (e.g., { quadra: 2, quina: 1 }).
 */
function calculatePrizeCountsForGames(userGames, drawNumbers, gameConfig, downgradeMaxPrize = false) {
    const prizeCounts = {};
    gameConfig.prizeTiers.forEach(tier => { prizeCounts[tier.key] = 0; });

    const drawNumbersSet = new Set(drawNumbers);

    userGames.forEach(game => {
        const userNumbers = game;
        const hitsInGame = userNumbers.filter(num => drawNumbersSet.has(num)).length;

        gameConfig.prizeTiers.forEach(tier => {
            if (hitsInGame >= tier.hits && userNumbers.length >= tier.hits) {
                const nonHitNumbersInGame = userNumbers.length - hitsInGame;
                const numbersToDrawFromNonHits = gameConfig.expectedNumbers - tier.hits;

                if (nonHitNumbersInGame >= numbersToDrawFromNonHits && numbersToDrawFromNonHits >= 0) {
                    const combinationsOfHits = combinationsCount(hitsInGame, tier.hits);
                    const combinationsOfNonHits = combinationsCount(nonHitNumbersInGame, numbersToDrawFromNonHits);
                    const totalPrizesOfThisTier = combinationsOfHits * combinationsOfNonHits;
                    
                    if (totalPrizesOfThisTier > 0) {
                        prizeCounts[tier.key] += totalPrizesOfThisTier;
                    }
                }
            }
        });
    });

    if (downgradeMaxPrize) {
        const sortedTiers = [...gameConfig.prizeTiers].sort((a, b) => a.hits - b.hits);
        if (sortedTiers.length >= 2) {
            const maxPrizeTier = sortedTiers[sortedTiers.length - 1];
            const secondMaxPrizeTier = sortedTiers[sortedTiers.length - 2];
            
            if (prizeCounts[maxPrizeTier.key] > 0) {
                // Adiciona o número de prêmios máximos ao prêmio imediatamente inferior
                prizeCounts[secondMaxPrizeTier.key] = (prizeCounts[secondMaxPrizeTier.key] || 0) + prizeCounts[maxPrizeTier.key];
                // Zera o contador do prêmio máximo
                prizeCounts[maxPrizeTier.key] = 0;
            }
        }
    }

    return prizeCounts;
}

/**
 * Calculates the total prize money for a set of user games against a single draw.
 * This function handles "desdobramento" for games with more numbers than the standard.
 * @param {Array<Array<number>>} userGames - Array of user's games (can have variable lengths).
 * @param {Array<number>} drawNumbers - The numbers from a single lottery draw.
 * @param {object} gameConfig - The configuration for the game type (from GAME_ANALYSIS_CONFIG).
 * @param {object} prizeValues - An object mapping prize keys (e.g., 'quadra') to their monetary value.
 * @returns {number} The total prize money won from all user games in this single draw.
 */
function calculatePrizesForGames(userGames, drawNumbers, gameConfig, prizeValues, downgradeMaxPrize = false) {
    const prizeCounts = calculatePrizeCountsForGames(userGames, drawNumbers, gameConfig, downgradeMaxPrize);
    let totalPrize = 0;

    for (const tierKey in prizeCounts) {
        if (prizeCounts[tierKey] > 0 && prizeValues[tierKey] !== undefined) {
            totalPrize += prizeCounts[tierKey] * prizeValues[tierKey];
        }
    }
    
    return totalPrize;
}

export { combinations, randomChoice, getSubconjuntos, jogosJaGerados, formatBrazilianCurrency, formatBrazilianPercentage, updateProgress, combinationsCount, combinationsGenerator, calculateInternalRepetitions, calculatePrizeCountsForGames, calculatePrizesForGames };