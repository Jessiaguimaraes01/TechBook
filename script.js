// ========================================
// CONFIGURAÇÕES E DADOS
// ========================================
/*
const CHAVE = "tecbook-demo-v2";
const CHAVE_CONTRASTE = "techbook-alto-contraste";

const desafiosIniciais = [
  {
    id: 1,
    titulo: "Explore um gênero novo",
    descricao: "Descubra um gênero literário que você ainda não conhece.",
    pontos: 25,
    concluido: false
  },
  {
    id: 2,
    titulo: "Conheça três autores",
    descricao: "Explore livros de três escritores diferentes.",
    pontos: 25,
    concluido: false
  },
  {
    id: 3,
    titulo: "Use o catálogo inteligente",
    descricao: "Pesquise um livro por título, autor ou gênero.",
    pontos: 25,
    concluido: false
  },
  {
    id: 4,
    titulo: "Descubra sua próxima leitura",
    descricao: "Use o recomendador para encontrar um livro.",
    pontos: 25,
    concluido: false
  }
];

function carregarDados() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      const dadosSalvos = JSON.parse(salvo);
      if (Array.isArray(dadosSalvos.desafios)) {
        return {
          livros: [],
          emprestimos: [],
          desafios: dadosSalvos.desafios
        };
      }
    }
  } catch (erro) {
    console.warn("Erro ao carregar dados locais:", erro);
  }

  return {
    livros: [],
    emprestimos: [],
    desafios: desafiosIniciais.map(desafio => ({ ...desafio }))
  };
}

let dados = carregarDados();
let generoSelecionado = "Todos";
let fonte = 100;
let bancoCarregado = false;
let erroCarregamentoLivros = false;
let carregandoLivros = true;

// ========================================
// CARREGAMENTO DOS LIVROS DO BANCO SQLITE
// ========================================

async function carregarLivrosDoBanco() {
  carregandoLivros = true;
  erroCarregamentoLivros = false;
  renderizarCatalogo();

  try {
    const resposta = await fetch("/api/livros", { cache: "no-store" });
    if (!resposta.ok) throw new Error("Não foi possível carregar os livros.");

    const livrosBanco = await resposta.json();
    if (!Array.isArray(livrosBanco)) throw new Error("A API não retornou uma lista válida.");

    dados.livros = livrosBanco.map(livro => ({
      id: Number(livro.id_livro),
      titulo: livro.titulo || "Título não informado",
      autor: livro.autor || "Autor não informado",
      genero: livro.genero || "Outros",
      isbn: livro.isbn || livro.ISBN || "",
      emoji: "📚",
      cor: "#E9DCE5",
      sinopse: "",
      quantidade: Number(livro.quantidade) || 0,
      disponiveisBanco: Number(livro.disponiveis) || 0,
      duracao: "longa"
    }));

    bancoCarregado = true;
    erroCarregamentoLivros = false;
    carregandoLivros = false;
    renderizarTudo();
  } catch (erro) {
    console.error("Erro ao conectar com o banco:", erro);
    dados.livros = [];
    bancoCarregado = false;
    erroCarregamentoLivros = true;
    carregandoLivros = false;
    renderizarTudo();
  }
}

// ========================================
// ARMAZENAMENTO E FUNÇÕES AUXILIARES
// ========================================

function salvarDados() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ desafios: dados.desafios }));
    return true;
  } catch (erro) {
    return false;
  }
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function disponiveis(livro) {
  return Math.max(0, Number(livro.disponiveisBanco) || 0);
}

// ========================================
// CAPAS DOS LIVROS
// ========================================

function capaHTML(livro) {
  const isbn = escapar(livro.isbn);
  const titulo = escapar(livro.titulo);
  const emoji = escapar(livro.emoji);

  if (!isbn) {
    return `
      <div class="capa-livro" style="--cor-capa:${livro.cor}">
        <span class="capa-emoji" aria-hidden="true">${emoji}</span>
      </div>
    `;
  }

  return `
    <div class="capa-livro" style="--cor-capa:${livro.cor}">
      <img
        src="https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg"
        alt="Capa de ${titulo}"
        loading="lazy"
        onerror="this.hidden=true;this.nextElementSibling.hidden=false"
      >
      <span class="capa-emoji" hidden aria-hidden="true">${emoji}</span>
    </div>
  `;
}

// ========================================
// CATÁLOGO INTELIGENTE
// ========================================

function renderizarCatalogo() {
  const campoBusca = document.querySelector("#busca");
  const grade = document.querySelector("#grade-livros");
  const resultado = document.querySelector("#resultado-busca");
  const vazio = document.querySelector("#vazio");

  if (!campoBusca || !grade || !resultado || !vazio) return;

  if (carregandoLivros) {
    resultado.textContent = "Consultando o catálogo...";
    vazio.hidden = false;
    vazio.textContent = "Carregando livros do banco de dados...";
    grade.innerHTML = "";
    return;
  }

  if (erroCarregamentoLivros) {
    resultado.textContent = "Catálogo indisponível";
    vazio.hidden = false;
    vazio.textContent = "Não foi possível consultar os livros. Tente novamente mais tarde.";
    grade.innerHTML = "";
    return;
  }

  if (dados.livros.length === 0) {
    resultado.textContent = "0 livro(s) encontrado(s).";
    vazio.hidden = false;
    vazio.textContent = "Ainda não existem livros cadastrados no banco de dados.";
    grade.innerHTML = "";
    return;
  }

  const busca = campoBusca.value.trim().toLocaleLowerCase("pt-BR");

  const encontrados = dados.livros.filter(livro => {
    const texto = `${livro.titulo} ${livro.autor} ${livro.genero} ${livro.sinopse}`.toLocaleLowerCase("pt-BR");
    return texto.includes(busca) && (generoSelecionado === "Todos" || livro.genero === generoSelecionado);
  });

  resultado.textContent = `${encontrados.length} livro(s) encontrado(s).`;
  vazio.hidden = encontrados.length > 0;

  if (encontrados.length === 0) {
    vazio.textContent = "Nenhum livro encontrado com essa pesquisa.";
  }

  grade.innerHTML = encontrados.map(livro => {
    const quantidade = disponiveis(livro);

    return `
      <article class="cartao-livro">
        ${capaHTML(livro)}

        <div class="info-livro">
          <span class="genero-livro">${escapar(livro.genero)}</span>
          <h3>${escapar(livro.titulo)}</h3>
          <p class="autor">${escapar(livro.autor)}</p>
          <p class="sinopse">${escapar(livro.sinopse)}</p>

          <span class="disponibilidade ${quantidade ? "" : "esgotado"}">
            ${quantidade ? `${quantidade} disponível(is)` : "Indisponível"}
          </span>

          <div style="display:grid; gap:8px; margin-top:10px;">
            <a
              class="botao botao-vinho acao-cartao"
              href="emprestimos-aluno.html?livro=${livro.id}"
              ${quantidade ? "" : 'style="pointer-events:none;opacity:.5;"'}
            >
              ${quantidade ? "📚 Ir para empréstimo" : "Esgotado"}
            </a>

            <button
              class="botao acao-cartao"
              data-acao="recomendar-livro"
              data-id="${livro.id}"
            >
              Ver semelhantes
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".filtro").forEach(botao => {
    const ativo = botao.dataset.genero === generoSelecionado;
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });
}

// ========================================
// ESTATÍSTICAS DA BIBLIOTECA
// ========================================

function renderizarEstatisticas() {
  const totalExemplares = dados.livros.reduce((soma, livro) => soma + livro.quantidade, 0);
  const generos = [...new Set(dados.livros.map(livro => livro.genero))];
  const livres = dados.livros.reduce((soma, livro) => soma + disponiveis(livro), 0);
  const emprestados = Math.max(0, totalExemplares - livres);

  const totalLivros = document.querySelector("#total-livros");
  const totalEmprestimos = document.querySelector("#total-emprestimos");
  const totalGeneros = document.querySelector("#total-generos");
  const totalDesafios = document.querySelector("#total-desafios");

  if (totalLivros) totalLivros.textContent = bancoCarregado ? totalExemplares : "—";
  if (totalEmprestimos) totalEmprestimos.textContent = bancoCarregado ? emprestados : "—";
  if (totalGeneros) totalGeneros.textContent = bancoCarregado ? generos.length : "—";
  if (totalDesafios) totalDesafios.textContent = dados.desafios.filter(d => d.concluido).length;

  const graficoGeneros = document.querySelector("#grafico-generos");
  const graficoDisponibilidade = document.querySelector("#grafico-disponibilidade");

  if (!graficoGeneros || !graficoDisponibilidade) return;

  if (!bancoCarregado) {
    graficoGeneros.textContent = "Estatísticas aguardando os dados do catálogo.";
    graficoDisponibilidade.textContent = "Disponibilidade aguardando os dados do catálogo.";
    return;
  }

  const contagem = generos.map(genero => ({
    genero,
    total: dados.livros.filter(livro => livro.genero === genero).length
  }));

  const maximo = Math.max(1, ...contagem.map(item => item.total));

  graficoGeneros.innerHTML = contagem.map(item => `
    <div class="barra-dado">
      <span>${escapar(item.genero)}</span>
      <div class="trilho"><span style="width:${item.total / maximo * 100}%"></span></div>
      <strong>${item.total}</strong>
    </div>
  `).join("");

  const escala = Math.max(1, totalExemplares);

  graficoDisponibilidade.innerHTML = `
    <div class="barra-dado">
      <span>Disponíveis</span>
      <div class="trilho"><span style="width:${livres / escala * 100}%"></span></div>
      <strong>${livres}</strong>
    </div>
    <div class="barra-dado">
      <span>Emprestados</span>
      <div class="trilho"><span style="width:${emprestados / escala * 100}%"></span></div>
      <strong>${emprestados}</strong>
    </div>
  `;
}

// ========================================
// DESAFIOS DE LEITURA
// ========================================

function renderizarDesafios() {
  const lista = document.querySelector("#lista-desafios");
  if (!lista) return;

  lista.innerHTML = dados.desafios.map(desafio => `
    <label class="desafio ${desafio.concluido ? "concluido" : ""}">
      <input
        type="checkbox"
        data-acao="desafio"
        data-id="${desafio.id}"
        ${desafio.concluido ? "checked" : ""}
      >
      <div>
        <h3>${escapar(desafio.titulo)}</h3>
        <p>${escapar(desafio.descricao)}</p>
        <span class="genero-livro">${desafio.pontos} pontos</span>
      </div>
    </label>
  `).join("");

  const feitos = dados.desafios.filter(d => d.concluido).length;
  const total = dados.desafios.length;
  const percentual = total ? Math.round(feitos / total * 100) : 0;

  const textoProgresso = document.querySelector("#texto-progresso");
  const barraProgresso = document.querySelector("#barra-progresso");
  const valorMedidor = document.querySelector("#valor-medidor");
  const barraMedidor = document.querySelector("#barra-medidor");
  const legendaMedidor = document.querySelector("#legenda-medidor");

  if (textoProgresso) textoProgresso.textContent = `${feitos} de ${total} concluídos`;
  if (barraProgresso) barraProgresso.style.width = `${percentual}%`;
  if (valorMedidor) valorMedidor.textContent = `${percentual}%`;
  if (barraMedidor) barraMedidor.style.width = `${percentual}%`;

  if (legendaMedidor) {
    legendaMedidor.textContent =
      percentual === 100
        ? "Você concluiu todos os desafios. Que jornada!"
        : percentual > 0
          ? "Cada descoberta ilumina o caminho!"
          : "Toda grande descoberta começa pela primeira página.";
  }
}

function renderizarTudo() {
  renderizarCatalogo();
  renderizarEstatisticas();
  renderizarDesafios();
}

// ========================================
// PESQUISA, FILTROS E RECOMENDADOR
// ========================================

const campoBusca = document.querySelector("#busca");
if (campoBusca) campoBusca.addEventListener("input", renderizarCatalogo);

document.querySelectorAll(".filtro").forEach(botao => {
  botao.addEventListener("click", () => {
    generoSelecionado = botao.dataset.genero;
    renderizarCatalogo();
  });
});

const areaCatalogo = document.querySelector("#grade-livros");

if (areaCatalogo) {
  areaCatalogo.addEventListener("click", (evento) => {
    const btnRecomendar = evento.target.closest("[data-acao='recomendar-livro']");
    if (!btnRecomendar) return;

    const livro = dados.livros.find(item => item.id === Number(btnRecomendar.dataset.id));
    if (!livro) return;
    const campoGenero = document.querySelector("#genero-preferido");
    if (!campoGenero) return;

    campoGenero.value = [...campoGenero.options].some(op => op.value === livro.genero) ? livro.genero : "Todos";
    document.querySelector("#recomendador")?.scrollIntoView({ behavior: "smooth" });
    recomendar();
  });
}

function recomendar() {
  const campoGenero = document.querySelector("#genero-preferido");
  const campoEstilo = document.querySelector("#estilo-preferido");
  const area = document.querySelector("#resultado-recomendacao");

  if (!campoGenero || !campoEstilo || !area) return;

  if (!bancoCarregado) {
    area.textContent = "As recomendações estarão disponíveis quando o catálogo carregar.";
    return;
  }

  const genero = campoGenero.value;
  const estilo = campoEstilo.value;

  let resultados = dados.livros.filter(livro => genero === "Todos" || livro.genero === genero);

  if (estilo === "curta") {
    const curtos = resultados.filter(livro => livro.duracao === "curta");
    if (curtos.length) resultados = curtos;
  } else if (estilo === "aventura") {
    const aventuras = resultados.filter(livro => ["Aventura", "Fantasia"].includes(livro.genero));
    if (aventuras.length) resultados = aventuras;
  } else if (estilo === "reflexao") {
    const reflexivos = resultados.filter(livro => ["Romance", "Ficção científica"].includes(livro.genero));
    if (reflexivos.length) resultados = reflexivos;
  }

  resultados = resultados.slice(0, 3);

  if (!resultados.length) {
    area.textContent = "Não encontramos sugestões para essa combinação.";
    return;
  }

  area.innerHTML = resultados.map(livro => `
    <article class="cartao-livro">
      ${capaHTML(livro)}
      <div class="info-livro">
        <span class="genero-livro">${escapar(livro.genero)}</span>
        <h3>${escapar(livro.titulo)}</h3>
        <p class="autor">${escapar(livro.autor)}</p>
        <p class="sinopse">${escapar(livro.sinopse)}</p>
      </div>
    </article>
  `).join("");
}

function concluirDesafio(id) {
  const desafio = dados.desafios.find(item => item.id === id);
  if (!desafio || desafio.concluido) return;
  desafio.concluido = true;
  salvarDados();
  renderizarDesafios();
  renderizarEstatisticas();
}

document.querySelector("#recomendar-btn")?.addEventListener("click", () => {
  recomendar();
  concluirDesafio(4);
});

document.querySelector("#lista-desafios")?.addEventListener("change", evento => {
  const checkbox = evento.target.closest("[data-acao='desafio']");
  if (!checkbox) return;
  const desafio = dados.desafios.find(item => item.id === Number(checkbox.dataset.id));
  if (!desafio) return;
  const anterior = desafio.concluido;
  desafio.concluido = checkbox.checked;
  if (!salvarDados()) {
    desafio.concluido = anterior;
    renderizarDesafios();
    return;
  }
  renderizarDesafios();
  renderizarEstatisticas();
});

// ========================================
// ACESSIBILIDADE E MENU RESPONSIVO
// ========================================

document.querySelector("#acessibilidade-btn")?.addEventListener("click", () => {
  document.querySelector("#acessibilidade")?.scrollIntoView({ behavior: "smooth" });
});

function atualizarFonte() {
  document.documentElement.style.fontSize = `${fonte}%`;
}

document.querySelector("#fonte-aumentar")?.addEventListener("click", () => { fonte = Math.min(130, fonte + 10); atualizarFonte(); });
document.querySelector("#fonte-diminuir")?.addEventListener("click", () => { fonte = Math.max(80, fonte - 10); atualizarFonte(); });
document.querySelector("#fonte-normal")?.addEventListener("click", () => { fonte = 100; atualizarFonte(); });

function aplicarContrasteSalvo() {
  const ativo = localStorage.getItem(CHAVE_CONTRASTE) === "1";
  document.body.classList.toggle("alto-contraste", ativo);
  const btn = document.querySelector("#contraste-btn");
  if (btn) btn.setAttribute("aria-pressed", String(ativo));
}

document.querySelector("#contraste-btn")?.addEventListener("click", evento => {
  const ativo = document.body.classList.toggle("alto-contraste");
  localStorage.setItem(CHAVE_CONTRASTE, ativo ? "1" : "0");
  evento.currentTarget.setAttribute("aria-pressed", String(ativo));
});

const menuBotao = document.querySelector("#menu-btn");
const menu = document.querySelector("#menu");

if (menuBotao && menu) {
  menuBotao.addEventListener("click", evento => {
    const aberto = menu.classList.toggle("aberto");
    evento.currentTarget.setAttribute("aria-expanded", String(aberto));
  });

  document.querySelectorAll("#menu a").forEach(link => {
    link.addEventListener("click", () => {
      menu.classList.remove("aberto");
      menuBotao.setAttribute("aria-expanded", "false");
    });
  });
}

// ========================================
// VERIFICAÇÃO DE SESSÃO NO TOPO
// ========================================

async function verificarSessaoTopo() {
  const area = document.querySelector("#acesso-aluno-area");
  if (!area) return;

  try {
    const resp = await fetch("/api/sessao-aluno", { credentials: "same-origin" });
    if (resp.ok) {
      const dados = await resp.json();
      const aluno = dados.aluno || dados;
      const primeiroNome = String(aluno.nome || "Leitor").split(" ")[0];
      area.innerHTML = `
        <a href="perfil-aluno.html" class="botao-entrar">👤 ${escapar(primeiroNome)}</a>
        <a href="emprestimos-aluno.html" class="botao-cadastrar">Empréstimos</a>
      `;
      return;
    }

    const respBib = await fetch("/api/sessao-bibliotecario", { credentials: "same-origin" });
    if (respBib.ok) {
      area.innerHTML = `
        <a href="bibliotecario.html" class="botao-entrar">🛠️ Painel Admin</a>
        <a href="emprestimos.html" class="botao-cadastrar">Empréstimos</a>
      `;
    }
  } catch (_) {}
}

// ========================================
// INICIALIZAÇÃO
// ========================================

aplicarContrasteSalvo();
renderizarTudo();
carregarLivrosDoBanco();
verificarSessaoTopo(); */

// TechBook — catálogo demonstrativo, sem servidor e sem banco de dados.
// A lista existe apenas neste arquivo e não é salva no navegador.
// ========================================
// CONFIGURAÇÕES E DADOS
// ========================================
// ========================================
// CONFIGURAÇÕES E DADOS
// ========================================
// TechBook — página inicial, catálogo, estatísticas e desafios locais.
(() => {
  "use strict";

  const demo = window.TechBookDemo;
  if (!demo) {
    console.error("A camada de dados locais do TechBook não foi carregada.");
    return;
  }

  let generoSelecionado = "Todos";

  const $ = seletor => document.querySelector(seletor);
  const escapar = texto => String(texto ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[caractere]);

  function capaHTML(livro) {
    const isbn = escapar(livro.isbn || "");
    const titulo = escapar(livro.titulo);
    const autor = escapar(livro.autor);
    return `
      <div class="capa-livro" style="--cor-capa:${escapar(livro.cor || "#eadfe4")}">
        <img src="${isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : "data:,"}"
          alt="Capa de ${titulo}" loading="lazy" data-titulo="${titulo}" data-autor="${autor}"
          onerror="buscarCapaAlternativa(this)">
        <span class="capa-fallback" hidden aria-hidden="true">
          <span class="capa-fallback-icone">${escapar(livro.emoji || "📚")}</span>
          <strong>${titulo}</strong>
          <small>${autor}</small>
        </span>
      </div>`;
  }

  async function buscarCapaAlternativa(imagem) {
    if (!imagem || imagem.dataset.tentativa === "sim") {
      if (imagem) { imagem.hidden = true; if (imagem.nextElementSibling) imagem.nextElementSibling.hidden = false; }
      return;
    }
    imagem.dataset.tentativa = "sim";
    try {
      const params = new URLSearchParams({ title: imagem.dataset.titulo || "", author: imagem.dataset.autor || "", limit: "5", fields: "cover_i" });
      const resposta = await fetch(`https://openlibrary.org/search.json?${params}`);
      if (!resposta.ok) throw new Error("Capa não localizada");
      const resultado = await resposta.json();
      const capa = resultado.docs?.find(item => item.cover_i)?.cover_i;
      if (capa) imagem.src = `https://covers.openlibrary.org/b/id/${capa}-M.jpg`;
      else throw new Error("Capa não localizada");
    } catch (_) {
      imagem.hidden = true;
      if (imagem.nextElementSibling) imagem.nextElementSibling.hidden = false;
    }
  }
  window.buscarCapaAlternativa = buscarCapaAlternativa;

  function renderizarCatalogo() {
    const campoBusca = $("#busca"), grade = $("#grade-livros"), resultado = $("#resultado-busca"), vazio = $("#vazio");
    if (!campoBusca || !grade || !resultado || !vazio) return;
    const busca = campoBusca.value.trim().toLocaleLowerCase("pt-BR");
    const encontrados = demo.getLivros().filter(livro => {
      const texto = `${livro.titulo} ${livro.autor} ${livro.genero} ${livro.sinopse}`.toLocaleLowerCase("pt-BR");
      return texto.includes(busca) && (generoSelecionado === "Todos" || livro.genero === generoSelecionado);
    });
    resultado.textContent = `${encontrados.length} livro(s) encontrado(s).`;
    vazio.hidden = encontrados.length > 0;
    vazio.textContent = encontrados.length ? "" : "Nenhum livro encontrado com essa pesquisa.";
    grade.innerHTML = encontrados.map(livro => {
      const qtd = demo.disponiveis(livro);
      return `
        <article class="cartao-livro">
          ${capaHTML(livro)}
          <div class="info-livro">
            <span class="genero-livro">${escapar(livro.genero)}</span>
            <h3>${escapar(livro.titulo)}</h3>
            <p class="autor">${escapar(livro.autor)}</p>
            <p class="sinopse">${escapar(livro.sinopse)}</p>
            <span class="disponibilidade ${qtd ? "" : "esgotado"}">${qtd ? `${qtd} disponível(is)` : "Indisponível"}</span>
            <div class="acoes-cartao-livro">
              <a class="botao botao-vinho acao-cartao" href="emprestimos-aluno.html?livro=${livro.id}" ${qtd ? "" : 'aria-disabled="true" tabindex="-1"'}>${qtd ? "Solicitar empréstimo" : "Sem exemplares"}</a>
              <button class="botao botao-claro acao-cartao" type="button" data-acao="recomendar-livro" data-id="${livro.id}">Ver semelhantes</button>
            </div>
          </div>
        </article>`;
    }).join("");
    document.querySelectorAll(".filtro").forEach(botao => {
      const ativo = botao.dataset.genero === generoSelecionado;
      botao.classList.toggle("ativo", ativo);
      botao.setAttribute("aria-pressed", String(ativo));
    });
  }

  function renderizarEstatisticas() {
    const s = demo.estatisticas();
    const leitura = demo.getLeitura();
    const desafios = demo.getDesafios();
    const concluidos = desafios.filter(item => item.concluido).length;
    const percentualDesafios = desafios.length ? Math.round(concluidos / desafios.length * 100) : 0;
    const percentualMeta = leitura.metaAnual ? Math.min(100, Math.round(leitura.livrosLidos / leitura.metaAnual * 100)) : 0;

    const mapa = {
      "#total-livros": s.totalExemplares,
      "#total-emprestimos": s.emprestimosAtivos,
      "#total-generos": s.generos,
      "#total-desafios": concluidos,
      "#dados-total-titulos": s.titulos,
      "#dados-total-exemplares": s.totalExemplares,
      "#dados-disponiveis": s.disponiveis,
      "#dados-emprestados": s.emprestados,
      "#dados-lidos": leitura.livrosLidos,
      "#dados-paginas": leitura.paginasLidas,
      "#dados-sequencia": leitura.sequenciaDias
    };
    Object.entries(mapa).forEach(([seletor, valor]) => { const el = $(seletor); if (el) el.textContent = valor; });

    const generos = [...new Set(demo.getLivros().map(livro => livro.genero))].map(genero => ({ genero, total: demo.getLivros().filter(livro => livro.genero === genero).length }));
    const max = Math.max(1, ...generos.map(item => item.total));
    const graficoGeneros = $("#grafico-generos");
    if (graficoGeneros) graficoGeneros.innerHTML = generos.map(item => `
      <div class="barra-dado"><span>${escapar(item.genero)}</span><div class="trilho"><span style="width:${item.total / max * 100}%"></span></div><strong>${item.total}</strong></div>`).join("");

    const graficoDisp = $("#grafico-disponibilidade");
    if (graficoDisp) {
      const total = Math.max(1, s.totalExemplares);
      graficoDisp.innerHTML = `
        <div class="barra-dado"><span>Disponíveis</span><div class="trilho"><span style="width:${s.disponiveis / total * 100}%"></span></div><strong>${s.disponiveis}</strong></div>
        <div class="barra-dado"><span>Emprestados</span><div class="trilho"><span style="width:${s.emprestados / total * 100}%"></span></div><strong>${s.emprestados}</strong></div>`;
    }

    const textoMeta = $("#texto-meta-anual");
    if (textoMeta) textoMeta.textContent = `${leitura.livrosLidos} de ${leitura.metaAnual} livros`;
    const barraMeta = $("#barra-meta-anual");
    if (barraMeta) barraMeta.style.width = `${percentualMeta}%`;
    const textoDesafios = $("#texto-progresso-dados");
    if (textoDesafios) textoDesafios.textContent = `${concluidos} de ${desafios.length} concluídos`;
    const barraDesafios = $("#barra-progresso-dados");
    if (barraDesafios) barraDesafios.style.width = `${percentualDesafios}%`;
    const listaConquistas = $("#lista-conquistas");
    if (listaConquistas) listaConquistas.innerHTML = demo.getConquistas().map(item => `
      <article class="conquista ${item.alcancada ? "conquista-alcancada" : "conquista-bloqueada"}">
        <span class="conquista-icone" aria-hidden="true">${item.icone}</span>
        <div><strong>${escapar(item.titulo)}</strong><small>${escapar(item.descricao)}</small><em>${item.alcancada ? "Conquista alcançada" : "Ainda não alcançada"}</em></div>
      </article>`).join("");
  }

  function renderizarDesafios() {
    const lista = $("#lista-desafios");
    if (!lista) return;
    lista.innerHTML = demo.getDesafios().map(item => `
      <label class="desafio ${item.concluido ? "concluido" : ""}">
        <input type="checkbox" data-acao="desafio" data-id="${item.id}" ${item.concluido ? "checked" : ""}>
        <div><h3>${escapar(item.titulo)}</h3><p>${escapar(item.descricao)}</p><span class="genero-livro">${item.pontos} pontos</span></div>
      </label>`).join("");
    const feitos = demo.getDesafios().filter(item => item.concluido).length;
    const total = demo.getDesafios().length;
    const percentual = total ? Math.round(feitos / total * 100) : 0;
    if ($("#texto-progresso")) $("#texto-progresso").textContent = `${feitos} de ${total} concluídos`;
    if ($("#barra-progresso")) $("#barra-progresso").style.width = `${percentual}%`;
    if ($("#valor-medidor")) $("#valor-medidor").textContent = `${percentual}%`;
    if ($("#barra-medidor")) $("#barra-medidor").style.width = `${percentual}%`;
    if ($("#legenda-medidor")) $("#legenda-medidor").textContent = percentual === 100 ? "Todos os desafios foram concluídos. Que jornada!" : percentual > 0 ? "Cada descoberta ilumina o caminho!" : "Toda grande descoberta começa pela primeira página.";
    renderizarEstatisticas();
  }

  function recomendar() {
    const campoGenero = $("#genero-preferido"), campoEstilo = $("#estilo-preferido"), area = $("#resultado-recomendacao");
    if (!campoGenero || !campoEstilo || !area) return;
    const genero = campoGenero.value;
    const estilo = campoEstilo.value;
    let resultados = demo.getLivros().filter(livro => genero === "Todos" || livro.genero === genero);
    if (estilo === "curta") {
      const curtos = resultados.filter(livro => livro.duracao === "curta");
      if (curtos.length) resultados = curtos;
    } else if (estilo === "aventura") {
      const aventuras = resultados.filter(livro => ["Aventura", "Fantasia"].includes(livro.genero));
      if (aventuras.length) resultados = aventuras;
    } else if (estilo === "reflexao") {
      const reflexivos = resultados.filter(livro => ["Romance", "Ficção científica"].includes(livro.genero));
      if (reflexivos.length) resultados = reflexivos;
    }
    resultados = resultados.slice(0, 3);
    area.innerHTML = resultados.length ? resultados.map(livro => `
      <article class="cartao-livro">${capaHTML(livro)}<div class="info-livro"><span class="genero-livro">${escapar(livro.genero)}</span><h3>${escapar(livro.titulo)}</h3><p class="autor">${escapar(livro.autor)}</p><p class="sinopse">${escapar(livro.sinopse)}</p></div></article>`).join("") : "Não encontramos sugestões para essa combinação.";
    demo.concluirDesafio(4, true);
    renderizarDesafios();
  }

  $("#busca")?.addEventListener("input", () => {
    renderizarCatalogo();
    if ($("#busca").value.trim()) demo.concluirDesafio(3, true);
  });
  document.querySelectorAll(".filtro").forEach(botao => botao.addEventListener("click", () => { generoSelecionado = botao.dataset.genero || "Todos"; renderizarCatalogo(); }));
  $("#grade-livros")?.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-acao='recomendar-livro']");
    if (!botao) return;
    const livro = demo.getLivros().find(item => item.id === Number(botao.dataset.id));
    if (!livro) return;
    const campoGenero = $("#genero-preferido");
    if (campoGenero) campoGenero.value = [...campoGenero.options].some(option => option.value === livro.genero) ? livro.genero : "Todos";
    $("#recomendador")?.scrollIntoView({ behavior: "smooth" });
    recomendar();
  });
  $("#recomendar-btn")?.addEventListener("click", recomendar);
  $("#lista-desafios")?.addEventListener("change", evento => {
    const input = evento.target.closest("[data-acao='desafio']");
    if (!input) return;
    demo.concluirDesafio(input.dataset.id, input.checked);
    renderizarDesafios();
  });

  $("#acessibilidade-btn")?.addEventListener("click", () => $("#acessibilidade")?.scrollIntoView({ behavior: "smooth" }));
  const menuBotao = $("#menu-btn"), menu = $("#menu");
  if (menuBotao && menu) {
    menuBotao.addEventListener("click", evento => {
      const aberto = menu.classList.toggle("aberto");
      evento.currentTarget.setAttribute("aria-expanded", String(aberto));
    });
    menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      menu.classList.remove("aberto"); menuBotao.setAttribute("aria-expanded", "false");
    }));
  }

  // A página inicial funciona sem sessão e não consulta endpoints do servidor.
  renderizarCatalogo();
  renderizarDesafios();
  renderizarEstatisticas();
})();
