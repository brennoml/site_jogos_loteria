/**
 * Módulo para gerar o relatório de geração de jogos em PDF.
 */

let doc, y, margin, pageWidth, pageHeight;

/**
 * Inicializa as variáveis globais para um novo documento PDF.
 * @param {jsPDF} pdfInstance - A instância do jsPDF.
 */
function setupPdfDocument(pdfInstance) {
    doc = pdfInstance;
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
    margin = 15;
    y = margin;
}

/**
 * Verifica se é necessário adicionar uma nova página e reseta a posição Y.
 * @param {number} requiredHeight - A altura necessária para o próximo conteúdo.
 */
function checkPageBreak(requiredHeight = 20) {
    if (y + requiredHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
    }
}

/**
 * Adiciona cabeçalho e rodapé a todas as páginas do documento.
 */
function addHeaderAndFooter() {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text(`LotoPro - Relatório de Geração`, margin, pageHeight - 10);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        doc.setTextColor(0);
    }
}

/**
 * Desenha um título de seção no PDF.
 * @param {string} title - O texto do título.
 */
function drawSectionTitle(title, x = margin, width = pageWidth - margin * 2) {
    checkPageBreak(15);
    y += (y === margin ? 0 : 8);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#1e293b');
    doc.text(title, x, y);
    y += 6;
    doc.setLineWidth(0.2);
    doc.setDrawColor('#e2e8f0');
    doc.line(x, y, x + width, y);
    y += 6;
}

/**
 * Desenha uma lista de chave-valor em duas colunas.
 * @param {Array<{label: string, value: string}>} items - A lista de itens.
 * @param {number} x - A posição X inicial da lista.
 * @param {number} width - A largura total disponível para a lista.
 */
function drawTwoColumnList(items, x = margin, width = pageWidth - margin * 2) {
    const labelWidth = 60;
    const col1X = x;
    const col2X = x + labelWidth;
    const valueWidth = width - labelWidth;
    const lineHeight = 6;

    doc.setFontSize(9);

    items.forEach(item => {
        checkPageBreak(lineHeight);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#374151');
        doc.text(item.label, col1X, y, { align: 'left', baseline: 'middle' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#1f2937');
        
        const valueLines = doc.splitTextToSize(String(item.value), valueWidth < 10 ? 10 : valueWidth);
        doc.text(valueLines, col2X, y, { baseline: 'middle' });

        y += (valueLines.length * (lineHeight - 1.5));
    });

    y += 2;
}

/**
 * Desenha um painel de bolas coloridas no PDF.
 * @param {string} title - Título do painel.
 * @param {string} subtitle - Subtítulo/descrição do painel.
 * @param {number[]} balls - Array de números das bolas a serem desenhadas.
 * @param {object} highlights - Objeto com Sets de bolas para destaque (e.g., { favorites: Set, inactiveRed: Set }).
 */
function drawBallPanel(title, subtitle, balls, highlights = {}) {
    checkPageBreak(25);
    drawSectionTitle(title);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#6b7280');
    const subtitleLines = doc.splitTextToSize(subtitle, pageWidth - margin * 2);
    doc.text(subtitleLines, margin, y);
    y += subtitleLines.length * 4 + 2;

    const ballRadius = 4;
    const ballDiameter = ballRadius * 2;
    const ballGap = 2;
    const itemWidth = ballDiameter + ballGap;
    const ballsPerRow = Math.floor((pageWidth - 2 * margin) / itemWidth);
    
    balls.forEach((ball, index) => {
        const col = index % ballsPerRow;
        if (col === 0 && index > 0) {
            y += itemWidth;
            checkPageBreak(itemWidth);
        }
        const x = margin + (col * itemWidth) + ballRadius;
        
        let fillColor = '#2563eb'; // default active
        let textColor = '#ffffff';
        let isFavorite = false;

        if (highlights.inactiveRed && highlights.inactiveRed.has(ball)) {
            fillColor = '#fecaca'; // light red
            textColor = '#991b1b';
        }
        if (highlights.newFromAproveitado && highlights.newFromAproveitado.has(ball)) {
            fillColor = '#dcfce7'; // light green
            textColor = '#166534';
        }
        if (highlights.inactive && highlights.inactive.has(ball)) {
            fillColor = '#e0e0e0'; // grey
            textColor = '#9e9e9e';
        }
        if (highlights.favorites && highlights.favorites.has(ball)) {
            isFavorite = true;
        }

        doc.setFillColor(fillColor);
        doc.circle(x, y, ballRadius, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(textColor);
        doc.text(String(ball).padStart(2, '0'), x, y, { align: 'center', baseline: 'middle' });

        if (isFavorite) {
            doc.setFontSize(12);
            doc.setTextColor('#f59e0b');
            // Usa o caractere de estrela e ajusta a posição
            doc.text('★', x + ballRadius - 1, y - ballRadius + 2.5);
        }
    });
    
    y += itemWidth + 5;
}

/**
 * Desenha a lista de jogos (aproveitados ou novos) em um frame com bolas visuais.
 * @param {string} title - Título da seção de jogos.
 * @param {Array<Array<number>>} games - A lista de jogos a serem desenhados.
 * @param {number} startIndex - O índice inicial para a numeração dos jogos.
 */
function renderGamesWithBalls(title, games, startIndex = 1) { // Reformulated for 2 columns and wrapping
    if (games.length === 0) return;
    
    doc.addPage();
    y = margin;
    drawSectionTitle(title);

    const col1X = margin;
    const col2X = pageWidth / 2;
    const colWidth = pageWidth / 2 - margin;
    
    const ballRadius = 3;
    const ballDiameter = ballRadius * 2;
    const ballGap = 1.5;
    const ballItemWidth = ballDiameter + ballGap;
    const indexWidth = 15;
    const ballsPerLine = Math.floor((colWidth - indexWidth) / ballItemWidth);

    const drawGame = (jogo, index, baseX, baseY) => {
        const numLinesForGame = Math.ceil(jogo.length / ballsPerLine);
        const gameHeight = numLinesForGame * ballItemWidth;

        // Draw game index
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#6b7280');
        doc.text(`J${String(startIndex + index).padStart(4, '0')}:`, baseX, baseY + ballRadius + 3);

        // Draw balls
        let currentBallX = baseX + indexWidth;
        let currentBallY = baseY;

        jogo.forEach((dezena, ballIndex) => {
            if (ballIndex > 0 && ballIndex % ballsPerLine === 0) {
                currentBallY += ballItemWidth;
                currentBallX = baseX + indexWidth;
            }
            doc.setFillColor('#1e293b');
            doc.circle(currentBallX + ballRadius, currentBallY + ballRadius + 3, ballRadius, 'F');
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor('#ffffff');
            doc.text(String(dezena).padStart(2, '0'), currentBallX + ballRadius, currentBallY + ballRadius + 3, { align: 'center', baseline: 'middle' });
            currentBallX += ballItemWidth;
        });

        return gameHeight;
    };

    for (let i = 0; i < games.length; i += 2) {
        const game1 = games[i];
        const game2 = (i + 1 < games.length) ? games[i + 1] : null;

        let height1 = 0;
        let height2 = 0;

        // Estimate height for a row, can be improved
        const estimatedHeight = (Math.ceil((game1?.length || 0) / ballsPerLine) * ballItemWidth) + 10;
        checkPageBreak(estimatedHeight);

        if (game1) {
            height1 = drawGame(game1, i, col1X, y);
        }
        if (game2) {
            height2 = drawGame(game2, i + 1, col2X, y);
        }

        y += Math.max(height1, height2) + 2; // Move y down by the max height of the row + padding
    }
}

/**
 * Gera o corpo principal do relatório (estatísticas e parâmetros).
 * @param {object} reportData - Os dados do relatório.
 */
function generateReportBody(reportData) {
    const p = reportData.parametros;

    // --- Cabeçalho do Documento ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor('#1e293b');
    doc.text('Relatório de Geração de Jogos - LotoPro', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor('#6b7280');
    const now = new Date();
    doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // --- Seções em duas colunas ---
    const col1X = margin;
    const colWidth = (pageWidth - margin * 2 - 10) / 2;
    const col2X = col1X + colWidth + 10;
    const startY = y;

    // --- Coluna 1: Estatísticas ---
    drawSectionTitle('Estatísticas Gerais', col1X, colWidth);
    let stats = [
        { label: 'Jogos Solicitados:', value: reportData.jogosSolicitados.toLocaleString('pt-BR') },
    ];
    if (reportData.jogosAproveitados > 0) {
        stats.push(
            { label: 'Jogos Aproveitados:', value: reportData.jogosAproveitados.toLocaleString('pt-BR') },
            { label: 'Novos Jogos Gerados:', value: reportData.jogosNovos.toLocaleString('pt-BR') },
            { label: 'Total de Jogos:', value: reportData.jogosGerados.toLocaleString('pt-BR') },
            { label: 'Descartados (Aproveitados):', value: reportData.jogosAproveitadosDescartados.toLocaleString('pt-BR') },
            { label: 'Descartados (Novos):', value: reportData.jogosNovosDescartados.toLocaleString('pt-BR') },
            { label: 'Custo Total:', value: reportData.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        );
    } else {
        stats.push(
            { label: 'Total de Jogos Gerados:', value: reportData.jogosGerados.toLocaleString('pt-BR') },
            { label: 'Jogos Descartados:', value: reportData.jogosDescartados.toLocaleString('pt-BR') },
            { label: 'Custo Total Estimado:', value: reportData.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        );
    }
    stats.push(
        { label: `Jogos Simples (${p.dezenasSimples} dezenas):`, value: reportData.jogosEquivalentes.toLocaleString('pt-BR') },
        { label: 'Tempo de Geração:', value: `${reportData.tempoGeracao} s` }
    );
    drawTwoColumnList(stats, col1X, colWidth);
    const yCol1 = y;

    // --- Coluna 2: Parâmetros ---
    y = startY;
    drawSectionTitle('Parâmetros da Geração', col2X, colWidth);
    const paramsList = [
        { label: 'Tipo de Jogo:', value: p.tipoJogo },
        { label: 'Dezenas por Jogo:', value: p.dezenasJogadas },
        { label: 'Acertos Garantidos:', value: p.acertosGarantidos },
        { label: 'Algoritmo:', value: p.algoritmo },
    ];
    if (p.algoritmo === 'Aleatório') {
        paramsList.push({ label: 'Timeout:', value: `${p.timeout}s` });
        paramsList.push({ label: 'Peso Favoritas:', value: p.usouPeso ? `${p.peso}x` : 'Não' });
    }
    paramsList.push({ label: 'Aproveitou Jogos:', value: p.aproveitouJogos ? 'Sim' : 'Não' });
    if (p.interrompido) {
        paramsList.push({ label: 'Status:', value: 'Interrompido pelo usuário' });
    }
    drawTwoColumnList(paramsList, col2X, colWidth);
    const yCol2 = y;

    // --- Continua abaixo das colunas ---
    y = Math.max(yCol1, yCol2);

    // --- Painéis de Bolas ---
    if (p.aproveitouJogos) {
        drawBallPanel(
            'Jogos Aproveitados',
            `Bolas contidas nos jogos do arquivo "${p.nomeArquivoAproveitado}". Em vermelho, as que não estavam na sua seleção:`,
            p.jogosAproveitadosInfo.dezenas,
            { inactiveRed: new Set(p.jogosAproveitadosInfo.dezenas.filter(b => !p.selecaoUsuario.dezenas.includes(b))) }
        );
    }

    const tipoUniverso = p.universoNovosJogos.tipo === 'selecao_usuario' ? 'a Seleção do Usuário' : 'as bolas dos jogos aproveitados';
    let subtitle = `Universo utilizado: ${tipoUniverso}.`;
    const legendItems = [];
    if (p.aproveitouJogos && p.universoNovosJogos.dezenas.some(d => p.jogosAproveitadosInfo.dezenas.includes(d))) {
        legendItems.push('em verde as que também estavam nos aproveitados');
    }
    if (p.universoNovosJogos.tipo === 'selecao_usuario' && p.favoritas.length > 0) {
        legendItems.push('com * as favoritas');
    }
    if (legendItems.length > 0) {
        subtitle += ` (${legendItems.join('; ')})`;
    }

    drawBallPanel(
        `Geração de Novos Jogos (${reportData.jogosNovos})`,
        subtitle,
        p.universoNovosJogos.dezenas,
        { 
            newFromAproveitado: new Set(p.jogosAproveitadosInfo.dezenas),
            favorites: p.universoNovosJogos.tipo === 'selecao_usuario' ? new Set(p.favoritas) : new Set()
        }
    );
}

/**
 * Gera um relatório em PDF com os resultados da geração de jogos.
 * @param {object} reportData - Os dados do relatório.
 */
function generateReportPDF(reportData) {
    if (!window.jspdf) {
        alert('Erro: Biblioteca jsPDF não carregada. Não é possível gerar o PDF.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const pdfInstance = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    setupPdfDocument(pdfInstance);

    generateReportBody(reportData);

    // --- Seção de Frequência de Bolas (Simplificada) ---
    drawSectionTitle('Frequência de Uso das Bolas');
    const sortedByFreq = [...reportData.frequenciaBolas].sort((a, b) => b.abs - a.abs || a.bola - b.bola);
    
    const ballRadius = 4;
    const ballDiameter = ballRadius * 2;
    const ballMargin = 3;
    const itemWidth = ballDiameter + ballMargin;
    const ballsPerRow = Math.floor((pageWidth - margin * 2) / itemWidth);
    
    sortedByFreq.forEach((item, index) => {
        checkPageBreak(ballDiameter + 12);

        const col = index % ballsPerRow;
        const row = Math.floor(index / ballsPerRow);

        const x = margin + (col * itemWidth) + ballRadius;
        const currentBallY = y + (row * (ballDiameter + 12)) + ballRadius;

        // Desenha a bola
        doc.setFillColor('#2563eb');
        doc.circle(x, currentBallY, ballRadius, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#ffffff');
        doc.text(String(item.bola).padStart(2, '0'), x, currentBallY, { align: 'center', baseline: 'middle' });

        // Desenha as frequências
        doc.setFontSize(7);
        doc.setTextColor('#1f2937');
        doc.setFont('helvetica', 'bold');
        doc.text(item.abs.toLocaleString('pt-BR'), x, currentBallY + ballRadius + 4, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#6b7280');
        doc.text(`${item.rel.toFixed(1).replace('.', ',')}%`, x, currentBallY + ballRadius + 8, { align: 'center' });
    });

    addHeaderAndFooter();

    // Salva o PDF
    doc.save(`Relatorio_Geracao_${reportData.parametros.tipoJogo}.pdf`);
}

/**
 * Gera um relatório completo em PDF, incluindo a lista de jogos gerados e aproveitados.
 * @param {object} reportData - Os dados do relatório.
 * @param {Array<Array<number>>} allGames - A lista completa de jogos.
 */
async function generateReportWithGamesPDF(reportData, allGames) {
    const { showNotification } = await import('./interface.js');
    showNotification('status-geracao', 'Gerando PDF detalhado, por favor aguarde...', 'info');
    
    const { jsPDF } = window.jspdf;
    const pdfInstance = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    setupPdfDocument(pdfInstance);

    generateReportBody(reportData);

    // --- PÁGINAS DE JOGOS ---
    const jogosAproveitados = allGames.slice(0, reportData.jogosAproveitados);
    const novosJogos = allGames.slice(reportData.jogosAproveitados);

    renderGamesWithBalls(`Jogos Aproveitados (${jogosAproveitados.length})`, jogosAproveitados);
    renderGamesWithBalls(`Novos Jogos Gerados (${novosJogos.length})`, novosJogos, jogosAproveitados + 1);

    addHeaderAndFooter();
    doc.save(`Relatorio_com_jogos_${reportData.jogosGerados}.pdf`);
}

export { generateReportPDF, generateReportWithGamesPDF };