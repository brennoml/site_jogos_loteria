// src/js/printPdf.js

import { parseBrazilianNumber } from './validators.js';
// Assume XLSX is globally available from the script tag in index.html
// Assume jsPDF is globally available, e.g., from a CDN: window.jspdf.jsPDF

// Configurações de layout por tipo de jogo
const VOLANTE_LAYOUTS = {
    quina: {
        NUM_COLS_LAYOUT: 10,
        NUM_ROWS_LAYOUT: 8,
        CARDS_PER_PAGE_PDF: 2,
        MAX_BALLS: 80,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            // Ordem padrão: esquerda para direita, topo para baixo
            const cellWidthPoints = mmToPoints(config.cellWidthMm);
            const cellHeightPoints = mmToPoints(config.cellHeightMm);
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * cellHeightPoints;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            const col = (number - 1) % this.NUM_COLS_LAYOUT;
            const row = Math.floor((number - 1) / this.NUM_COLS_LAYOUT);
            const x = mmToPoints(config.startXMm) + col * cellWidthPoints;
            const y = gameGridBaseY + row * cellHeightPoints;
            return { x, y };
        }
    },
    megasena: {
        NUM_COLS_LAYOUT: 10,
        NUM_ROWS_LAYOUT: 6,
        CARDS_PER_PAGE_PDF: 3,
        MAX_BALLS: 60,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            // Ordem padrão: esquerda para direita, topo para baixo
            const cellWidthPoints = mmToPoints(config.cellWidthMm);
            const cellHeightPoints = mmToPoints(config.cellHeightMm);
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * cellHeightPoints;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            const col = (number - 1) % this.NUM_COLS_LAYOUT;
            const row = Math.floor((number - 1) / this.NUM_COLS_LAYOUT);
            const x = mmToPoints(config.startXMm) + col * cellWidthPoints;
            const y = gameGridBaseY + row * cellHeightPoints;
            return { x, y };
        }
    },
    lotofacil: {
        NUM_COLS_LAYOUT: 5,
        NUM_ROWS_LAYOUT: 5,
        CARDS_PER_PAGE_PDF: 3,
        MAX_BALLS: 25,
        getNumberPosition: function(number, gameIndexOnPage, config) {
            // Ordem: colunas de cima para baixo, da direita para a esquerda (gira 90º anti-horário)
            const cellWidthPoints = mmToPoints(config.cellWidthMm);
            const cellHeightPoints = mmToPoints(config.cellHeightMm);
            const gameHeightPoints = this.NUM_ROWS_LAYOUT * cellHeightPoints;
            const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
            const gameGridBaseY = mmToPoints(config.firstGameYFromTopMm) +
                (gameIndexOnPage * (gameHeightPoints + distanceBetweenGamesPoints));
            // Cálculo para ordem especial:
            // Coluna: floor((number-1)/NUM_ROWS_LAYOUT) [direita para esquerda]
            // Linha: (number-1)%NUM_ROWS_LAYOUT [de cima para baixo]
            const col = this.NUM_COLS_LAYOUT - 1 - Math.floor((number - 1) / this.NUM_ROWS_LAYOUT); // direita para esquerda
            const row = (number - 1) % this.NUM_ROWS_LAYOUT; // cima para baixo
            const x = mmToPoints(config.startXMm) + col * cellWidthPoints;
            const y = gameGridBaseY + row * cellHeightPoints;
            return { x, y };
        }
    }
};

// Função para obter o tipo de jogo selecionado
function getSelectedGameType() {
    const select = document.getElementById('gameTypeGlobal');
    return select ? select.value : 'quina';
}

// Função para obter o layout do volante conforme o tipo de jogo
function getVolanteLayout() {
    const tipo = getSelectedGameType();
    return VOLANTE_LAYOUTS[tipo] || VOLANTE_LAYOUTS['quina'];
}

const NUM_COLS_LAYOUT = 10; // Número de colunas por jogo no volante
const NUM_ROWS_LAYOUT = 8;  // Número de linhas por jogo no volante
const CARDS_PER_PAGE_PDF = 2; // Quantidade de jogos por volante (página PDF)

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
 * A primeira coluna pode opcionalmente conter o número de cotas.
 * As colunas subsequentes contêm as dezenas do jogo.
 * @param {File} file - O arquivo Excel.
 * @param {boolean} readCotasFromExcel - Se deve ler cotas da primeira coluna.
 * @param {number} maxBallsOnTicket - O número máximo de bolas no bilhete (ex: 80 para Quina).
 * @returns {Promise<{jogos: number[][], cotas: number[], dezenasPorJogo: number[]}>}
 */
async function readExcelForPdf(file, readCotasFromExcel, maxBallsOnTicket) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    const jogos = [];
    const cotas = [];
    const dezenasPorJogo = [];

    jsonData.forEach(row => {
        if (!row || row.length === 0) return; // Skip empty rows

        let cota = null;
        let gameNumbers = [];
        let startIndex = 0;

        if (readCotasFromExcel) {
            const firstCell = row[0];
            if (firstCell !== null && !isNaN(Number(firstCell))) {
                cota = parseInt(Number(firstCell), 10);
            }
            startIndex = 1;
        }

        gameNumbers = row.slice(startIndex)
            .filter(num => num !== null && !isNaN(Number(num)) && Number.isInteger(Number(num)) && Number(num) >= 1 && Number(num) <= maxBallsOnTicket)
            .map(Number);

        if (gameNumbers.length > 0) {
            jogos.push(gameNumbers.sort((a, b) => a - b));
            cotas.push(cota); // Will be null if not read or not a number
            dezenasPorJogo.push(gameNumbers.length);
        }
    });

    return { jogos, cotas, dezenasPorJogo };
}


/**
 * Calcula a posição (x, y) de um número no cartão do jogo dentro da página PDF.
 * Y é medido do topo da área desenhável.
 * @param {number} number - O número a ser posicionado (1-80 para Quina).
 * @param {number} gameIndexOnPage - O índice do jogo na página atual (0 para o primeiro, 1 para o segundo, etc.).
 * @param {object} config - Objeto de configuração com dimensões e posições.
 * @returns {{x: number, y: number}} Coordenadas em pontos.
 */
function getNumberPositionOnPdf(number, gameIndexOnPage, config) {
    const layout = getVolanteLayout();
    return layout.getNumberPosition(number, gameIndexOnPage, config);
}

/**
 * Desenha um cartão de jogo (marca os números) no PDF.
 * @param {jsPDF} doc - A instância do jsPDF.
 * @param {number[]} numerosDoJogo - Array com os números do jogo.
 * @param {number} gameIndexOnPage - Índice do jogo na página atual (0 ou 1 para CARDS_PER_PAGE_PDF=2).
 * @param {object} config - Configurações de impressão.
 */
function drawCardOnPdf(doc, numerosDoJogo, gameIndexOnPage, config) {
    const layout = getVolanteLayout();
    const cellWidthPoints = mmToPoints(config.cellWidthMm);
    const cellHeightPoints = mmToPoints(config.cellHeightMm);
    const borderWidthPoints = mmToPoints(config.borderWidthMm); // Borda interna X
    const borderHeightPoints = mmToPoints(config.borderHeightMm); // Borda interna Y

    numerosDoJogo.forEach(numero => {
        const { x, y } = layout.getNumberPosition(numero, gameIndexOnPage, config);

        // Retângulo branco (fundo da célula) - Opcional se o fundo do volante já for branco
        // doc.setFillColor(255, 255, 255);
        // doc.rect(x, y, cellWidthPoints, cellHeightPoints, 'F');

        // Retângulo preto (marcação)
        doc.setFillColor(0, 0, 0);
        doc.rect(
            x + borderWidthPoints,
            y + borderHeightPoints,
            cellWidthPoints - (2 * borderWidthPoints),
            cellHeightPoints - (2 * borderHeightPoints),
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
    const layout = getVolanteLayout();
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

    const gameBaseYFromTopPoints = mmToPoints(config.firstGameYFromTopMm);
    const cellWidthPoints = mmToPoints(config.cellWidthMm);
    const cellHeightPoints = mmToPoints(config.cellHeightMm);
    const gameHeightPoints = layout.NUM_ROWS_LAYOUT * cellHeightPoints;
    const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
    const borderWidthPoints = mmToPoints(config.borderWidthMm);
    const borderHeightPoints = mmToPoints(config.borderHeightMm);

    // Y do topo da área de marcação de "dezenas jogadas"
    let markAreaTopY = gameBaseYFromTopPoints +
        (layout.CARDS_PER_PAGE_PDF * gameHeightPoints) +
        ((layout.CARDS_PER_PAGE_PDF - 1) * distanceBetweenGamesPoints) +
        mmToPoints(config.afterGameOffsetMm);

    // Ajuste o Y para cada tipo de jogo
    markAreaTopY += yOffsetExtra;

    // A coluna é 0-indexed (ex: quina: 5 dezenas -> coluna 0, megasena: 6 dezenas -> coluna 0, lotofacil: 15 dezenas -> coluna 0)
    const colunaDezenaIndex = dezenasPorJogo - minDezenas;
    const pdfGamesNumbersXOffsetMm = mmToPoints(config.startXMm) + colunaDezenaIndex * cellWidthPoints;

    doc.setFillColor(0, 0, 0); // Marcação preta
    doc.rect(
        pdfGamesNumbersXOffsetMm + borderWidthPoints,
        markAreaTopY + borderHeightPoints,
        cellWidthPoints - (2 * borderWidthPoints),
        cellHeightPoints - (2 * borderHeightPoints),
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
    const layout = getVolanteLayout();
    if (cotaValue < 1 || cotaValue > 99) return; // Limite comum para cotas

    const gameBaseYFromTopPoints = mmToPoints(config.firstGameYFromTopMm);
    const cellWidthPoints = mmToPoints(6.5); // Ajuste para o novo tamanho da célula
    const cellHeightPoints = mmToPoints(3);
    const gameHeightPoints = layout.NUM_ROWS_LAYOUT * cellHeightPoints;
    const distanceBetweenGamesPoints = mmToPoints(config.distanceBetweenGamesMm);
    const borderWidthPoints = mmToPoints(1.1);
    const borderHeightPoints = mmToPoints(0.3); // Ajuste para a borda interna Y
    const gapBetweenDezenaUnidadeMm = 0.7; // Equivalente aos 2 pontos do Python

    // Y do topo da área de marcação do bolão (para a dezena)
    const posYDezena = gameBaseYFromTopPoints +
                       (layout.CARDS_PER_PAGE_PDF * gameHeightPoints) +
                       ((layout.CARDS_PER_PAGE_PDF - 4) * distanceBetweenGamesPoints) +
                       mmToPoints(config.bolaoOffsetMm);

    // Y do topo da área de marcação do bolão (para a unidade)
    const posYUnidade = posYDezena + cellHeightPoints + mmToPoints(gapBetweenDezenaUnidadeMm);

    const dezena = Math.floor(cotaValue / 10); // 0 para cotas < 10, 1 para 10-19, ..., 5 para 50
    const unidade = cotaValue % 10;        // 0-9

    // Marcar dezena (se cotaValue >= 10)
    // As colunas para dezenas (10, 20, 30, 40, 50) são geralmente indexadas de 0 a 4 ou 1 a 5.
    // Python: (dezena - 1) * CELL_WIDTH. Se dezena=1 (para 10), col_idx=0. Se dezena=5 (para 50), col_idx=4.
    if (dezena > 0) {
        const pdfGamesNumbersXOffsetMmDezenaMark = mmToPoints(config.startXMm+2) + (dezena - 1) * cellWidthPoints;
        // doc.setFillColor(255, 255, 255);
        // doc.rect(pdfGamesNumbersXOffsetMmDezenaMark, posYDezena, cellWidthPoints, cellHeightPoints, 'F');
        doc.setFillColor(0, 0, 0);
        doc.rect(
            pdfGamesNumbersXOffsetMmDezenaMark + borderWidthPoints,
            posYDezena + borderHeightPoints,
            cellWidthPoints - (2 * borderWidthPoints),
            cellHeightPoints - (2 * borderHeightPoints),
            'F'
        );
    }

    // Marcar unidade (sempre, para cotas 1-9, ou 0 para 10, 20, etc.)
    // As colunas para unidades (0-9) são geralmente indexadas de 0 a 9.
    // Python: unidade * CELL_WIDTH. Se unidade=0, col_idx=0. Se unidade=9, col_idx=9.
    const pdfGamesNumbersXOffsetMmUnidadeMark = mmToPoints(config.startXMm) + unidade * cellWidthPoints;
    // doc.setFillColor(255, 255, 255);
    // doc.rect(pdfGamesNumbersXOffsetMmUnidadeMark, posYUnidade, cellWidthPoints, cellHeightPoints, 'F');
    doc.setFillColor(0, 0, 0);
    doc.rect(
        pdfGamesNumbersXOffsetMmUnidadeMark + borderWidthPoints,
        posYUnidade + borderHeightPoints,
        cellWidthPoints - (2 * borderWidthPoints),
        cellHeightPoints - (2 * borderHeightPoints),
        'F'
    );
}

/**
 * Desenha o número da página (volante) no PDF.
 * @param {jsPDF} doc - A instância do jsPDF.
 * @param {number} pageNumber - O número da página atual.
 * @param {object} config - Configurações de impressão.
 */
function drawPageNumberOnPdf(doc, pageNumber, config) {
    // Posição X: START_X + 20mm
    //const pdfGamesNumbersXOffsetMm = mmToPoints(config.startXMm + 20);
    const pdfGamesNumbersXOffsetMm = mmToPoints(config.startXMm + config.pageNumberXOffsetMm);
    // Posição Y: PAGE_HEIGHT - 172mm (do topo da área desenhável)
    // Equivalente a (PAGE_HEIGHT - pdfMarginMm) - (186 - 172)mm do topo da área desenhável
    // = (186 - pdfMarginMm) - 14 mm do topo da área desenhável
    // = 172 - pdfMarginMm mm do topo da área desenhável
    //const posY = mmToPoints(172 - config.marginMm);
    const posY = mmToPoints(config.pageHeightMm - config.pageNumberYOffsetMm);

    doc.setFont("Verdana-Bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Preto
    doc.text(String(pageNumber), pdfGamesNumbersXOffsetMm, posY);
}

/**
 * Desenha os números dos jogos da página no final da folha.
 * @param {jsPDF} doc - A instância do jsPDF.
 * @param {number[][]} gamesOnPage - Array de jogos (cada jogo é um array de números) na página atual.
 * @param {object} config - Configurações de impressão.
 * @param {number} pdfPageHeightPoints - Altura da página PDF em pontos.
 */
function drawGamesNumbersOnPdf(doc, gamesOnPage, config, pdfPageHeightPoints) {
    //const startXPoints = mmToPoints(config.startXMm) + 40; // START_X + 40 points (as in Python)
    const startXPoints = mmToPoints(config.startXMm + config.gamesNumbersXOffsetMm);
    //const startYPoints = pdfPageHeightPoints - mmToPoints(3); // 3mm from the bottom of the drawable area
    const startYPoints = pdfPageHeightPoints - mmToPoints(config.gamesNumbersYOffsetMm);
    //const lineSpacingPoints = mmToPoints(3); // 3mm spacing between lines
    const lineSpacingPoints = mmToPoints(config.gamesNumbersLineSpacingMm);

    doc.setFont("Verdana-ExtraBold");
    doc.setFontSize(11); // 10pt font size (as in Python)
    doc.setTextColor(0, 0, 0); // Preto

    gamesOnPage.forEach((jogo, index) => {
        const jogoNumeros = jogo.map(num => String(num).padStart(2, '0')).join('-');
        const posY = startYPoints + (index * lineSpacingPoints);
        doc.text(jogoNumeros, startXPoints, posY);
    });
}

/**
 * Loads an image file and returns its data URL.
 * @param {File} file - The image file.
 * @returns {Promise<string>} A promise that resolves with the image data URL.
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
 * Função principal para gerar o PDF dos volantes.
 */
async function generateVolantePDF() {
    const statusEl = document.getElementById('status-impressao');
    const loaderEl = document.getElementById('loader-impressao');
    const { jsPDF } = window.jspdf; // Make sure jsPDF is loaded (e.g., via CDN)

    statusEl.textContent = 'Iniciando geração do PDF...';
    statusEl.classList.remove('error');
    loaderEl.style.display = 'block';

    try {
        const pdfConfig = {
            gameFile: document.getElementById('pdfGameFile').files[0],
            pageWidthMm: parseBrazilianNumber(document.getElementById('pdfPageWidthMm').value),
            pageHeightMm: parseBrazilianNumber(document.getElementById('pdfPageHeightMm').value),
            marginMm: parseBrazilianNumber(document.getElementById('pdfMarginMm').value),
            startXMm: parseBrazilianNumber(document.getElementById('pdfStartXMm').value),
            firstGameYFromTopMm: parseBrazilianNumber(document.getElementById('pdfFirstGameYFromTopMm').value),
            cellWidthMm: parseBrazilianNumber(document.getElementById('pdfCellWidthMm').value),
            cellHeightMm: parseBrazilianNumber(document.getElementById('pdfCellHeightMm').value),
            distanceBetweenGamesMm: parseBrazilianNumber(document.getElementById('pdfDistanceBetweenGamesMm').value),
            borderWidthMm: parseBrazilianNumber(document.getElementById('pdfBorderWidthMm').value),
            borderHeightMm: parseBrazilianNumber(document.getElementById('pdfBorderHeightMm').value),
            afterGameOffsetMm: parseBrazilianNumber(document.getElementById('pdfAfterGameOffsetMm').value),
            bolaoOffsetMm: parseBrazilianNumber(document.getElementById('pdfBolaoOffsetMm').value),
            defaultCotas: parseInt(document.getElementById('pdfDefaultCotas').value, 10),
            readCotasFromExcel: document.getElementById('pdfReadCotasFromExcel').checked,
            printBackgroundImage: document.getElementById('pdfPrintBackgroundImage').checked,
            backgroundImageFile: document.getElementById('pdfBackgroundImageFile').files[0],

            // Novos campos para posicionamento
            pageNumberXOffsetMm: parseBrazilianNumber(document.getElementById('pdfPageNumberXOffsetMm').value),
            pageNumberYOffsetMm: parseBrazilianNumber(document.getElementById('pdfPageNumberYOffsetMm').value),
            gamesNumbersXOffsetMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersXOffsetMm').value),
            gamesNumbersYOffsetMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersYOffsetMm').value),
            gamesNumbersLineSpacingMm: parseBrazilianNumber(document.getElementById('pdfGamesNumbersLineSpacingMm').value),
        };

        if (!pdfConfig.gameFile) {
            throw new Error('Por favor, selecione o arquivo Excel com os jogos.');
        }
        // Basic validation for other critical numbers (parseInt for defaultCotas is already done)
        if (isNaN(pdfConfig.pageWidthMm) || isNaN(pdfConfig.pageHeightMm) || isNaN(pdfConfig.marginMm) ||
            isNaN(pdfConfig.startXMm) || isNaN(pdfConfig.firstGameYFromTopMm) || isNaN(pdfConfig.cellWidthMm) ||
            isNaN(pdfConfig.cellHeightMm) || isNaN(pdfConfig.defaultCotas)) {
            throw new Error('Verifique as configurações de dimensão e posicionamento. Valores numéricos são esperados.');
        }
        if (pdfConfig.printBackgroundImage && !pdfConfig.backgroundImageFile) {
            throw new Error('"Imprimir Imagem de Fundo" está marcado, mas nenhum arquivo de imagem foi selecionado.');
        }


        statusEl.textContent = 'Lendo arquivo Excel...';
        // Assuming Quina (max 80 balls) for now. This could be made dynamic if needed.
        const layout = getVolanteLayout();
        const { jogos: jogosParaPdf, cotas: cotasParaPdf, dezenasPorJogo: dezenasPorJogoArray } =
            await readExcelForPdf(pdfConfig.gameFile, pdfConfig.readCotasFromExcel, layout.MAX_BALLS);

        if (!jogosParaPdf || jogosParaPdf.length === 0) {
            throw new Error('Nenhum jogo válido encontrado no arquivo Excel.');
        }

        // Área útil/desenhável da página em pontos
        // const drawableWidthPoints = mmToPoints(pdfConfig.pageWidthMm - (2 * pdfConfig.marginMm)); // Not directly used here, but for context
        // const drawableHeightPoints = mmToPoints(pdfConfig.pageHeightMm - (2 * pdfConfig.marginMm)); // Not directly used here

        // Ajuste para que as coordenadas (startXMm, firstGameYFromTopMm) sejam relativas à pdfMarginMm da página
        // Se o volante físico tem 82mm e pdfMarginMm de 2.96mm, a área útil é 82 - 2*2.96.
        // O jsPDF format [W, H] define o tamanho da mídia.
        // Se as coordenadas no HTML são relativas à borda física do papel, e não à área útil após pdfMarginMm,
        // então o startXMm e firstGameYFromTopMm já incluem a pdfMarginMm.
        // O Python script faz: PAGE_WIDTH = 82 * mm - pdfMarginMm. Isso é ambíguo.
        // Se pdfMarginMm é de cada lado, então PAGE_WIDTH = 82*mm - 2*pdfMarginMm.
        // Se pdfMarginMm é uma pdfMarginMm interna da área de impressão já definida, então PAGE_WIDTH = (82-pdfMarginMm)*mm.
        // Assumindo que `pdfPageWidthMm` é o tamanho físico do volante, e `pdfMarginMm` é a pdfMarginMm de cada lado
        // que NÃO PODE SER IMPRESSA. Então a área de impressão é `pdfPageWidthMm - 2 * pdfMarginMm`.
        // E `pdfStartXMm` é a partir da borda ESQUERDA da área de impressão.
        // E `pdfFirstGameYFromTopMm` é a partir da borda SUPERIOR da área de impressão.

        // O script Python define PAGE_WIDTH = 82 * mm - pdfMarginMm.
        // E depois usa START_X = 7.8 * mm.
        // Se pdfMarginMm = 2.96mm, PAGE_WIDTH_py = (82 - 2.96)mm = 79.04mm.
        // Se a intenção do Python é que a página do PDF seja (82-pdfMarginMm) x (186-pdfMarginMm),
        // e as coordenadas são relativas a essa página, então o jsPDF deve ser:
        // format: [mmToPoints(pdfConfig.pageWidthMm - pdfConfig.marginMm), mmToPoints(pdfConfig.pageHeightMm - pdfConfig.marginMm)]
        // E as coordenadas (startXMm, etc.) são relativas ao canto (0,0) dessa página.
        // Esta é a interpretação que o código anterior usou e parece mais consistente com o Python.

        const pdfDoc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: [
                mmToPoints(pdfConfig.pageWidthMm - pdfConfig.marginMm), // Largura da página PDF = Largura física - 1x pdfMarginMm (como no Python)
                mmToPoints(pdfConfig.pageHeightMm - pdfConfig.marginMm)  // Altura da página PDF = Altura física - 1x pdfMarginMm (como no Python)
            ]
        });

        const pdfPageWidthPoints = mmToPoints(pdfConfig.pageWidthMm - pdfConfig.marginMm);
        const pdfPageHeightPoints = mmToPoints(pdfConfig.pageHeightMm - pdfConfig.marginMm);

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
        await new Promise(resolve => setTimeout(resolve, 0)); // UI update

        let gameIndexInAllGames = 0;
        let pageCount = 0;
        while (gameIndexInAllGames < jogosParaPdf.length) {
            pageCount++;
            if (pageCount > 1) {
                pdfDoc.addPage();
            }

            // Informações do primeiro jogo desta página (volante) para os rodapés
            let firstGameDezenasCountThisPage = 0;
            let firstGameCotaThisPage = pdfConfig.defaultCotas;

            if (pdfConfig.readCotasFromExcel && gameIndexInAllGames < cotasParaPdf.length && cotasParaPdf[gameIndexInAllGames] !== null) {
                firstGameCotaThisPage = cotasParaPdf[gameIndexInAllGames];
            } else {
                firstGameCotaThisPage = pdfConfig.defaultCotas;
            }

            const gamesOnCurrentPage = []; // Collect games for this page to print numbers at the bottom
            // Desenhar imagem de fundo, se habilitada
            if (backgroundImageDataUrl) {
                // Assume que a imagem deve cobrir toda a página definida pelo format
                pdfDoc.addImage(backgroundImageDataUrl, 'JPEG', 0, 0, pdfPageWidthPoints, pdfPageHeightPoints);
            }
            // Desenhar o número da página DEPOIS da imagem de fundo
            drawPageNumberOnPdf(pdfDoc, pageCount, pdfConfig);

            // Capturar informações do primeiro jogo desta página (volante) para os rodapés
            // É importante fazer isso ANTES do loop de desenhar os jogos,
            // pois gameIndexInAllGames será incrementado dentro do loop.
            if (gameIndexInAllGames < dezenasPorJogoArray.length && dezenasPorJogoArray[gameIndexInAllGames]) {
                firstGameDezenasCountThisPage = dezenasPorJogoArray[gameIndexInAllGames];
            }

            // Desenhar os jogos no volante atual (página PDF)
            const layout = getVolanteLayout();
            for (let i = 0; i < layout.CARDS_PER_PAGE_PDF && gameIndexInAllGames < jogosParaPdf.length; i++) {
                const currentGameNumbers = jogosParaPdf[gameIndexInAllGames];
                gamesOnCurrentPage.push(currentGameNumbers); // Add game to the list for this page
                
                // Se for o primeiro jogo da página, suas propriedades já foram capturadas.
                // Se for o segundo (i=1), ele é apenas desenhado.
                drawCardOnPdf(pdfDoc, currentGameNumbers, i /*gameIndexOnPage*/, pdfConfig);
                
                gameIndexInAllGames++;
                if (gameIndexInAllGames % 20 === 0) { // Update status less frequently
                    statusEl.textContent = `Desenhando jogo ${gameIndexInAllGames} de ${jogosParaPdf.length}... (Volante ${pageCount})`;
                    await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update
                }
            }

            // Desenhar marcações de rodapé para o volante atual
            drawDezenasJogadasMark(pdfDoc, firstGameDezenasCountThisPage, pdfConfig);
            drawGamesNumbersOnPdf(pdfDoc, gamesOnCurrentPage, pdfConfig, pdfPageHeightPoints); // Draw game numbers at the bottom
            drawBolaoMark(pdfDoc, firstGameCotaThisPage, pdfConfig);
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

// Função para coletar as configurações atuais dos inputs
function coletarConfiguracoesImpressao() {
    return {
        pdfPageWidthMm: document.getElementById('pdfPageWidthMm').value,
        pdfPageHeightMm: document.getElementById('pdfPageHeightMm').value,
        pdfMarginMm: document.getElementById('pdfMarginMm')?.value || '',
        pdfGamesNumbersXOffsetMm: document.getElementById('pdfGamesNumbersXOffsetMm').value,
        // Adicione aqui outros campos conforme necessário
        pdfStartXMm: document.getElementById('pdfStartXMm').value,
        pdfFirstGameYFromTopMm: document.getElementById('pdfFirstGameYFromTopMm').value,
        pdfCellWidthMm: document.getElementById('pdfCellWidthMm').value,
        pdfCellHeightMm: document.getElementById('pdfCellHeightMm').value,
        pdfBorderWidthMm: document.getElementById('pdfBorderWidthMm').value,
        pdfBorderHeightMm: document.getElementById('pdfBorderHeightMm').value,
        pdfDistanceBetweenGamesMm: document.getElementById('pdfDistanceBetweenGamesMm').value,
        pdfAfterGameOffsetMm: document.getElementById('pdfAfterGameOffsetMm').value,
        pdfBolaoOffsetMm: document.getElementById('pdfBolaoOffsetMm').value,
        pdfDefaultCotas: document.getElementById('pdfDefaultCotas').value,
        pdfPageNumberXOffsetMm: document.getElementById('pdfPageNumberXOffsetMm').value,
        pdfPageNumberYOffsetMm: document.getElementById('pdfPageNumberYOffsetMm').value,
        pdfGamesNumbersXOffsetMm: document.getElementById('pdfGamesNumbersXOffsetMm').value,
        pdfGamesNumbersYOffsetMm: document.getElementById('pdfGamesNumbersYOffsetMm').value,
        pdfGamesNumbersLineSpacingMm: document.getElementById('pdfGamesNumbersLineSpacingMm').value,
    };
}

// Função para aplicar configurações nos inputs
function aplicarConfiguracoesImpressao(config) {
    if (config.pdfPageWidthMm) document.getElementById('pdfPageWidthMm').value = config.pdfPageWidthMm;
    if (config.pdfPageHeightMm) document.getElementById('pdfPageHeightMm').value = config.pdfPageHeightMm;
    if (config.pdfMarginMm && document.getElementById('pdfMarginMm')) document.getElementById('pdfMarginMm').value = config.pdfMarginMm;
    if (config.pdfGamesNumbersXOffsetMm) document.getElementById('pdfGamesNumbersXOffsetMm').value = config.pdfGamesNumbersXOffsetMm;
    // Adicione aqui outros campos conforme necessário
    if (config.pdfStartXMm) document.getElementById('pdfStartXMm').value = config.pdfStartXMm;
    if (config.pdfFirstGameYFromTopMm) document.getElementById('pdfFirstGameYFromTopMm').value = config.pdfFirstGameYFromTopMm;
    if (config.pdfCellWidthMm) document.getElementById('pdfCellWidthMm').value = config.pdfCellWidthMm;
    if (config.pdfCellHeightMm) document.getElementById('pdfCellHeightMm').value = config.pdfCellHeightMm;
    if (config.pdfBorderWidthMm) document.getElementById('pdfBorderWidthMm').value = config.pdfBorderWidthMm;
    if (config.pdfBorderHeightMm) document.getElementById('pdfBorderHeightMm').value = config.pdfBorderHeightMm;
    if (config.pdfDistanceBetweenGamesMm) document.getElementById('pdfDistanceBetweenGamesMm').value = config.pdfDistanceBetweenGamesMm;
    if (config.pdfAfterGameOffsetMm) document.getElementById('pdfAfterGameOffsetMm').value = config.pdfAfterGameOffsetMm;
    if (config.pdfBolaoOffsetMm) document.getElementById('pdfBolaoOffsetMm').value = config.pdfBolaoOffsetMm;
    if (config.pdfDefaultCotas) document.getElementById('pdfDefaultCotas').value = config.pdfDefaultCotas;
    if (config.pdfPageNumberXOffsetMm) document.getElementById('pdfPageNumberXOffsetMm').value = config.pdfPageNumberXOffsetMm;
    if (config.pdfPageNumberYOffsetMm) document.getElementById('pdfPageNumberYOffsetMm').value = config.pdfPageNumberYOffsetMm;
    if (config.pdfGamesNumbersXOffsetMm) document.getElementById('pdfGamesNumbersXOffsetMm').value = config.pdfGamesNumbersXOffsetMm;
    if (config.pdfGamesNumbersYOffsetMm) document.getElementById('pdfGamesNumbersYOffsetMm').value = config.pdfGamesNumbersYOffsetMm;
    if (config.pdfGamesNumbersLineSpacingMm) document.getElementById('pdfGamesNumbersLineSpacingMm').value = config.pdfGamesNumbersLineSpacingMm;
}

// Salvar como padrão (localStorage)
document.getElementById('btn-salvar-config-padrao').onclick = function() {
    const config = coletarConfiguracoesImpressao();
    localStorage.setItem('configPadraoImpressao', JSON.stringify(config));
    alert('Configuração padrão salva!');
    atualizarComboConfigs();
};

// Salvar em arquivo
document.getElementById('btn-salvar-config-arquivo').onclick = function() {
    const nome = document.getElementById('nome-config-personalizada').value.trim();
    if (!nome) {
        alert('Digite um nome para a configuração.');
        return;
    }
    const config = coletarConfiguracoesImpressao();
    localStorage.setItem('configImpressao_' + nome, JSON.stringify(config));
    // Também salva como arquivo JSON
    //const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
    //const a = document.createElement('a');
    //a.href = URL.createObjectURL(blob);
    //a.download = nome + '.json';
    //a.click();
    atualizarComboConfigs();
};


// Atualiza o combobox com as configurações salvas
function atualizarComboConfigs() {
    const combo = document.getElementById('combo-configs-salvas');
    combo.innerHTML = '<option value="">Selecione uma configuração salva...</option>';
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('configImpressao_')) {
            const nome = key.replace('configImpressao_', '');
            const option = document.createElement('option');
            option.value = key;
            option.textContent = nome;
            combo.appendChild(option);
        }
    }
}

// Carregar configuração selecionada
document.getElementById('btn-carregar-config').onclick = function() {
    const combo = document.getElementById('combo-configs-salvas');
    const key = combo.value;
    if (!key) {
        alert('Selecione uma configuração.');
        return;
    }
    const config = JSON.parse(localStorage.getItem(key));
    aplicarConfiguracoesImpressao(config);
    alert('Configuração carregada!');
};

// Carregar configuração padrão ao abrir a página
window.addEventListener('DOMContentLoaded', () => {
    const configPadrao = localStorage.getItem('configPadraoImpressao');
    if (configPadrao) {
        aplicarConfiguracoesImpressao(JSON.parse(configPadrao));
    }
    atualizarComboConfigs();
});

export { generateVolantePDF };
