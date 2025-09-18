/**
 * Módulo de configurações e controles de interface
 * Contém funções para configurar e gerenciar controles da aplicação
 */

import { GAME_DEFAULTS, GAME_COSTS } from './constants.js';

/**
 * Atualiza as cotas máximas baseado no custo total dos jogos com cota mínima de R$ 5,00.
 */
export function updateCotasMaximas() {
    const gameType = document.getElementById('gameTypeGlobal')?.value || 'megasena';
    const dezenasJogadasElement = document.getElementById('dezenasJogadas');
    const quantidadeJogosElement = document.getElementById('quantidadeJogos');
    const quantidadeCotasSelect = document.getElementById('quantidadeCotas');
    
    if (!dezenasJogadasElement || !quantidadeJogosElement || !quantidadeCotasSelect) return;

    const dezenasJogadas = parseInt(dezenasJogadasElement.value) || 6;
    const quantidadeJogos = parseInt(quantidadeJogosElement.value.replace(/\D/g, '')) || 1;
    
    // Obter custo unitário da tabela de custos
    const tabelaCustos = GAME_COSTS[gameType] || {};
    const custoUnitario = tabelaCustos[dezenasJogadas] || 1;
    const custoTotal = custoUnitario * quantidadeJogos;
    
    // Calcular cotas máximas baseado na cota mínima de R$ 5,00
    const cotaMinima = 5.00;
    const maxCotas = Math.max(1, Math.floor(custoTotal / cotaMinima));
    
    // Limitar a no máximo 100 cotas
    const cotasLimitadas = Math.min(maxCotas, 100);
    
    // Limpar opções existentes
    quantidadeCotasSelect.innerHTML = '';
    
    // Adicionar opções de 1 até o máximo calculado
    for (let i = 1; i <= cotasLimitadas; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} cota${i > 1 ? 's' : ''}`;
        if (i === cotasLimitadas) option.selected = true; // Selecionar o máximo por padrão
        quantidadeCotasSelect.appendChild(option);
    }
    
    // Atualizar cotas compradas após atualizar máximas
    updateCotasCompradas();
}

/**
 * Atualiza as cotas compradas baseado na quantidade máxima de cotas disponíveis.
 */
export function updateCotasCompradas() {
    const quantidadeCotasSelect = document.getElementById('quantidadeCotas');
    const cotasCompradasSelect = document.getElementById('cotasCompradas');
    
    if (!quantidadeCotasSelect || !cotasCompradasSelect) return;

    const cotasMax = parseInt(quantidadeCotasSelect.value) || 1;
    const cotasCompradasAtual = parseInt(cotasCompradasSelect.value) || 1;
    
    // Limpar opções existentes
    cotasCompradasSelect.innerHTML = '';
    
    // Adicionar opções de 1 até cotasMax
    for (let i = 1; i <= cotasMax; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} cota${i > 1 ? 's' : ''}`;
        
        // Manter seleção anterior se ainda válida, senão selecionar o máximo
        if (i === Math.min(cotasCompradasAtual, cotasMax)) {
            option.selected = true;
        } else if (i === cotasMax && cotasCompradasAtual > cotasMax) {
            option.selected = true;
        }
        
        cotasCompradasSelect.appendChild(option);
    }

    // Atualizar exibições de custo
    atualizarExibicoesCusto();
}

/**
 * Atualiza as exibições de custo baseado nas configurações de cotas.
 */
export function atualizarExibicoesCusto() {
    const gameType = document.getElementById('gameTypeGlobal')?.value || 'megasena';
    const calcularCotasCheckbox = document.getElementById('calcularCotas');
    const quantidadeCotasSelect = document.getElementById('quantidadeCotas');
    const cotasCompradasSelect = document.getElementById('cotasCompradas');
    const taxaCheckbox = document.getElementById('pago35Caixa');
    
    if (!calcularCotasCheckbox || !quantidadeCotasSelect || !cotasCompradasSelect || !taxaCheckbox) return;

    const ativo = calcularCotasCheckbox.checked;
    const cotasMax = parseInt(quantidadeCotasSelect.value) || 1;
    const cotasCompradas = parseInt(cotasCompradasSelect.value) || 1;
    const pago35 = taxaCheckbox.checked;

    // Encontrar todas as exibições de custo e atualizar
    document.querySelectorAll('[data-custo-base]').forEach(element => {
        const custoBase = parseFloat(element.dataset.custoBase) || 0;
        
        if (!ativo || cotasMax === 1) {
            // Sem cotas ou apenas 1 cota = custo normal
            let custoFinal = custoBase;
            if (ativo && pago35) custoFinal *= 1.35;
            element.textContent = `R$ ${custoFinal.toFixed(2)}`;
        } else {
            // Com cotas
            const proporcao = cotasCompradas / cotasMax;
            let custoFinal = custoBase * proporcao;
            if (pago35) custoFinal *= 1.35;
            element.textContent = `R$ ${custoFinal.toFixed(2)}`;
        }
    });
}

/**
 * Configura os controles de cotas.
 */
/**
 * Obtém configuração básica de geração de jogos (para formulários simples).
 */
export function getBasicGenerationConfig() {
    const tipoJogo = document.getElementById('gameTypeGlobal').value;
    const defaults = GAME_DEFAULTS[tipoJogo] || GAME_DEFAULTS.megasena;

    return {
        tipoJogo: tipoJogo,
        totalBolas: parseInt(document.getElementById('totalBolas').value) || defaults.totalBolas,
        qtdBolasSelecionadas: parseInt(document.getElementById('qtdBolasSelecionadas').value) || defaults.qtdBolasSelecionadas,
        dezenasJogadas: parseInt(document.getElementById('dezenasJogadas').value) || defaults.dezenasJogadas,
        acertosGarantidos: parseInt(document.getElementById('acertosGarantidos').value) || defaults.acertosGarantidos,
        quantidadeJogos: parseInt(document.getElementById('quantidadeJogos').value) || defaults.quantidadeJogos,
        maxTime: parseInt(document.getElementById('maxTime').value) || defaults.maxTime,
        numeroFixos: document.getElementById('numeroFixos').value.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1),
        aproveitaJogos: document.getElementById('aproveitaJogos').checked
    };
}

/**
 * Configura controles de impressão baseados no tipo de jogo.
 */
export function setupPrintControls() {
    const tipoJogo = document.getElementById('gameTypeGlobal')?.value;
    
    // Event listeners para atualização automática
    const colunasPorLinhaInput = document.getElementById('colunas-por-linha');
    const linhasPorPaginaInput = document.getElementById('linhas-por-pagina');
    
    if (colunasPorLinhaInput) {
        colunasPorLinhaInput.addEventListener('change', () => {
            // Validar valor mínimo e máximo
            const valor = parseInt(colunasPorLinhaInput.value);
            if (valor < 1) colunasPorLinhaInput.value = 1;
            if (valor > 10) colunasPorLinhaInput.value = 10;
        });
    }
    
    if (linhasPorPaginaInput) {
        linhasPorPaginaInput.addEventListener('change', () => {
            // Validar valor mínimo e máximo
            const valor = parseInt(linhasPorPaginaInput.value);
            if (valor < 1) linhasPorPaginaInput.value = 1;
            if (valor > 50) linhasPorPaginaInput.value = 50;
        });
    }

    // Controle para habilitar/desabilitar imagem de fundo no PDF
    const backgroundCheckbox = document.getElementById('pdfPrintBackgroundImage');
    const backgroundFileInput = document.getElementById('pdfBackgroundImageFile');
    
    if (backgroundCheckbox && backgroundFileInput) {
        backgroundCheckbox.addEventListener('change', function() {
            backgroundFileInput.disabled = !this.checked;
            if (!this.checked) {
                backgroundFileInput.value = '';
                const display = document.getElementById('pdfBackgroundImageFileName');
                if (display) display.textContent = '';
            }
        });
    }

    // Controle para linhas de grade
    const gridCheckbox = document.getElementById('pdfShowGridLines');
    const gridOptions = document.getElementById('grid-lines-options');
    if (gridCheckbox && gridOptions) {
        gridCheckbox.addEventListener('change', function() {
            gridOptions.style.display = this.checked ? 'block' : 'none';
        });
    }
}