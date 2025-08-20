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
    if (arr.length !== weights.length) {
        console.error("Array e pesos devem ter o mesmo tamanho para randomChoice.");
        // Fallback: escolha aleatória sem pesos se os pesos forem inválidos
        const fallbackResult = [];
        const arrCopyForFallback = [...arr];
        for (let i = 0; i < Math.min(size, arrCopyForFallback.length); i++) {
            const randomIndex = Math.floor(Math.random() * arrCopyForFallback.length);
            fallbackResult.push(arrCopyForFallback[randomIndex]);
            if(!replace) arrCopyForFallback.splice(randomIndex, 1);
        }
        return fallbackResult;
    }


    const result = [];
    const currentArr = replace ? [...arr] : arr; // Se replace=true, podemos modificar a cópia original dos pesos
    const currentWeights = [...weights];
    
    let totalWeight = currentWeights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < size; i++) {
        if (currentArr.length === 0 || totalWeight <= 0) break; // Não há mais itens ou pesos

        const r = Math.random() * totalWeight;
        let accumulatedWeight = 0;
        let chosenIndex = -1;

        for (let j = 0; j < currentArr.length; j++) {
            accumulatedWeight += currentWeights[j];
            if (r <= accumulatedWeight) {
                chosenIndex = j;
                break;
            }
        }
        
        // Fallback caso algo dê errado com a soma dos pesos (ex: NaN, pesos negativos)
        if (chosenIndex === -1 && currentArr.length > 0) {
            chosenIndex = Math.floor(Math.random() * currentArr.length);
        }


        if (chosenIndex !== -1) {
            result.push(currentArr[chosenIndex]);
            if (!replace) {
                totalWeight -= currentWeights[chosenIndex];
                // Remove o elemento escolhido de currentArr e currentWeights para evitar que seja escolhido novamente
                // Como currentArr é uma referência ao original (se !replace), precisamos ter cuidado
                // É mais seguro trabalhar com cópias se a modificação do array original não for desejada externamente.
                // Para o contexto deste app, a função generate.js cria cópias ou lida com isso.
                // Aqui, se !replace, vamos assumir que quem chama espera que os arrays sejam modificados,
                // ou que passou cópias.
                // Melhoria: Se !replace, criar cópias internas para evitar efeitos colaterais no array original.
                // Para este caso, vamos manter o comportamento de modificar a cópia, se `arr` for uma cópia.
                
                // Se `arr` e `weights` são passados como cópias para esta função, está ok.
                // Se `arr` e `weights` são os originais, isso os modificaria.
                // A implementação em generate.js usa `dezenasParaTrabalhar` (cópia) e `calcularPesos()` (nova array de pesos).
                
                // A forma mais segura se !replace seria:
                // const chosenItem = currentArr.splice(chosenIndex, 1)[0];
                // currentWeights.splice(chosenIndex, 1);
                // Mas isso modifica currentArr, que pode ser o `arr` original.
                // Para manter o `arr` original intacto, a lógica de remoção deve ser mais complexa ou
                // a função deve sempre operar sobre cópias se `replace` for `false`.
                // A implementação atual em `generate.js` já passa cópias ou arrays recalculadas,
                // então `currentArr.splice` e `currentWeights.splice` seria ok.

                // Vamos refatorar para ser mais seguro caso `arr` não seja uma cópia:
                const arrCopyInternal = replace ? [...arr] : [...arr]; // Sempre opera em cópia se !replace
                const weightsCopyInternal = [...weights];
                let totalWeightInternal = weightsCopyInternal.reduce((a, b) => a + b, 0);
                const resultInternal = [];

                for (let k_loop = 0; k_loop < size; k_loop++) {
                    if (arrCopyInternal.length === 0 || totalWeightInternal <= 0) break;
                    const r_internal = Math.random() * totalWeightInternal;
                    let acc_internal = 0;
                    let idx_internal = -1;
                    for (let j_loop = 0; j_loop < arrCopyInternal.length; j_loop++) {
                        acc_internal += weightsCopyInternal[j_loop];
                        if (r_internal <= acc_internal) {
                            idx_internal = j_loop;
                            break;
                        }
                    }
                    if (idx_internal === -1 && arrCopyInternal.length > 0) { // Fallback
                        idx_internal = Math.floor(Math.random() * arrCopyInternal.length);
                    }

                    if (idx_internal !== -1) {
                        resultInternal.push(arrCopyInternal[idx_internal]);
                        if (!replace) {
                            totalWeightInternal -= weightsCopyInternal[idx_internal];
                            arrCopyInternal.splice(idx_internal, 1);
                            weightsCopyInternal.splice(idx_internal, 1);
                        }
                    }
                }
                return resultInternal; // Retorna a versão segura
            }
        }
    }
    // Este return abaixo é para o caso de replace=true, onde o loop original faria sentido.
    // Contudo, a refatoração acima já cobre ambos os casos de forma mais segura.
    return result; 
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
 * @param {number | null} [progressPercentCombinatoria] - Percentual de progresso para combinatória.
 * @param {string} [additionalInfo=""] - Informação adicional para exibir.
 */
async function updateProgress(jogosGerados, totalJogosAlvo, isAleatorio, progressPercentCombinatoria = null, additionalInfo = "") {
    const progressElement = document.getElementById('progress-geracao');
    if (!progressElement) return;

    return new Promise(resolve => {
        // Usar requestAnimationFrame para atualizações mais suaves na UI
        requestAnimationFrame(() => {
            let message;
            if (isAleatorio) {
                message = `Gerados: ${jogosGerados} / ${totalJogosAlvo}`;
                if (additionalInfo) message += ` (${additionalInfo})`;
            } else {
                const percentText = progressPercentCombinatoria !== null ? `${progressPercentCombinatoria.toFixed(1)}%` : 'Calculando...';
                message = `Gerados: ${jogosGerados} / ${totalJogosAlvo} | Combinações: ${percentText}`;
                 if (additionalInfo) message += ` (${additionalInfo})`;
            }
            progressElement.textContent = message;
            resolve();
        });
    });
}

export { combinations, randomChoice, getSubconjuntos, jogosJaGerados, formatBrazilianCurrency, formatBrazilianPercentage, updateProgress };