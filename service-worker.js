/*
const CACHE_NAME = "tecbook-offline-v4";

const ARQUIVOS = [
  "/",
  "/index.html",
  "/assets/css/style.css",
  "/assets/js/script.js",
  "/quiz.html",
  "/login.html",
  "/cadastro.html",
  "/login-bibliotecario.html",
  "/bibliotecario.html"
];

// Instala a nova versão e guarda as páginas para uso offline.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const arquivo of ARQUIVOS) {
        try {
          const resposta = await fetch(arquivo, {
            cache: "no-store"
          });

          // Só guarda páginas e arquivos válidos.
          if (
            resposta.ok &&
            resposta.type === "basic"
          ) {
            await cache.put(arquivo, resposta);
          } else {
            console.warn(
              "Arquivo não foi guardado:",
              arquivo,
              resposta.status
            );
          }
        } catch (erro) {
          console.warn(
            "Não foi possível guardar:",
            arquivo,
            erro
          );
        }
      }

      // Ativa a nova versão sem esperar todas as abas fecharem.
      await self.skipWaiting();
    })()
  );
});

// Ativa a versão nova e remove caches antigos do TecBook.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();

      await Promise.all(
        nomes
          .filter(
            (nome) =>
              nome.startsWith("tecbook-offline-") &&
              nome !== CACHE_NAME
          )
          .map((nome) => caches.delete(nome))
      );

      await self.clients.claim();
    })()
  );
});

// Busca primeiro na rede e usa o cache se estiver offline.
self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  // Só trata pedidos GET do próprio site.
  if (
    requisicao.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Não intercepta nem guarda respostas da API.
  if (url.pathname.startsWith("/api/")) {
    return;
  }


  // Telas de login: tenta a rede primeiro e usa o cache offline
  // somente para exibir o formulário estático.
  const paginasDeLogin = [
    "/login.html",
    "/login-bibliotecario.html"
  ];

  if (paginasDeLogin.includes(url.pathname)) {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(requisicao);

          if (resposta.ok && resposta.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(requisicao, resposta.clone());
          }

          return resposta;
        } catch (erro) {
          const paginaGuardada = await caches.match(requisicao);

          if (paginaGuardada) {
            return paginaGuardada;
          }

          return new Response(
            "A tela de login não está disponível offline. Conecte-se à internet e tente novamente.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );

    return;
  }


  // Permite abrir o painel do bibliotecário offline
  // usando a cópia salva no cache.
  if (url.pathname === "/bibliotecario.html") {
    evento.respondWith(
      (async () => {
        try {
          const resposta = await fetch(requisicao);

          if (resposta.ok && resposta.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(requisicao, resposta.clone());
          }

          return resposta;
        } catch (erro) {
          const paginaGuardada = await caches.match(requisicao);

          if (paginaGuardada) {
            return paginaGuardada;
          }

          return new Response(
            "O painel ainda não foi salvo para uso offline. Conecte-se à internet e abra-o primeiro.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }
      })()
    );

    return;
  }


  evento.respondWith(
    (async () => {
      try {
        const resposta = await fetch(requisicao);

        if (resposta.ok && resposta.type === "basic") {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(requisicao, resposta.clone());
        }

        return resposta;
      } catch (erro) {
        const arquivoGuardado = await caches.match(requisicao);

        if (arquivoGuardado) {
          return arquivoGuardado;
        }

        // Se uma página não estiver no cache, tenta a página inicial.
        if (requisicao.mode === "navigate") {
          const paginaInicial = await caches.match("/index.html");

          if (paginaInicial) {
            return paginaInicial;
          }
        }

        return new Response(
          "Este conteúdo ainda não foi salvo para uso offline.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })()
  );
}); */ 

// Service worker compatível com GitHub Pages (inclusive publicação em /TechBook/).
const CACHE_NAME = "techbook-offline-v7";
const BASE = self.registration.scope;
const URLS = [
  "./", "./index.html", "./login.html", "./cadastro.html",
  "./login-bibliotecario.html", "./perfil-aluno.html", "./bibliotecario.html",
  "./emprestimos.html", "./emprestimos-aluno.html", "./emprestimo.html",
  "./emprestimo-aluno.html", "./emprestimo-atalho.html", "./emprestimo-aluno-atalho.html",
  "./clubes.html", "./Ranking.html", "./minha_estante_virtual_cabecalho_vinho.html",
  "./amigos_de_leitura_completo.html", "./quiz.html", "./jogos.html", "./jogo.html",
  "./techbook.html", "./scanner.html", "./estatisticas.html",
  "./assets/css/style.css", "./assets/css/emprestimos.css", "./assets/css/clubes.css",
  "./assets/css/tema-global.css", "./jogo.css", "./emprestimos.css",
  "./assets/js/dados-visitante.js", "./assets/js/script.js", "./assets/js/tema-global.js",
  "./assets/js/emprestimos.js", "./assets/js/emprestimos-aluno.js", "./assets/js/clubes.js",
  "./jogo.js"
].map(path => new URL(path, BASE).href);

const BASE_URL = new URL(BASE);
const API_PATH = new URL("api/", BASE).pathname;
const LOGIN_PATHS = [
  new URL("login.html", BASE).pathname,
  new URL("login-bibliotecario.html", BASE).pathname
];
const BIBLIOTECARIO_PATH = new URL("bibliotecario.html", BASE).pathname;
const HOME_URL = new URL("index.html", BASE).href;

self.addEventListener("install", evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of URLS) {
      try {
        const resposta = await fetch(url, { cache: "no-store" });
        if (resposta.ok && resposta.type === "basic") await cache.put(url, resposta);
      } catch (_) {
        // A instalação continua mesmo que algum recurso não esteja acessível.
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", evento => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter(nome => (nome.startsWith("techbook-offline-") || nome.startsWith("tecbook-offline-")) && nome !== CACHE_NAME)
      .map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", evento => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;
  const url = new URL(requisicao.url);
  if (url.origin !== BASE_URL.origin || !url.pathname.startsWith(BASE_URL.pathname)) return;
  if (url.pathname.startsWith(API_PATH)) return;

  evento.respondWith((async () => {
    try {
      const resposta = await fetch(requisicao);
      if (resposta.ok && resposta.type === "basic") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(requisicao, resposta.clone());
      }
      return resposta;
    } catch (_) {
      const guardada = await caches.match(requisicao);
      if (guardada) return guardada;
      if (requisicao.mode === "navigate") {
        const inicio = await caches.match(HOME_URL);
        if (inicio) return inicio;
      }
      return new Response("Este conteúdo ainda não foi salvo para uso offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});

