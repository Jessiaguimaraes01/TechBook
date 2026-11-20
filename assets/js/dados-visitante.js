/*
 * Dados locais do TechBook.
 * Esta camada mantém a demonstração independente do servidor e do banco.
 * A estrutura de livros já prevê os campos necessários ao futuro acervo escolar.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "techbook-visitante-v1";
  const LEGACY_KEYS = ["tecbook-demo-v1", "tecbook-demo-v2"];

  function dataISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function deslocarData(dias) {
    const data = new Date();
    data.setHours(12, 0, 0, 0);
    data.setDate(data.getDate() + dias);
    return dataISO(data);
  }

  const livrosPadrao = [
    { id: 1, titulo: "Alice no País das Maravilhas", autor: "Lewis Carroll", editora: "Penguin Books", genero: "Fantasia", ano: 1865, isbn: "9780141321073", codigo: "TB-001", emoji: "🐇", cor: "#e8e8fa", sinopse: "Uma aventura fantástica por um mundo cheio de surpresas.", quantidade: 3, duracao: "longa", tipoAcervo: "exemplo" },
    { id: 2, titulo: "Sherlock Holmes", autor: "Arthur Conan Doyle", editora: "Penguin Classics", genero: "Mistério", ano: 1892, isbn: "9780141439563", codigo: "TB-002", emoji: "🔎", cor: "#eee2cb", sinopse: "Investigações, pistas e enigmas para desvendar.", quantidade: 2, duracao: "curta", tipoAcervo: "exemplo" },
    { id: 3, titulo: "Viagem ao Centro da Terra", autor: "Júlio Verne", editora: "Penguin Books", genero: "Aventura", ano: 1864, isbn: "9780141439976", codigo: "TB-003", emoji: "🌋", cor: "#f5dfd3", sinopse: "Uma expedição extraordinária às profundezas da Terra.", quantidade: 3, duracao: "longa", tipoAcervo: "exemplo" },
    { id: 4, titulo: "A Máquina do Tempo", autor: "H. G. Wells", editora: "Domínio Público", genero: "Ficção científica", ano: 1895, isbn: "", codigo: "TB-004", emoji: "⏳", cor: "#d8f0eb", sinopse: "Uma viagem imaginativa pelas possibilidades do tempo.", quantidade: 2, duracao: "curta", tipoAcervo: "exemplo" },
    { id: 5, titulo: "O Mágico de Oz", autor: "L. Frank Baum", editora: "Penguin Books", genero: "Fantasia", ano: 1900, isbn: "9780141321028", codigo: "TB-005", emoji: "🌈", cor: "#f7e4f1", sinopse: "Uma jornada de amizade, coragem e descobertas.", quantidade: 2, duracao: "curta", tipoAcervo: "exemplo" },
    { id: 6, titulo: "A Ilha Misteriosa", autor: "Júlio Verne", editora: "Penguin Classics", genero: "Aventura", ano: 1874, isbn: "9780140449441", codigo: "TB-006", emoji: "🏝️", cor: "#dceaf6", sinopse: "Sobrevivência e engenhosidade em uma ilha desconhecida.", quantidade: 2, duracao: "longa", tipoAcervo: "exemplo" },
    { id: 7, titulo: "Orgulho e Preconceito", autor: "Jane Austen", editora: "Penguin Classics", genero: "Romance", ano: 1813, isbn: "9780141439518", codigo: "TB-007", emoji: "🌹", cor: "#f5e0e4", sinopse: "Uma história de relações, escolhas e primeiras impressões.", quantidade: 2, duracao: "longa", tipoAcervo: "exemplo" },
    { id: 8, titulo: "Frankenstein", autor: "Mary Shelley", editora: "Penguin Classics", genero: "Ficção científica", ano: 1818, isbn: "9780141439471", codigo: "TB-008", emoji: "⚡", cor: "#e1e7df", sinopse: "Uma narrativa clássica sobre ciência, responsabilidade e humanidade.", quantidade: 2, duracao: "longa", tipoAcervo: "exemplo" }
  ];

  const desafiosPadrao = [
    { id: 1, titulo: "Explore um gênero novo", descricao: "Descubra um gênero literário que você ainda não conhece.", pontos: 25, concluido: true },
    { id: 2, titulo: "Conheça três autores", descricao: "Explore livros de três escritores diferentes.", pontos: 25, concluido: false },
    { id: 3, titulo: "Use o catálogo inteligente", descricao: "Pesquise um livro por título, autor ou gênero.", pontos: 25, concluido: false },
    { id: 4, titulo: "Descubra sua próxima leitura", descricao: "Use o recomendador para encontrar um livro.", pontos: 25, concluido: false }
  ];

  function dadosIniciais() {
    return {
      livros: livrosPadrao.map(livro => ({ ...livro })),
      emprestimos: [
        { id: 901, livroId: 1, leitor: "Visitante", status: "emprestado", solicitadoEm: deslocarData(-5), dataDevolucao: deslocarData(9), devolvido: false, origem: "exemplo" },
        { id: 902, livroId: 2, leitor: "Visitante", status: "emprestado", solicitadoEm: deslocarData(-3), dataDevolucao: deslocarData(11), devolvido: false, origem: "exemplo" },
        { id: 903, livroId: 7, leitor: "Visitante", status: "emprestado", solicitadoEm: deslocarData(-2), dataDevolucao: deslocarData(12), devolvido: false, origem: "exemplo" },
        { id: 904, livroId: 5, leitor: "Visitante", status: "devolvido", solicitadoEm: deslocarData(-12), dataDevolucao: deslocarData(-5), devolvido: true, origem: "exemplo" },
        { id: 905, livroId: 6, leitor: "Leitor(a) 03", status: "devolvido", solicitadoEm: deslocarData(-18), dataDevolucao: deslocarData(-9), devolvido: true, origem: "exemplo" }
      ],
      desafios: desafiosPadrao.map(item => ({ ...item })),
      leitura: { livrosLidos: 3, paginasLidas: 286, metaAnual: 12, sequenciaDias: 4 }
    };
  }

  function normalizarEmprestimo(item, indice) {
    const devolvido = Boolean(item.devolvido || item.status === "devolvido" || item.data_entrega);
    return {
      ...item,
      id: Number(item.id || item.id_emprestimo) || (10000 + indice),
      livroId: Number(item.livroId || item.id_livro) || 0,
      leitor: item.leitor || item.aluno || "Visitante",
      solicitadoEm: item.solicitadoEm || item.data_emprestimo || dataISO(new Date()),
      dataDevolucao: item.dataDevolucao || item.data_prevista_devolucao || deslocarData(14),
      status: devolvido ? "devolvido" : (item.status || "emprestado"),
      devolvido,
      origem: item.origem || "local"
    };
  }

  function carregar() {
    const padrao = dadosIniciais();
    let salvo = null;
    try {
      const atual = localStorage.getItem(STORAGE_KEY);
      if (atual) salvo = JSON.parse(atual);
      if (!salvo) {
        for (const chave of LEGACY_KEYS) {
          const legado = localStorage.getItem(chave);
          if (legado) {
            salvo = JSON.parse(legado);
            break;
          }
        }
      }
    } catch (erro) {
      console.warn("Os dados locais iniciais serão utilizados.", erro);
    }

    if (!salvo || typeof salvo !== "object") return padrao;

    const livrosSalvos = Array.isArray(salvo.livros) ? salvo.livros : [];
    const desafiosSalvos = Array.isArray(salvo.desafios) ? salvo.desafios : [];

    return {
      livros: padrao.livros.map(base => {
        const salvoLivro = livrosSalvos.find(item => Number(item.id) === base.id);
        return { ...base, ...(salvoLivro || {}), quantidade: Math.max(0, Number(salvoLivro?.quantidade ?? base.quantidade) || 0), tipoAcervo: "exemplo" };
      }),
      emprestimos: Array.isArray(salvo.emprestimos)
        ? salvo.emprestimos.map(normalizarEmprestimo)
        : padrao.emprestimos,
      desafios: padrao.desafios.map(base => {
        const salvoDesafio = desafiosSalvos.find(item => Number(item.id) === base.id);
        return { ...base, ...(salvoDesafio || {}), concluido: salvoDesafio ? Boolean(salvoDesafio.concluido) : base.concluido };
      }),
      leitura: { ...padrao.leitura, ...(salvo.leitura || {}) }
    };
  }

  let dados = carregar();

  function salvar() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
      return true;
    } catch (erro) {
      console.error("Não foi possível salvar os dados locais.", erro);
      return false;
    }
  }

  function ativos() {
    return dados.emprestimos.filter(item => !item.devolvido && !["devolvido", "recusado"].includes(item.status));
  }

  function disponiveis(livro) {
    const emprestados = ativos().filter(item => Number(item.livroId) === Number(livro.id)).length;
    return Math.max(0, Number(livro.quantidade) - emprestados);
  }

  function estatisticas() {
    const totalExemplares = dados.livros.reduce((soma, livro) => soma + Number(livro.quantidade || 0), 0);
    const disponiveisTotal = dados.livros.reduce((soma, livro) => soma + disponiveis(livro), 0);
    const emprestados = Math.max(0, totalExemplares - disponiveisTotal);
    return {
      titulos: dados.livros.length,
      totalExemplares,
      disponiveis: disponiveisTotal,
      emprestados,
      emprestimosAtivos: ativos().length,
      devolvidos: dados.emprestimos.filter(item => item.devolvido).length,
      generos: [...new Set(dados.livros.map(item => item.genero))].length,
      leitores: [...new Set(dados.emprestimos.map(item => item.leitor).filter(Boolean))].length
    };
  }

  function adicionarSolicitacao(livroId, dataDevolucao) {
    const livro = dados.livros.find(item => item.id === Number(livroId));
    if (!livro) return { ok: false, mensagem: "Selecione um livro válido." };
    if (disponiveis(livro) < 1) return { ok: false, mensagem: "Este livro não está disponível no momento." };
    const hoje = dataISO(new Date());
    if (!dataDevolucao || dataDevolucao <= hoje) return { ok: false, mensagem: "Escolha uma data de devolução futura." };

    const registro = {
      id: Date.now(), livroId: livro.id, leitor: "Visitante", status: "solicitado",
      solicitadoEm: hoje, dataDevolucao, devolvido: false, origem: "solicitacao-local"
    };
    dados.emprestimos.unshift(registro);
    if (!salvar()) {
      dados.emprestimos.shift();
      return { ok: false, mensagem: "O navegador não conseguiu guardar esta solicitação." };
    }
    return { ok: true, registro, livro };
  }

  function solicitarDevolucao(id) {
    const item = dados.emprestimos.find(registro => Number(registro.id) === Number(id));
    if (!item || item.devolvido) return false;
    item.status = "devolucao_solicitada";
    return salvar();
  }

  function atualizarStatusEmprestimo(id, novoStatus) {
    const item = dados.emprestimos.find(registro => Number(registro.id) === Number(id));
    if (!item) return false;
    if (!["solicitado", "emprestado", "devolucao_solicitada", "devolvido", "recusado"].includes(novoStatus)) return false;
    item.status = novoStatus;
    item.devolvido = novoStatus === "devolvido";
    if (item.devolvido) item.dataEntrega = dataISO(new Date());
    return salvar();
  }

  function concluirDesafio(id, concluido = true) {
    const item = dados.desafios.find(desafio => desafio.id === Number(id));
    if (!item) return false;
    item.concluido = Boolean(concluido);
    return salvar();
  }

  function conquistas() {
    const desafiosFeitos = dados.desafios.filter(item => item.concluido).length;
    return [
      { titulo: "Primeira descoberta", descricao: "Conclua seu primeiro desafio.", alcancada: desafiosFeitos >= 1, icone: "✦" },
      { titulo: "Explorador de gêneros", descricao: "Conheça cinco gêneros literários.", alcancada: new Set(dados.livros.map(item => item.genero)).size >= 5, icone: "◇" },
      { titulo: "Leitor dedicado", descricao: "Conclua três desafios de leitura.", alcancada: desafiosFeitos >= 3, icone: "★" },
      { titulo: "Jornada completa", descricao: "Conclua todos os desafios disponíveis.", alcancada: desafiosFeitos === dados.desafios.length, icone: "♛" }
    ];
  }

  global.TechBookDemo = {
    STORAGE_KEY,
    livrosPadrao,
    get dados() { return dados; },
    getLivros() { return dados.livros; },
    getEmprestimos() { return dados.emprestimos; },
    getDesafios() { return dados.desafios; },
    getLeitura() { return dados.leitura; },
    getConquistas: conquistas,
    disponiveis,
    estatisticas,
    salvar,
    adicionarSolicitacao,
    solicitarDevolucao,
    atualizarStatusEmprestimo,
    concluirDesafio,
    deslocarData,
    dataISO,
    listarAtivos: ativos
  };
})(window);
