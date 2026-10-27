
const CACHE_NAME = "tecbook-offline-v3";

const ARQUIVOS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
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

  // Não guarda páginas de login nem outras páginas com dados de acesso.
  // Elas só podem ser abertas quando o servidor estiver disponível.
  const paginasDeAcesso = [
    "/login.html",
    "/cadastro.html",
    "/login-bibliotecario.html",
    "/bibliotecario.html"
  ];

  if (paginasDeAcesso.includes(url.pathname)) {
    evento.respondWith(fetch(requisicao));
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
});
