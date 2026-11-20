const $ = (seletor) => document.querySelector(seletor);

const alunoSelect = $("#alunoSelect");
const exemplarSelect = $("#exemplarSelect");
const dataPrevista = $("#dataPrevista");
const tabela = $("#emprestimosTabela");
const mensagem = $("#mensagem");

let emprestimos = [];

function hojeISO() {
  const agora = new Date();
  const local = new Date(
    agora.getTime() - agora.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function formatarData(valor) {
  if (!valor) return "—";

  const partes = String(valor).slice(0, 10).split("-");

  if (partes.length !== 3) return valor;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function mostrarMensagem(texto, tipo = "success") {
  mensagem.textContent = texto;
  mensagem.className = `message show ${tipo}`;
}

function limparMensagem() {
  mensagem.textContent = "";
  mensagem.className = "message";
}

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, {
    credentials: "same-origin",
    ...opcoes,
    headers: {
      ...(opcoes.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(opcoes.headers || {})
    }
  });

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    window.location.href = "login-bibliotecario.html";
    throw new Error("Faça login como bibliotecário.");
  }

  if (!resposta.ok) {
    throw new Error(
      dados.erro || dados.mensagem || "Erro na operação."
    );
  }

  return dados;
}

async function carregarAlunos() {
  const alunos = await requisicao("/api/admin/alunos");

  alunoSelect.innerHTML =
    '<option value="">Selecione um aluno</option>';

  alunos.forEach((aluno) => {
    const option = document.createElement("option");

    option.value = aluno.id_aluno;

    option.textContent =
      `${aluno.nome} — ${aluno.matricula} (${aluno.turma || "Sem turma"})`;

    alunoSelect.appendChild(option);
  });
}

async function carregarExemplares() {
  const exemplares = await requisicao(
    "/api/admin/exemplares-disponiveis"
  );

  exemplarSelect.innerHTML =
    '<option value="">Selecione um livro disponível</option>';

  exemplares.forEach((exemplar) => {
    const option = document.createElement("option");

    option.value = exemplar.id_exemplar;

    option.textContent =
      `${exemplar.titulo} — Exemplar ${exemplar.codigo}`;

    exemplarSelect.appendChild(option);
  });

  if (exemplares.length === 0) {
    exemplarSelect.innerHTML =
      '<option value="">Nenhum exemplar disponível</option>';
  }
}

function situacao(item) {
  if (item.data_devolucao || item.status === "devolvido") {
    return { texto: "Devolvido", classe: "returned", filtro: "devolvido" };
  }
  if (item.status === "solicitado") {
    return { texto: "Aguardando aprovação", classe: "requested", filtro: "pendente" };
  }
  if (item.status === "aprovado") {
    return { texto: "Aprovado — aguarda retirada", classe: "approved", filtro: "aprovado" };
  }
  if (item.status === "recusado") {
    return { texto: "Solicitação recusada", classe: "refused", filtro: "recusado" };
  }
  if (item.status === "devolucao_solicitada" || item.data_solicitacao_devolucao) {
    return { texto: "Devolução solicitada", classe: "requested", filtro: "devolucao" };
  }
  if (item.atrasado) {
    return { texto: "Em atraso", classe: "late", filtro: "atrasado" };
  }
  return { texto: "Em andamento", classe: "active", filtro: "ativo" };
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caractere]);
}

function renderizarTabela() {
  const busca = $("#buscaInput")
    .value.trim().toLocaleLowerCase("pt-BR");

  const filtro = $("#filtroStatus").value;

  const filtrados = emprestimos.filter((item) => {
    const texto =
      `${item.aluno} ${item.matricula} ${item.titulo} ${item.codigo_exemplar}`
      .toLocaleLowerCase("pt-BR");

    return texto.includes(busca) &&
      (filtro === "todos" || situacao(item).filtro === filtro);
  });

  if (filtrados.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          Nenhum empréstimo encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tabela.innerHTML = filtrados.map((item) => {
    const estado = situacao(item);
    let acao = '<span class="sub">Finalizado</span>';
    if (item.status === "solicitado") {
      acao = `
        <div class="actions-cell">
          <button class="action-button" data-aprovar="${item.id_emprestimo}">Aprovar</button>
          <button class="action-button action-refuse" data-recusar="${item.id_emprestimo}">Recusar</button>
        </div>`;
    } else if (item.status === "aprovado") {
      acao = `<button class="action-button" data-entregar="${item.id_emprestimo}">Registrar entrega</button>`;
    } else if (item.status === "devolucao_solicitada" || item.data_solicitacao_devolucao) {
      acao = `<button class="action-button" data-devolver="${item.id_emprestimo}">Confirmar devolução</button>`;
    } else if (item.status === "emprestado") {
      acao = '<button class="action-button" disabled>Aguardando devolução</button>';
    } else if (item.status === "recusado") {
      acao = '<span class="sub">Encerrado</span>';
    }

    return `
      <tr>
        <td>
          <strong>${escapar(item.aluno)}</strong>
          <span class="sub">
            Matrícula: ${escapar(item.matricula)}
          </span>
        </td>

        <td>
          <strong>${escapar(item.titulo)}</strong>
          <span class="sub">
            Exemplar: ${escapar(item.codigo_exemplar)}
          </span>
        </td>

        <td>${formatarData(item.data_emprestimo)}</td>

        <td>${formatarData(item.data_prevista_devolucao)}</td>

        <td>
          <span class="status ${estado.classe}">
            ${estado.texto}
          </span>
        </td>

        <td>${acao}</td>
      </tr>
    `;
  }).join("");
}

function atualizarResumo() {
  const ativos = emprestimos.filter(
    (item) => ["aprovado", "emprestado", "devolucao_solicitada"].includes(item.status)
  );

  const atrasados = ativos.filter(
    (item) => item.atrasado
  );

  const devolvidos = emprestimos.filter(
    (item) => item.status === "devolvido" || item.data_devolucao
  );

  $("#totalAtivos").textContent = ativos.length;
  $("#totalAtrasados").textContent = atrasados.length;
  $("#totalDevolvidos").textContent = devolvidos.length;
}

async function carregarEmprestimos() {
  emprestimos = await requisicao(
    "/api/admin/emprestimos"
  );

  atualizarResumo();
  renderizarTabela();
}

async function carregarTudo() {
  limparMensagem();

  tabela.innerHTML = `
    <tr>
      <td colspan="6" class="empty">
        Carregando registros...
      </td>
    </tr>
  `;

  try {
    await requisicao("/api/sessao-bibliotecario");

    await Promise.all([
      carregarAlunos(),
      carregarExemplares(),
      carregarEmprestimos()
    ]);

  } catch (erro) {
    mostrarMensagem(erro.message, "error");

    tabela.innerHTML = `
      <tr>
        <td colspan="6" class="empty">
          Não foi possível carregar os dados.
        </td>
      </tr>
    `;
  }
}

// REGISTRAR EMPRÉSTIMO

$("#emprestimoForm").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  limparMensagem();

  const id_aluno = Number(alunoSelect.value);
  const id_exemplar = Number(exemplarSelect.value);

  const data_prevista_devolucao = dataPrevista.value;

  if (!id_aluno || !id_exemplar || !data_prevista_devolucao) {
    mostrarMensagem(
      "Preencha todos os campos.",
      "error"
    );
    return;
  }

  const botao = evento.submitter;

  botao.disabled = true;
  botao.textContent = "Registrando...";

  try {
    const resultado = await requisicao(
      "/api/admin/emprestimos",
      {
        method: "POST",
        body: JSON.stringify({
          id_aluno,
          id_exemplar,
          data_prevista_devolucao
        })
      }
    );

    evento.target.reset();

    dataPrevista.min = hojeISO();

    mostrarMensagem(
      resultado.mensagem || "Empréstimo registrado com sucesso!"
    );

    await Promise.all([
      carregarExemplares(),
      carregarEmprestimos()
    ]);

  } catch (erro) {
    mostrarMensagem(erro.message, "error");

  } finally {
    botao.disabled = false;
    botao.textContent = "Registrar empréstimo";
  }
});

// ANALISAR SOLICITAÇÕES, REGISTRAR ENTREGA E CONFIRMAR DEVOLUÇÃO

tabela.addEventListener("click", async (evento) => {
  const botao = evento.target.closest("[data-aprovar], [data-recusar], [data-entregar], [data-devolver]");
  if (!botao) return;

  const acoes = [
    { atributo: "aprovar", rota: "/api/admin/emprestimos/aprovar", pergunta: "Aprovar esta solicitação de empréstimo?" },
    { atributo: "recusar", rota: "/api/admin/emprestimos/recusar", pergunta: "Recusar esta solicitação? O exemplar voltará ao catálogo." },
    { atributo: "entregar", rota: "/api/admin/emprestimos/entrega", pergunta: "Confirma que o livro foi entregue fisicamente ao aluno?" },
    { atributo: "devolver", rota: "/api/admin/devolucoes", pergunta: "Confirma que o livro foi recebido e deseja registrar a devolução?" }
  ];
  const acao = acoes.find((item) => botao.hasAttribute(`data-${item.atributo}`));
  if (!acao) return;

  const id_emprestimo = Number(botao.getAttribute(`data-${acao.atributo}`));
  if (!id_emprestimo || !confirm(acao.pergunta)) return;

  botao.disabled = true;
  try {
    const resultado = await requisicao(acao.rota, {
      method: "POST",
      body: JSON.stringify({ id_emprestimo })
    });
    mostrarMensagem(resultado.mensagem || "Operação concluída.");
    await Promise.all([carregarExemplares(), carregarEmprestimos()]);
  } catch (erro) {
    mostrarMensagem(erro.message, "error");
    botao.disabled = false;
  }
});

// PESQUISA E FILTROS

$("#buscaInput").addEventListener(
  "input",
  renderizarTabela
);

$("#filtroStatus").addEventListener(
  "change",
  renderizarTabela
);

$("#atualizarBtn").addEventListener(
  "click",
  carregarTudo
);

// SAIR DO SISTEMA

$("#sairBtn").addEventListener("click", async () => {
  try {
    await requisicao(
      "/api/logout-bibliotecario",
      { method: "POST" }
    );
  } catch (_) {
    // A sessão pode já ter expirado.
  }

  window.location.href = "login-bibliotecario.html";
});

// INICIALIZAÇÃO

dataPrevista.min = hojeISO();
dataPrevista.value = hojeISO();

carregarTudo();
