// Acessibilidade global do TechBook.
(() => {
  "use strict";

  const CHAVE_TEMA = "techbook-alto-contraste";
  const CHAVE_FONTE = "techbook-fonte-percentual";
  const FONTE_MIN = 80;
  const FONTE_MAX = 140;
  const FONTE_PADRAO = 100;

  function lerPreferencia(chave, padrao) {
    try {
      const valor = localStorage.getItem(chave);
      return valor === null ? padrao : valor;
    } catch {
      return padrao;
    }
  }

  function salvarPreferencia(chave, valor) {
    try {
      localStorage.setItem(chave, String(valor));
    } catch {
      // O site continua funcionando mesmo sem armazenamento local.
    }
  }

  function limitarFonte(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return FONTE_PADRAO;
    return Math.min(FONTE_MAX, Math.max(FONTE_MIN, numero));
  }

  let modoNoturno = lerPreferencia(CHAVE_TEMA, "0") === "1";
  let tamanhoFonte = limitarFonte(lerPreferencia(CHAVE_FONTE, FONTE_PADRAO));

  function atualizarControles() {
    document.querySelectorAll("#contraste-btn, [data-tb-theme-toggle]").forEach(botao => {
      botao.setAttribute("aria-pressed", String(modoNoturno));
      botao.textContent = modoNoturno ? "Desativar modo noturno" : "Ativar modo noturno";
    });

    document.querySelectorAll("#fonte-aumentar, #fonte-diminuir, #fonte-normal, [data-tb-font]").forEach(botao => {
      const acao = botao.dataset.tbFont || botao.id;
      if (acao === "fonte-aumentar" || acao === "mais") botao.disabled = tamanhoFonte >= FONTE_MAX;
      if (acao === "fonte-diminuir" || acao === "menos") botao.disabled = tamanhoFonte <= FONTE_MIN;
      if (acao === "fonte-normal" || acao === "normal") {
        botao.setAttribute("aria-pressed", String(tamanhoFonte === FONTE_PADRAO));
      }
    });

    document.querySelectorAll("[data-tb-font-value]").forEach(indicador => {
      indicador.textContent = `${tamanhoFonte}%`;
    });
  }

  function aplicarPreferencias() {
    if (document.body) {
      document.body.classList.toggle("alto-contraste", modoNoturno);
    }
    document.documentElement.style.colorScheme = modoNoturno ? "dark" : "light";
    document.documentElement.style.fontSize = `${tamanhoFonte}%`;
    atualizarControles();
  }

  function definirTema(ativo) {
    modoNoturno = Boolean(ativo);
    salvarPreferencia(CHAVE_TEMA, modoNoturno ? "1" : "0");
    aplicarPreferencias();
  }

  function alternarTema() {
    definirTema(!modoNoturno);
    return modoNoturno;
  }

  function definirFonte(valor) {
    tamanhoFonte = limitarFonte(valor);
    salvarPreferencia(CHAVE_FONTE, tamanhoFonte);
    aplicarPreferencias();
  }

  function criarPainelGlobal() {
    if (!document.body || document.querySelector(".tb-acessibilidade-global")) return;

    const area = document.createElement("div");
    area.className = "tb-acessibilidade-global";
    area.innerHTML = `
      <button class="tb-acessibilidade-abrir" type="button"
        aria-expanded="false" aria-controls="tb-acessibilidade-painel">
        <span class="tb-acessibilidade-icone" aria-hidden="true">Aa</span>
        <span>Acessibilidade</span>
      </button>

      <section class="tb-acessibilidade-painel" id="tb-acessibilidade-painel"
        aria-labelledby="tb-acessibilidade-titulo" hidden>
        <div class="tb-acessibilidade-cabecalho">
          <div>
            <strong id="tb-acessibilidade-titulo">Acessibilidade</strong>
            <p>Personalize a leitura do TechBook.</p>
          </div>
          <button class="tb-acessibilidade-fechar" type="button"
            aria-label="Fechar opções de acessibilidade">×</button>
        </div>

        <div class="tb-acessibilidade-linha">
          <span id="tb-acessibilidade-fonte-label">Tamanho do texto</span>
          <div class="tb-acessibilidade-fontes" role="group"
            aria-labelledby="tb-acessibilidade-fonte-label">
            <button type="button" data-tb-font="menos" aria-label="Diminuir tamanho do texto">A−</button>
            <button type="button" data-tb-font="normal" aria-label="Restaurar tamanho normal">A</button>
            <button type="button" data-tb-font="mais" aria-label="Aumentar tamanho do texto">A+</button>
          </div>
        </div>

        <div class="tb-acessibilidade-linha tb-acessibilidade-tema">
          <div>
            <strong>Modo noturno</strong>
            <small>Fundo escuro e textos claros nas páginas compatíveis.</small>
          </div>
          <button type="button" data-tb-theme-toggle aria-pressed="false">
            Ativar modo noturno
          </button>
        </div>

        <p class="tb-acessibilidade-aviso" aria-live="polite">
          Suas escolhas ficam salvas neste navegador.
        </p>
      </section>`;

    document.body.appendChild(area);

    const abrir = area.querySelector(".tb-acessibilidade-abrir");
    const painel = area.querySelector(".tb-acessibilidade-painel");
    const fechar = area.querySelector(".tb-acessibilidade-fechar");

    function definirPainelAberto(aberto) {
      painel.hidden = !aberto;
      abrir.setAttribute("aria-expanded", String(aberto));
      if (aberto) {
        area.querySelector('[data-tb-font="normal"]').focus();
      }
    }

    abrir.addEventListener("click", () => definirPainelAberto(painel.hidden));

    fechar.addEventListener("click", () => {
      definirPainelAberto(false);
      abrir.focus();
    });

    document.addEventListener("click", evento => {
      if (!area.contains(evento.target) && !painel.hidden) {
        definirPainelAberto(false);
      }
    });

    document.addEventListener("keydown", evento => {
      if (evento.key === "Escape" && !painel.hidden) {
        definirPainelAberto(false);
        abrir.focus();
      }
    });
  }

  // Mantém compatibilidade com os controles que já existem na página inicial.
  document.addEventListener("click", evento => {
    const alvo = evento.target.closest(
      "#contraste-btn, [data-tb-theme-toggle], #fonte-aumentar, #fonte-diminuir, #fonte-normal, [data-tb-font]"
    );
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

  aplicarPreferencias();
  criarPainelGlobal();

  // Mantém os nomes usados por scripts antigos do projeto.
  window.TechBookAcessibilidade = {
    aplicar: aplicarPreferencias,
    alternarTema,
    definirTema,
    definirFonte,
    obterPreferencias: () => ({ modoNoturno, tamanhoFonte })
  };
  window.TechBookTheme = window.TechBookAcessibilidade;
})();