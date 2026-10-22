
const CACHE_NAME = "tecbook-offline-v1";

const ARQUIVOS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/quiz.html"
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ARQUIVOS.map(async (arquivo) => {
          try {
            const resposta = await fetch(arquivo);
            if (resposta.ok) {
              await cache.put(arquivo, resposta);
            }
          } catch (erro) {
            console.log("Arquivo ainda não disponível:", arquivo);
          }
        })
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome.startsWith("tecbook-offline-") && nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  if (evento.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Não guardar respostas da API nem dados do banco no cache do site.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(evento.request, copia);
          });
        }

        return resposta;
      })
      .catch(async () => {
        const guardado = await caches.match(evento.request);
        if (guardado) return guardado;

        if (evento.request.mode === "navigate") {
          return (await caches.match("/index.html")) ||
            Response.error();
        }

        return Response.error();
      })
  );
});
