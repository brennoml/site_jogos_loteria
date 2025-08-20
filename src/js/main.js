import { initializeInterface, handleGlobalGameTypeChange, updateGenerationInputsState } from './interface.js';
import { generateGames } from './generate.js';
import { processFiles } from './analyze.js';
import { generateVolantePDF } from './printPdf.js';

/**
 * Inicializa a aplicação.
 */
function init() {
    console.log('Inicializando aplicação...');

    if (!window.XLSX || !window.Cleave) {
        console.error('Dependências XLSX ou Cleave.js não carregadas.');
        const statusGeracao = document.getElementById('status-geracao');
        if (statusGeracao) {
            statusGeracao.textContent = 'Erro: Dependências não carregadas.';
            statusGeracao.classList.add('error');
        }
        const statusAnalise = document.getElementById('status-analise');
         if (statusAnalise) {
            statusAnalise.textContent = 'Erro: Dependências não carregadas.';
            statusAnalise.classList.add('error');
        }
        return;
    }

    initializeInterface();

    // Adicionar listeners para os botões
    const btnGerarJogos = document.getElementById('btn-gerar-jogos');
    const btnGerarRelatorio = document.getElementById('btn-gerar-relatorio');
    const btnGerarPdfVolantes = document.getElementById('btn-gerar-pdf-volantes');
    const tabGeracao = document.getElementById('tab-geracao');
    const tabAnalise = document.getElementById('tab-analise');
    const tabImpressao = document.getElementById('tab-impressao');

    if (btnGerarJogos) {
        btnGerarJogos.addEventListener('click', () => {
            console.log('Botão Gerar Jogos clicado');
            generateGames();
        });
    } else {
        console.error('Botão Gerar Jogos não encontrado');
    }

    if (btnGerarRelatorio) {
        btnGerarRelatorio.addEventListener('click', () => {
            console.log('Botão Gerar Relatório clicado');
            processFiles();
        });
    } else {
        console.error('Botão Gerar Relatório não encontrado');
    }

    if (btnGerarPdfVolantes) {
        btnGerarPdfVolantes.addEventListener('click', () => {
            console.log('Botão Gerar PDF Volantes clicado');
            generateVolantePDF();
        });
    } else {
        console.error('Botão Gerar PDF Volantes não encontrado');
    }

    // Adicionar listeners para as abas
    if (tabGeracao && tabAnalise && tabImpressao) {
        tabGeracao.addEventListener('click', () => toggleTab('geracao'));
        tabAnalise.addEventListener('click', () => toggleTab('analise'));
        tabImpressao.addEventListener('click', () => toggleTab('impressao'));
    } else {
        console.error('Abas não encontradas');
    }

    // Listener para o select de tipo de jogo GLOBAL
    const gameTypeGlobalSelect = document.getElementById('gameTypeGlobal');
    if (gameTypeGlobalSelect) {
        gameTypeGlobalSelect.addEventListener('change', handleGlobalGameTypeChange);
    }

    // Listeners para checkboxes e inputs na aba Geração
    const bolasAleatoriasCheckbox = document.getElementById('bolasAleatorias');
    const aproveitaJogosCheckbox = document.getElementById('aproveitaJogos');
    const jogosSorteadosCheckbox = document.getElementById('jogosSorteados');
    const forcarUniversoOriginalCheckbox = document.getElementById('forcarUniversoOriginalParaNovos');
    const dezenasJogadasInput = document.getElementById('dezenasJogadas');


    if (bolasAleatoriasCheckbox) {
        bolasAleatoriasCheckbox.addEventListener('change', updateGenerationInputsState);
    }
    if (aproveitaJogosCheckbox) {
        aproveitaJogosCheckbox.addEventListener('change', updateGenerationInputsState);
    }
    if (jogosSorteadosCheckbox) {
        jogosSorteadosCheckbox.addEventListener('change', updateGenerationInputsState);
    }
    if (forcarUniversoOriginalCheckbox) {
        forcarUniversoOriginalCheckbox.addEventListener('change', updateGenerationInputsState);
    }
    if (dezenasJogadasInput) { // Para atualizar presets se dezenas por jogo mudar
        dezenasJogadasInput.addEventListener('change', updateGenerationInputsState);
    }


    // Listeners para mostrar nome do arquivo selecionado
    const jogosExistentesFileInput = document.getElementById('jogosExistentesFile');
    const userFileAnaliseInput = document.getElementById('userFileAnalise');
    const pdfGameFileInput = document.getElementById('pdfGameFile');
    const pdfBackgroundImageFileInput = document.getElementById('pdfBackgroundImageFile');

    if (jogosExistentesFileInput) {
        jogosExistentesFileInput.addEventListener('change', function() {
            const display = document.getElementById('jogosExistentesFileName');
            if (display) display.textContent = this.files.length > 0 ? this.files[0].name : '';
        });
    }
    if (pdfGameFileInput) {
        pdfGameFileInput.addEventListener('change', function() {
            const display = document.getElementById('pdfGameFileName');
            if (display) display.textContent = this.files.length > 0 ? this.files[0].name : '';
        });

    }
    if (userFileAnaliseInput) {
        userFileAnaliseInput.addEventListener('change', function() {
            const display = document.getElementById('userFileAnaliseName');
            if (display) display.textContent = this.files.length > 0 ? this.files[0].name : '';
        });
    }
    if (pdfBackgroundImageFileInput) {
        pdfBackgroundImageFileInput.addEventListener('change', function() {
            const display = document.getElementById('pdfBackgroundImageFileName');
            if (display) display.textContent = this.files.length > 0 ? this.files[0].name : '';
        });
    }

    // Listener para o checkbox de imagem de fundo na aba de impressão
    const pdfPrintBackgroundImageCheckbox = document.getElementById('pdfPrintBackgroundImage');
    if (pdfPrintBackgroundImageCheckbox && pdfBackgroundImageFileInput) {
        pdfPrintBackgroundImageCheckbox.addEventListener('change', function() {
            pdfBackgroundImageFileInput.disabled = !this.checked;
            if (!this.checked) {
                pdfBackgroundImageFileInput.value = ''; // Limpa o arquivo selecionado
                const display = document.getElementById('pdfBackgroundImageFileName');
                if (display) display.textContent = '';
            }
        });
    }
}

/**
 * Alterna entre abas.
 * @param {string} tabId - ID da aba a ativar.
 */
function toggleTab(tabId) {
    console.log(`Alternando para aba: ${tabId}`);
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    
    const tabContent = document.getElementById(tabId);
    const tabButton = document.getElementById(`tab-${tabId}`);

    if (tabContent) tabContent.classList.add('active');
    if (tabButton) tabButton.classList.add('active');
}

document.addEventListener('DOMContentLoaded', init);