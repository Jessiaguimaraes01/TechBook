
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const phaseNumber = document.getElementById("phaseNumber");
const phaseTitle = document.getElementById("phaseTitle");
const phaseDescription = document.getElementById("phaseDescription");
const progressFill = document.getElementById("progressFill");
const missionList = document.getElementById("missionList");
const pointsValue = document.getElementById("pointsValue");
const inventoryList = document.getElementById("inventoryList");
const inventoryCount = document.getElementById("inventoryCount");
const interactionHint = document.getElementById("interactionHint");
const locationName = document.getElementById("locationName");
const gameLog = document.getElementById("gameLog");

const dialogOverlay = document.getElementById("dialogOverlay");
const dialogTitle = document.getElementById("dialogTitle");
const dialogText = document.getElementById("dialogText");
const dialogOptions = document.getElementById("dialogOptions");
const dialogClose = document.getElementById("dialogClose");
const restartButton = document.getElementById("restartButton");

const state = {
    stage: 0,
    points: 0,
    inventory: [],
    started: false,
    archiveStarted: false,
    oldLibrarianTalked: false,
    bookFound: false,
    finished: false,
    flags: {},
    dialogOpen: false,
    elapsed: 0,
    lastTime: 0,
    falseClueCount: 0,
    positionCache: {},
    finalMessageRead: false,
    player: {
        x: 475,
        y: 535,
        speed: 220,
        direction: "down"
    }
};

const keys = {};

const stageInfo = [
    { title: "O mistério começa", description: "Um livro muito importante desapareceu. Descubra o que aconteceu.", location: "Biblioteca principal" },
    { title: "A sala secreta", description: "As pistas indicaram uma passagem escondida. Encontre uma forma de entrar.", location: "Estante misteriosa" },
    { title: "O arquivo esquecido", description: "Documentos antigos podem revelar quem levou o livro.", location: "Arquivo antigo" },
    { title: "O enigma dos corredores", description: "Três símbolos escondem a sequência que libera a próxima passagem.", location: "Corredor dos enigmas" },
    { title: "O último segredo", description: "Uma antiga história da biblioteca pode revelar o esconderijo do livro.", location: "Sala restrita" },
    { title: "Os registros ocultos", description: "Descubra o que os registros escondem antes de chegar ao livro.", location: "Arquivo reservado" },
    { title: "A mensagem fragmentada", description: "Reúna três partes de uma mensagem escondida.", location: "Sala dos documentos" },
    { title: "O código esquecido", description: "Encontre as anotações e descubra a combinação correta.", location: "Sala de catalogação" },
    { title: "A última investigação", description: "Descubra quem protegeu o livro e por quê.", location: "Biblioteca subterrânea" },
    { title: "O livro e a verdade", description: "Encontre o livro, leia a mensagem escondida e conclua a investigação.", location: "Câmara de leitura" }
];

const obstacles = [
    { x: 250, y: 130, w: 170, h: 52 },
    { x: 510, y: 130, w: 160, h: 52 },
    { x: 760, y: 130, w: 145, h: 52 },
    { x: 250, y: 420, w: 170, h: 52 },
    { x: 510, y: 420, w: 160, h: 52 },
    { x: 760, y: 420, w: 145, h: 52 },
    { x: 430, y: 275, w: 105, h: 72 },
    { x: 65, y: 260, w: 150, h: 72 }
];

function allCluesFound() {
    return Boolean(state.flags.clue_note && state.flags.clue_bookmark && state.flags.clue_register);
}

function allPagesFound() {
    return Boolean(state.flags.page_one && state.flags.page_two && state.flags.page_three);
}

function allSymbolsFound() {
    return Boolean(state.flags.symbol_sun && state.flags.symbol_moon && state.flags.symbol_star);
}

// Cada pista recebe uma posição diferente a cada partida, sem ficar sobre os móveis.
function cluePosition(id, fallbackX, fallbackY) {
    const key = `${state.stage}:${id}`;
    if (state.positionCache[key]) return state.positionCache[key];

    const margin = 30;
    const blockedAreas = obstacles.map(o => ({
        x: o.x - margin, y: o.y - margin,
        w: o.w + margin * 2, h: o.h + margin * 2
    }));

    for (let i = 0; i < 300; i++) {
        const p = { x: 75 + Math.random() * 810, y: 105 + Math.random() * 420 };
        const blocked = blockedAreas.some(o =>
            p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h
        );
        const nearSpawn = Math.hypot(p.x - 475, p.y - 535) < 80;
        const nearAnotherClue = Object.entries(state.positionCache).some(([k, v]) =>
            k.startsWith(`${state.stage}:`) && Math.hypot(p.x - v.x, p.y - v.y) < 90
        );
        if (!blocked && !nearSpawn && !nearAnotherClue) {
            state.positionCache[key] = p;
            return p;
        }
    }
    state.positionCache[key] = { x: fallbackX, y: fallbackY };
    return state.positionCache[key];
}

function clue(id, name, type, x, y, extra = {}) {
    return { id, name, type, ...cluePosition(id, x, y), hidden: true, ...extra };
}

function entitiesForStage() {
    switch (state.stage) {
        case 0:
            if (!state.started || allCluesFound()) return [{ id: "librarian", name: "Bibliotecária", type: "npc", x: 155, y: 375 }];
            return [
                { id: "librarian", name: "Bibliotecária", type: "npc", x: 155, y: 375 },
                clue("clue_note", "Bilhete rasgado", "paper", 225, 365),
                clue("clue_bookmark", "Marca-página azul", "bookmark", 705, 205),
                clue("clue_register", "Registro de empréstimo", "paper", 470, 375),
                clue("false_ticket", "Papel antigo", "false", 610, 350),
                clue("false_box", "Objeto esquecido", "false", 825, 350)
            ];
        case 1:
            return [clue("old_key", "Chave antiga", "key", 225, 365), { id: "secret_door", name: "Passagem secreta", type: "door", x: 885, y: 300 }];
        case 2:
            if (!state.archiveStarted || allPagesFound()) return [{ id: "archivist", name: "Arquivista", type: "archivist", x: 155, y: 375 }];
            return [
                { id: "archivist", name: "Arquivista", type: "archivist", x: 155, y: 375 },
                clue("page_one", "Página rasgada 1", "paper", 225, 365),
                clue("page_two", "Página rasgada 2", "paper", 705, 205),
                clue("page_three", "Página rasgada 3", "paper", 470, 375),
                clue("false_folder", "Pasta vazia", "false", 610, 350)
            ];
        case 3:
            return [
                ...(!state.flags.symbol_sun ? [clue("symbol_sun", "Símbolo do sol", "symbol", 225, 365, { symbol: "☀" })] : []),
                ...(!state.flags.symbol_moon ? [clue("symbol_moon", "Símbolo da lua", "symbol", 705, 205, { symbol: "☾" })] : []),
                ...(!state.flags.symbol_star ? [clue("symbol_star", "Símbolo da estrela", "symbol", 470, 375, { symbol: "✦" })] : []),
                clue("false_symbol", "Símbolo apagado", "false", 610, 350),
                { id: "panel", name: "Painel de símbolos", type: "panel", x: 885, y: 530 }
            ];
        case 4:
            return [
                { id: "old_librarian", name: "Antigo bibliotecário", type: "oldnpc", x: 155, y: 375 },
                ...(state.oldLibrarianTalked && !state.flags.catalog_checked ? [clue("catalog", "Catálogo antigo", "catalog", 705, 205)] : []),
                ...(state.flags.catalog_checked ? [{ id: "cabinet", name: "Armário fechado", type: "cabinet", x: 720, y: 530 }] : [])
            ];
        case 5:
            return [
                { id: "record_keeper", name: "Responsável pelo arquivo", type: "archivist", x: 155, y: 375 },
                ...(!state.flags.record_a ? [clue("record_a", "Registro de entrada", "paper", 225, 365)] : []),
                ...(!state.flags.record_b ? [clue("record_b", "Ficha de consulta", "paper", 705, 205)] : []),
                ...(!state.flags.record_c ? [clue("record_c", "Anotação rasgada", "paper", 470, 375)] : []),
                { id: "record_desk", name: "Mesa de registros", type: "panel", x: 885, y: 530 }
            ];
        case 6:
            return [
                { id: "message_keeper", name: "Guardião dos documentos", type: "oldnpc", x: 155, y: 375 },
                ...(!state.flags.message_a ? [clue("message_a", "Fragmento da mensagem 1", "paper", 225, 365)] : []),
                ...(!state.flags.message_b ? [clue("message_b", "Fragmento da mensagem 2", "paper", 705, 205)] : []),
                ...(!state.flags.message_c ? [clue("message_c", "Fragmento da mensagem 3", "paper", 470, 375)] : []),
                { id: "message_board", name: "Quadro de mensagens", type: "panel", x: 885, y: 530 }
            ];
        case 7:
            return [
                { id: "code_keeper", name: "Catalogadora", type: "archivist", x: 155, y: 375 },
                ...(!state.flags.code_hint_a ? [clue("code_hint_a", "Anotação do primeiro número", "paper", 225, 365)] : []),
                ...(!state.flags.code_hint_b ? [clue("code_hint_b", "Anotação do último número", "paper", 705, 205)] : []),
                { id: "final_panel", name: "Painel de combinação", type: "panel", x: 885, y: 530 }
            ];
        case 8:
            return [
                { id: "witness", name: "Antiga funcionária", type: "oldnpc", x: 155, y: 375 },
                ...(!state.flags.evidence_a ? [clue("evidence_a", "Relatório antigo", "paper", 225, 365)] : []),
                ...(!state.flags.evidence_b ? [clue("evidence_b", "Carta guardada", "paper", 705, 205)] : []),
                ...(!state.flags.evidence_c ? [clue("evidence_c", "Página do diário", "paper", 470, 375)] : []),
                { id: "evidence_box", name: "Caixa de documentos", type: "cabinet", x: 720, y: 530 }
            ];
        case 9:
            return [
                ...(!state.bookFound ? [clue("lost_book", "Livro desaparecido", "book", 705, 205)] : []),
                ...(state.bookFound && !state.finalMessageRead ? [{ id: "book_message", name: "Mensagem escondida no livro", type: "catalog", x: 470, y: 375 }] : []),
                ...(state.finalMessageRead ? [{ id: "final_librarian", name: "Bibliotecária", type: "npc", x: 155, y: 375 }] : [])
            ];
        default: return [];
    }
}

function getMissions() {
    switch (state.stage) {
        case 0:
            if (!state.started) return [{ text: "Converse com a bibliotecária.", done: false }];
            return [
                { text: "Encontrar o bilhete rasgado.", done: !!state.flags.clue_note },
                { text: "Encontrar o marca-página azul.", done: !!state.flags.clue_bookmark },
                { text: "Encontrar o registro de empréstimo.", done: !!state.flags.clue_register },
                { text: "Voltar à bibliotecária.", done: false }
            ];
        case 1: return [{ text: "Encontrar a chave antiga.", done: !!state.flags.old_key }, { text: "Destrancar a passagem secreta.", done: false }];
        case 2: return [{ text: "Conversar com o arquivista.", done: state.archiveStarted }, { text: "Encontrar as três páginas perdidas.", done: allPagesFound() }, { text: "Entregar as páginas ao arquivista.", done: false }];
        case 3: return [
            { text: "Encontrar o símbolo do sol.", done: !!state.flags.symbol_sun },
            { text: "Encontrar o símbolo da lua.", done: !!state.flags.symbol_moon },
            { text: "Encontrar o símbolo da estrela.", done: !!state.flags.symbol_star },
            { text: "Resolver o painel de símbolos.", done: false }
        ];
        case 4: return [{ text: "Conversar com o antigo bibliotecário.", done: state.oldLibrarianTalked }, { text: "Consultar o catálogo antigo.", done: !!state.flags.catalog_checked }, { text: "Investigar o armário fechado.", done: false }];
        case 5: return [
            { text: "Encontrar os três registros.", done: !!(state.flags.record_a && state.flags.record_b && state.flags.record_c) },
            { text: "Conferir os registros na mesa.", done: !!state.flags.records_checked }
        ];
        case 6: return [
            { text: "Encontrar os três fragmentos.", done: !!(state.flags.message_a && state.flags.message_b && state.flags.message_c) },
            { text: "Montar a mensagem no quadro.", done: !!state.flags.message_decoded }
        ];
        case 7: return [
            { text: "Encontrar as duas anotações.", done: !!(state.flags.code_hint_a && state.flags.code_hint_b) },
            { text: "Descobrir a combinação correta.", done: !!state.flags.code_solved }
        ];
        case 8: return [
            { text: "Conversar com a antiga funcionária.", done: !!state.flags.witness_talked },
            { text: "Encontrar as três provas.", done: !!(state.flags.evidence_a && state.flags.evidence_b && state.flags.evidence_c) },
            { text: "Abrir a caixa de documentos.", done: !!state.flags.evidence_opened }
        ];
        case 9: return [
            { text: "Encontrar o livro desaparecido.", done: state.bookFound },
            { text: "Ler a mensagem escondida.", done: state.finalMessageRead },
            { text: "Voltar à bibliotecária.", done: false }
        ];
        default: return [{ text: "Mistério resolvido!", done: true }];
    }
}

function updateUI() {
    if (state.stage >= 10) {
        phaseNumber.textContent = "JORNADA CONCLUÍDA";
        phaseTitle.textContent = "A verdade foi revelada!";
        phaseDescription.textContent = "O livro foi recuperado e a história por trás do desaparecimento foi descoberta.";
        progressFill.style.width = "100%";
        locationName.textContent = "Missão concluída";

        missionList.innerHTML = `
            <div class="mission-item done">
                <span class="mission-check">✓</span>
                <span>Encontrar o livro perdido.</span>
            </div>
            <div class="mission-item done">
                <span class="mission-check">✓</span>
                <span>Resolver todos os enigmas.</span>
            </div>
            <div class="mission-item done">
                <span class="mission-check">✓</span>
                <span>Devolver o livro à biblioteca.</span>
            </div>
        `;
    } else {
        const info = stageInfo[state.stage];

        phaseNumber.textContent = `FASE ${state.stage + 1} DE 10`;
        phaseTitle.textContent = info.title;
        phaseDescription.textContent = info.description;
        locationName.textContent = info.location;

        const missions = getMissions();
        const completed = missions.filter(item => item.done).length;
        const percent = missions.length ? (completed / missions.length) * 100 : 0;

        progressFill.style.width = `${percent}%`;

        missionList.innerHTML = missions.map(item => `
            <div class="mission-item ${item.done ? "done" : ""}">
                <span class="mission-check">${item.done ? "✓" : ""}</span>
                <span>${item.text}</span>
            </div>
        `).join("");
    }

    pointsValue.textContent = state.points;
    inventoryCount.textContent = state.inventory.length;

    if (state.inventory.length === 0) {
        inventoryList.innerHTML = `
            <div class="empty-inventory">
                <span>📦</span>
                <p>Sua mochila está vazia.</p>
                <small>Os objetos encontrados aparecerão aqui.</small>
            </div>
        `;
    } else {
        inventoryList.innerHTML = state.inventory.map(item => `
            <div class="inventory-item">
                <span>${item.icon}</span>
                <strong>${item.name}</strong>
            </div>
        `).join("");
    }
}

function setLog(text) {
    gameLog.textContent = text;
}

function showDialog(title, text, options = []) {
    state.dialogOpen = true;
    dialogTitle.textContent = title;
    dialogText.textContent = text;
    dialogOptions.innerHTML = "";

    if (options.length === 0) {
        const button = document.createElement("button");
        button.className = "dialog-option";
        button.textContent = "Entendi";
        button.addEventListener("click", closeDialog);
        dialogOptions.appendChild(button);
    } else {
        options.forEach(option => {
            const button = document.createElement("button");
            button.className = "dialog-option";
            button.textContent = option.label;
            button.addEventListener("click", option.action);
            dialogOptions.appendChild(button);
        });
    }

    dialogOverlay.classList.add("active");
}

function closeDialog() {
    dialogOverlay.classList.remove("active");
    state.dialogOpen = false;
}

dialogClose.addEventListener("click", closeDialog);

function transitionStage(nextStage, message) {
    state.stage = nextStage;
    state.player.x = 475;
    state.player.y = 535;
    state.points += 100;

    updateUI();
    setLog(`Nova fase desbloqueada: ${stageInfo[nextStage].title}.`);
    showDialog(`Fase ${nextStage + 1} desbloqueada!`, message);
}

function collectItem(flag, name, icon, message, points = 30) {
    if (state.flags[flag]) return;

    state.flags[flag] = true;
    state.inventory.push({ name, icon });
    state.points += points;

    updateUI();
    setLog(`Item encontrado: ${name}.`);
    showDialog("Objeto encontrado!", message);
}

function interactWith(entity) {
    if (entity.type === "false") {
        const messages = [
            "Você encontrou um objeto antigo, mas ele não tem relação com o livro desaparecido.",
            "Parece uma pista, mas é apenas algo esquecido na biblioteca. Continue investigando!",
            "Outra pista falsa! Observe os detalhes antes de tirar conclusões."
        ];

        state.falseClueCount++;
        showDialog(
            "Pista falsa",
            messages[Math.min(state.falseClueCount - 1, messages.length - 1)]
        );

        setLog("Você investigou um objeto que não fazia parte do mistério.");
        return;
    }

    switch (entity.id) {
        case "librarian":
            if (!state.started) {
                state.started = true;
                updateUI();

                showDialog(
                    "Bibliotecária",
                    "Ainda bem que você chegou! Um livro muito importante desapareceu da biblioteca. Antes de sumir, ele
