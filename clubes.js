
const STORAGE_KEY = "techbook_clubes_v1";

const defaultClubs = [
  {
    id: "classicos",
    name: "Clube de Clássicos",
    genre: "Clássicos",
    members: 24,
    description: "Grandes obras que atravessam gerações.",
    emoji: "🌳",
    art: "classics",
    tags: ["Literatura", "Clássicos"],
    owner: false
  },
  {
    id: "fantasia",
    name: "Mundos Fantásticos",
    genre: "Fantasia",
    members: 37,
    description: "Explore histórias de magia e aventuras épicas.",
    emoji: "🏰",
    art: "fantasy",
    tags: ["Fantasia", "Aventura"],
    owner: false
  },
  {
    id: "misterio",
    name: "Mistérios & Investigação",
    genre: "Mistério",
    members: 29,
    description: "Livros que desafiam sua mente e revelam grandes enigmas.",
    emoji: "🔎",
    art: "mystery",
    tags: ["Suspense", "Mistério"],
    owner: false
  },
  {
    id: "romance",
    name: "Entre Páginas e Emoções",
    genre: "Romance",
    members: 18,
    description: "Histórias para conversar sobre sentimentos e relações.",
    emoji: "🌷",
    art: "romance",
    tags: ["Romance", "Leitura"],
    owner: false
  }
];

let clubs = loadClubs();

let joined = JSON.parse(
  localStorage.getItem("techbook_clubes_participando") || "[]"
);

function loadClubs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    return Array.isArray(saved) && saved.length
      ? saved
      : defaultClubs;

  } catch {
    return defaultClubs;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clubs));

  localStorage.setItem(
    "techbook_clubes_participando",
    JSON.stringify(joined)
  );
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function render() {
  const term = document
    .getElementById("searchInput")
    .value.trim().toLowerCase();

  const genre = document.getElementById("genreFilter").value;

  const filtered = clubs.filter(c =>
    (c.name + " " + c.genre + " " + c.description)
      .toLowerCase()
      .includes(term) &&
    (!genre || c.genre === genre)
  );

  document.getElementById("clubCount").textContent =
    `${clubs.length} ${clubs.length === 1 ? "clube" : "clubes"}`;

  document.getElementById("clubGrid").innerHTML =
    filtered.map(c => `
      <article class="club-card">

        <div class="club-art art-${escapeHTML(c.art || "classics")}">
          ${escapeHTML(c.emoji || "📚")}
        </div>

        <div class="club-info">

          <h3>${escapeHTML(c.name)}</h3>

          <span class="members">
            ♟ ${Number(c.members) || 0} membros
          </span>

          <p>${escapeHTML(c.description)}</p>

          <div class="tags">
            ${(c.tags || [c.genre]).map(t =>
              `<span class="tag">${escapeHTML(t)}</span>`
            ).join("")}
          </div>

          <button
            class="btn join-btn ${joined.includes(c.id) ? "joined" : ""}"
            data-join="${escapeHTML(c.id)}">

            ${joined.includes(c.id) ? "✓ Participando" : "Participar"}

          </button>

        </div>
      </article>
    `).join("");

  document.getElementById("emptyState").hidden =
    filtered.length !== 0;

  renderMyClubs();
}

function renderMyClubs() {
  const mine = clubs.filter(c => joined.includes(c.id));

  document.getElementById("myClubList").innerHTML =
    mine.length
      ? mine.map(c =>
          `<span class="my-chip">📖 ${escapeHTML(c.name)}</span>`
        ).join("")
      : '<span class="empty-my">Você ainda não participa de nenhum clube.</span>';
}

function showToast(message) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Participar ou sair de um clube
document.getElementById("clubGrid").addEventListener("click", e => {
  const btn = e.target.closest("[data-join]");

  if (!btn) return;

  const id = btn.dataset.join;
  const club = clubs.find(c => c.id === id);

  if (!club) return;

  if (joined.includes(id)) {
    joined = joined.filter(x => x !== id);

    club.members = Math.max(
      0,
      (Number(club.members) || 0) - 1
    );

    showToast("Você saiu do clube.");

  } else {
    joined.push(id);

    club.members = (Number(club.members) || 0) + 1;

    showToast("Você agora participa deste clube!");
  }

  save();
  render();
});

// Busca e filtro
document.getElementById("searchInput")
  .addEventListener("input", render);

document.getElementById("genreFilter")
  .addEventListener("change", render);

// Abrir formulário de criação
const dialog = document.getElementById("createDialog");

document.getElementById("openCreate")
  .addEventListener("click", () => dialog.showModal());

document.getElementById("closeCreate")
  .addEventListener("click", () => dialog.close());

dialog.addEventListener("click", e => {
  if (e.target === dialog) {
    dialog.close();
  }
});

// Criar um clube novo
document.getElementById("createForm")
  .addEventListener("submit", e => {

    e.preventDefault();

    const name = document.getElementById("clubName").value.trim();
    const genre = document.getElementById("clubGenre").value;
    const description = document.getElementById("clubDescription").value.trim();

    if (!name || !genre || !description) return;

    const id = "club-" + Date.now();

    const emojiByGenre = {
      Clássicos: "📜",
      Fantasia: "🪄",
      Mistério: "🕵️",
      Romance: "💌",
      Ficção: "🚀",
      Poesia: "🌼",
      Variados: "📚"
    };

    const artByGenre = {
      Clássicos: "classics",
      Fantasia: "fantasy",
      Mistério: "mystery",
      Romance: "romance",
      Ficção: "fiction",
      Poesia: "poetry",
      Variados: "fiction"
    };

    clubs.unshift({
      id,
      name,
      genre,
      members: 1,
      description,
      emoji: emojiByGenre[genre] || "📚",
      art: artByGenre[genre] || "classics",
      tags: [genre],
      owner: true
    });

    joined.push(id);

    save();
    render();

    e.target.reset();
    dialog.close();

    showToast("Clube criado com sucesso!");
  });

render();

