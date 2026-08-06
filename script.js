/**
 * ============================================================================
 * COELHOS ACADEMY - MOTOR FRONTEND 2.0
 * ============================================================================
 *
 * ÍNDICE DESTE ARQUIVO (use Ctrl+F / Cmd+F e cole o título da seção que
 * procura — todos os títulos abaixo existem literalmente no código):
 *
 *   INICIALIZAÇÃO DA PÁGINA .......................... configura tema, data, listeners iniciais
 *   AVISO DE CAPS LOCK ................................ aviso visual no login/cadastro
 *   PADRONIZAÇÃO DO WHATSAPP .......................... máscara de telefone (99) 99999-9999
 *   ESQUECI MINHA SENHA -> SUPORTE VIA WHATSAPP ....... botão de suporte
 *   INTERFACE E NAVEGAÇÃO ............................. troca de tema, menu mobile, navigateTo()
 *   COMUNICAÇÃO COM API (FETCH) ....................... apiRequest() — TODA chamada ao backend passa aqui
 *   AUTENTICAÇÃO E CADASTRO ........................... login, registro, logout
 *   MOTOR DE CURSOS E AULAS ........................... grade de cursos, sala de aula, PLAYER DE VÍDEO
 *   AVALIAÇÕES E COMENTÁRIOS .......................... estrelas e comentários por curso
 *   ENVIO DE ATIVIDADE FINAL .......................... upload de atividade (final ou por aula)
 *   CERTIFICADOS ....................................... emissão + geração do PDF
 *   MEUS CERTIFICADOS (ALUNO) ......................... listagem de certificados do aluno
 *   FLASHCARDS (ANKI) DINÂMICO ........................ cartões de memorização com repetição espaçada
 *   REGISTRO DE LOGS (ADMIN PANEL) .................... histórico de acessos
 *   ADMIN: FILA DE ATIVIDADES PENDENTES ............... aprovar/reprovar atividades
 *   ADMIN: SOLICITAÇÕES DE ACESSO A CURSOS PAGOS ...... liberar/revogar acesso pago
 *   RECUPERAÇÃO DE ACESSO (SELF-SERVICE) .............. fluxo de "esqueci minha senha" automático
 *   ANÚNCIOS (BANNER PÚBLICO) ......................... banner de propaganda antes do login
 *   NOTIFICAÇÕES INTERNAS (SINO) ...................... sino de notificações do topo
 *   MEU PERFIL ......................................... edição de dados + troca de senha
 *   GAMIFICAÇÃO: RANKING .............................. ranking público de alunos
 *   BLOG / ARTIGOS ..................................... blog público do site
 *   ADMIN: DASHBOARD COM GRÁFICOS ..................... gráficos do painel admin (Chart.js)
 *   ONBOARDING: TOUR GUIADO ............................ tour do primeiro acesso do aluno
 *   DÚVIDAS POR AULA ................................... perguntas e respostas por aula
 *   ADMIN: DÚVIDAS PENDENTES DE RESPOSTA .............. fila de dúvidas pro professor responder
 *   VERIFICAÇÃO PÚBLICA DE CERTIFICADO ................ página /verificar (sem precisar login)
 *   COMPARTILHAR CERTIFICADO (IMAGEM) ................. gera imagem pra Instagram/LinkedIn
 *   BOTÃO FLUTUANTE DE WHATSAPP ........................ suporte sempre visível
 *
 * DICA: se for mexer no PLAYER DE VÍDEO (YouTube/Drive/link direto), procure
 * por "renderizarPlayerAula" — é a função que decide como cada vídeo é tocado.
 * ============================================================================
 */

// URL DO APPS SCRIPT - Banco de Dados
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz3YQ8A0T4Q9k7hD2hAac9MdA4l8pcPpRiKRsicY4sUQUDjBMYm3Dh8TtEnkXhzEpk/exec";

// Logo usada no certificado e (opcionalmente) na marca
const LOGO_URL = "https://i.postimg.cc/qvJD9HPp/LOGO.jpg";

// Número de WhatsApp usado em todos os botões de contato do site (suporte, recuperação de
// acesso, compra de curso pago e envio de atividade). Formato: 55 + DDD + número, sem símbolos.
const WHATSAPP_NUMERO = "5521985211884";

/**
 * ----------------------------------------------------------------------------
 * PERFORMANCE: CARREGAMENTO SOB DEMANDA DE BIBLIOTECAS EXTERNAS
 * ----------------------------------------------------------------------------
 * jsPDF (gera o certificado) e Chart.js (gráficos do admin) são bibliotecas
 * relativamente pesadas que a MAIORIA dos visitantes nunca usa (só quem emite
 * certificado ou é admin). Em vez de forçar todo mundo a baixar as duas em
 * toda visita, elas só são baixadas na hora exata em que a funcionalidade que
 * depende delas é acionada — ver uso em gerarCertificadoPDF() e
 * carregarDashboardAdmin().
 *
 * Como usar em qualquer lugar novo do código:
 *   await carregarBibliotecaExterna('https://.../minha-lib.js', 'NomeGlobalDaLib');
 * ============================================================================
 */
const CDN_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const CDN_CHARTJS = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const bibliotecasCarregadas = {}; // cache simples: evita baixar a mesma lib duas vezes na mesma sessão

function carregarBibliotecaExterna(url, nomeGlobal) {
    return new Promise((resolve, reject) => {
        // Já carregada nesta sessão, ou já existe no window por outro motivo? Não baixa de novo.
        if (bibliotecasCarregadas[url] || (nomeGlobal && window[nomeGlobal])) {
            bibliotecasCarregadas[url] = true;
            resolve();
            return;
        }
        const tagScript = document.createElement('script');
        tagScript.src = url;
        tagScript.onload = () => { bibliotecasCarregadas[url] = true; resolve(); };
        tagScript.onerror = () => reject(new Error(`Não foi possível carregar: ${url}`));
        document.head.appendChild(tagScript);
    });
}

let certificadosGlobais = 0;

let currentUser = {
    role: 'guest',
    name: 'Visitante',
    nomeCompleto: '',
    email: '',
    token: '',
    cursosLiberados: [],
    fotoPerfil: '',
    rankingPublico: false
};

let cursoAtual = {
    id: null,
    nome: "",
    cargaHoraria: 40,
    modoAtividade: 'final'
};

let aulaAtual = { ordem: null, titulo: '', temAtividade: false };

// status da atividade final do curso aberto no momento: 'nao_enviada' | 'pendente' | 'aprovado' | 'reprovado'
let statusAtividadeAtual = 'nao_enviada';

// ==========================================
// INICIALIZAÇÃO DA PÁGINA
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('coelhos-theme') || 'dark';
    const savedFont = localStorage.getItem('coelhos-font') || 'normal';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-font', savedFont);

    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        dateElement.innerText = new Date().toLocaleDateString('pt-BR', options);
    }

    updateUIPermissions();
    carregarCursosVitrine();
    carregarAnuncios();

    configurarAvisoCapsLock('log-senha', 'log-capslock-aviso');
    configurarAvisoCapsLock('reg-senha', 'reg-capslock-aviso');
    configurarAvisoCapsLock('reg-senha2', 'reg-senha2-capslock-aviso');

    document.getElementById('reg-whats')?.addEventListener('input', (e) => {
        e.target.value = formatarWhatsApp(e.target.value);
    });
});

// ==========================================
// AVISO DE CAPS LOCK
// ==========================================
function configurarAvisoCapsLock(inputId, avisoId) {
    const input = document.getElementById(inputId);
    const aviso = document.getElementById(avisoId);
    if (!input || !aviso) return;

    const verificar = (e) => {
        const ativo = !!(e.getModifierState && e.getModifierState('CapsLock'));
        aviso.style.display = ativo ? 'flex' : 'none';
    };
    input.addEventListener('keydown', verificar);
    input.addEventListener('keyup', verificar);
    input.addEventListener('blur', () => { aviso.style.display = 'none'; });
}

// ==========================================
// PADRONIZAÇÃO DO WHATSAPP (DDD + 8 ou 9 dígitos)
// ==========================================
function formatarWhatsApp(valor) {
    let numeros = valor.replace(/\D/g, '').slice(0, 11);
    if (numeros.length === 0) return '';
    if (numeros.length <= 2) return `(${numeros}`;

    const ddd = numeros.slice(0, 2);
    const resto = numeros.slice(2);

    if (resto.length <= 4) return `(${ddd}) ${resto}`;
    if (resto.length <= 8) {
        return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
    }
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5, 9)}`;
}

// ==========================================
// ESQUECI MINHA SENHA -> SUPORTE VIA WHATSAPP
// ==========================================
function esqueciSenha() {
    const numeroSuporte = WHATSAPP_NUMERO;
    const mensagem = encodeURIComponent("Olá! Esqueci minha senha na Coelhos Academy e preciso de ajuda para recuperar o acesso.");
    window.open(`https://wa.me/${numeroSuporte}?text=${mensagem}`, '_blank');
}

// ==========================================
// INTERFACE E NAVEGAÇÃO
// ==========================================
function changeTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('coelhos-theme', theme);
}

function toggleFontSize() {
    const root = document.documentElement;
    const newSize = root.getAttribute('data-font') === 'normal' ? 'large' : 'normal';
    root.setAttribute('data-font', newSize);
    localStorage.setItem('coelhos-font', newSize);
}

function updateUIPermissions() {
    const authLinks = document.querySelectorAll('.auth-only');
    const adminLinks = document.querySelectorAll('.admin-only');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    const roleBadge = document.getElementById('topbar-role-badge');
    const userNameDisplay = document.getElementById('user-display-name');

    userNameDisplay.innerText = currentUser.name;
    atualizarAvatarSidebar();

    if (currentUser.role === 'guest') {
        authLinks.forEach(link => link.style.display = 'none');
        adminLinks.forEach(link => link.style.display = 'none');
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
    }
    else if (currentUser.role === 'student') {
        authLinks.forEach(link => link.style.display = 'flex');
        adminLinks.forEach(link => link.style.display = 'none');
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        roleBadge.innerText = 'Aluno';
        roleBadge.style.color = 'var(--accent)';
        carregarNotificacoes();
        iniciarTourOnboardingSeNecessario();
    }
    else if (currentUser.role === 'admin') {
        authLinks.forEach(link => link.style.display = 'flex');
        adminLinks.forEach(link => link.style.display = 'flex');
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        roleBadge.innerText = 'Admin';
        roleBadge.style.color = '#10b981';
        carregarLogsAdmin();
        carregarAtividadesPendentesAdmin();
        carregarCertificadosAdmin();
        carregarSolicitacoesCursoAdmin();
        carregarNotificacoes();
        carregarDashboardAdmin();
        carregarDuvidasPendentesAdmin();
    }
}

function atualizarAvatarSidebar() {
    const container = document.getElementById('avatar-container');
    if (!container) return;
    if (currentUser.fotoPerfil) {
        container.innerHTML = `<img src="${currentUser.fotoPerfil}" alt="Foto de perfil" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'ri-user-line\\'></i>';">`;
    } else {
        container.innerHTML = `<i class="ri-user-line"></i>`;
    }
}

function navigateTo(targetId) {
    const targetSection = document.getElementById(targetId);

    if (targetSection && targetSection.classList.contains('auth-protected') && currentUser.role === 'guest') {
        alert("Acesso Negado: Você precisa fazer login para acessar esta área.");
        openAuthPage('login');
        return;
    }

    if (targetSection && targetSection.classList.contains('admin-protected') && currentUser.role !== 'admin') {
        alert("Acesso Negado: Área restrita para administradores.");
        navigateTo('home');
        return;
    }

    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

    if (targetSection) {
        targetSection.classList.add('active');

        if (targetId === 'flashcards') carregarFlashcardsAPI();
        if (targetId === 'meus-certificados') carregarMeusCertificados();
        if (targetId === 'recuperar-acesso') resetarRecuperacaoAcesso();
        if (targetId === 'meu-perfil') carregarMeuPerfil();
        if (targetId === 'ranking') carregarRanking();
        if (targetId === 'blog') carregarBlog();
        if (targetId === 'admin-panel' && currentUser.role === 'admin') {
            carregarAtividadesPendentesAdmin();
            carregarCertificadosAdmin();
            carregarSolicitacoesCursoAdmin();
            carregarDashboardAdmin();
            carregarDuvidasPendentesAdmin();
        }

        const activeLink = document.querySelector(`.nav-links a[href="#${targetId}"]`);
        if (activeLink) activeLink.parentElement.classList.add('active');
        document.querySelector('.content-area').scrollTo(0, 0);
    }
}

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        navigateTo(targetId);
        document.querySelector('.sidebar')?.classList.remove('menu-aberto');
    });
});

function toggleMobileMenu() {
    document.querySelector('.sidebar')?.classList.toggle('menu-aberto');
}

function openAuthPage(type) {
    navigateTo('auth-section');
    switchAuth(type);
}

function switchAuth(type) {
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');

    if (type === 'login') {
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        formLogin.style.display = 'none';
        formRegister.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

// ==========================================
// COMUNICAÇÃO COM API (FETCH)
// ==========================================
async function apiRequest(payload) {
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const textResponse = await response.text();
        try {
            return JSON.parse(textResponse);
        } catch (e) {
            throw new Error("Erro no servidor Apps Script.");
        }
    } catch (error) {
        return { status: 'error', message: 'Falha de comunicação de rede.' };
    }
}

// ==========================================
// AUTENTICAÇÃO E CADASTRO
// ==========================================
document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('reg-senha').value;
    const senha2 = document.getElementById('reg-senha2').value;

    if (senha !== senha2) return alert("Erro: As senhas não coincidem.");

    const whatsDigitos = document.getElementById('reg-whats').value.replace(/\D/g, '');
    if (whatsDigitos.length < 10 || whatsDigitos.length > 11) {
        return alert("Informe um WhatsApp válido com DDD (Ex: (21) 98521-1884 ou (21) 8521-1884).");
    }

    if (!document.getElementById('reg-privacidade').checked) {
        return alert("É necessário aceitar a Política de Privacidade para se cadastrar.");
    }

    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Registrando...";
    btn.disabled = true;

    const payload = {
        action: 'register',
        nome: document.getElementById('reg-nome').value,
        email: document.getElementById('reg-email').value,
        whats: whatsDigitos,
        senha: senha,
        news: document.getElementById('reg-news').checked,
        aceitePrivacidade: true
    };

    const res = await apiRequest(payload);

    if (res.status === 'success') {
        currentUser.role = res.data.role;
        currentUser.name = res.data.nome.split(' ')[0];
        currentUser.nomeCompleto = res.data.nome;
        currentUser.email = payload.email;
        currentUser.token = res.data.token;
        currentUser.cursosLiberados = res.data.cursosLiberados || [];
        currentUser.fotoPerfil = res.data.fotoPerfil || '';
        currentUser.rankingPublico = !!res.data.rankingPublico;

        updateUIPermissions();
        carregarCursosVitrine(); // refaz a grade de cursos: agora que sabemos os cursos liberados, os botões "Comprar"/"Acessar" ficam corretos
        document.getElementById('form-register').reset();
        registrarAcessoSilencioso("Novo Cadastro");
        navigateTo('dashboard');
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    const email = document.getElementById('log-email').value;
    const senha = document.getElementById('log-senha').value;

    btn.innerText = "Autenticando...";
    btn.disabled = true;

    const res = await apiRequest({ action: 'login', email, senha });

    if (res.status === 'success') {
        currentUser.role = res.data.role;
        currentUser.name = res.data.nome.split(' ')[0];
        currentUser.nomeCompleto = res.data.nome;
        currentUser.email = res.data.email;
        currentUser.token = res.data.token;
        currentUser.cursosLiberados = res.data.cursosLiberados || [];
        currentUser.fotoPerfil = res.data.fotoPerfil || '';
        currentUser.rankingPublico = !!res.data.rankingPublico;

        updateUIPermissions();
        carregarCursosVitrine(); // refaz a grade de cursos com os cursos liberados deste aluno
        document.getElementById('form-login').reset();
        registrarAcessoSilencioso("Login");

        if (currentUser.role === 'admin') navigateTo('admin-panel');
        else navigateTo('dashboard');
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

function logout() {
    registrarAcessoSilencioso("Logout");
    currentUser = { role: 'guest', name: 'Visitante', nomeCompleto: '', email: '', token: '', cursosLiberados: [], fotoPerfil: '', rankingPublico: false };
    updateUIPermissions();
    carregarCursosVitrine(); // volta a grade pro estado de visitante (sem cursos pagos liberados)
    navigateTo('home');
}

// ==========================================
// MOTOR DE CURSOS E AULAS
// ==========================================
function transformarLinkDrive(url) {
    if (!url) return '';
    // Extrai o ID do arquivo não importa o formato do link colado (view, open?id=, edit, já em /preview, etc.)
    // IDs de arquivo do Google Drive são uma sequência longa de letras/números/traço/underline.
    const match = url.match(/[-\w]{25,}/);
    if (match) {
        return `https://drive.google.com/file/d/${match[0]}/preview`;
    }
    // Plano B, caso não consiga extrair um ID reconhecível.
    return url.replace(/\/view.*$/, '/preview');
}

async function carregarCursosVitrine() {
    const gridCursos = document.getElementById('grid-cursos');
    const gridHome = document.getElementById('home-cursos');

    const res = await apiRequest({ action: 'getCursos' });

    if (res.status === 'success') {
        const htmlRenderizado = res.data.map(curso => {
            const emBreve = String(curso.desc || '').trim().toLowerCase() === 'em breve';
            const ehPago = Number(curso.price) > 0;
            const jaTemAcesso = currentUser.role === 'admin' || !ehPago || currentUser.cursosLiberados.includes(String(curso.id));

            let btnText, disabledAttr, onclickAttr;
            if (emBreve) {
                btnText = "Em Breve"; disabledAttr = 'disabled'; onclickAttr = '';
            } else if (ehPago && !jaTemAcesso) {
                btnText = `<i class="ri-whatsapp-line"></i> Comprar (R$ ${Number(curso.price).toFixed(2).replace('.', ',')})`;
                disabledAttr = '';
                onclickAttr = `onclick="solicitarCompraCurso(${curso.id}, '${escapeAttr(curso.title)}', ${curso.price})"`;
            } else {
                btnText = ehPago ? "Acessar Curso" : "Acessar Grátis";
                disabledAttr = '';
                onclickAttr = `onclick="abrirSalaDeAula(${curso.id}, '${escapeAttr(curso.title)}', '${curso.pdfLink}', '${curso.pptLink}', ${curso.price}, '${curso.modoAtividade}')"`;
            }

            return `
                <div class="bento-card course-card ${emBreve ? 'coming-soon' : ''}">
                    <div class="course-cover-wrap">
                        <img src="${curso.image}" alt="${curso.title}" class="course-cover-img" loading="lazy" onerror="this.src='https://via.placeholder.com/400x200?text=Capa+Indispon%C3%ADvel'">
                        ${emBreve ? '<div class="coming-soon-badge"><i class="ri-time-line"></i>&nbsp; Em Breve</div>' : ''}
                    </div>
                    <span class="role-badge" style="width: fit-content; margin-bottom: 10px;">${curso.category}</span>
                    <h3>${curso.title}</h3>
                    <p>${curso.desc}</p>
                    <button class="primary-btn" ${disabledAttr} ${onclickAttr}>${btnText}</button>
                </div>
            `;
        }).join('');

        if (gridCursos) gridCursos.innerHTML = htmlRenderizado;
        if (gridHome) gridHome.innerHTML = htmlRenderizado;
    } else {
        const erroMsg = `<p style="color: #ef4444;">Erro ao carregar cursos do banco de dados.</p>`;
        if (gridCursos) gridCursos.innerHTML = erroMsg;
        if (gridHome) gridHome.innerHTML = erroMsg;
    }
}

function escapeAttr(str) {
    return String(str || '').replace(/'/g, "\\'");
}

function abrirSalaDeAula(idCurso, nomeCurso, pdfLink, pptLink, price, modoAtividade) {
    if (currentUser.role === 'guest') {
        alert("Você precisa fazer login para acessar a Sala de Aula.");
        openAuthPage('login');
        return;
    }

    const ehPago = Number(price) > 0;
    if (ehPago && currentUser.role !== 'admin' && !currentUser.cursosLiberados.includes(String(idCurso))) {
        alert("Este é um curso pago. Solicite a liberação de acesso após confirmar o pagamento.");
        return;
    }

    cursoAtual.id = idCurso;
    cursoAtual.nome = nomeCurso;
    cursoAtual.modoAtividade = modoAtividade === 'por_aula' ? 'por_aula' : 'final';
    aulaAtual = { ordem: null, titulo: '', temAtividade: false };

    document.getElementById('sala-aula-titulo').innerText = nomeCurso;
    document.getElementById('lista-aulas').innerHTML = '<p><i class="ri-loader-4-line ri-spin"></i> Carregando aulas...</p>';
    document.getElementById('video-player-container').innerHTML = `<i class="ri-google-drive-fill"></i><p>Selecione uma aula ao lado</p>`;

    const btnCompartilhar = document.getElementById('btn-compartilhar-certificado');
    if (btnCompartilhar) btnCompartilhar.style.display = 'none';
    const duvidasBox = document.getElementById('duvidas-box');
    if (duvidasBox) duvidasBox.style.display = 'none';

    const boxMateriais = document.getElementById('materiais-complementares');
    if (boxMateriais) {
        let htmlMateriais = `<h4><i class="ri-folder-download-line"></i> Materiais Extras</h4>`;
        let temMaterial = false;

        if (pdfLink && pdfLink !== 'undefined' && pdfLink.trim() !== '') {
            htmlMateriais += `<a href="${pdfLink}" target="_blank" class="btn-ghost" style="margin-bottom:10px; display:block; text-align:center;"><i class="ri-file-pdf-2-line"></i> Baixar PDF</a>`;
            temMaterial = true;
        }
        if (pptLink && pptLink !== 'undefined' && pptLink.trim() !== '') {
            htmlMateriais += `<a href="${pptLink}" target="_blank" class="btn-ghost" style="margin-bottom:10px; display:block; text-align:center;"><i class="ri-file-ppt-2-line"></i> Baixar Slide</a>`;
            temMaterial = true;
        }
        if (!temMaterial) {
            htmlMateriais += `<p style="font-size: 0.8rem; color: var(--text-muted);">Nenhum material extra disponível.</p>`;
        }
        boxMateriais.innerHTML = htmlMateriais;
    }

    navigateTo('sala-aula');
    carregarAulasDoCurso(idCurso);
    carregarAvaliacoesDoCurso(idCurso);
    carregarStatusAtividade(idCurso);
    registrarAcessoSilencioso(`Entrou no curso: ${nomeCurso}`);
}

async function solicitarCompraCurso(idCurso, nomeCurso, preco) {
    if (currentUser.role === 'guest') {
        alert("Você precisa fazer login para solicitar um curso pago.");
        openAuthPage('login');
        return;
    }

    const numeroSuporte = WHATSAPP_NUMERO;
    const precoFormatado = Number(preco).toFixed(2).replace('.', ',');
    const mensagem = encodeURIComponent(`Olá! Quero comprar o curso "${nomeCurso}" (R$ ${precoFormatado}) na Coelhos Academy. Meu e-mail de cadastro é ${currentUser.email}.`);
    window.open(`https://wa.me/${numeroSuporte}?text=${mensagem}`, '_blank');

    const res = await apiRequest({
        action: 'solicitarAcessoCurso',
        email: currentUser.email,
        token: currentUser.token,
        courseId: idCurso,
        courseName: nomeCurso
    });

    if (res.status === 'success') {
        alert("Solicitação registrada! Assim que confirmarmos o pagamento pelo WhatsApp, seu acesso será liberado.");
    }
}

async function carregarAulasDoCurso(idCurso) {
    const res = await apiRequest({ action: 'getAulas', courseId: idCurso });
    const lista = document.getElementById('lista-aulas');
    lista.innerHTML = '';

    if (res.status === 'success' && res.data.length > 0) {
        res.data.forEach((aula) => {
            const li = document.createElement('li');
            li.className = 'lesson-item';
            li.innerHTML = `<i class="ri-play-circle-line"></i> Aula ${aula.ordem}: ${aula.title}`;

            li.onclick = () => {
                document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                renderizarPlayerAula(aula.url, aula.title, aula.ordem);

                registrarAcessoSilencioso(`Assistindo: ${aula.title}`);
                aulaAtual = { ordem: aula.ordem, titulo: aula.title, temAtividade: !!aula.temAtividade };
                abrirDuvidasDaAula(aula.ordem, aula.title);
                // Busca o status direto do servidor (não usa cache) para garantir que a aula certa mostre o status certo.
                carregarStatusAtividade(cursoAtual.id);
            };
            lista.appendChild(li);
        });
    } else {
        lista.innerHTML = '<p style="font-size: 0.9rem; color: var(--text-muted);">Nenhuma aula encontrada.</p>';
    }
}

// Toca o vídeo com um <video> nativo apontando direto para o conteúdo do arquivo no Drive.
// Isso evita depender do player embutido do Drive (que exige cookies de terceiros e falha em
// navegadores com proteção de rastreamento ativada). Se por qualquer motivo o vídeo direto falhar
// (arquivo grande demais, aviso de verificação de vírus, etc.), cai automaticamente para o iframe
// como plano B — sem precisar de nenhum serviço externo.
/**
 * ============================================================================
 * PLAYER DE VÍDEO DAS AULAS
 * ----------------------------------------------------------------------------
 * Decide COMO tocar o vídeo de uma aula, dependendo de onde ele está hospedado.
 * Ordem de prioridade (do mais recomendado pro mais antigo/compatibilidade):
 *
 *   1) YOUTUBE (não listado)  -> player oficial do YouTube, mas com uma "moldura"
 *      visual própria da Coelhos Academy por cima (cabeçalho com a marca, borda
 *      arredondada, sombra) pra não parecer "um vídeo do YouTube largado no site".
 *      Não dá pra remover 100% a marca do YouTube de dentro do player embutido
 *      (é regra deles), mas dá pra deixar bem discreta e "vestir" o restante.
 *
 *   2) LINK DIRETO DE ARQUIVO (ex: Cloudflare, Backblaze, servidor próprio)
 *      -> toca direto com a tag <video> nativa do navegador, sem intermediário.
 *
 *   3) GOOGLE DRIVE (aulas antigas que ainda não foram migradas)
 *      -> tenta tocar direto (mais rápido); se falhar em 4s, cai automaticamente
 *      pro modo antigo (iframe de pré-visualização do Drive).
 *
 * Pra trocar de provedor de vídeo no futuro, essa é a ÚNICA função que precisa
 * mudar — o resto do site só chama renderizarPlayerAula(url, titulo, ordem).
 * ============================================================================
 */
function renderizarPlayerAula(url, tituloAula, numeroAula) {
    const container = document.getElementById('video-player-container');
    if (!url) return;

    // --- 1) YOUTUBE -----------------------------------------------------------
    // Reconhece qualquer formato de link do YouTube: youtu.be/ID, watch?v=ID,
    // embed/ID ou shorts/ID. O "ID" do YouTube tem sempre 11 caracteres.
    const idYoutube = extrairIdYoutube(url);
    if (idYoutube) {
        renderizarPlayerYoutube(container, idYoutube, tituloAula, numeroAula);
        return;
    }

    // --- 2) LINK DIRETO DE ARQUIVO DE VÍDEO ------------------------------------
    // Qualquer link que não seja do Drive nem do YouTube é tratado como um
    // arquivo de vídeo hospedado em algum lugar (Cloudflare R2, Backblaze B2,
    // servidor próprio, etc.). Não precisa de nenhum truque: o navegador só
    // pede o arquivo e toca, igual uma imagem.
    if (!url.includes('drive.google.com')) {
        container.innerHTML = `
            <video class="drive-iframe" controls preload="metadata" playsinline style="background:#000;">
                <source src="${url}" type="video/mp4">
                Seu navegador não é compatível com este player de vídeo.
            </video>
        `;
        return;
    }

    // --- 3) GOOGLE DRIVE (compatibilidade com aulas antigas) -------------------
    const idMatch = url.match(/[-\w]{25,}/); // extrai o ID do arquivo do Drive

    if (!idMatch) {
        // Não conseguiu achar um ID reconhecível: usa o link como veio, direto no iframe.
        container.innerHTML = `<iframe src="${transformarLinkDrive(url)}" class="drive-iframe" allow="autoplay; fullscreen; encrypted-media" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
        return;
    }

    const fileId = idMatch[0];
    const videoSrc = `https://drive.google.com/uc?export=download&id=${fileId}`; // conteúdo bruto do arquivo (tenta primeiro)
    const iframeSrc = `https://drive.google.com/file/d/${fileId}/preview`;       // player do Drive (plano B)

    container.innerHTML = `
        <div class="video-loading-overlay" id="video-loading-overlay">
            <i class="ri-loader-4-line ri-spin"></i> Carregando vídeo...
        </div>
        <video id="aula-video-tag" class="drive-iframe" controls preload="metadata" playsinline style="background:#000;">
            <source src="${videoSrc}" type="video/mp4">
        </video>
    `;

    const videoTag = document.getElementById('aula-video-tag');
    const overlay = document.getElementById('video-loading-overlay');
    let jaResolveu = false; // trava pra garantir que o fallback só rode uma vez

    const esconderOverlay = () => { if (overlay) overlay.style.display = 'none'; };

    const usarFallbackIframe = () => {
        if (jaResolveu) return;
        jaResolveu = true;
        container.innerHTML = `<iframe src="${iframeSrc}" class="drive-iframe" allow="autoplay; fullscreen; encrypted-media" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    };

    videoTag.addEventListener('loadedmetadata', () => { jaResolveu = true; esconderOverlay(); });
    videoTag.addEventListener('error', usarFallbackIframe);

    // Se em 4s nada carregou (arquivo grande, bloqueio do navegador, etc.), cai pro iframe automaticamente.
    setTimeout(() => { if (!jaResolveu) usarFallbackIframe(); }, 4000);
}

/**
 * Extrai o ID de 11 caracteres de um link do YouTube, em qualquer formato comum:
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/watch?v=ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 * Retorna null se o link não for do YouTube.
 */
function extrairIdYoutube(url) {
    const match = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

/**
 * ----------------------------------------------------------------------------
 * PLAYER DE YOUTUBE COM CONTROLES 100% PRÓPRIOS
 * ----------------------------------------------------------------------------
 * Em vez de simplesmente embutir o player padrão do YouTube (que mostra logo,
 * título do vídeo, nome do canal, botão de CC, engrenagem, etc.), aqui a gente:
 *
 *   1) Mostra uma capa própria (thumbnail do vídeo + botão de play com o
 *      gradiente da Coelhos Academy) ANTES de carregar qualquer coisa do YouTube.
 *   2) Só ao clicar em play, cria o player oficial do YouTube ESCONDIDO
 *      (controls: 0 — sem nenhum botão nativo deles) e passa a controlá-lo
 *      via JavaScript com uma barra de controles construída do zero (play/
 *      pause, barra de progresso, tempo, mudo, tela cheia).
 *
 * Isso é o máximo que dá pra "disfarçar" um vídeo do YouTube sem violar as
 * regras deles (o vídeo em si continua vindo do YouTube — não tem como um
 * site sem servidor de vídeo próprio fugir disso — mas nenhum controle,
 * marca ou título deles fica visível).
 * ----------------------------------------------------------------------------
 */

let playerYoutubeAtual = null; // guarda o player em uso, pra "desligar" ao trocar de aula
let ytApiPromise = null;       // evita carregar a API do YouTube mais de uma vez

// Carrega o script oficial da API do YouTube (iframe_api) uma única vez por sessão.
function carregarYoutubeIframeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve(); // já carregada antes
    if (ytApiPromise) return ytApiPromise; // já está carregando, reaproveita a mesma Promise

    ytApiPromise = new Promise((resolve) => {
        window.onYouTubeIframeAPIReady = resolve; // o YouTube chama essa função global quando terminar
        const tagScript = document.createElement('script');
        tagScript.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tagScript);
    });
    return ytApiPromise;
}

// Formata segundos totais em "M:SS" (ex: 143 -> "2:23") pro relógio do player.
function formatarTempoVideo(segundosTotais) {
    const total = Math.max(0, Math.floor(segundosTotais || 0));
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${minutos}:${String(segundos).padStart(2, '0')}`;
}

function renderizarPlayerYoutube(container, idYoutube, tituloAula, numeroAula) {
    // Se já existia um player tocando (de outra aula), destrói ele primeiro —
    // evita um vídeo "fantasma" continuar rodando em segundo plano.
    if (playerYoutubeAtual && typeof playerYoutubeAtual.destroy === 'function') {
        try { playerYoutubeAtual.destroy(); } catch (erro) { /* ignora — o player já pode ter sumido */ }
    }
    playerYoutubeAtual = null;

    const thumbnail = `https://img.youtube.com/vi/${idYoutube}/hqdefault.jpg`;

    // IMPORTANTE sobre a "capa" (.custom-video-overlay): ela não aparece só no início.
    // O YouTube mostra a própria marca dele (logo, compartilhar, assistir mais tarde)
    // automaticamente sempre que o vídeo fica pausado — e isso roda DENTRO do iframe
    // deles, então não tem CSS que alcance pra esconder. A solução é: toda vez que o
    // vídeo pausa, a gente MOSTRA essa capa de novo por cima de tudo, escondendo
    // completamente o que está por baixo. Por isso "pausar" e "mostrar a capa" andam
    // sempre juntos nas funções abaixo.
    container.innerHTML = `
        <div class="video-frame-custom">
            <div id="yt-player-mount"></div>

            <div class="custom-video-overlay" id="custom-video-overlay" style="background-image:url('${thumbnail}');">
                <button class="custom-play-btn" id="custom-play-btn" aria-label="Reproduzir vídeo"><i class="ri-play-fill"></i></button>
            </div>

            <div class="custom-video-controls" id="custom-video-controls" style="display:none;">
                <button class="custom-ctrl-btn" id="custom-playpause-btn" aria-label="Pausar"><i class="ri-pause-fill"></i></button>
                <span class="custom-time" id="custom-time-current">0:00</span>
                <div class="custom-progress-track" id="custom-progress-track">
                    <div class="custom-progress-fill" id="custom-progress-fill"></div>
                </div>
                <span class="custom-time" id="custom-time-duration">0:00</span>
                <button class="custom-ctrl-btn" id="custom-mute-btn" aria-label="Ativar ou desativar o som"><i class="ri-volume-up-line"></i></button>
                <button class="custom-ctrl-btn" id="custom-fullscreen-btn" aria-label="Tela cheia"><i class="ri-fullscreen-line"></i></button>
            </div>
        </div>
    `;

    const overlay = document.getElementById('custom-video-overlay');
    const controles = document.getElementById('custom-video-controls');

    // Mostra a reprodução: esconde a capa, mostra a barra de controles, dá play.
    const mostrarReproducao = () => {
        overlay.style.display = 'none';
        controles.style.display = 'flex';
        if (playerYoutubeAtual) playerYoutubeAtual.playVideo();
    };

    // Volta pro estado "pausado": mostra a capa por cima de TUDO (esconde qualquer
    // marca do YouTube que esteja aparecendo por baixo) e esconde a barra de controles.
    const mostrarPausado = () => {
        if (playerYoutubeAtual) playerYoutubeAtual.pauseVideo();
        overlay.style.display = 'flex';
        controles.style.display = 'none';
    };

    document.getElementById('custom-play-btn').addEventListener('click', async () => {
        // Primeira vez: ainda não existe player, precisa criar.
        if (!playerYoutubeAtual) {
            await carregarYoutubeIframeAPI();
            if (!document.getElementById('yt-player-mount')) return; // aula trocou enquanto a API carregava

            playerYoutubeAtual = new YT.Player('yt-player-mount', {
                videoId: idYoutube,
                playerVars: {
                    controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, cc_load_policy: 0,
                    disablekb: 1, fs: 0, playsinline: 1, autoplay: 1, origin: window.location.origin
                },
                events: {
                    onReady: (evento) => {
                        mostrarReproducao();
                        configurarControlesCustomizadosYoutube(evento.target, mostrarPausado);
                    }
                }
            });
        } else {
            // Já existe (o aluno só pausou e apertou play de novo): não recria, só retoma.
            mostrarReproducao();
        }
    });
}

/**
 * Liga os botões da barra de controles customizada (play/pause, progresso,
 * mudo, tela cheia) ao player de YouTube de verdade, e mantém a barra de
 * progresso e o relógio atualizados em tempo real durante a reprodução.
 *
 * @param player          instância do YT.Player já pronta (evento.target do onReady)
 * @param mostrarPausado  função que pausa E cobre a tela com a capa própria (ver renderizarPlayerYoutube)
 */
function configurarControlesCustomizadosYoutube(player, mostrarPausado) {
    const btnPlayPause = document.getElementById('custom-playpause-btn');
    const trilhaProgresso = document.getElementById('custom-progress-track');
    const preenchimentoProgresso = document.getElementById('custom-progress-fill');
    const tempoAtualEl = document.getElementById('custom-time-current');
    const tempoTotalEl = document.getElementById('custom-time-duration');
    const btnMudo = document.getElementById('custom-mute-btn');
    const btnTelaCheia = document.getElementById('custom-fullscreen-btn');
    if (!btnPlayPause) return; // a aula já foi trocada antes disso rodar

    // O botão de play/pause da barra SEMPRE pausa cobrindo a tela (nunca deixa o
    // vídeo pausado "exposto", que é justamente onde a marca do YouTube aparece).
    btnPlayPause.onclick = mostrarPausado;

    // Clicar em qualquer ponto da trilha "pula" o vídeo pra aquele ponto (seek) —
    // funciona com o vídeo tocando, sem precisar pausar.
    trilhaProgresso.onclick = (evento) => {
        const retangulo = trilhaProgresso.getBoundingClientRect();
        const porcentagem = Math.min(1, Math.max(0, (evento.clientX - retangulo.left) / retangulo.width));
        const duracao = player.getDuration();
        if (duracao) player.seekTo(duracao * porcentagem, true);
    };

    btnMudo.onclick = () => {
        if (player.isMuted()) {
            player.unMute();
            btnMudo.innerHTML = '<i class="ri-volume-up-line"></i>';
        } else {
            player.mute();
            btnMudo.innerHTML = '<i class="ri-volume-mute-line"></i>';
        }
    };

    btnTelaCheia.onclick = () => {
        const moldura = document.querySelector('.video-frame-custom');
        if (moldura && moldura.requestFullscreen) moldura.requestFullscreen();
    };

    // Se o vídeo chegar ao fim sozinho, o loop abaixo detecta e cobre a tela de novo.
    // Atualiza a barra de progresso, o relógio e detecta o fim do vídeo a cada 500ms.
    const intervaloAtualizacao = setInterval(() => {
        // Se os elementos sumiram da tela (o aluno trocou de aula), para o loop pra não gastar memória à toa.
        if (!document.getElementById('custom-progress-fill')) {
            clearInterval(intervaloAtualizacao);
            return;
        }
        const estado = player.getPlayerState();
        const atual = player.getCurrentTime() || 0;
        const duracao = player.getDuration() || 0;
        if (duracao > 0) preenchimentoProgresso.style.width = ((atual / duracao) * 100) + '%';
        tempoAtualEl.innerText = formatarTempoVideo(atual);
        tempoTotalEl.innerText = formatarTempoVideo(duracao);

        // YT.PlayerState.ENDED === 0 — quando o vídeo termina sozinho, cobre a tela de novo.
        if (estado === 0) mostrarPausado();
    }, 500);
}

// ==========================================
// AVALIAÇÕES E COMENTÁRIOS
// ==========================================
document.getElementById('form-avaliacao')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!cursoAtual.id) return;

    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const payload = {
        action: 'saveAvaliacao',
        courseId: cursoAtual.id,
        courseName: cursoAtual.nome,
        studentName: currentUser.name,
        email: currentUser.email || 'Sem Email',
        rating: document.getElementById('nota-curso').value,
        comment: document.getElementById('comentario-curso').value
    };

    const res = await apiRequest(payload);

    if (res.status === 'success') {
        alert("Obrigado pela sua avaliação!");
        e.target.reset();
        carregarAvaliacoesDoCurso(cursoAtual.id);
    } else {
        alert("Erro ao salvar avaliação.");
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

async function carregarAvaliacoesDoCurso(idCurso) {
    const res = await apiRequest({ action: 'getAvaliacoes', courseId: idCurso });
    const mural = document.getElementById('mural-avaliacoes');
    mural.innerHTML = '';

    if (res.status === 'success' && res.data.length > 0) {
        res.data.forEach(av => {
            const estrelas = '★'.repeat(av.rating) + '☆'.repeat(5 - av.rating);
            mural.innerHTML += `
                <div class="review-box">
                    <div style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 10px;">${estrelas}</div>
                    <p style="font-style: italic; margin-bottom: 10px;">"${av.comment}"</p>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">- ${av.studentName}</span>
                </div>
            `;
        });
    } else {
        mural.innerHTML = '<p style="color: var(--text-muted);">Seja o primeiro a avaliar este curso!</p>';
    }
}

// ==========================================
// ENVIO DE ATIVIDADE FINAL (LIBERA CERTIFICADO)
// ==========================================
const TIPOS_PERMITIDOS_ATIVIDADE = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg'];

// Clique no botão "Enviar Atividade pelo WhatsApp": abre o WhatsApp com a mensagem pronta
// (nome, e-mail, curso e aula) e registra no site que o envio foi feito, pra aparecer
// como "Pendente" na fila do professor conferir e aprovar/reprovar.
document.getElementById('btn-enviar-atividade-whatsapp')?.addEventListener('click', async () => {
    if (!cursoAtual.id || !aulaAtual.ordem) return;

    const nomeAluno = currentUser.nomeCompleto || currentUser.name;
    const mensagem = `Olá! Estou enviando minha atividade.\n\nCurso: ${cursoAtual.nome}\nAula ${aulaAtual.ordem}: ${aulaAtual.titulo}\nAluno: ${nomeAluno}\nE-mail: ${currentUser.email}\n\n(Arquivo em anexo)`;
    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`, '_blank');

    const btn = document.getElementById('btn-enviar-atividade-whatsapp');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Registrando...';

    const res = await apiRequest({
        action: 'enviarAtividade',
        email: currentUser.email,
        token: currentUser.token,
        nome: nomeAluno,
        courseId: cursoAtual.id,
        courseName: cursoAtual.nome,
        aulaOrdem: aulaAtual.ordem,
        aulaTitulo: aulaAtual.titulo
    });

    if (res.status === 'success') {
        registrarAcessoSilencioso(`Enviou atividade via WhatsApp: ${cursoAtual.nome} (Aula ${aulaAtual.ordem})`);
        carregarStatusAtividade(cursoAtual.id);
    } else {
        alert(`Erro ao registrar: ${res.message}`);
    }

    btn.disabled = false;
    btn.innerHTML = originalHtml;
});

let statusAtividadeCursoAtual = null; // guarda a resposta completa do backend (progresso do curso todo)

async function carregarStatusAtividade(idCurso) {
    if (currentUser.role === 'guest') return;

    const container = document.getElementById('status-atividade-container');
    if (container) container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Verificando status...</p>`;

    const res = await apiRequest({ action: 'getStatusAtividade', email: currentUser.email, token: currentUser.token, courseId: idCurso });

    statusAtividadeCursoAtual = (res.status === 'success') ? res.data : null;
    cursoAtual.cargaHoraria = (statusAtividadeCursoAtual && statusAtividadeCursoAtual.cargaHoraria) || 40;

    renderizarStatusAtividadeAtual();
}

// Mostra (ou esconde) a caixa de atividade conforme a aula selecionada exige atividade
// ou não (coluna "TemAtividade" da aba Aulas), e atualiza a barra de progresso geral
// do curso + o botão de certificado.
function renderizarStatusAtividadeAtual() {
    const caixa = document.getElementById('atividade-box');
    const container = document.getElementById('status-atividade-container');
    const btnCert = document.getElementById('btn-certificado');
    const btnEnviar = document.getElementById('btn-enviar-atividade-whatsapp');
    const subtituloBox = document.getElementById('atividade-box-subtitulo');
    const progressoWrap = document.getElementById('progresso-por-aula-container');
    const progressoBar = document.getElementById('progresso-por-aula-bar');
    const progressoTexto = document.getElementById('progresso-por-aula-texto');

    if (!caixa || !statusAtividadeCursoAtual) return;

    const { aulasTotal, aprovadasCount, statusPorAula } = statusAtividadeCursoAtual;

    // Barra de progresso geral do curso (sempre visível, independente da aula selecionada)
    if (aulasTotal > 0) {
        progressoWrap.style.display = 'block';
        const pct = Math.round((aprovadasCount / aulasTotal) * 100);
        progressoBar.style.width = pct + '%';
        progressoTexto.innerText = `${aprovadasCount} de ${aulasTotal} aula(s) com atividade aprovada`;
    } else {
        progressoWrap.style.display = 'none';
    }

    // A caixa de atividade só aparece se a aula selecionada exigir atividade.
    if (!aulaAtual.ordem || !aulaAtual.temAtividade) {
        caixa.style.display = 'none';
    } else {
        caixa.style.display = 'block';
        subtituloBox.innerText = `Atividade da Aula ${aulaAtual.ordem}: ${aulaAtual.titulo}`;

        const statusAula = (statusPorAula && statusPorAula[String(aulaAtual.ordem).trim()]) || 'nao_enviada';
        statusAtividadeAtual = statusAula;
        renderizarPillStatus(container, btnEnviar, statusAula);
    }

    const certificadoLiberado = aulasTotal > 0 && aprovadasCount >= aulasTotal;
    btnCert.disabled = !certificadoLiberado;
    btnCert.innerHTML = certificadoLiberado
        ? `<i class="ri-medal-line"></i> Emitir Certificado`
        : `<i class="ri-lock-line"></i> Envie as atividades para liberar`;
    if (!certificadoLiberado) btnCert.classList.remove('success-btn');
}

function renderizarPillStatus(container, btnEnviar, status) {
    if (status === 'pendente') {
        container.innerHTML = `<span class="status-pill status-pendente"><i class="ri-time-line"></i> Em análise pelo professor</span>`;
        btnEnviar.innerHTML = '<i class="ri-whatsapp-line"></i> Reenviar pelo WhatsApp';
    } else if (status === 'aprovado') {
        container.innerHTML = `<span class="status-pill status-aprovado"><i class="ri-checkbox-circle-line"></i> Atividade aprovada</span>`;
        btnEnviar.innerHTML = '<i class="ri-whatsapp-line"></i> Reenviar pelo WhatsApp';
    } else if (status === 'reprovado') {
        container.innerHTML = `<span class="status-pill status-reprovado"><i class="ri-close-circle-line"></i> Atividade reprovada — envie novamente</span>`;
        btnEnviar.innerHTML = '<i class="ri-whatsapp-line"></i> Reenviar pelo WhatsApp';
    } else {
        container.innerHTML = `<span class="status-pill status-nao-enviada"><i class="ri-file-forbid-line"></i> Nenhuma atividade enviada ainda</span>`;
        btnEnviar.innerHTML = '<i class="ri-whatsapp-line"></i> Enviar Atividade pelo WhatsApp';
    }
}

// ==========================================
// CERTIFICADOS
// ==========================================
document.getElementById('btn-certificado')?.addEventListener('click', async (e) => {
    if (!cursoAtual.id) return;
    if (e.currentTarget.disabled) return;

    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = "Processando...";
    btn.disabled = true;

    const res = await apiRequest({
        action: 'emitirCertificado',
        email: currentUser.email,
        token: currentUser.token,
        courseId: cursoAtual.id,
        courseName: cursoAtual.nome
    });

    if (res.status === 'success') {
        certificadosGlobais = res.data.total;
        registrarAcessoSilencioso("Emissão de Certificado");

        const dadosCertificado = {
            nomeAluno: res.data.nomeCompleto || currentUser.nomeCompleto || currentUser.name,
            nomeCurso: cursoAtual.nome,
            cargaHoraria: res.data.cargaHoraria || cursoAtual.cargaHoraria || 40,
            codigo: res.data.codigo
        };

        await gerarCertificadoPDF(dadosCertificado);

        btn.innerHTML = `<i class="ri-checkbox-circle-line"></i> Certificado Emitido`;
        btn.classList.replace('primary-btn', 'success-btn');

        const btnCompartilhar = document.getElementById('btn-compartilhar-certificado');
        if (btnCompartilhar) {
            btnCompartilhar.style.display = 'block';
            btnCompartilhar.onclick = () => gerarImagemCompartilhavel(dadosCertificado);
        }
    } else {
        alert(`Não foi possível emitir o certificado: ${res.message || ''}`);
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
});

// Contador de certificados: visível apenas no Painel Admin
async function carregarCertificadosAdmin() {
    if (currentUser.role !== 'admin') return;
    const el = document.getElementById('admin-contador-certificados');
    if (!el) return;

    const res = await apiRequest({ action: 'getCertificadosAdmin', email: currentUser.email, token: currentUser.token });
    if (res.status === 'success') {
        certificadosGlobais = res.data.total;
        el.innerText = certificadosGlobais;
    }
}

// ==========================================
// MEUS CERTIFICADOS (ALUNO)
// ==========================================
async function carregarMeusCertificados() {
    const container = document.getElementById('lista-meus-certificados');
    if (!container) return;

    if (currentUser.role === 'guest') {
        container.innerHTML = '<p style="color: var(--text-muted);">Faça login para ver seus certificados.</p>';
        return;
    }

    container.innerHTML = '<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando seus certificados...</p>';

    const res = await apiRequest({ action: 'getMeusCertificados', email: currentUser.email, token: currentUser.token });

    if (res.status !== 'success' || !res.data || res.data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">Você ainda não possui certificados. Conclua um curso e envie a atividade final para conquistar o seu primeiro! 🎓</p>';
        return;
    }

    container.innerHTML = res.data.map(cert => `
        <div class="bento-card flex-center">
            <i class="ri-medal-line"></i>
            <h3>${cert.courseTitle}</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Carga horária: ${cert.cargaHoraria}h ${cert.dataLiberacao ? `• Liberado em ${cert.dataLiberacao}` : ''}</p>
            <div style="display:flex; gap:8px; margin-top:1rem; width:100%;">
                <button class="primary-btn" onclick='baixarCertificadoSalvo(${JSON.stringify(cert.courseTitle)}, ${cert.cargaHoraria}, ${JSON.stringify(cert.codigo)})'>
                    <i class="ri-download-2-line"></i> PDF
                </button>
                <button class="btn-ghost" onclick='gerarImagemCompartilhavel({nomeAluno: ${JSON.stringify(currentUser.nomeCompleto || currentUser.name)}, nomeCurso: ${JSON.stringify(cert.courseTitle)}, cargaHoraria: ${cert.cargaHoraria}, codigo: ${JSON.stringify(cert.codigo)}})'>
                    <i class="ri-share-forward-line"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Reemite o PDF de um certificado já liberado, sem contar de novo nas métricas globais
async function baixarCertificadoSalvo(nomeCurso, cargaHoraria, codigo) {
    await gerarCertificadoPDF({
        nomeAluno: currentUser.nomeCompleto || currentUser.name,
        nomeCurso: nomeCurso,
        cargaHoraria: cargaHoraria,
        codigo: codigo
    });
}

async function carregarCertificadosGlobais() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getCertificados`);
        const res = await response.json();
        if (res.status === 'success') certificadosGlobais = res.data.total;
    } catch (e) {}
}

// Gera o certificado em PDF (jsPDF), paisagem, com a logo do curso
async function gerarCertificadoPDF({ nomeAluno, nomeCurso, cargaHoraria, codigo }) {
    // Carrega a biblioteca jsPDF agora (só na hora de emitir/baixar um certificado de verdade).
    await carregarBibliotecaExterna(CDN_JSPDF, 'jspdf');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Cores da marca (RGB)
    const corAccent = [99, 102, 241];   // #6366f1
    const corAccent2 = [34, 211, 238];  // #22d3ee
    const corTexto = [17, 22, 41];
    const corMuted = [100, 110, 130];

    // Fundo
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, H, 'F');

    // Moldura externa com gradiente simulado (faixas finas)
    doc.setDrawColor(...corAccent);
    doc.setLineWidth(1.2);
    doc.rect(8, 8, W - 16, H - 16);
    doc.setDrawColor(...corAccent2);
    doc.setLineWidth(0.4);
    doc.rect(11, 11, W - 22, H - 22);

    // Faixa superior gradiente (simples, em blocos de cor)
    const faixaY = 8, faixaH = 3;
    const blocos = 60;
    for (let i = 0; i < blocos; i++) {
        const t = i / (blocos - 1);
        const r = corAccent[0] + (corAccent2[0] - corAccent[0]) * t;
        const g = corAccent[1] + (corAccent2[1] - corAccent[1]) * t;
        const b = corAccent[2] + (corAccent2[2] - corAccent[2]) * t;
        doc.setFillColor(r, g, b);
        doc.rect(8 + (i * (W - 16) / blocos), faixaY, (W - 16) / blocos + 0.5, faixaH, 'F');
    }

    // Logo (centralizada no topo)
    try {
        const logoData = await carregarImagemComoDataURL(LOGO_URL);
        if (logoData) {
            const logoW = 28;
            const logoH = 28;
            doc.addImage(logoData, 'JPEG', (W - logoW) / 2, 20, logoW, logoH);
        }
    } catch (e) { /* segue sem logo se falhar */ }

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.setTextColor(...corTexto);
    doc.text('CERTIFICADO DE CONCLUSÃO', W / 2, 60, { align: 'center' });

    doc.setDrawColor(...corAccent);
    doc.setLineWidth(0.6);
    doc.line(W / 2 - 30, 65, W / 2 + 30, 65);

    // Texto introdutório
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...corMuted);
    doc.text('A Coelhos Academy certifica que', W / 2, 82, { align: 'center' });

    // Nome do aluno
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...corAccent);
    doc.text(nomeAluno || 'Aluno(a)', W / 2, 96, { align: 'center' });

    // Descrição do curso
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...corMuted);
    doc.text('concluiu com aproveitamento o curso', W / 2, 110, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(...corTexto);
    doc.text(`"${nomeCurso}"`, W / 2, 122, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...corMuted);
    doc.text(`com carga horária de ${cargaHoraria} horas.`, W / 2, 132, { align: 'center' });

    // Data e assinatura
    const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.setFontSize(11);
    doc.text(`Emitido em ${dataEmissao}`, W / 2, 148, { align: 'center' });

    // Assinatura (estilo cursivo simulado com itálico + cor de destaque)
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(24);
    doc.setTextColor(...corAccent);
    doc.text('Mateus Coelho', W / 2, 168, { align: 'center' });

    doc.setDrawColor(...corMuted);
    doc.setLineWidth(0.3);
    doc.line(W / 2 - 35, 172, W / 2 + 35, 172);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...corTexto);
    doc.text('Mateus Coelho', W / 2, 178, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...corMuted);
    doc.text('Diretor Acadêmico — Coelhos Academy', W / 2, 183, { align: 'center' });

    // Código único do certificado (rodapé) — o mesmo salvo no servidor, usado na verificação pública
    const codigoFinal = codigo || gerarCodigoCertificado();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...corMuted);
    doc.text(`Código de validação: ${codigoFinal}  •  verifique em coelhosacademy.com.br`, W / 2, H - 14, { align: 'center' });

    const nomeArquivo = `Certificado - ${nomeCurso} - ${(nomeAluno || 'Aluno').split(' ')[0]}.pdf`;
    doc.save(nomeArquivo);
}

// Fallback apenas se, por algum motivo, o servidor não retornar um código (não deveria acontecer)
function gerarCodigoCertificado() {
    return 'CA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function carregarImagemComoDataURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// ==========================================
// FLASHCARDS (ANKI) DINÂMICO
// ==========================================
let listaFlashcards = [];
let listaFlashcardsAgendados = [];
let cardIndexAtual = 0;

const OPCOES_DIFICULDADE = [
    { valor: 'muito_dificil', label: 'Muito Difícil', tempo: '10 min' },
    { valor: 'dificil',       label: 'Difícil',        tempo: '1 hora' },
    { valor: 'medio',         label: 'Médio',          tempo: '1 dia' },
    { valor: 'facil',         label: 'Fácil',          tempo: '4 dias' }
];

async function carregarFlashcardsAPI() {
    const container = document.getElementById('area-cards-dinamica');
    if (!container) return;

    if (currentUser.role === 'guest') {
        container.innerHTML = '<p style="color: var(--text-muted);">Faça login para acessar seus flashcards.</p>';
        return;
    }

    container.innerHTML = '<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Sincronizando com a nuvem...</p>';

    const res = await apiRequest({ action: 'getFlashcardsAluno', email: currentUser.email, token: currentUser.token });
    if (res.status === 'success') {
        const agora = new Date();
        listaFlashcards = res.data.filter(c => !c.proximaRevisao || new Date(c.proximaRevisao) <= agora);
        listaFlashcardsAgendados = res.data.filter(c => c.proximaRevisao && new Date(c.proximaRevisao) > agora);
        cardIndexAtual = 0;
        renderizarCardAtual();
    } else {
        container.innerHTML = `<p style="color:#ef4444;">${res.message || 'Erro ao carregar flashcards.'}</p>`;
    }
}

function renderizarCardAtual() {
    const container = document.getElementById('area-cards-dinamica');

    if (listaFlashcards.length === 0) {
        if (listaFlashcardsAgendados.length > 0) {
            const proximo = listaFlashcardsAgendados.reduce((a, b) => new Date(a.proximaRevisao) < new Date(b.proximaRevisao) ? a : b);
            container.innerHTML = `<p style="color: var(--text-muted); text-align:center;">Você revisou todos os cards disponíveis! 🎉<br>O próximo card (${proximo.materia}) libera em ${formatarTempoRestante(proximo.proximaRevisao)}.</p>`;
        } else {
            container.innerHTML = '<p style="color: var(--text-muted);">Nenhum card cadastrado na aba "Flashcards" ainda.</p>';
        }
        return;
    }

    const card = listaFlashcards[cardIndexAtual];
    const botoesDificuldade = OPCOES_DIFICULDADE.map(op =>
        `<button class="btn-dificuldade ${op.valor.replace('_', '-')}" onclick="marcarDificuldade('${card.id}', '${op.valor}')">${op.label}<br><small>${op.tempo}</small></button>`
    ).join('');

    container.innerHTML = `
        <div class="anki-card" onclick="this.classList.toggle('flipped')">
            <div class="card-inner">
                <div class="card-front flex-center">
                    <span class="role-badge" style="position:absolute; top: 15px;">${card.materia}</span>
                    <p style="font-size: 1.5rem; font-weight: bold;">${card.frente}</p>
                    <span class="hint"><i class="ri-drag-move-line"></i> Toque para virar</span>
                </div>
                <div class="card-back flex-center">
                    <p style="font-size: 1.2rem;">${card.verso}</p>
                </div>
            </div>
        </div>
        <p style="text-align:center; margin-top:10px; font-size:0.8rem; color:var(--text-muted)">Card ${cardIndexAtual + 1} de ${listaFlashcards.length}</p>
        <div class="dificuldade-botoes">${botoesDificuldade}</div>
    `;
}

async function marcarDificuldade(codigoCard, dificuldade) {
    const res = await apiRequest({ action: 'marcarRevisao', email: currentUser.email, token: currentUser.token, codigo: codigoCard, dificuldade: dificuldade });
    if (res.status === 'success') {
        listaFlashcards.splice(cardIndexAtual, 1);
        if (cardIndexAtual >= listaFlashcards.length) cardIndexAtual = 0;
        renderizarCardAtual();
    } else {
        alert("Erro ao registrar sua resposta: " + (res.message || ''));
    }
}

function formatarTempoRestante(dataISO) {
    const diffMs = new Date(dataISO) - new Date();
    if (diffMs <= 0) return 'agora';
    const minutos = Math.ceil(diffMs / 60000);
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.ceil(minutos / 60);
    if (horas < 24) return `${horas}h`;
    const dias = Math.ceil(horas / 24);
    return `${dias} dia(s)`;
}

function proximoCard() {
    if (cardIndexAtual < listaFlashcards.length - 1) { cardIndexAtual++; renderizarCardAtual(); }
}

function cardAnterior() {
    if (cardIndexAtual > 0) { cardIndexAtual--; renderizarCardAtual(); }
}

document.getElementById('form-card')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Salvando na Nuvem...";
    btn.disabled = true;

    const payload = {
        action: 'saveCard',
        email: currentUser.email,
        token: currentUser.token,
        codigo: document.getElementById('card-codigo').value,
        materia: document.getElementById('card-materia').value,
        frente: document.getElementById('card-frente').value,
        verso: document.getElementById('card-verso').value
    };

    const res = await apiRequest(payload);
    if (res.status === 'success') {
        e.target.reset();
        registrarAcessoSilencioso(`Criou Flashcard: ${payload.codigo}`);
        carregarFlashcardsAPI();
    }
    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// REGISTRO DE LOGS (ADMIN PANEL)
// ==========================================
async function carregarLogsAdmin() {
    const res = await apiRequest({ action: 'getLogs', email: currentUser.email, token: currentUser.token });
    const logContainer = document.getElementById('admin-access-log');

    if (res.status === 'success' && logContainer) {
        logContainer.innerHTML = '';
        if (res.data.length === 0) logContainer.innerHTML = '<p>Nenhum acesso registrado.</p>';

        res.data.forEach(log => {
            logContainer.innerHTML += `
                <li style="display:flex; justify-content:space-between; width:100%;">
                    <span><i class="ri-history-line" style="color:var(--accent)"></i> <strong>${log.usuario}</strong>: ${log.acao}</span>
                    <span style="font-size:0.7rem; color:var(--text-muted);">${log.data}</span>
                </li>`;
        });
    }
}

function registrarAcessoSilencioso(acao) {
    if (currentUser.role === 'guest') return;

    apiRequest({ action: 'log', usuario: currentUser.name, acao: acao }).catch(() => {});
}

// ==========================================
// ADMIN: FILA DE ATIVIDADES PENDENTES
// ==========================================
async function carregarAtividadesPendentesAdmin() {
    const container = document.getElementById('admin-atividades-pendentes');
    if (!container || currentUser.role !== 'admin') return;

    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando atividades...</p>`;

    const res = await apiRequest({ action: 'listarAtividadesPendentes', email: currentUser.email, token: currentUser.token });

    if (res.status !== 'success') {
        container.innerHTML = `<p style="color:#ef4444;">${res.message || 'Erro ao carregar atividades.'}</p>`;
        return;
    }

    if (!res.data || res.data.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Nenhuma atividade pendente de correção. ✅</p>`;
        return;
    }

    container.innerHTML = res.data.map(item => `
        <div class="admin-activity-item">
            <div class="admin-activity-info">
                <strong>${item.nomeAluno}</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">${item.nomeCurso}${item.aulaOrdem ? ` • Aula ${item.aulaOrdem}${item.aulaTitulo ? ': ' + item.aulaTitulo : ''}` : ''} • ${item.data}</span>
            </div>
            <div class="admin-activity-actions">
                <span class="role-badge" style="background: rgba(37,211,102,0.15); color:#25D366;"><i class="ri-whatsapp-line"></i> Confira no WhatsApp</span>
                <button class="btn-outline-success" onclick="avaliarAtividade('${item.id}', '${item.email}', '${item.courseId}', 'aprovado', this)"><i class="ri-check-line"></i> Aprovar</button>
                <button class="btn-outline-danger" onclick="avaliarAtividade('${item.id}', '${item.email}', '${item.courseId}', 'reprovado', this)"><i class="ri-close-line"></i> Reprovar</button>
            </div>
        </div>
    `).join('');
}

async function avaliarAtividade(idAtividade, emailAluno, courseId, decisao, btnEl) {
    const item = btnEl.closest('.admin-activity-item');
    item.style.opacity = '0.5';
    item.style.pointerEvents = 'none';

    const res = await apiRequest({
        action: 'avaliarAtividade',
        email: currentUser.email,
        token: currentUser.token,
        idAtividade, emailAluno, courseId, decisao
    });

    if (res.status === 'success') {
        registrarAcessoSilencioso(`${decisao === 'aprovado' ? 'Aprovou' : 'Reprovou'} atividade de ${emailAluno}`);
        carregarAtividadesPendentesAdmin();
    } else {
        alert(`Erro: ${res.message}`);
        item.style.opacity = '1';
        item.style.pointerEvents = 'auto';
    }
}

// ==========================================
// ADMIN: SOLICITAÇÕES DE ACESSO A CURSOS PAGOS
// ==========================================
async function carregarSolicitacoesCursoAdmin() {
    const container = document.getElementById('admin-solicitacoes-curso');
    if (!container || currentUser.role !== 'admin') return;

    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando solicitações...</p>`;

    const res = await apiRequest({ action: 'listarSolicitacoesCurso', email: currentUser.email, token: currentUser.token });

    if (res.status !== 'success') {
        container.innerHTML = `<p style="color:#ef4444;">${res.message || 'Erro ao carregar solicitações.'}</p>`;
        return;
    }

    if (!res.data || res.data.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Nenhuma solicitação pendente. ✅</p>`;
        return;
    }

    container.innerHTML = res.data.map(item => `
        <div class="admin-activity-item">
            <div class="admin-activity-info">
                <strong>${item.nomeAluno}</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">${item.nomeCurso} • ${item.email} • ${item.data}</span>
            </div>
            <div class="admin-activity-actions">
                <button class="btn-outline-success" onclick="liberarAcessoCursoAdmin('${item.id}', '${item.email}', '${item.courseId}', this)"><i class="ri-check-line"></i> Liberar Acesso</button>
            </div>
        </div>
    `).join('');
}

async function liberarAcessoCursoAdmin(idSolicitacao, emailAluno, courseId, btnEl) {
    const item = btnEl.closest('.admin-activity-item');
    item.style.opacity = '0.5';
    item.style.pointerEvents = 'none';

    const res = await apiRequest({
        action: 'liberarAcessoCurso',
        email: currentUser.email,
        token: currentUser.token,
        emailAluno, courseId, idSolicitacao
    });

    if (res.status === 'success') {
        registrarAcessoSilencioso(`Liberou acesso ao curso ${courseId} para ${emailAluno}`);
        carregarSolicitacoesCursoAdmin();
    } else {
        alert(`Erro: ${res.message}`);
        item.style.opacity = '1';
        item.style.pointerEvents = 'auto';
    }
}

document.getElementById('form-revogar-acesso')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailAluno = document.getElementById('revogar-email-aluno').value.trim();
    const courseId = document.getElementById('revogar-course-id').value.trim();

    if (!confirm(`Confirma revogar o acesso do curso ${courseId} para ${emailAluno}?`)) return;

    const btn = e.target.querySelector('.btn-outline-danger');
    const originalText = btn.innerText;
    btn.innerText = "Revogando...";
    btn.disabled = true;

    const res = await apiRequest({
        action: 'revogarAcessoCurso',
        email: currentUser.email,
        token: currentUser.token,
        emailAluno, courseId
    });

    if (res.status === 'success') {
        alert("Acesso revogado com sucesso.");
        e.target.reset();
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// RECUPERAÇÃO DE ACESSO (SELF-SERVICE)
// ==========================================
let recuperacaoAtual = { email: '', whats: '' };

function resetarRecuperacaoAcesso() {
    document.getElementById('form-recuperar-passo1').style.display = 'block';
    document.getElementById('form-recuperar-passo1').reset();
    document.getElementById('recuperar-passo2').style.display = 'none';
    document.getElementById('recuperar-passo3').style.display = 'none';
}

document.getElementById('form-recuperar-passo1')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    const email = document.getElementById('rec-email').value;
    const whats = document.getElementById('rec-whats').value;

    const res = await apiRequest({ action: 'iniciarRecuperacao', email, whats });

    if (res.status === 'success') {
        recuperacaoAtual = { email, whats };
        document.getElementById('rec-primeiro-nome').innerText = res.data.primeiroNome;

        const opcoesContainer = document.getElementById('rec-opcoes-sobrenome');
        opcoesContainer.innerHTML = res.data.opcoes.map(sobrenome =>
            `<button type="button" class="sobrenome-btn" onclick="escolherSobrenome('${sobrenome.replace(/'/g, "\\'")}', this)">${sobrenome}</button>`
        ).join('');

        e.target.style.display = 'none';
        document.getElementById('recuperar-passo2').style.display = 'block';
    } else {
        alert(res.message || 'Não foi possível verificar seus dados.');
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

async function escolherSobrenome(sobrenomeEscolhido, btnEl) {
    document.querySelectorAll('.sobrenome-btn').forEach(b => b.disabled = true);
    btnEl.innerText = 'Verificando...';

    const res = await apiRequest({
        action: 'confirmarRecuperacao',
        email: recuperacaoAtual.email,
        whats: recuperacaoAtual.whats,
        sobrenomeEscolhido
    });

    if (res.status === 'success') {
        document.getElementById('recuperar-passo2').style.display = 'none';
        document.getElementById('rec-nova-senha').innerText = res.data.novaSenha;
        document.getElementById('recuperar-passo3').style.display = 'block';
    } else {
        alert(res.message || 'Sobrenome incorreto. Vamos tentar novamente.');
        document.getElementById('recuperar-passo2').style.display = 'none';
        document.getElementById('form-recuperar-passo1').style.display = 'block';
        document.getElementById('rec-whats').value = '';
    }
}

// ==========================================
// ANÚNCIOS (BANNER PÚBLICO, ANTES DO LOGIN)
// ==========================================
async function carregarAnuncios() {
    const slots = document.querySelectorAll('.ads-banner-slot');
    if (slots.length === 0) return;

    const res = await apiRequest({ action: 'getAnuncios' });
    if (res.status !== 'success' || !res.data || res.data.length === 0) {
        document.querySelectorAll('.ads-banner-wrap').forEach(wrap => wrap.style.display = 'none');
        return;
    }

    const htmlAnuncios = res.data.map(anuncio =>
        `<img src="${anuncio.imagem}" alt="Anúncio" loading="lazy" onclick="window.open('${anuncio.link}', '_blank')">`
    ).join('');

    slots.forEach(slot => { slot.innerHTML = htmlAnuncios; });
}

// ==========================================
// NOTIFICAÇÕES INTERNAS (SINO)
// ==========================================
let notificacoesCache = [];

function chaveUltimaNotificacaoVista() {
    return `coelhos-notif-lastseen-${currentUser.email}`;
}

async function carregarNotificacoes() {
    if (currentUser.role === 'guest') return;

    const res = await apiRequest({ action: 'getNotificacoes', email: currentUser.email, token: currentUser.token });
    if (res.status !== 'success') return;

    notificacoesCache = res.data || [];
    const ultimaVista = parseInt(localStorage.getItem(chaveUltimaNotificacaoVista())) || 0;
    const naoLidas = notificacoesCache.filter(n => Number(n.id) > ultimaVista).length;

    const badge = document.getElementById('notif-badge');
    if (badge) {
        if (naoLidas > 0) { badge.style.display = 'flex'; badge.innerText = naoLidas > 9 ? '9+' : naoLidas; }
        else { badge.style.display = 'none'; }
    }

    renderizarNotificacoes();
}

function renderizarNotificacoes() {
    const lista = document.getElementById('notif-lista');
    if (!lista) return;

    if (notificacoesCache.length === 0) {
        lista.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Nenhuma notificação por enquanto.</p>`;
        return;
    }

    lista.innerHTML = notificacoesCache.map(n => `
        <div class="notif-item">
            ${n.mensagem}
            <span>${n.data}</span>
        </div>
    `).join('');
}

function toggleNotificacoes() {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown) return;
    const abrindo = dropdown.style.display === 'none';
    dropdown.style.display = abrindo ? 'block' : 'none';

    if (abrindo) {
        const maiorId = notificacoesCache.reduce((max, n) => Math.max(max, Number(n.id)), 0);
        if (maiorId > 0) localStorage.setItem(chaveUltimaNotificacaoVista(), String(maiorId));
        const badge = document.getElementById('notif-badge');
        if (badge) badge.style.display = 'none';
    }
}

document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.notif-bell-wrap');
    if (wrap && !wrap.contains(e.target)) {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});

// ==========================================
// MEU PERFIL
// ==========================================
function carregarMeuPerfil() {
    if (currentUser.role === 'guest') return;
    document.getElementById('perfil-nome').value = currentUser.nomeCompleto || currentUser.name;
    document.getElementById('perfil-whats').value = '';
    document.getElementById('perfil-foto').value = currentUser.fotoPerfil || '';
    document.getElementById('perfil-ranking').checked = !!currentUser.rankingPublico;
}

document.getElementById('form-perfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    const nome = document.getElementById('perfil-nome').value.trim();
    const whats = document.getElementById('perfil-whats').value.replace(/\D/g, '');
    const fotoUrl = document.getElementById('perfil-foto').value.trim();
    const rankingPublico = document.getElementById('perfil-ranking').checked;

    const res = await apiRequest({
        action: 'atualizarPerfil',
        email: currentUser.email,
        token: currentUser.token,
        nome: nome,
        whats: whats,
        fotoUrl: fotoUrl,
        rankingPublico: rankingPublico
    });

    if (res.status === 'success') {
        currentUser.nomeCompleto = res.data.nome;
        currentUser.name = res.data.nome.split(' ')[0];
        currentUser.fotoPerfil = res.data.fotoPerfil;
        currentUser.rankingPublico = res.data.rankingPublico;
        updateUIPermissions();
        alert("Perfil atualizado com sucesso!");
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

document.getElementById('form-trocar-senha')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senhaAtual = document.getElementById('senha-atual').value;
    const senhaNova = document.getElementById('senha-nova').value;
    const senhaNova2 = document.getElementById('senha-nova2').value;

    if (senhaNova !== senhaNova2) return alert("As novas senhas não coincidem.");

    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Trocando...";
    btn.disabled = true;

    const res = await apiRequest({
        action: 'trocarSenha',
        email: currentUser.email,
        token: currentUser.token,
        senhaAtual: senhaAtual,
        novaSenha: senhaNova
    });

    if (res.status === 'success') {
        alert("Senha alterada com sucesso!");
        e.target.reset();
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// GAMIFICAÇÃO: RANKING
// ==========================================
async function carregarRanking() {
    const container = document.getElementById('lista-ranking');
    if (!container) return;

    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando ranking...</p>`;

    const res = await apiRequest({ action: 'getRanking', email: currentUser.email, token: currentUser.token });

    if (res.status !== 'success' || !res.data || res.data.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Ainda não há alunos no ranking público. Ative a opção "Aparecer no ranking público" no seu Perfil para aparecer aqui!</p>`;
        return;
    }

    const medalhas = ['🥇', '🥈', '🥉'];
    container.innerHTML = res.data.map((aluno, idx) => `
        <div class="bento-card flex-center">
            <div style="font-size: 2rem;">${medalhas[idx] || `#${idx + 1}`}</div>
            <h3>${aluno.nome}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">
                <i class="ri-medal-line"></i> ${aluno.certificados} certificado(s) &nbsp;•&nbsp;
                <i class="ri-fire-line"></i> ${aluno.streak} dia(s) seguidos
            </p>
        </div>
    `).join('');
}

// ==========================================
// BLOG / ARTIGOS
// ==========================================
async function carregarBlog() {
    const container = document.getElementById('lista-blog');
    if (!container) return;

    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando artigos...</p>`;

    const res = await apiRequest({ action: 'getArtigos' });

    if (res.status !== 'success' || !res.data || res.data.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Nenhum artigo publicado ainda. Volte em breve! 📝</p>`;
        return;
    }

    container.innerHTML = res.data.map(artigo => `
        <div class="bento-card course-card hover-scale" style="cursor:pointer;" onclick="abrirArtigo(${artigo.id})">
            ${artigo.capa ? `<img src="${artigo.capa}" alt="${artigo.titulo}" class="course-cover-img" loading="lazy">` : ''}
            <span class="role-badge" style="width: fit-content; margin: 10px 0;">${artigo.data || ''}</span>
            <h3>${artigo.titulo}</h3>
            <p>${artigo.resumo}</p>
            <button class="primary-btn">Ler Artigo</button>
        </div>
    `).join('');
}

async function abrirArtigo(id) {
    navigateTo('artigo-detalhe');
    const container = document.getElementById('conteudo-artigo');
    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando artigo...</p>`;

    const res = await apiRequest({ action: 'getArtigo', id: id });

    if (res.status !== 'success') {
        container.innerHTML = `<p style="color:#ef4444;">${res.message || 'Artigo não encontrado.'}</p>`;
        return;
    }

    const conteudoFormatado = String(res.data.conteudo || '')
        .replace(/\\n/g, '\n')
        .split('\n')
        .map(p => p.trim() ? `<p style="margin-bottom:1rem;">${p.trim()}</p>` : '')
        .join('');

    container.innerHTML = `
        ${res.data.capa ? `<img src="${res.data.capa}" alt="${res.data.titulo}" style="width:100%; max-height:320px; object-fit:cover; border-radius:20px; margin-bottom:1.5rem;">` : ''}
        <span class="role-badge">${res.data.data || ''}</span>
        <h1 style="margin-top: 1rem;">${res.data.titulo}</h1>
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Por ${res.data.autor}</p>
        <div style="max-width: 720px; line-height: 1.8;">${conteudoFormatado}</div>
    `;
}

// ==========================================
// ADMIN: DASHBOARD COM GRÁFICOS
// ==========================================
let chartAlunosSemana = null;
let chartCursosProcurados = null;

async function carregarDashboardAdmin() {
    if (currentUser.role !== 'admin') return;

    // Carrega a biblioteca Chart.js agora (só quando o admin realmente abre o dashboard).
    try {
        await carregarBibliotecaExterna(CDN_CHARTJS, 'Chart');
    } catch (e) {
        return; // sem a lib, não dá pra desenhar os gráficos — os cartões de KPI acima continuam funcionando normalmente
    }

    const res = await apiRequest({ action: 'getDashboardAdmin', email: currentUser.email, token: currentUser.token });
    if (res.status !== 'success') return;

    const totalAlunosEl = document.getElementById('admin-total-alunos');
    const taxaEl = document.getElementById('admin-taxa-conclusao');
    if (totalAlunosEl) totalAlunosEl.innerText = res.data.totalAlunos;
    if (taxaEl) taxaEl.innerText = res.data.taxaConclusao + '%';

    const corAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1';
    const corAccent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#22d3ee';
    const corTexto = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#8b96ac';

    const ctxSemana = document.getElementById('chart-alunos-semana');
    if (ctxSemana) {
        if (chartAlunosSemana) chartAlunosSemana.destroy();
        chartAlunosSemana = new Chart(ctxSemana, {
            type: 'line',
            data: {
                labels: res.data.alunosPorSemana.map(s => s.semana),
                datasets: [{
                    label: 'Novos alunos',
                    data: res.data.alunosPorSemana.map(s => s.total),
                    borderColor: corAccent,
                    backgroundColor: corAccent + '33',
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: corTexto }, grid: { display: false } },
                    y: { ticks: { color: corTexto, precision: 0 }, grid: { color: corTexto + '22' } }
                }
            }
        });
    }

    const ctxCursos = document.getElementById('chart-cursos-procurados');
    if (ctxCursos) {
        if (chartCursosProcurados) chartCursosProcurados.destroy();
        chartCursosProcurados = new Chart(ctxCursos, {
            type: 'bar',
            data: {
                labels: res.data.cursosMaisProcurados.map(c => c.curso),
                datasets: [{
                    label: 'Acessos',
                    data: res.data.cursosMaisProcurados.map(c => c.total),
                    backgroundColor: corAccent2
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: corTexto }, grid: { display: false } },
                    y: { ticks: { color: corTexto, precision: 0 }, grid: { color: corTexto + '22' } }
                }
            }
        });
    }
}

document.getElementById('form-notificacao-broadcast')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const mensagem = document.getElementById('broadcast-mensagem').value;
    const res = await apiRequest({ action: 'enviarNotificacaoBroadcast', email: currentUser.email, token: currentUser.token, mensagem });

    if (res.status === 'success') {
        alert("Notificação enviada a todos os alunos!");
        e.target.reset();
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// ONBOARDING: TOUR GUIADO NO PRIMEIRO ACESSO
// ==========================================
const PASSOS_TOUR = [
    { seletor: 'a[href="#sala-aula"]', titulo: 'Sala de Aula', texto: 'Aqui você assiste às aulas dos seus cursos, envia a atividade final e emite seu certificado.' },
    { seletor: 'a[href="#flashcards"]', titulo: 'Anki Cards', texto: 'Use os flashcards para revisar o conteúdo com repetição espaçada — o sistema te lembra na hora certa.' },
    { seletor: 'a[href="#meus-certificados"]', titulo: 'Meus Certificados', texto: 'Todos os certificados que você conquistar ficam guardados aqui, prontos para baixar quando quiser.' }
];

function iniciarTourOnboardingSeNecessario() {
    if (currentUser.role !== 'student') return;
    if (localStorage.getItem('coelhos-tour-feito')) return;

    setTimeout(() => mostrarPassoTour(0), 700);
}

function mostrarPassoTour(indice) {
    document.getElementById('tour-overlay')?.remove();

    if (indice >= PASSOS_TOUR.length) {
        localStorage.setItem('coelhos-tour-feito', '1');
        return;
    }

    const passo = PASSOS_TOUR[indice];
    const alvo = document.querySelector(passo.seletor);
    if (!alvo) { mostrarPassoTour(indice + 1); return; }

    const rect = alvo.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    overlay.className = 'tour-overlay';
    overlay.innerHTML = `
        <div class="tour-spotlight" style="top:${rect.top - 6}px; left:${rect.left - 6}px; width:${rect.width + 12}px; height:${rect.height + 12}px;"></div>
        <div class="tour-tooltip" style="top:${rect.bottom + 12}px; left:${Math.min(rect.left, window.innerWidth - 300)}px;">
            <strong>${passo.titulo}</strong>
            <p>${passo.texto}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.8rem;">
                <span style="font-size:0.75rem; color:var(--text-muted);">${indice + 1} de ${PASSOS_TOUR.length}</span>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-ghost" style="padding:6px 14px; font-size:0.8rem;" onclick="pularTour()">Pular</button>
                    <button class="primary-btn" style="padding:6px 14px; font-size:0.8rem; width:auto;" onclick="mostrarPassoTour(${indice + 1})">${indice + 1 === PASSOS_TOUR.length ? 'Concluir' : 'Próximo'}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function pularTour() {
    document.getElementById('tour-overlay')?.remove();
    localStorage.setItem('coelhos-tour-feito', '1');
}

// ==========================================
// DÚVIDAS POR AULA
// ==========================================
async function abrirDuvidasDaAula(ordem, titulo) {
    aulaAtual = { ordem, titulo };
    const box = document.getElementById('duvidas-box');
    if (box) box.style.display = 'block';
    await carregarDuvidasDaAula();
}

async function carregarDuvidasDaAula() {
    const lista = document.getElementById('lista-duvidas');
    if (!lista || !cursoAtual.id || aulaAtual.ordem === null) return;

    lista.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;"><i class="ri-loader-4-line ri-spin"></i> Carregando dúvidas...</p>`;

    const res = await apiRequest({
        action: 'getDuvidasAula',
        email: currentUser.email,
        token: currentUser.token,
        courseId: cursoAtual.id,
        aulaOrdem: aulaAtual.ordem
    });

    if (res.status !== 'success' || !res.data || res.data.length === 0) {
        lista.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Nenhuma dúvida ainda nesta aula. Seja o primeiro a perguntar!</p>`;
        return;
    }

    lista.innerHTML = res.data.map(d => `
        <div class="duvida-item">
            <div class="duvida-meta">${d.nomeAluno} • ${d.data}</div>
            <div class="duvida-pergunta">${d.pergunta}</div>
            ${d.resposta
                ? `<div class="duvida-resposta"><i class="ri-shield-check-line"></i> ${d.resposta}</div>`
                : `<div class="duvida-sem-resposta">Ainda sem resposta do professor.</div>`}
        </div>
    `).join('');
}

document.getElementById('form-duvida')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!cursoAtual.id || aulaAtual.ordem === null) return alert("Selecione uma aula primeiro.");

    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const res = await apiRequest({
        action: 'enviarDuvida',
        email: currentUser.email,
        token: currentUser.token,
        courseId: cursoAtual.id,
        courseName: cursoAtual.nome,
        aulaOrdem: aulaAtual.ordem,
        aulaTitulo: aulaAtual.titulo,
        pergunta: document.getElementById('duvida-texto').value
    });

    if (res.status === 'success') {
        e.target.reset();
        carregarDuvidasDaAula();
    } else {
        alert(`Erro: ${res.message}`);
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// ADMIN: DÚVIDAS PENDENTES DE RESPOSTA
// ==========================================
async function carregarDuvidasPendentesAdmin() {
    const container = document.getElementById('admin-duvidas-pendentes');
    if (!container || currentUser.role !== 'admin') return;

    container.innerHTML = `<p style="color: var(--text-muted);"><i class="ri-loader-4-line ri-spin"></i> Carregando dúvidas...</p>`;

    const res = await apiRequest({ action: 'getDuvidasPendentesAdmin', email: currentUser.email, token: currentUser.token });

    if (res.status !== 'success') {
        container.innerHTML = `<p style="color:#ef4444;">${res.message || 'Erro ao carregar dúvidas.'}</p>`;
        return;
    }

    if (!res.data || res.data.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Nenhuma dúvida pendente. ✅</p>`;
        return;
    }

    container.innerHTML = res.data.map((item, idx) => `
        <div class="admin-activity-item" style="flex-direction:column; align-items:stretch;">
            <div class="admin-activity-info">
                <strong>${item.nomeAluno}</strong>
                <span style="font-size:0.85rem; color:var(--text-muted);">${item.aulaTitulo || 'Aula'} • ${item.data}</span>
                <p style="margin-top:6px;">${item.pergunta}</p>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <input type="text" id="resposta-duvida-${idx}" placeholder="Escreva a resposta..." style="margin-bottom:0;">
                <button class="btn-outline-success" style="white-space:nowrap;" onclick="responderDuvidaAdmin('${item.id}', '${item.email}', ${idx}, this)">Responder</button>
            </div>
        </div>
    `).join('');
}

async function responderDuvidaAdmin(idDuvida, emailAluno, idx, btnEl) {
    const input = document.getElementById(`resposta-duvida-${idx}`);
    const resposta = input.value.trim();
    if (!resposta) return alert("Escreva uma resposta antes de enviar.");

    btnEl.disabled = true;
    btnEl.innerText = "Enviando...";

    const res = await apiRequest({
        action: 'responderDuvida',
        email: currentUser.email,
        token: currentUser.token,
        idDuvida, emailAluno, resposta
    });

    if (res.status === 'success') {
        carregarDuvidasPendentesAdmin();
    } else {
        alert(`Erro: ${res.message}`);
        btnEl.disabled = false;
        btnEl.innerText = "Responder";
    }
}

// ==========================================
// VERIFICAÇÃO PÚBLICA DE CERTIFICADO
// ==========================================
document.getElementById('form-verificar-certificado')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    const codigo = document.getElementById('verificar-codigo').value.trim();
    const resultado = document.getElementById('resultado-verificacao');

    const res = await apiRequest({ action: 'verificarCertificado', codigo });

    if (res.status === 'success' && res.data.valido) {
        resultado.innerHTML = `
            <div class="status-pill status-aprovado" style="margin-bottom:0.8rem;"><i class="ri-checkbox-circle-line"></i> Certificado autêntico</div>
            <p><strong>Aluno:</strong> ${res.data.nomeAluno}</p>
            <p><strong>Curso:</strong> ${res.data.nomeCurso}</p>
            <p><strong>Carga horária:</strong> ${res.data.cargaHoraria}h</p>
            <p><strong>Emitido em:</strong> ${res.data.data}</p>
        `;
    } else {
        resultado.innerHTML = `
            <div class="status-pill status-reprovado"><i class="ri-close-circle-line"></i> Código não encontrado</div>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.6rem;">Verifique se digitou o código corretamente, exatamente como aparece no rodapé do certificado.</p>
        `;
    }

    btn.innerText = originalText;
    btn.disabled = false;
});

// ==========================================
// COMPARTILHAR CERTIFICADO (IMAGEM PARA REDES SOCIAIS)
// ==========================================
async function gerarImagemCompartilhavel({ nomeAluno, nomeCurso, cargaHoraria, codigo }) {
    const tamanho = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = tamanho;
    canvas.height = tamanho;
    const ctx = canvas.getContext('2d');

    // Fundo gradiente (indigo -> ciano)
    const gradiente = ctx.createLinearGradient(0, 0, tamanho, tamanho);
    gradiente.addColorStop(0, '#6366f1');
    gradiente.addColorStop(1, '#22d3ee');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, tamanho, tamanho);

    // Cartão branco central
    const margem = 60;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, margem, margem, tamanho - margem * 2, tamanho - margem * 2, 32);
    ctx.fill();

    // Logo
    try {
        const logoImg = await carregarImagemElemento(LOGO_URL);
        const logoTam = 90;
        ctx.drawImage(logoImg, (tamanho - logoTam) / 2, margem + 50, logoTam, logoTam);
    } catch (e) { /* segue sem logo */ }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#111629';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText('Certificado de Conclusão', tamanho / 2, margem + 220);

    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 46px Georgia, serif';
    quebrarTextoCanvas(ctx, nomeAluno || 'Aluno(a)', tamanho / 2, margem + 300, tamanho - margem * 3, 54);

    ctx.fillStyle = '#5b6577';
    ctx.font = '24px Arial';
    ctx.fillText('concluiu com sucesso o curso', tamanho / 2, margem + 400);

    ctx.fillStyle = '#111629';
    ctx.font = 'bold 30px Arial';
    quebrarTextoCanvas(ctx, `"${nomeCurso}"`, tamanho / 2, margem + 450, tamanho - margem * 3, 38);

    ctx.fillStyle = '#5b6577';
    ctx.font = '22px Arial';
    ctx.fillText(`Carga horária: ${cargaHoraria}h`, tamanho / 2, margem + 560);

    ctx.fillStyle = '#8b96ac';
    ctx.font = '18px Arial';
    ctx.fillText('Coelhos Academy 🐰', tamanho / 2, tamanho - margem - 90);
    if (codigo) ctx.fillText(`Verifique em: coelhosacademy.com.br — código ${codigo}`, tamanho / 2, tamanho - margem - 60);

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Conquista - ${nomeCurso}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function quebrarTextoCanvas(ctx, texto, x, y, larguraMaxima, alturaLinha) {
    const palavras = String(texto).split(' ');
    let linha = '';
    let linhaY = y;
    const linhas = [];

    palavras.forEach(palavra => {
        const testeLinha = linha + palavra + ' ';
        if (ctx.measureText(testeLinha).width > larguraMaxima && linha !== '') {
            linhas.push(linha);
            linha = palavra + ' ';
        } else {
            linha = testeLinha;
        }
    });
    linhas.push(linha);

    const offsetInicial = ((linhas.length - 1) * alturaLinha) / 2;
    linhas.forEach((l, i) => ctx.fillText(l.trim(), x, y - offsetInicial + i * alturaLinha));
}

function carregarImagemElemento(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

// ==========================================
// BOTÃO FLUTUANTE DE WHATSAPP
// ==========================================
function abrirWhatsappSuporte() {
    const numeroSuporte = WHATSAPP_NUMERO;
    const mensagem = encodeURIComponent("Olá! Estou navegando no site da Coelhos Academy e gostaria de tirar uma dúvida.");
    window.open(`https://wa.me/${numeroSuporte}?text=${mensagem}`, '_blank');
}
