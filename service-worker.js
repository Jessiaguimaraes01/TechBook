

const CACHE_NAME = "tecbook-offline-v2";

const ARQUIVOS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/quiz.html"
];

// 1. Instala o modo offline e guarda os arquivos principais.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const arquivo of ARQUIVOS) {
        try {
          const resposta = await fetch(arquivo);

          if (resposta.ok) {
            await cache.put(arquivo, resposta);
          }
        } catch (erro) {
          console.log(
            "Não foi possível guardar o arquivo:",
            arquivo
          );
        }
      }

      await self.skipWaiting();
    })()
  );
});

// 2. Ativa a nova versão e limpa caches antigos do TecBook.
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

// 3. Tenta carregar os arquivos e usa o cache se a conexão falhar.
self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  // Só trata pedidos GET do próprio TecBook.
  if (
    requisicao.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Não guarda nem substitui respostas da API do banco de dados.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  evento.respondWith(
    (async () => {
      try {
        // Primeiro tenta buscar a versão atual no servidor.
        const resposta = await fetch(requisicao);

        // Guarda uma cópia das respostas válidas.
        if (resposta.ok) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(requisicao, resposta.clone());
        }

        return resposta;
      } catch (erro) {
        // Sem conexão, tenta encontrar o arquivo guardado.
        const arquivoGuardado = await caches.match(requisicao);

        if (arquivoGuardado) {
          return arquivoGuardado;
        }

        // Se uma página não estiver no cache, tenta abrir o início.
        if (requisicao.mode === "navigate") {
          const paginaInicial = await caches.match("/index.html");

          if (paginaInicial) {
            return paginaInicial;
          }
        }

        // Se não houver cópia, informa que não foi possível carregar.
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
