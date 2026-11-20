(() => {
  "use strict";
  const demo = window.TechBookDemo;
  if (!demo) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const formatar = value => {
    if (!value) return "—";
    const p = String(value).slice(0,10).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
  };
  const hoje = demo.dataISO(new Date());
  const dataMinima = demo.deslocarData(1);
  const dataPadrao = demo.deslocarData(14);
  $("dataDevolucao").min = dataMinima;
  $("dataDevolucao").value = dataPadrao;

  function mensagem(texto, tipo = "success") {
    const area = $("mensagemSolicitar");
    area.textContent = texto;
    area.className = `message show ${tipo === "error" ? "error" : "success"}`;
  }

  function carregarCatalogo() {
    const livros = demo.getLivros().filter(livro => demo.disponiveis(livro) > 0);
    $("livroSelect").innerHTML = '<option value="">Selecione um livro</option>' + livros.map(livro =>
      `<option value="${livro.id}">${esc(livro.titulo)} — ${esc(livro.autor)} (${demo.disponiveis(livro)} disponível(is))</option>`
    ).join("");
    const escolhido = new URLSearchParams(window.location.search).get("livro");
    if (escolhido && livros.some(livro => livro.id === Number(escolhido))) $("livroSelect").value = escolhido;
    atualizarPreview();
  }

  function atualizarPreview() {
    const livro = demo.getLivros().find(item => item.id === Number($("livroSelect").value));
    const imagem = $("previewImagem");
    const emoji = $("previewEmoji");
    if (!livro) {
      imagem.src = "data:,";
      imagem.alt = "Nenhum livro selecionado";
      emoji.textContent = "📚";
      $("previewTitulo").textContent = "Escolha um livro";
      $("previewAutor").textContent = "As informações aparecerão aqui.";
      $("previewGenero").textContent = "";
      $("previewDisponibilidade").textContent = "";
      $("resumoTexto").textContent = "Selecione um livro e uma data para visualizar o resumo.";
      return;
    }
    imagem.onerror = () => { imagem.onerror = null; imagem.src = "data:,"; emoji.textContent = livro.emoji || "📚"; };
    imagem.src = livro.isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(livro.isbn)}-M.jpg?default=false` : "data:,";
    imagem.alt = `Capa de ${livro.titulo}`;
    emoji.textContent = livro.emoji || "📚";
    $("previewTitulo").textContent = livro.titulo;
    $("previewAutor").textContent = livro.autor;
    $("previewGenero").textContent = `${livro.genero} · ${livro.ano}`;
    $("previewDisponibilidade").textContent = `${demo.disponiveis(livro)} exemplar(es) disponível(is)`;
    atualizarResumo(livro);
  }

  function atualizarResumo(livro = demo.getLivros().find(item => item.id === Number($("livroSelect").value))) {
    const data = $("dataDevolucao").value;
    if (!livro) return;
    $("resumoTexto").textContent = `Livro: ${livro.titulo}. Leitor: Visitante. Data prevista para devolução: ${formatar(data)}.`;
  }

  function status(item) {
    if (item.devolvido || item.status === "devolvido") return ["Devolvido", "done"];
    if (item.status === "solicitado") return ["Aguardando análise", "requested"];
    if (item.status === "devolucao_solicitada") return ["Devolução solicitada", "requested"];
    if (item.status === "recusado") return ["Solicitação recusada", "late"];
    return ["Em andamento", ""];
  }

  function renderizarEmprestimos() {
    const itens = demo.getEmprestimos().filter(item => item.leitor === "Visitante");
    const ativos = itens.filter(item => !item.devolvido && item.status !== "recusado");
    const devolvidos = itens.filter(item => item.devolvido);
    const atrasados = ativos.filter(item => item.dataDevolucao < hoje);
    $("totalAtivos").textContent = ativos.length;
    $("totalDevolvidos").textContent = devolvidos.length;
    $("totalAtrasados").textContent = atrasados.length;
    $("listaEmprestimos").innerHTML = itens.length ? itens.map(item => {
      const livro = demo.getLivros().find(reg => reg.id === Number(item.livroId));
      const [rotulo, classe] = status(item);
      const acao = item.status === "emprestado" && !item.devolvido
        ? `<button type="button" data-devolver="${item.id}" class="acao-devolucao">Solicitar devolução</button>`
        : item.status === "devolucao_solicitada" ? '<span class="status requested">Aguardando confirmação</span>' : "";
      return `<article class="loan"><div><h3>${esc(livro?.titulo || "Livro")}</h3><p>${esc(livro?.autor || "Autor não informado")} · ${esc(livro?.codigo || "Exemplar local")}</p><p>Solicitado: ${formatar(item.solicitadoEm)} · Prazo: ${formatar(item.dataDevolucao)}</p></div><div><span class="status ${classe}">${rotulo}</span><div style="margin-top:9px">${acao}</div></div></article>`;
    }).join("") : '<div class="empty">Você ainda não tem empréstimos. Escolha um livro disponível acima para começar.</div>';
  }

  $("livroSelect").addEventListener("change", atualizarPreview);
  $("dataDevolucao").addEventListener("change", () => atualizarResumo());
  $("formSolicitar").addEventListener("submit", evento => {
    evento.preventDefault();
    const botao = $("btnSolicitar");
    botao.disabled = true;
    const resultado = demo.adicionarSolicitacao($("livroSelect").value, $("dataDevolucao").value);
    if (!resultado.ok) {
      mensagem(resultado.mensagem, "error");
      botao.disabled = false;
      return;
    }
    mensagem("Solicitação de demonstração registrada com sucesso! Nenhum empréstimo real foi realizado.");
    carregarCatalogo();
    renderizarEmprestimos();
    botao.disabled = false;
  });

  $("listaEmprestimos").addEventListener("click", evento => {
    const botao = evento.target.closest("[data-devolver]");
    if (!botao) return;
    if (!demo.solicitarDevolucao(botao.dataset.devolver)) {
      mensagem("Não foi possível atualizar a solicitação de devolução.", "error");
      return;
    }
    mensagem("Pedido de devolução enviado para conferência nesta simulação.");
    renderizarEmprestimos();
  });

  carregarCatalogo();
  renderizarEmprestimos();
})();
