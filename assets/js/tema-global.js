// Acessibilidade global do TechBook: as preferências acompanham o usuário em todas as páginas.
(() => {
  "use strict";

  const CHAVE_TEMA = "techbook-alto-contraste";
  const CHAVE_FONTE = "techbook-fonte-percentual";
  const FONTE_MIN = 80;
  const FONTE_MAX = 140;
  const FONTE_PADRAO = 100;

  const ler = (chave, padrao = null) => {
    try {
      const valor = localStorage.getItem(chave);
      return valor === null ? padrao : valor;
    } catch (_) {
      return padrao;
    }
  };

  const gravar = (chave, valor) => {
    try {
      localStorage.setItem(chave, String(valor));
    } catch (_) {
      // A página continua funcionando mesmo quando o navegador bloqueia o armazenamento.
    }
  };

  const limitarFonte = valor => Math.min(FONTE_MAX, Math.max(FONTE_MIN, Number(valor) || FONTE_PADRAO));
  let tamanhoFonte = limitarFonte(ler(CHAVE_FONTE, FONTE_PADRAO));
  let modoNoturno = ler(CHAVE_TEMA, "0") === "1";

  function atualizarBotoes() {
    document.querySelectorAll("#contraste-btn, [data-tb-theme-toggle]").forEach(botao => {
      botao.setAttribute("aria-pressed", String(modoNoturno));
      botao.textContent = modoNoturno ? "Desativar modo noturno" : "Ativar modo noturno";
    });

    document.querySelectorAll("#fonte-aumentar, #fonte-diminuir, #fonte-normal, [data-tb-font]").forEach(botao => {
      const acao = botao.dataset.tbFont || botao.id;
      if (acao === "fonte-aumentar" || acao === "mais") botao.disabled = tamanhoFonte >= FONTE_MAX;
      if (acao === "fonte-diminuir" || acao === "menos") botao.disabled = tamanhoFonte <= FONTE_MIN;
      if (acao === "fonte-normal" || acao === "normal") botao.setAttribute("aria-pressed", String(tamanhoFonte === FONTE_PADRAO));
    });

    const indicador = document.querySelector("[data-tb-font-value]");
    if (indicador) indicador.textContent = `${tamanhoFonte}%`;
  }

  function aplicar() {
    if (document.body) document.body.classList.toggle("alto-contraste", modoNoturno);
    document.documentElement.style.colorScheme = modoNoturno ? "dark" : "light";
    document.documentElement.style.fontSize = `${tamanhoFonte}%`;
    atualizarBotoes();
  }

  function definirTema(ativo) {
    modoNoturno = Boolean(ativo);
    gravar(CHAVE_TEMA, modoNoturno ? "1" : "0");
    aplicar();
  }

  function alternarTema() {
    definirTema(!modoNoturno);
    return modoNoturno;
  }

  function definirFonte(valor) {
    tamanhoFonte = limitarFonte(valor);
    gravar(CHAVE_FONTE, tamanhoFonte);
    aplicar();
  }

  function criarPainelGlobal() {
    if (!document.body || document.querySelector(".tb-acessibilidade-global")) return;

    const area = document.createElement("div");
    area.className = "tb-acessibilidade-global";
    area.innerHTML = `
      <button class="tb-acessibilidade-abrir" type="button" aria-expanded="false" aria-controls="tb-acessibilidade-painel">
        <span class="tb-acessibilidade-icone" aria-hidden="true">Aa</span>
        <span>Acessibilidade</span>
      </button>
      <section class="tb-acessibilidade-painel" id="tb-acessibilidade-painel" aria-labelledby="tb-acessibilidade-titulo" hidden>
        <div class="tb-acessibilidade-cabecalho">
          <div>
            <strong id="tb-acessibilidade-titulo">Acessibilidade</strong>
            <p>Personalize a leitura do TechBook.</p>
          </div>
          <button class="tb-acessibilidade-fechar" type="button" aria-label="Fechar opções de acessibilidade">×</button>
        </div>
        <div class="tb-acessibilidade-linha">
          <span>Tamanho do texto</span>
          <div class="tb-acessibilidade-fontes" aria-label="Ajustar tamanho do texto">
            <button type="button" data-tb-font="menos" aria-label="Diminuir texto">A−</button>
            <button type="button" data-tb-font="normal" aria-label="Restaurar tamanho normal">A</button>
            <button type="button" data-tb-font="mais" aria-label="Aumentar texto">A+</button>
          </div>
        </div>
        <div class="tb-acessibilidade-linha tb-acessibilidade-tema">
          <div>
            <strong>Modo noturno</strong>
            <small>Fundo escuro e textos claros em todas as páginas.</small>
          </div>
          <button type="button" data-tb-theme-toggle aria-pressed="false">Ativar modo noturno</button>
        </div>
        <p class="tb-acessibilidade-aviso">Suas escolhas ficam salvas neste navegador e continuam ativas ao mudar de página.</p>
      </section>`;

    document.body.appendChild(area);

    const abrir = area.querySelector(".tb-acessibilidade-abrir");
    const painel = area.querySelector(".tb-acessibilidade-painel");
    const fechar = area.querySelector(".tb-acessibilidade-fechar");

    const definirAberto = aberto => {
      painel.hidden = !aberto;
      abrir.setAttribute("aria-expanded", String(aberto));
      if (aberto) area.querySelector("[data-tb-font='menos']")?.focus();
    };

    abrir.addEventListener("click", () => definirAberto(painel.hidden));
    fechar.addEventListener("click", () => {
      definirAberto(false);
      abrir.focus();
    });

    document.addEventListener("click", evento => {
      if (!area.contains(evento.target) && !painel.hidden) definirAberto(false);
    });

    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && !painel.hidden) {
        definirAberto(false);
        abrir.focus();
      }
    });
  }

  // Os controles da seção de acessibilidade da página inicial usam a mesma configuração global.
  document.addEventListener("click", evento => {
    const alvo = evento.target.closest("#contraste-btn, [data-tb-theme-toggle], #fonte-aumentar, #fonte-diminuir, #fonte-normal, [data-tb-font]");
    if (!alvo) return;

    if (alvo.matches("#contraste-btn, [data-tb-theme-toggle]")) {
      alternarTema();
      return;
    }

    const acao = alvo.dataset.tbFont || alvo.id;
    if (acao === "fonte-aumentar" || acao === "mais") definirFonte(tamanhoFonte + 10);
    if (acao === "fonte-diminuir" || acao === "menos") definirFonte(tamanhoFonte - 10);
    if (acao === "fonte-normal" || acao === "normal") definirFonte(FONTE_PADRAO);
  });

  aplicar();
  criarPainelGlobal();

  window.TechBookAcessibilidade = {
    aplicar,
    alternarTema,
    definirTema,
    definirFonte,
    obterPreferencias: () => ({ modoNoturno, tamanhoFonte })
  };
  // Compatibilidade com páginas/trechos que já chamavam o nome antigo.
  window.TechBookTheme = window.TechBookAcessibilidade;
})();
