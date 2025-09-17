// src/js/printPdf.js

import { parseBrazilianNumber } from './validators.js';

/**
 * Define as configurações de layout do volante para cada tipo de jogo.
 * Inclui dimensões, número de cartões por página e a função para calcular a posição de cada número.
 */
const VOLANTE_LAYOUTS = {
    quina: {
        NUM_COLS_LAYOUT: 10,
        NUM_ROWS_LAYOUT: 8,
        CARDS_PER_PAGE_PDF: 2,
        MAX_BALLS: 80,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            /**
             * Calcula a posição (x, y) de um número no volante da Quina.
             * A ordem de preenchimento é da esquerda para a direita, de cima para baixo.
             * @param {number} number - O número a ser posicionado.
             * @param {number} gameIndexOnPage - O índice do jogo na página (0, 1, etc.).
             * @param {object} config - O objeto de configuração de impressão.
             * @returns {{x: number, y: number}} As coordenadas em pontos.
             */
            const markWidthPoints = mmToPoints(config.markWidthMm);
            const markHeightPoints = mmToPoints(config.markHeightMm);
            const horizontalSpacingPoints = mmToPoints(config.horizontalSpacingMm);
            const verticalSpacingPoints = mmToPoints(config.verticalSpacingMm);
            const totalCellWidth = markWidthPoints + horizontalSpacingPoints;
            const totalCellHeight = markHeightPoints + verticalSpacingPoints;
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * totalCellHeight;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            const col = (number - 1) % this.NUM_COLS_LAYOUT;
            const row = Math.floor((number - 1) / this.NUM_COLS_LAYOUT);
            const x = mmToPoints(config.startXMm) + col * totalCellWidth;
            const y = gameGridBaseY + row * totalCellHeight;
            return { x, y };
        }
    },
    megasena: {
        NUM_COLS_LAYOUT: 10,
        NUM_ROWS_LAYOUT: 6,
        CARDS_PER_PAGE_PDF: 3,
        MAX_BALLS: 60,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            /**
             * Calcula a posição (x, y) de um número no volante da Mega-Sena.
             * A ordem de preenchimento é da esquerda para a direita, de cima para baixo.
             * @param {number} number - O número a ser posicionado.
             * @param {number} gameIndexOnPage - O índice do jogo na página.
             * @param {object} config - O objeto de configuração de impressão.
             * @returns {{x: number, y: number}} As coordenadas em pontos.
             */
            const markWidthPoints = mmToPoints(config.markWidthMm);
            const markHeightPoints = mmToPoints(config.markHeightMm);
            const horizontalSpacingPoints = mmToPoints(config.horizontalSpacingMm);
            const verticalSpacingPoints = mmToPoints(config.verticalSpacingMm);
            const totalCellWidth = markWidthPoints + horizontalSpacingPoints;
            const totalCellHeight = markHeightPoints + verticalSpacingPoints;
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * totalCellHeight;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            const col = (number - 1) % this.NUM_COLS_LAYOUT;
            const row = Math.floor((number - 1) / this.NUM_COLS_LAYOUT);
            const x = mmToPoints(config.startXMm) + col * totalCellWidth;
            const y = gameGridBaseY + row * totalCellHeight;
            return { x, y };
        }
    },
    lotofacil: {
        NUM_COLS_LAYOUT: 5,
        NUM_ROWS_LAYOUT: 5,
        CARDS_PER_PAGE_PDF: 3,
        MAX_BALLS: 25,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            /**
             * Calcula a posição (x, y) de um número no volante da Lotofácil.
             * A ordem de preenchimento é especial: de cima para baixo, preenchendo as colunas da direita para a esquerda.
             * @param {number} number - O número a ser posicionado.
             * @param {number} gameIndexOnPage - O índice do jogo na página.
             * @param {object} config - O objeto de configuração de impressão.
             * @returns {{x: number, y: number}} As coordenadas em pontos.
             */
            const markWidthPoints = mmToPoints(config.markWidthMm);
            const markHeightPoints = mmToPoints(config.markHeightMm);
            const horizontalSpacingPoints = mmToPoints(config.horizontalSpacingMm);
            const verticalSpacingPoints = mmToPoints(config.verticalSpacingMm);
            const totalCellWidth = markWidthPoints + horizontalSpacingPoints;
            const totalCellHeight = markHeightPoints + verticalSpacingPoints;
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * totalCellHeight;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            // Coluna: floor((number-1)/NUM_ROWS_LAYOUT) [direita para esquerda]
            // Linha: (number-1)%NUM_ROWS_LAYOUT [de cima para baixo]
            const col = this.NUM_COLS_LAYOUT - 1 - Math.floor((number - 1) / this.NUM_ROWS_LAYOUT); // direita para esquerda
            const row = (number - 1) % this.NUM_ROWS_LAYOUT; // cima para baixo
            const x = mmToPoints(config.startXMm) + col * totalCellWidth;
            const y = gameGridBaseY + row * totalCellHeight;
            return { x, y };
        }
    }
};

/**
 * Obtém o tipo de jogo atualmente selecionado na interface.
 * @returns {string} O valor do tipo de jogo ('quina', 'megasena', 'lotofacil').
 */
function getSelectedGameType() {
    const select = document.getElementById('gameTypeGlobal');
    return select ? select.value : 'quina';
}

/**
 * Obtém o objeto de layout do volante correspondente ao tipo de jogo selecionado.
 * @returns {object} O objeto de layout do volante.
 */
function getVolanteLayout() {
    const tipo = getSelectedGameType();
    return VOLANTE_LAYOUTS[tipo] || VOLANTE_LAYOUTS['quina'];
}

/**
 * Converte milímetros para pontos (unidade do jsPDF).
 * 1 mm = 2.83465 pontos (aproximadamente)
 * @param {number} mm - Valor em milímetros.
 * @returns {number} Valor em pontos.
 */
function mmToPoints(mm) {
    return mm * (72 / 25.4); // 72 points per inch, 25.4 mm per inch
}

/**
 * Lê um arquivo Excel contendo os jogos para impressão.
 * @param {File} file - O arquivo Excel a ser lido.
 * @param {number} maxBallsOnTicket - O número máximo de dezenas permitido no volante (ex: 80 para Quina).
 * @returns {Promise<{jogos: number[][], dezenasPorJogo: number[]}>} Um objeto contendo
 * os jogos e a quantidade de dezenas de cada jogo.
 */
async function readExcelForPdf(file, maxBallsOnTicket) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    const jogos = [];
    const dezenasPorJogo = [];

    jsonData.forEach(row => {
        if (!row || row.length === 0) return; // Skip empty rows

        let gameNumbers = [];
        let startIndex = 0;

        gameNumbers = row.slice(startIndex)
            .filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBallsOnTicket)
            .map(Number);

        if (gameNumbers.length > 0) {
            jogos.push(gameNumbers.sort((a, b) => a - b));
            dezenasPorJogo.push(gameNumbers.length);
        }
    });

    return { jogos, dezenasPorJogo };
}

/**
 * Desenha as marcações de um único jogo (cartão) no documento PDF.
 * @param {jsPDF} doc - A instância do jsPDF.
 * @param {number[]} numerosDoJogo - Array com as dezenas do jogo a ser marcado.
 * @param {number} gameIndexOnPage - Índice do jogo na página atual (ex: 0, 1, 2).
 * @param {object} config - Configurações de impressão.
 */
function drawCardOnPdf(doc, numerosDoJogo, gameIndexOnPage, config) {
    const layout = getVolanteLayout();
    const markWidthPoints = mmToPoints(config.markWidthMm);
    const markHeightPoints = mmToPoints(config.markHeightMm);

    const globalOffsetXPoints = mmToPoints(config.globalOffsetX || 0);
    const globalOffsetYPoints = mmToPoints(config.globalOffsetY || 0);

    numerosDoJogo.forEach(numero => {
        const { x, y } = layout.getNumberPosition(numero, gameIndexOnPage, config);

        // Desenha o retângulo preto que preenche a célula do número
        doc.setFillColor(0, 0, 0);
        doc.rect(
            x + globalOffsetXPoints,
            y + globalOffsetYPoints,
            markWidthPoints,
            markHeightPoints,
            'F'
        );
    });
}

/**
 * Marca a quantidade de dezenas jogadas no volante.
 * @param {jsPDF} doc - A instância do jsPDF. 
 * @param {number} dezenasPorJogo - Quantidade de dezenas no jogo.
 * @param {object} config - Configurações de impressão.
 */
function drawDezenasJogadasMark(doc, dezenasPorJogo, config) {
    // Definições de início e máximo para cada tipo de jogo
    const gameType = getSelectedGameType();
    let minDezenas, maxDezenas, yOffsetExtra = 0;

    if (gameType === 'quina') {
        minDezenas = 5;
        maxDezenas = 20;
        yOffsetExtra = 0; // ajuste se necessário para espaçamento vertical entre marcações
    } else if (gameType === 'megasena') {
        minDezenas = 6;
        maxDezenas = 20;
        yOffsetExtra = 0; 
    } else if (gameType === 'lotofacil') {
        minDezenas = 15;
        maxDezenas = 20;
        yOffsetExtra = 0;
    } else {
        minDezenas = 5;
        maxDezenas = 20;
        yOffsetExtra = 0;
    }

    if (dezenasPorJogo < minDezenas || dezenasPorJogo > maxDezenas) return;

    const startXPoints = mmToPoints(config.dezenasMarkXPosMm);
    const startYPoints = mmToPoints(config.dezenasMarkYPosMm);

    // Reutiliza as dimensões e espaçamentos da grade principal para consistência
    const cellWidthPoints = mmToPoints(config.dezenasMarkCellWidthMm);
    const cellHeightPoints = mmToPoints(config.dezenasMarkCellHeightMm);
    const horizontalSpacingPoints = mmToPoints(config.dezenasMarkHorizontalSpacingMm);
    const totalCellWidth = cellWidthPoints + horizontalSpacingPoints;

    // A coluna é 0-indexed (ex: quina: 5 dezenas -> coluna 0, megasena: 6 dezenas -> coluna 0, lotofacil: 15 dezenas -> coluna 0)
    const colunaDezenaIndex = dezenasPorJogo - minDezenas;
    const xPos = startXPoints + (colunaDezenaIndex * totalCellWidth);

    const globalOffsetXPoints = mmToPoints(config.globalOffsetX || 0);
    const globalOffsetYPoints = mmToPoints(config.globalOffsetY || 0);

    doc.setFillColor(0, 0, 0); // Marcação preta
    doc.rect(
        xPos + globalOffsetXPoints,
        startYPoints + globalOffsetYPoints,
        cellWidthPoints,
        cellHeightPoints,
        'F'
    );
}

/**
 * Marca a quantidade de cotas do bolão no volante.
 * @param {jsPDF} doc - A instância do jsPDF. 
 * @param {number} cotaValue - O valor da cota (1 a 50).
 * @param {object} config - Configurações de impressão.
 */
function drawBolaoMark(doc, cotaValue, config) {
    if (cotaValue < 1 || cotaValue > 99) return; // Limite comum para cotas

    const startXPoints = mmToPoints(config.bolaoMarkXPosMm);
    const startYPoints = mmToPoints(config.bolaoMarkYPosMm);
    const cellWidthPoints = mmToPoints(config.bolaoCellWidthMm);
    const cellHeightPoints = mmToPoints(config.bolaoCellHeightMm);
    const horizontalSpacingPoints = mmToPoints(config.bolaoHorizontalSpacingMm);
    const verticalSpacingPoints = mmToPoints(config.bolaoVerticalSpacingMm);
    const totalCellWidth = cellWidthPoints + horizontalSpacingPoints;
    const totalCellHeight = cellHeightPoints + verticalSpacingPoints;

    // Y do topo da área de marcação do bolão (para a dezena)
    const posYDezena = startYPoints;
    // Y do topo da área de marcação do bolão (para a unidade)
    const posYUnidade = startYPoints + totalCellHeight;

    const dezena = Math.floor(cotaValue / 10); // 0 para cotas < 10, 1 para 10-19, ..., 5 para 50
    const unidade = cotaValue % 10;        // 0-9

    const globalOffsetXPoints = mmToPoints(config.globalOffsetX || 0);
    const globalOffsetYPoints = mmToPoints(config.globalOffsetY || 0);

    // Marcar dezena (se cotaValue >= 10)
    // As colunas para dezenas (10, 20, 30, 40, 50) são geralmente indexadas de 0 a 4 ou 1 a 5.
    // Python: (dezena - 1) * CELL_WIDTH. Se dezena=1 (para 10), col_idx=0. Se dezena=5 (para 50), col_idx=4.
    if (dezena > 0) {
        const xPosDezena = startXPoints + (dezena - 1) * totalCellWidth;
        doc.setFillColor(0, 0, 0);
        doc.rect(
            xPosDezena + globalOffsetXPoints,
            posYDezena + globalOffsetYPoints,
            cellWidthPoints,
            cellHeightPoints,
            'F'
        );
    }

    // Marcar unidade (sempre, para cotas 1-9, ou 0 para 10, 20, etc.)
    // As colunas para unidades (0-9) são geralmente indexadas de 0 a 9.
    // Python: unidade * CELL_WIDTH. Se unidade=0, col_idx=0. Se unidade=9, col_idx=9.

    const xPosUnidade = startXPoints + unidade * totalCellWidth;
    doc.setFillColor(0, 0, 0);
    doc.rect(
        xPosUnidade + globalOffsetXPoints,
        posYUnidade + globalOffsetYPoints,
        cellWidthPoints,
        cellHeightPoints,
        'F'
    );
}

/**
 * Desenha o número do volante (página) no documento PDF.
 * @param {jsPDF} doc - A instância do jsPDF. 
 * @param {number} pageNumber - O número da página atual.
 * @param {object} config - Configurações de impressão.
 */
function drawPageNumberOnPdf(doc, pageNumber, config) {
    const posX = mmToPoints(config.pageNumberXPosMm);
    const posY = mmToPoints(config.pageNumberYPosMm);

    const globalOffsetXPoints = mmToPoints(config.globalOffsetX || 0);
    const globalOffsetYPoints = mmToPoints(config.globalOffsetY || 0);

    doc.setFontSize(config.pageNumberFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0); // Preto
    doc.text(String(pageNumber), posX + globalOffsetXPoints, posY + globalOffsetYPoints, { baseline: 'top' });
}

/**
 * Desenha as dezenas dos jogos da página atual na parte inferior da folha.
 * @param {jsPDF} doc - A instância do jsPDF. 
 * @param {number[][]} gamesOnPage - Array de jogos (cada jogo é um array de números) na página atual.
 * @param {object} config - Configurações de impressão.
 */
function drawGamesNumbersOnPdf(doc, gamesOnPage, config) {
    const startXPoints = mmToPoints(config.gamesNumbersXPosMm);
    const startYPoints = mmToPoints(config.gamesNumbersYPosMm);
    const lineSpacingPoints = mmToPoints(config.gamesNumbersLineSpacingMm);

    const globalOffsetXPoints = mmToPoints(config.globalOffsetX || 0);
    const globalOffsetYPoints = mmToPoints(config.globalOffsetY || 0);

    doc.setFontSize(config.gamesNumbersFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0); // Preto

    gamesOnPage.forEach((jogo, index) => {
        const jogoNumeros = jogo.map(num => String(num).padStart(2, '0')).join('.');
        const posY = startYPoints + (index * lineSpacingPoints);
        doc.text(jogoNumeros, startXPoints + globalOffsetXPoints, posY + globalOffsetYPoints, { baseline: 'top' });
    });
}

/**
 * Carrega um arquivo de imagem e retorna sua representação em Data URL.
 * @param {File} file - O arquivo de imagem.
 * @returns {Promise<string>} Uma promessa que resolve com a Data URL da imagem.
 */
function loadImageData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            resolve(event.target.result);
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Função principal que orquestra a geração do PDF dos volantes.
 */
async function generateVolantePDF() {
    const statusEl = document.getElementById('status-impressao');
    const loaderEl = document.getElementById('loader-impressao');
    const { jsPDF } = window.jspdf; // Garante que o jsPDF esteja carregado (via CDN)

    statusEl.textContent = 'Iniciando geração do PDF...';
    statusEl.classList.remove('error');
    loaderEl.style.display = 'block';

    try {
        const pdfConfig = {
            gameFile: document.getElementById('pdfGameFile').files[0],
            pageWidthMm: parseBrazilianNumber(document.getElementById('pdfPageWidthMm').value),
            pageHeightMm: parseBrazilianNumber(document.getElementById('pdfPageHeightMm').value),
            globalOffsetX: parseBrazilianNumber(document.getElementById('pdfGlobalOffsetX').value) || 0,
            globalOffsetY: parseBrazilianNumber(document.getElementById('pdfGlobalOffsetY').value) || 0,
            startXMm: parseBrazilianNumber(document.getElementById('pdfStartXMm').value),
            firstGameYFromTopMm: parseBrazilianNumber(document.getElementById('pdfFirstGameYFromTopMm').value),
            markWidthMm: parseBrazilianNumber(document.getElementById('pdfMarkWidthMm').value),
            markHeightMm: parseBrazilianNumber(document.getElementById('pdfMarkHeightMm').value),
            horizontalSpacingMm: parseBrazilianNumber(document.getElementById('pdfHorizontalSpacingMm').value),
            verticalSpacingMm: parseBrazilianNumber(document.getElementById('pdfVerticalSpacingMm').value),
            distanceBetweenGamesMm: parseBrazilianNumber(document.getElementById('pdfDistanceBetweenGamesMm').value),
            
            // Marcações Especiais
            dezenasMarkXPosMm: parseBrazilianNumber(document.getElementById('pdfDezenasMarkXPosMm').value),
            dezenasMarkYPosMm: parseBrazilianNumber(document.getElementById('pdfDezenasMarkYPosMm').value),
            dezenasMarkCellWidthMm: parseBrazilianNumber(document.getElementById('pdfDezenasMarkCellWidthMm').value),
            dezenasMarkCellHeightMm: parseBrazilianNumber(document.getElementById('pdfDezenasMarkCellHeightMm').value),
            dezenasMarkHorizontalSpacingMm: parseBrazilianNumber(document.getElementById('pdfDezenasMarkHorizontalSpacingMm').value),

            bolaoMarkXPosMm: parseBrazilianNumber(document.getElementById('pdfBolaoMarkXPosMm').value),
            bolaoMarkYPosMm: parseBrazilianNumber(document.getElementById('pdfBolaoMarkYPosMm').value),
            bolaoCellWidthMm: parseBrazilianNumber(document.getElementById('pdfBolaoCellWidthMm').value),
            bolaoCellHeightMm: parseBrazilianNumber(document.getElementById('pdfBolaoCellHeightMm').value),
            bolaoHorizontalSpacingMm: parseBrazilianNumber(document.getElementById('pdfBolaoHorizontalSpacingMm').value),
            bolaoVerticalSpacingMm: parseBrazilianNumber(document.getElementById('pdfBolaoVerticalSpacingMm').value),
            cotaValue: parseInt(document.getElementById('pdfCotas').value, 10) || 0,

            // Avançadas
            printBackgroundImage: document.getElementById('pdfPrintBackgroundImage').checked,
            backgroundImageFile: document.getElementById('pdfBackgroundImageFile').files[0],
            pageNumberXPosMm: parseBrazilianNumber(document.getElementById('pdfPageNumberXPosMm').value),
            pageNumberYPosMm: parseBrazilianNumber(document.getElementById('pdfPageNumberYPosMm').value),
            pageNumberFontSize: parseBrazilianNumber(document.getElementById('pdfPageNumberFontSize').value) || 18,
            gamesNumbersXPosMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersXPosMm').value),
            gamesNumbersYPosMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersYPosMm').value),
            gamesNumbersLineSpacingMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersLineSpacingMm').value),
            gamesNumbersFontSize: parseBrazilianNumber(document.getElementById('pdfGamesNumbersFontSize').value) || 10,
            showLogoMarginLines: document.getElementById('pdfShowLogoMarginLines').checked,
            showGridLines: document.getElementById('pdfShowGridLines').checked,
            gridLineColSpacing: parseInt(document.getElementById('pdfGridLineColSpacing').value, 10) || 1,
            gridLineRowSpacing: parseInt(document.getElementById('pdfGridLineRowSpacing').value, 10) || 1,
        };

        if (!pdfConfig.gameFile) {
            throw new Error('Por favor, selecione o arquivo Excel com os jogos.');
        }
        // Validação básica para outros campos numéricos críticos
        if (isNaN(pdfConfig.pageWidthMm) || isNaN(pdfConfig.pageHeightMm) || isNaN(pdfConfig.startXMm) || isNaN(pdfConfig.firstGameYFromTopMm) || isNaN(pdfConfig.markWidthMm) ||
            isNaN(pdfConfig.markHeightMm)) {
            throw new Error('Verifique as configurações de dimensão e posicionamento. Valores numéricos são esperados.');
        }
        if (pdfConfig.printBackgroundImage && !pdfConfig.backgroundImageFile) {
            throw new Error('"Imprimir Imagem de Fundo" está marcado, mas nenhum arquivo de imagem foi selecionado.');
        }


        statusEl.textContent = 'Lendo arquivo Excel...';
        const layout = getVolanteLayout();
        const { jogos: jogosParaPdf, dezenasPorJogo: dezenasPorJogoArray } =
            await readExcelForPdf(pdfConfig.gameFile, layout.MAX_BALLS);

        if (!jogosParaPdf || jogosParaPdf.length === 0) {
            throw new Error('Nenhum jogo válido encontrado no arquivo Excel.');
        }

        // Cria o documento PDF com as dimensões da página especificadas.
        const pdfDoc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: [
                mmToPoints(pdfConfig.pageWidthMm), // Largura total do volante
                mmToPoints(pdfConfig.pageHeightMm)  // Altura total do volante
            ]
        });

        const pdfPageHeightPoints = mmToPoints(pdfConfig.pageHeightMm);

        let backgroundImageDataUrl = null;
        if (pdfConfig.printBackgroundImage && pdfConfig.backgroundImageFile) {
            statusEl.textContent = 'Carregando imagem de fundo...';
            try {
                backgroundImageDataUrl = await loadImageData(pdfConfig.backgroundImageFile);
            } catch (imgError) {
                throw new Error('Erro ao carregar a imagem de fundo: ' + imgError.message);
            }
        }

        statusEl.textContent = `Preparando para desenhar ${jogosParaPdf.length} jogos...`;
        await new Promise(resolve => setTimeout(resolve, 0)); // Força atualização da UI

        let gameIndexInAllGames = 0;
        let pageCount = 0;
        while (gameIndexInAllGames < jogosParaPdf.length) {
            pageCount++;
            if (pageCount > 1) {
                pdfDoc.addPage();
            }

            // Captura informações do primeiro jogo desta página (volante) para usar nas marcações de rodapé
            let firstGameDezenasCountThisPage = 0;
            const cotaValue = pdfConfig.cotaValue;

            const gamesOnCurrentPage = []; // Coleta os jogos desta página para imprimir os números no rodapé
            
            // Desenhar imagem de fundo, se habilitada
            if (backgroundImageDataUrl) {
                pdfDoc.addImage(backgroundImageDataUrl, 'JPEG', 0, 0, mmToPoints(pdfConfig.pageWidthMm), pdfPageHeightPoints);
            }

            // NEW: Draw grid lines for alignment
            if (pdfConfig.showGridLines) {
                const colSpacingPt = mmToPoints(pdfConfig.gridLineColSpacing);
                const rowSpacingPt = mmToPoints(pdfConfig.gridLineRowSpacing);
                const pageWidthPt = mmToPoints(pdfConfig.pageWidthMm);
                const pageHeightPt = mmToPoints(pdfConfig.pageHeightMm);

                pdfDoc.setDrawColor(0, 0, 0); // Preto
                pdfDoc.setLineWidth(0.1);

                // Draw vertical lines
                for (let x = colSpacingPt; x < pageWidthPt; x += colSpacingPt) {
                    pdfDoc.line(x, 0, x, pageHeightPt);
                }
                // Draw horizontal lines
                for (let y = rowSpacingPt; y < pageHeightPt; y += rowSpacingPt) {
                    pdfDoc.line(0, y, pageWidthPt, y);
                }
            }

            // Desenha linhas de margem da logo para calibração, se solicitado
            if (pdfConfig.showLogoMarginLines) {
                const offsetX = mmToPoints(pdfConfig.globalOffsetX);
                const offsetY = mmToPoints(pdfConfig.globalOffsetY);
                const pageWidthPt = mmToPoints(pdfConfig.pageWidthMm);
                const pageHeightPt = mmToPoints(pdfConfig.pageHeightMm);
                pdfDoc.setDrawColor(255, 0, 0); // Vermelho
                pdfDoc.setLineWidth(0.1);
                pdfDoc.line(offsetX, 0, offsetX, pageHeightPt); // Linha vertical
                pdfDoc.line(0, offsetY, pageWidthPt, offsetY); // Linha horizontal
            }

            // Desenha o número da página (volante)
            drawPageNumberOnPdf(pdfDoc, pageCount, pdfConfig);

            if (gameIndexInAllGames < dezenasPorJogoArray.length && dezenasPorJogoArray[gameIndexInAllGames]) {
                firstGameDezenasCountThisPage = dezenasPorJogoArray[gameIndexInAllGames];
            }

            // Desenhar os jogos no volante atual (página PDF)
            const layout = getVolanteLayout();
            for (let i = 0; i < layout.CARDS_PER_PAGE_PDF && gameIndexInAllGames < jogosParaPdf.length; i++) {
                const currentGameNumbers = jogosParaPdf[gameIndexInAllGames];
                gamesOnCurrentPage.push(currentGameNumbers);

                drawCardOnPdf(pdfDoc, currentGameNumbers, i /*gameIndexOnPage*/, pdfConfig);
                
                gameIndexInAllGames++;
                if (gameIndexInAllGames % 20 === 0) { // Atualiza o status com menos frequência para não sobrecarregar
                    statusEl.textContent = `Desenhando jogo ${gameIndexInAllGames} de ${jogosParaPdf.length}... (Volante ${pageCount})`;
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Desenhar marcações de rodapé para o volante atual
            drawDezenasJogadasMark(pdfDoc, firstGameDezenasCountThisPage, pdfConfig);
            drawGamesNumbersOnPdf(pdfDoc, gamesOnCurrentPage, pdfConfig); // Draw game numbers at the bottom
            drawBolaoMark(pdfDoc, cotaValue, pdfConfig);
        }

        pdfDoc.save('Volantes_Gerados.pdf');
        statusEl.textContent = `PDF com ${pageCount} volante(s) gerado com sucesso! Total de ${jogosParaPdf.length} jogos processados.`;

    } catch (error) {
        console.error('Erro ao gerar PDF dos volantes:', error);
        statusEl.textContent = 'Erro: ' + error.message;
        statusEl.classList.add('error');
    } finally {
        loaderEl.style.display = 'none';
    }
}

/**
 * Coleta todas as configurações de impressão dos campos de input da UI.
 * @returns {object} Um objeto com todas as configurações de impressão.
 */
function coletarConfiguracoesImpressao() {
    return {
        pdfPageWidthMm: document.getElementById('pdfPageWidthMm').value,
        pdfPageHeightMm: document.getElementById('pdfPageHeightMm').value,
        pdfGlobalOffsetX: document.getElementById('pdfGlobalOffsetX').value,
        pdfGlobalOffsetY: document.getElementById('pdfGlobalOffsetY').value,
        pdfStartXMm: document.getElementById('pdfStartXMm').value,
        pdfFirstGameYFromTopMm: document.getElementById('pdfFirstGameYFromTopMm').value,
        pdfMarkWidthMm: document.getElementById('pdfMarkWidthMm').value,
        pdfMarkHeightMm: document.getElementById('pdfMarkHeightMm').value,
        pdfHorizontalSpacingMm: document.getElementById('pdfHorizontalSpacingMm').value,
        pdfVerticalSpacingMm: document.getElementById('pdfVerticalSpacingMm').value,
        pdfDistanceBetweenGamesMm: document.getElementById('pdfDistanceBetweenGamesMm').value,

        pdfDezenasMarkXPosMm: document.getElementById('pdfDezenasMarkXPosMm').value,
        pdfDezenasMarkYPosMm: document.getElementById('pdfDezenasMarkYPosMm').value,
        pdfDezenasMarkCellWidthMm: document.getElementById('pdfDezenasMarkCellWidthMm').value,
        pdfDezenasMarkCellHeightMm: document.getElementById('pdfDezenasMarkCellHeightMm').value,
        pdfDezenasMarkHorizontalSpacingMm: document.getElementById('pdfDezenasMarkHorizontalSpacingMm').value,

        pdfBolaoMarkXPosMm: document.getElementById('pdfBolaoMarkXPosMm').value,
        pdfBolaoMarkYPosMm: document.getElementById('pdfBolaoMarkYPosMm').value,
        pdfBolaoCellWidthMm: document.getElementById('pdfBolaoCellWidthMm').value,
        pdfBolaoCellHeightMm: document.getElementById('pdfBolaoCellHeightMm').value,
        pdfBolaoHorizontalSpacingMm: document.getElementById('pdfBolaoHorizontalSpacingMm').value,
        pdfBolaoVerticalSpacingMm: document.getElementById('pdfBolaoVerticalSpacingMm').value,
        pdfCotas: document.getElementById('pdfCotas').value,

        pdfPageNumberXPosMm: document.getElementById('pdfPageNumberXPosMm').value,
        pdfPageNumberYPosMm: document.getElementById('pdfPageNumberYPosMm').value,
        pdfPageNumberFontSize: document.getElementById('pdfPageNumberFontSize').value,
        pdfGamesNumbersXPosMm: document.getElementById('pdfGamesNumbersXPosMm').value,
        pdfGamesNumbersYPosMm: document.getElementById('pdfGamesNumbersYPosMm').value,
        pdfGamesNumbersLineSpacingMm: document.getElementById('pdfGamesNumbersLineSpacingMm').value,
        pdfGamesNumbersFontSize: document.getElementById('pdfGamesNumbersFontSize').value,
        pdfShowLogoMarginLines: document.getElementById('pdfShowLogoMarginLines').checked,
        pdfShowGridLines: document.getElementById('pdfShowGridLines').checked,
        pdfGridLineColSpacing: document.getElementById('pdfGridLineColSpacing').value,
        pdfGridLineRowSpacing: document.getElementById('pdfGridLineRowSpacing').value,
    };
}

/**
 * Aplica um objeto de configuração aos campos de input da UI de impressão.
 * @param {object} config - O objeto de configuração a ser aplicado.
 */
function aplicarConfiguracoesImpressao(config) {
    if (config.pdfPageWidthMm) document.getElementById('pdfPageWidthMm').value = config.pdfPageWidthMm;
    if (config.pdfPageHeightMm) document.getElementById('pdfPageHeightMm').value = config.pdfPageHeightMm;
    if (config.pdfGlobalOffsetX) document.getElementById('pdfGlobalOffsetX').value = config.pdfGlobalOffsetX;
    if (config.pdfGlobalOffsetY) document.getElementById('pdfGlobalOffsetY').value = config.pdfGlobalOffsetY;
    if (config.pdfStartXMm) document.getElementById('pdfStartXMm').value = config.pdfStartXMm;
    if (config.pdfFirstGameYFromTopMm) document.getElementById('pdfFirstGameYFromTopMm').value = config.pdfFirstGameYFromTopMm;
    if (config.pdfMarkWidthMm) document.getElementById('pdfMarkWidthMm').value = config.pdfMarkWidthMm;
    if (config.pdfMarkHeightMm) document.getElementById('pdfMarkHeightMm').value = config.pdfMarkHeightMm;
    if (config.pdfHorizontalSpacingMm) document.getElementById('pdfHorizontalSpacingMm').value = config.pdfHorizontalSpacingMm;
    if (config.pdfVerticalSpacingMm) document.getElementById('pdfVerticalSpacingMm').value = config.pdfVerticalSpacingMm;
    if (config.pdfDistanceBetweenGamesMm) document.getElementById('pdfDistanceBetweenGamesMm').value = config.pdfDistanceBetweenGamesMm;

    if (config.pdfDezenasMarkXPosMm) document.getElementById('pdfDezenasMarkXPosMm').value = config.pdfDezenasMarkXPosMm;
    if (config.pdfDezenasMarkYPosMm) document.getElementById('pdfDezenasMarkYPosMm').value = config.pdfDezenasMarkYPosMm;
    if (config.pdfDezenasMarkCellWidthMm) document.getElementById('pdfDezenasMarkCellWidthMm').value = config.pdfDezenasMarkCellWidthMm;
    if (config.pdfDezenasMarkCellHeightMm) document.getElementById('pdfDezenasMarkCellHeightMm').value = config.pdfDezenasMarkCellHeightMm;
    if (config.pdfDezenasMarkHorizontalSpacingMm) document.getElementById('pdfDezenasMarkHorizontalSpacingMm').value = config.pdfDezenasMarkHorizontalSpacingMm;

    if (config.pdfBolaoMarkXPosMm) document.getElementById('pdfBolaoMarkXPosMm').value = config.pdfBolaoMarkXPosMm;
    if (config.pdfBolaoMarkYPosMm) document.getElementById('pdfBolaoMarkYPosMm').value = config.pdfBolaoMarkYPosMm;
    if (config.pdfBolaoCellWidthMm) document.getElementById('pdfBolaoCellWidthMm').value = config.pdfBolaoCellWidthMm;
    if (config.pdfBolaoCellHeightMm) document.getElementById('pdfBolaoCellHeightMm').value = config.pdfBolaoCellHeightMm;
    if (config.pdfBolaoHorizontalSpacingMm) document.getElementById('pdfBolaoHorizontalSpacingMm').value = config.pdfBolaoHorizontalSpacingMm;
    if (config.pdfBolaoVerticalSpacingMm) document.getElementById('pdfBolaoVerticalSpacingMm').value = config.pdfBolaoVerticalSpacingMm;
    if (config.pdfCotas) document.getElementById('pdfCotas').value = config.pdfCotas;

    if (config.pdfPageNumberXPosMm) document.getElementById('pdfPageNumberXPosMm').value = config.pdfPageNumberXPosMm;
    if (config.pdfPageNumberYPosMm) document.getElementById('pdfPageNumberYPosMm').value = config.pdfPageNumberYPosMm;
    if (config.pdfPageNumberFontSize) document.getElementById('pdfPageNumberFontSize').value = config.pdfPageNumberFontSize;
    if (config.pdfGamesNumbersXPosMm) document.getElementById('pdfGamesNumbersXPosMm').value = config.pdfGamesNumbersXPosMm;
    if (config.pdfGamesNumbersYPosMm) document.getElementById('pdfGamesNumbersYPosMm').value = config.pdfGamesNumbersYPosMm;
    if (config.pdfGamesNumbersLineSpacingMm) document.getElementById('pdfGamesNumbersLineSpacingMm').value = config.pdfGamesNumbersLineSpacingMm;
    if (config.pdfGamesNumbersFontSize) document.getElementById('pdfGamesNumbersFontSize').value = config.pdfGamesNumbersFontSize;
    if (config.pdfShowLogoMarginLines !== undefined) document.getElementById('pdfShowLogoMarginLines').checked = config.pdfShowLogoMarginLines;

    if (config.pdfShowGridLines !== undefined) document.getElementById('pdfShowGridLines').checked = config.pdfShowGridLines;
    if (config.pdfGridLineColSpacing) document.getElementById('pdfGridLineColSpacing').value = config.pdfGridLineColSpacing;
    if (config.pdfGridLineRowSpacing) document.getElementById('pdfGridLineRowSpacing').value = config.pdfGridLineRowSpacing;
    // Trigger change to update UI
    const gridCheckbox = document.getElementById('pdfShowGridLines');
    if (gridCheckbox) {
        gridCheckbox.dispatchEvent(new Event('change'));
    }
}

export { generateVolantePDF, coletarConfiguracoesImpressao, aplicarConfiguracoesImpressao };
