const CHAVE = "tecbook-demo-v2";

const livrosIniciais = [
  { id: 1, titulo: "Alice no País das Maravilhas", autor: "Lewis Carroll", genero: "Fantasia", isbn: "9780141321073", emoji: "🐇", cor: "#E9DCE5", sinopse: "Uma aventura fantástica por um mundo cheio de surpresas.", quantidade: 3, duracao: "longa" },
  { id: 2, titulo: "Sherlock Holmes", autor: "Arthur Conan Doyle", genero: "Mistério", isbn: "9780141439563", emoji: "🔎", cor: "#E8D9C6", sinopse: "Investigações, pistas e enigmas para desvendar.", quantidade: 2, duracao: "curta" },
  { id: 3, titulo: "Viagem ao Centro da Terra", autor: "Júlio Verne", genero: "Aventura", isbn: "9780141439976", emoji: "🌋", cor: "#EBD6CB", sinopse: "Uma expedição extraordinária às profundezas da Terra.", quantidade: 3, duracao: "longa" },
  { id: 4, titulo: "A Máquina do Tempo", autor: "H. G. Wells", genero: "Ficção científica", isbn: "9780141439976", emoji: "⏳", cor: "#D9E7DF", sinopse: "Uma viagem imaginativa pelas possibilidades do tempo.", quantidade: 2, duracao: "curta" },
  { id: 5, titulo: "O Mágico de Oz", autor: "L. Frank Baum", genero: "Fantasia", isbn: "9780141321028", emoji: "🌈", cor: "#F0DFE5", sinopse: "Uma jornada de amizade, coragem e descobertas.", quantidade: 2, duracao: "curta" },
  { id: 6, titulo: "A Ilha Misteriosa", autor: "Júlio Verne", genero: "Aventura", isbn: "9780140449441", emoji: "🏝️", cor: "#D8E5EA", sinopse: "Sobrevivência e engenhosidade em uma ilha desconhecida.", quantidade: 2, duracao: "longa" },
  { id: 7, titulo: "Orgulho e Preconceito", autor: "Jane Austen", genero: "Romance", isbn: "9780141439518", emoji: "🌹", cor: "#F0DCE0", sinopse: "Uma história de relações, escolhas e primeiras impressões.", quantidade: 2, duracao: "longa" },
  { id: 8, titulo: "Frankenstein", autor: "Mary Shelley", genero: "Ficção científica", isbn: "9780141439471", emoji: "⚡", cor: "#DDE3D9", sinopse: "Uma narrativa clássica sobre ciência, responsabilidade e humanidade.", quantidade: 2, duracao: "longa" }
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
      const dadosSalvos = JSON.parse(salvo);
      if (Array.isArray(dadosSalvos.livros) &&
          Array.isArray(dadosSalvos.emprestimos) &&
          Array.isArray(dadosSalvos.desafios)) return dadosSalvos;
    }
  } catch (erro) {
    console.warn("Não foi possível carregar os dados locais.", erro);
  }
  return {
    livros: livrosIniciais.map(livro => ({ ...livro })),
    emprestimos: [],
    desafios: desafiosIniciais.map(desafio => ({ ...desafio, concluido: false }))
  };
}

let dados = carregarDados();

async function carregarLivrosDoBanco() {
  try {
    const resposta = await fetch("/api/livros");

    if (!resposta.ok) {
      throw new Error("Não foi possível carregar os livros.");
    }

    const livrosBanco = await resposta.json();

    if (!Array.isArray(livrosBanco)) {
      throw new Error("A API não retornou uma lista de livros.");
    }

    dados.livros = livrosBanco.map(livro => ({
      id: livro.id_livro,
      titulo: livro.titulo || "Título não informado",
      autor: livro.autor || "Autor não informado",
      genero: livro.genero || "Outros",
      isbn: livro.isbn || "",
      emoji: "📚",
      cor: "#E9DCE5",
      sinopse: "",
      quantidade: 1,
      duracao: "longa"
    }));

    renderizarTudo();
    console.log("Livros carregados do banco:", dados.livros);
  } catch (erro) {
    console.error("Erro ao conectar com o banco:", erro);
    alert("Não foi possível carregar os livros do banco. Verifique se o servidor está funcionando.");
  }
}

let generoSelecionado = "Todos";
let fonte = 100;

function salvarDados() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
    return true;
  } catch (erro) {
    alert("Não foi possível salvar os dados neste navegador.");
    console.error(erro);
    return false;
  }
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[caractere]);
}

function formatarData(data) {
  if (!data) return "Não informada";
  const partes = data.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data;
}

function exemplaresEmprestados(idLivro) {
  return dados.emprestimos.filter(item => item.livroId === idLivro && !item.devolvido).length;
}

function disponiveis(livro) {
  return Math.max(0, livro.quantidade - exemplaresEmprestados(livro.id));
}

function capaHTML(livro) {
  const isbn = escapar(livro.isbn);
  const titulo = escapar(livro.titulo);
  const emoji = escapar(livro.emoji);
  return `
    <div class="capa-livro" style="--cor-capa:${livro.cor}">
      <img src="https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg"
           alt="Capa de ${titulo}" loading="lazy"
           onerror="this.hidden=true;this.nextElementSibling.hidden=false">
      <span class="capa-emoji" hidden aria-hidden="true">${emoji}</span>
    </div>`;
}

function renderizarCatalogo() {
  const busca = document.querySelector("#busca").value.trim().toLocaleLowerCase("pt-BR");
  const encontrados = dados.livros.filter(livro => {
    const texto = `${livro.titulo} ${livro.autor} ${livro.genero} ${livro.sinopse}`.toLocaleLowerCase("pt-BR");
    return texto.includes(busca) && (generoSelecionado === "Todos" || livro.genero === generoSelecionado);
  });

  document.querySelector("#resultado-busca").textContent = `${encontrados.length} livro(s) encontrado(s).`;
  document.querySelector("#vazio").hidden = encontrados.length > 0;

  document.querySelector("#grade-livros").innerHTML = encontrados.map(livro => {
    const quantidade = disponiveis(livro);
    return `
      <article class="cartao-livro">
        ${capaHTML(livro)}
        <div class="info-livro">
          <span class="genero-livro">${escapar(livro.genero)}</span>
          <h3>${escapar(livro.titulo)}</h3>
          <p class="autor">${escapar(livro.autor)}</p>
          <p class="sinopse">${escapar(livro.sinopse)}</p>
          <span class="disponibilidade ${quantidade ? "" : "esgotado"}">${quantidade ? `${quantidade} disponível(is)` : "Indisponível"}</span>
          <button class="botao acao-cartao" data-acao="recomendar-livro" data-id="${livro.id}">Ver recomendação</button>
        </div>
      </article>`;
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
  select.innerHTML = `<option value="">Selecione um livro</option>${disponiveisLivros.map(livro =>
    `<option value="${livro.id}">${escapar(livro.titulo)} — ${disponiveis(livro)} disponível(is)</option>`
  ).join("")}`;
}

function renderizarEmprestimos() {
  const lista = document.querySelector("#lista-emprestimos");
  if (!dados.emprestimos.length) {
    lista.innerHTML = "<p class='texto-suave'>Ainda não existem empréstimos registrados.</p>";
  } else {
    lista.innerHTML = [...dados.emprestimos].reverse().map(item => {
      const livro = dados.livros.find(l => l.id === item.livroId);
      return `<article class="registro">
        <div><strong>${escapar(livro ? livro.titulo : "Livro não encontrado")}</strong>
          <p>Leitor: ${escapar(item.leitor)}</p>
          <p>Devolução prevista: ${formatarData(item.dataDevolucao)}</p>
          <span class="disponibilidade ${item.devolvido ? "" : "esgotado"}">${item.devolvido ? "Devolvido" : "Empréstimo ativo"}</span>
        </div>
        ${item.devolvido ? "" : `<button data-acao="devolver" data-id="${item.id}">Registrar devolução</button>`}
      </article>`;
    }).join("");
  }
  renderizarOpcoesEmprestimo();
}

function renderizarEstatisticas() {
  const totalExemplares = dados.livros.reduce((soma, livro) => soma + livro.quantidade, 0);
  const ativos = dados.emprestimos.filter(item => !item.devolvido).length;
  const generos = [...new Set(dados.livros.map(livro => livro.genero))];

  document.querySelector("#total-livros").textContent = totalExemplares;
  document.querySelector("#total-emprestimos").textContent = ativos;
  document.querySelector("#total-generos").textContent = generos.length;
  document.querySelector("#total-desafios").textContent = dados.desafios.filter(d => d.concluido).length;

  const contagem = generos.map(genero => ({
    genero,
    total: dados.livros.filter(livro => livro.genero === genero).length
  }));
  const maximo = Math.max(1, ...contagem.map(item => item.total));

  document.querySelector("#grafico-generos").innerHTML = contagem.map(item => `
    <div class="barra-dado"><span>${escapar(item.genero)}</span>
      <div class="trilho"><span style="width:${item.total / maximo * 100}%"></span></div><strong>${item.total}</strong>
    </div>`).join("");

  const emprestados = dados.livros.reduce((soma, livro) => soma + exemplaresEmprestados(livro.id), 0);
  const livres = Math.max(0, totalExemplares - emprestados);
  const escala = Math.max(1, totalExemplares);

  document.querySelector("#grafico-disponibilidade").innerHTML = `
    <div class="barra-dado"><span>Disponíveis</span><div class="trilho"><span style="width:${livres / escala * 100}%"></span></div><strong>${livres}</strong></div>
    <div class="barra-dado"><span>Emprestados</span><div class="trilho"><span style="width:${emprestados / escala * 100}%"></span></div><strong>${emprestados}</strong></div>`;
}

function renderizarDesafios() {
  document.querySelector("#lista-desafios").innerHTML = dados.desafios.map(desafio => `
    <label class="desafio ${desafio.concluido ? "concluido" : ""}">
      <input type="checkbox" data-acao="desafio" data-id="${desafio.id}" ${desafio.concluido ? "checked" : ""}>
      <div><h3>${escapar(desafio.titulo)}</h3><p>${escapar(desafio.descricao)}</p><span class="genero-livro">${desafio.pontos} pontos</span></div>
    </label>`).join("");

  const feitos = dados.desafios.filter(d => d.concluido).length;
  const total = dados.desafios.length;
  const percentual = total ? Math.round(feitos / total * 100) : 0;

  document.querySelector("#texto-progresso").textContent = `${feitos} de ${total} concluídos`;
  document.querySelector("#barra-progresso").style.width = `${percentual}%`;
  document.querySelector("#valor-medidor").textContent = `${percentual}%`;
  document.querySelector("#barra-medidor").style.width = `${percentual}%`;
  document.querySelector("#legenda-medidor").textContent =
    percentual === 100 ? "Você concluiu todos os desafios. Que jornada!" :
    percentual > 0 ? "Cada descoberta ilumina o caminho!" :
    "Toda grande descoberta começa pela primeira página.";
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
  const area = document.querySelector("#resultado-recomendacao");
  if (!resultados.length) {
    area.textContent = "Não encontramos sugestões para essa combinação.";
    return;
  }

  area.innerHTML = resultados.map(livro => `
    <article class="cartao-livro">${capaHTML(livro)}
      <div class="info-livro"><span class="genero-livro">${escapar(livro.genero)}</span>
        <h3>${escapar(livro.titulo)}</h3><p class="autor">${escapar(livro.autor)}</p>
        <p class="sinopse">${escapar(livro.sinopse)}</p>
      </div>
    </article>`).join("");
}

function concluirDesafio(id) {
  const desafio = dados.desafios.find(item => item.id === id);
  if (!desafio || desafio.concluido) return;
  desafio.concluido = true;
  salvarDados();
  renderizarDesafios();
  renderizarEstatisticas();
}

document.querySelector("#recomendar-btn").addEventListener("click", () => {
  recomendar();
  concluirDesafio(4);
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

  dados.emprestimos.push({ id: Date.now(), leitor, livroId, dataDevolucao, devolvido: false });
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
  const item = dados.emprestimos.find(registro => registro.id === Number(botao.dataset.id));
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
  const desafio = dados.desafios.find(item => item.id === Number(checkbox.dataset.id));
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
document.querySelector("#contraste-btn").addEventListener("click", evento => {
  document.body.classList.toggle("alto-contraste");
  evento.currentTarget.setAttribute("aria-pressed", String(document.body.classList.contains("alto-contraste")));
});

document.querySelector("#menu-btn").addEventListener("click", evento => {
  const menu = document.querySelector("#menu");
  const aberto = menu.classList.toggle("aberto");
  evento.currentTarget.setAttribute("aria-expanded", String(aberto));
  evento.currentTarget.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
});
document.querySelectorAll("#menu a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelector("#menu").classList.remove("aberto");
    document.querySelector("#menu-btn").setAttribute("aria-expanded", "false");
  });
});

const hoje = new Date();
const dataMinima = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
document.querySelector("#data-devolucao").min = dataMinima;

renderizarTudo();
carregarLivrosDoBanco();