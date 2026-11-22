// Cabeçalho discreto e retorno inteligente nas páginas secundárias.
(() => {
  "use strict";
  const file = location.pathname.split("/").pop().toLowerCase();
  const fallbacks = {
    "jogo.html":"jogos.html", "jogos.html":"perfil-aluno.html",
    "emprestimos-aluno.html":"perfil-aluno.html",
    "minha_estante_virtual_cabecalho_vinho.html":"perfil-aluno.html",
    "amigos_de_leitura_completo.html":"perfil-aluno.html", "clubes.html":"perfil-aluno.html",
    "tebys.html":"perfil-aluno.html", "emprestimos.html":"bibliotecario.html",
    "doacoes.html":"bibliotecario.html", "bibliotecario_doacoes.html":"bibliotecario.html",
    "techbook.html":"bibliotecario.html", "scanner.html":"bibliotecario.html",
    "ranking.html":"index.html", "ranking-antigo.html":"index.html", "quiz.html":"index.html",
    "nossa-historia.html":"index.html", "techexpandir.html":"index.html",
    "estatisticas.html":"index.html", "login.html":"index.html", "cadastro.html":"index.html",
    "login-bibliotecario.html":"index.html"
  };
  const destino = fallbacks[file] || "index.html";
  const header = document.querySelector("body > header, body > .game-shell > header, body > .shell header, body > .topbar");
  let area = header?.querySelector(".topinner, .wrap, .topbar-inner") || header;
  if (header) {
    header.classList.add("tb-secondary-header");
    header.querySelectorAll("nav").forEach(nav => {
      nav.setAttribute("data-tb-secondary-hidden", "true");
      nav.setAttribute("aria-hidden", "true");
    });
  } else {
    const bar = document.createElement("header");
    bar.className = "tb-secondary-header tb-secondary-fallback-header";
    bar.innerHTML = '<a class="tb-secondary-brand" href="index.html">TB · TechBook</a>';
    document.body.prepend(bar);
    area = bar;
  }
  if (!area || area.querySelector(".tb-voltar")) return;
  const back = document.createElement("button");
  back.type = "button";
  back.className = "tb-voltar";
  back.textContent = "← Voltar";
  back.setAttribute("aria-label", "Voltar à página anterior");
  back.addEventListener("click", () => {
    let sameSite = false;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      sameSite = !!ref && ref.origin === location.origin && ref.pathname !== location.pathname;
    } catch (_) { sameSite = false; }
    if (sameSite && history.length > 1) history.back();
    else location.href = destino;
  });
  area.appendChild(back);
})();
