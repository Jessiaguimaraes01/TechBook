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

const CHAVE = "tecbook-demo-v1";

const livrosIniciais = [
  { id: 1, titulo: "Alice no País das Maravilhas", autor: "Lewis Carroll", genero: "Fantasia", isbn: "9780141321073", emoji: "🐇", cor: "#e8e8fa", sinopse: "Uma aventura fantástica por um mundo cheio de surpresas.", quantidade: 3, duracao: "longa" },
  { id: 2, titulo: "Sherlock Holmes", autor: "Arthur Conan Doyle", genero: "Mistério", isbn: "9780141439563", emoji: "🔎", cor: "#eee2cb", sinopse: "Investigações, pistas e enigmas para desvendar.", quantidade: 2, duracao: "curta" },
  { id: 3, titulo: "Viagem ao Centro da Terra", autor: "Júlio Verne", genero: "Aventura", isbn: "9780141439976", emoji: "🌋", cor: "#f5dfd3", sinopse: "Uma expedição extraordinária às profundezas da Terra.", quantidade: 3, duracao: "longa" },
  { id: 4, titulo: "A Máquina do Tempo", autor: "H. G. Wells", genero: "Ficção científica", isbn: "9780141439976", emoji: "⏳", cor: "#d8f0eb", sinopse: "Uma viagem imaginativa pelas possibilidades do tempo.", quantidade: 2, duracao: "curta" },
  { id: 5, titulo: "O Mágico de Oz", autor: "L. Frank Baum", genero: "Fantasia", isbn: "9780141321028", emoji: "🌈", cor: "#f7e4f1", sinopse: "Uma jornada de amizade, coragem e descobertas.", quantidade: 2, duracao: "curta" },
  { id: 6, titulo: "A Ilha Misteriosa", autor: "Júlio Verne", genero: "Aventura", isbn: "9780140449441", emoji: "🏝️", cor: "#dceaf6", sinopse: "Sobrevivência e engenhosidade em uma ilha desconhecida.", quantidade: 2, duracao: "longa" },
  { id: 7, titulo: "Orgulho e Preconceito", autor: "Jane Austen", genero: "Romance", isbn: "9780141439518", emoji: "🌹", cor: "#f5e0e4", sinopse: "Uma história de relações, escolhas e primeiras impressões.", quantidade: 2, duracao: "longa" },
  { id: 8, titulo: "Frankenstein", autor: "Mary Shelley", genero: "Ficção científica", isbn: "9780141439471", emoji: "⚡", cor: "#e1e7df", sinopse: "Uma narrativa clássica sobre ciência, responsabilidade e humanidade.", quantidade: 2, duracao: "longa" }
];

const desafiosIniciais = [
  { id: 1, titulo: "Explore um gênero novo", descricao: "Descubra um gênero literário que você ainda não conhece.", pontos: 25 },
  { id: 2, titulo: "Conheça três autores", descricao: "Explore livros de três escritores diferentes.", pontos: 25 },
  { id: 3, titulo: "Use o catálogo inteligente", descricao: "Pesquise um livro por título, autor ou gênero.", pontos: 25 },
  { id: 4, titulo: "Descubra sua próxima leitura", descricao: "Use o recomendador para encontrar um livro.", pontos: 25 }
];

function carregarDados() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) {
      const dados = JSON.parse(salvo);
      if (
        Array.isArray(dados.livros) &&
        Array.isArray(dados.emprestimos) &&
        Array.isArray(dados.desafios)
      ) return dados;
    }
  } catch (erro) {
    console.warn("Não foi possível carregar os dados locais.", erro);
  }

  return {
    livros: livrosIniciais.map(livro => ({ ...livro })),
    emprestimos: [],
    desafios: desafiosIniciais.map(d => ({ ...d, concluido: false }))
  };
}

let dados = carregarDados();
let generoSelecionado = "Todos";
let fonte = 100;

function salvarDados() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch (erro) {
    alert("Não foi possível salvar. Verifique o armazenamento do navegador.");
    console.error(erro);
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

function formatarData(data) {
  if (!data) return "Não informada";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function exemplaresEmprestados(idLivro) {
  return dados.emprestimos.filter(
    emprestimo => emprestimo.livroId === idLivro && !emprestimo.devolvido
  ).length;
}

function disponiveis(livro) {
  return Math.max(0, livro.quantidade - exemplaresEmprestados(livro.id));
}

function capaHTML(livro) {
  const isbn = escapar(livro.isbn || "");
  const titulo = escapar(livro.titulo);
  const autor = escapar(livro.autor);
  const temISBN = Boolean(isbn) && livro.id !== 4;

  return `
    <div class="capa-livro" style="--cor-capa:${livro.cor}">
      <img
        src="${temISBN ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : "data:,"}"
        alt="Capa de ${titulo}"
        loading="lazy"
        data-titulo="${titulo}"
        data-autor="${autor}"
        data-busca-tentada="nao"
        onerror="buscarCapaAlternativa(this)"
      >
      <span class="capa-fallback" hidden> Capa não encontrada </span>
    </div>
  `;
}

async function buscarCapaAlternativa(imagem) {
  if (imagem.dataset.buscaTentada === "sim") {
    imagem.hidden = true;
    imagem.nextElementSibling.hidden = false;
    return;
  }

  imagem.dataset.buscaTentada = "sim";
  const parametros = new URLSearchParams({
    title: imagem.dataset.titulo,
    author: imagem.dataset.autor,
    limit: "10",
    fields: "cover_i,title,author_name"
  });

  try {
    const resposta = await fetch(`https://openlibrary.org/search.json?${parametros}`);
    if (!resposta.ok) throw new Error("Falha na pesquisa de capas.");

    const resultado = await resposta.json();
    const livroEncontrado = resultado.docs?.find(livro => livro.cover_i);

    if (livroEncontrado) {
      imagem.src = `https://covers.openlibrary.org/b/id/${livroEncontrado.cover_i}-M.jpg`;
    } else {
      imagem.hidden = true;
      imagem.nextElementSibling.hidden = false;
    }
  } catch (erro) {
    console.warn("Não foi possível carregar uma capa alternativa:", erro);
    imagem.hidden = true;
    imagem.nextElementSibling.hidden = false;
  }
}

function renderizarCatalogo() {
  const busca = document.querySelector("#busca").value
    .trim().toLocaleLowerCase("pt-BR");

  const encontrados = dados.livros.filter(livro => {
    const texto = `${livro.titulo} ${livro.autor} ${livro.genero} ${livro.sinopse}`
      .toLocaleLowerCase("pt-BR");

    return texto.includes(busca) &&
      (generoSelecionado === "Todos" || livro.genero === generoSelecionado);
  });

  document.querySelector("#resultado-busca").textContent =
    `${encontrados.length} livro(s) encontrado(s).`;

  document.querySelector("#vazio").hidden = encontrados.length > 0;

  document.querySelector("#grade-livros").innerHTML = encontrados.map(livro => {
    const quantidade = disponiveis(livro);
    const disponivel = quantidade > 0;

    return `
      <article class="cartao-livro">
        ${capaHTML(livro)}
        <div class="info-livro">
          <span class="genero-livro">${escapar(livro.genero)}</span>
          <h3>${escapar(livro.titulo)}</h3>
          <p class="autor">${escapar(livro.autor)}</p>
          <p class="sinopse">${escapar(livro.sinopse)}</p>
          <span class="disponibilidade ${disponivel ? "" : "esgotado"}">
            ${disponivel ? `${quantidade} disponível(is)` : "Indisponível"}
          </span>
          <button
            class="botao acao-cartao"
            data-acao="recomendar-livro"
            data-id="${livro.id}"
          >Ver recomendação</button>
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

function renderizarOpcoesEmprestimo() {
  const select = document.querySelector("#livro-emprestimo");
  const disponiveisLivros = dados.livros.filter(livro => disponiveis(livro) > 0);

  select.innerHTML = `
    <option value="">Selecione um livro</option>
    ${disponiveisLivros.map(livro => `
      <option value="${livro.id}">
        ${escapar(livro.titulo)} — ${disponiveis(livro)} disponível(is)
      </option>
    `).join("")}
  `;
}

function renderizarEmprestimos() {
  const lista = document.querySelector("#lista-emprestimos");
  const ativos = dados.emprestimos.filter(item => !item.devolvido);

  if (dados.emprestimos.length === 0) {
    lista.innerHTML = "<p class='texto-suave'>Ainda não existem empréstimos registrados.</p>";
  } else {
    lista.innerHTML = [...dados.emprestimos].reverse().map(item => {
      const livro = dados.livros.find(l => l.id === item.livroId);
      const nomeLivro = livro ? livro.titulo : "Livro não encontrado";

      return `
        <article class="registro">
          <div>
            <strong>${escapar(nomeLivro)}</strong>
            <p>Leitor: ${escapar(item.leitor)}</p>
            <p>Devolução prevista: ${formatarData(item.dataDevolucao)}</p>
            <span class="disponibilidade ${item.devolvido ? "" : "esgotado"}">
              ${item.devolvido ? "Devolvido" : "Empréstimo ativo"}
            </span>
          </div>
          ${item.devolvido ? "" : `
            <button data-acao="devolver" data-id="${item.id}">
              Registrar devolução
            </button>
          `}
        </article>
      `;
    }).join("");
  }

  renderizarOpcoesEmprestimo();
}

function renderizarEstatisticas() {
  const totalLivros = dados.livros.reduce((soma, livro) => soma + livro.quantidade, 0);
  const ativos = dados.emprestimos.filter(item => !item.devolvido).length;
  const generos = [...new Set(dados.livros.map(livro => livro.genero))];

  document.querySelector("#total-livros").textContent = totalLivros;
  document.querySelector("#total-emprestimos").textContent = ativos;
  document.querySelector("#total-generos").textContent = generos.length;
  document.querySelector("#total-desafios").textContent =
    dados.desafios.filter(d => d.concluido).length;

  const contagem = generos.map(genero => ({
    genero,
    total: dados.livros.filter(livro => livro.genero === genero).length
  }));

  const maximo = Math.max(1, ...contagem.map(item => item.total));

  document.querySelector("#grafico-generos").innerHTML = contagem.map(item => `
    <div class="barra-dado">
      <span>${escapar(item.genero)}</span>
      <div class="trilho"><span style="width:${item.total / maximo * 100}%"></span></div>
      <strong>${item.total}</strong>
    </div>
  `).join("");

  const totalExemplares = dados.livros.reduce((soma, livro) => soma + livro.quantidade, 0);
  const emprestados = dados.livros.reduce(
    (soma, livro) => soma + exemplaresEmprestados(livro.id), 0
  );
  const livres = Math.max(0, totalExemplares - emprestados);
  const escala = Math.max(1, totalExemplares);

  document.querySelector("#grafico-disponibilidade").innerHTML = `
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

function renderizarDesafios() {
  const lista = document.querySelector("#lista-desafios");

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

  document.querySelector("#texto-progresso").textContent =
    `${feitos} de ${total} concluídos`;
  document.querySelector("#barra-progresso").style.width = `${percentual}%`;
  document.querySelector("#valor-medidor").textContent = `${percentual}%`;
  document.querySelector("#barra-medidor").style.width = `${percentual}%`;

  document.querySelector("#legenda-medidor").textContent =
    percentual === 100 ? "Todos os desafios foram concluídos!" :
    percentual > 0 ? "Você está descobrindo novos caminhos!" :
    "Vamos começar a explorar!";
}

function renderizarTudo() {
  renderizarCatalogo();
  renderizarEmprestimos();
  renderizarEstatisticas();
  renderizarDesafios();
}

document.querySelector("#busca").addEventListener("input", renderizarCatalogo);

document.querySelectorAll(".filtro").forEach(botao => {
  botao.addEventListener("click", () => {
    generoSelecionado = botao.dataset.genero;
    renderizarCatalogo();
  });
});

document.querySelector("#grade-livros").addEventListener("click", evento => {
  const botao = evento.target.closest("[data-acao='recomendar-livro']");
  if (!botao) return;

  const livro = dados.livros.find(item => item.id === Number(botao.dataset.id));
  if (!livro) return;

  document.querySelector("#genero-preferido").value = livro.genero;
  document.querySelector("#recomendador").scrollIntoView({ behavior: "smooth" });
  recomendar();
});

function recomendar() {
  const genero = document.querySelector("#genero-preferido").value;
  const estilo = document.querySelector("#estilo-preferido").value;

  let resultados = dados.livros.filter(livro =>
    genero === "Todos" || livro.genero === genero
  );

  if (estilo === "curta") {
    const curtos = resultados.filter(livro => livro.duracao === "curta");
    if (curtos.length) resultados = curtos;
  }

  if (estilo === "aventura") {
    const aventura = resultados.filter(livro =>
      livro.genero === "Aventura" || livro.genero === "Fantasia"
    );
    if (aventura.length) resultados = aventura;
  }

  if (estilo === "reflexao") {
    const reflexivos = resultados.filter(livro =>
      livro.genero === "Romance" || livro.genero === "Ficção científica"
    );
    if (reflexivos.length) resultados = reflexivos;
  }

  resultados = resultados.slice(0, 3);

  const area = document.querySelector("#resultado-recomendacao");

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

document.querySelector("#recomendar-btn").addEventListener("click", () => {
  recomendar();

  // Registrar que o visitante experimentou o recomendador.
  const desafio = dados.desafios.find(d => d.id === 4);
  if (desafio && !desafio.concluido) {
    desafio.concluido = true;
    salvarDados();
    renderizarDesafios();
    renderizarEstatisticas();
  }
});

document.querySelector("#form-emprestimo").addEventListener("submit", evento => {
  evento.preventDefault();

  const leitor = document.querySelector("#leitor").value.trim();
  const livroId = Number(document.querySelector("#livro-emprestimo").value);
  const dataDevolucao = document.querySelector("#data-devolucao").value;
  const livro = dados.livros.find(item => item.id === livroId);

  if (!leitor || !livro || !dataDevolucao) {
    alert("Preencha todos os campos.");
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataEscolhida = new Date(`${dataDevolucao}T00:00:00`);

  if (Number.isNaN(dataEscolhida.getTime()) || dataEscolhida < hoje) {
    alert("Escolha uma data de devolução válida, a partir de hoje.");
    return;
  }

  if (disponiveis(livro) < 1) {
    alert("Este livro não está disponível.");
    return;
  }

  dados.emprestimos.push({
    id: Date.now(),
    leitor,
    livroId,
    dataDevolucao,
    devolvido: false
  });

  if (!salvarDados()) {
    dados.emprestimos.pop();
    return;
  }

  evento.target.reset();
  renderizarTudo();
  alert("Empréstimo registrado no protótipo!");
});

document.querySelector("#lista-emprestimos").addEventListener("click", evento => {
  const botao = evento.target.closest("[data-acao='devolver']");
  if (!botao) return;

  const item = dados.emprestimos.find(
    emprestimo => emprestimo.id === Number(botao.dataset.id)
  );

  if (!item || item.devolvido) return;

  item.devolvido = true;

  if (!salvarDados()) {
    item.devolvido = false;
    return;
  }

  renderizarTudo();
});

document.querySelector("#lista-desafios").addEventListener("change", evento => {
  const checkbox = evento.target.closest("[data-acao='desafio']");
  if (!checkbox) return;

  const desafio = dados.desafios.find(
    item => item.id === Number(checkbox.dataset.id)
  );
  if (!desafio) return;

  const anterior = desafio.concluido;
  desafio.concluido = checkbox.checked;

  if (!salvarDados()) {
    desafio.concluido = anterior;
    return;
  }

  renderizarDesafios();
  renderizarEstatisticas();
});

document.querySelector("#acessibilidade-btn").addEventListener("click", () => {
  document.querySelector("#acessibilidade").scrollIntoView({ behavior: "smooth" });
});

function atualizarFonte() {
  document.documentElement.style.fontSize = `${fonte}%`;
}

document.querySelector("#fonte-aumentar").addEventListener("click", () => {
  fonte = Math.min(130, fonte + 10);
  atualizarFonte();
});

document.querySelector("#fonte-diminuir").addEventListener("click", () => {
  fonte = Math.max(80, fonte - 10);
  atualizarFonte();
});

document.querySelector("#fonte-normal").addEventListener("click", () => {
  fonte = 100;
  atualizarFonte();
});

document.querySelector("#contraste-btn").addEventListener("click", () => {
  document.body.classList.toggle("alto-contraste");
});

document.querySelector("#menu-btn").addEventListener("click", () => {
  const menu = document.querySelector("#menu");
  menu.classList.toggle("aberto");
});

document.querySelectorAll("#menu a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelector("#menu").classList.remove("aberto");
  });
});

const hojeISO = new Date();
const ano = hojeISO.getFullYear();
const mes = String(hojeISO.getMonth() + 1).padStart(2, "0");
const dia = String(hojeISO.getDate()).padStart(2, "0");
document.querySelector("#data-devolucao").min = `${ano}-${mes}-${dia}`;

renderizarTudo();