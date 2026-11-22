
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
                    "Ainda bem que você chegou! Um livro muito importante desapareceu da biblioteca. Antes de sumir, ele estava registrado no sistema de empréstimos. Encontrei três pistas espalhadas pelo local. Você pode investigar para mim?"
                );

                setLog("A investigação começou. Procure as três pistas.");
            } else if (allCluesFound()) {
                transitionStage(
                    1,
                    "Você reuniu todas as pistas! O bilhete e o registro indicam que alguém utilizou uma passagem escondida atrás de uma das estantes. Agora precisamos descobrir como entrar nela."
                );
            } else {
                showDialog(
                    "Bibliotecária",
                    "Ainda precisamos encontrar as três pistas. Observe as mesas e as estantes. Não deixe nenhum canto sem investigar!"
                );
            }
            break;

        case "clue_note":
            collectItem("clue_note", "Bilhete rasgado", "📜", "O bilhete diz: 'A resposta está onde os livros antigos descansam'. Parece uma mensagem importante.");
            break;

        case "clue_bookmark":
            collectItem("clue_bookmark", "Marca-página azul", "🔖", "O marca-página possui um símbolo desenhado: uma pequena estrela. Guarde essa informação!");
            break;

        case "clue_register":
            collectItem("clue_register", "Registro de empréstimo", "📋", "O registro mostra que o livro foi consultado pela última vez na área restrita da biblioteca.");
            break;

        case "old_key":
            collectItem("old_key", "Chave antiga", "🗝️", "Você encontrou uma chave antiga escondida. Ela parece combinar com a fechadura da passagem secreta.", 40);
            break;

        case "secret_door":
            if (state.flags.old_key) {
                showDialog(
                    "Passagem secreta",
                    "A chave se encaixa perfeitamente! A passagem está aberta. Você encontrou uma sala escondida atrás das estantes.",
                    [{
                        label: "Entrar na sala secreta",
                        action: () => {
                            closeDialog();
                            transitionStage(2, "A sala secreta guarda documentos esquecidos. Um arquivista está aqui e talvez saiba algo sobre o livro desaparecido.");
                        }
                    }]
                );
            } else {
                showDialog("Passagem secreta", "Você encontrou uma porta escondida! Ela está trancada. Parece que será necessária uma chave antiga para abri-la.");
            }
            break;

        case "archivist":
            if (!state.archiveStarted) {
                state.archiveStarted = true;
                updateUI();

                showDialog(
                    "Arquivista",
                    "Esta sala guarda documentos muito antigos. Algumas páginas foram arrancadas de um registro importante. Encontre as três páginas. Talvez elas revelem o caminho do livro."
                );

                setLog("O arquivista pediu ajuda para recuperar três páginas.");
            } else if (allPagesFound()) {
                transitionStage(3, "Muito bem! As páginas revelam que a próxima passagem só pode ser aberta com uma sequência de símbolos. Você precisará explorar os corredores e encontrar todos eles.");
            } else {
                showDialog("Arquivista", "Ainda faltam páginas do registro. Procure com atenção. Não podemos deixar esse documento incompleto!");
            }
            break;

        case "page_one":
            collectItem("page_one", "Página antiga 1", "📄", "A primeira página menciona o símbolo do sol.");
            break;

        case "page_two":
            collectItem("page_two", "Página antiga 2", "📄", "A segunda página fala sobre uma sequência de três símbolos.");
            break;

        case "page_three":
            collectItem("page_three", "Página antiga 3", "📄", "A última página confirma que a estrela fecha a sequência.");
            break;

        case "symbol_sun":
            collectItem("symbol_sun", "Símbolo do sol", "☀️", "Você encontrou o símbolo do sol. Ele parece fazer parte da sequência.");
            break;

        case "symbol_moon":
            collectItem("symbol_moon", "Símbolo da lua", "🌙", "O símbolo da lua foi encontrado. Lembre-se: ele vem depois do sol.");
            break;

        case "symbol_star":
            collectItem("symbol_star", "Símbolo da estrela", "⭐", "Você encontrou a estrela! Agora já tem os três símbolos.");
            break;

        case "panel":
            if (!allSymbolsFound()) {
                showDialog("Painel misterioso", "O painel possui três espaços vazios. Você precisa encontrar todos os símbolos antes de tentar ativá-lo.");
            } else {
                showDialog(
                    "Enigma dos símbolos",
                    "As páginas antigas dão uma pista: o sol vem primeiro, a lua aparece depois e a estrela encerra a sequência. Qual é a ordem correta?",
                    [
                        {
                            label: "☀ Sol → 🌙 Lua → ⭐ Estrela",
                            action: () => {
                                closeDialog();
                                transitionStage(4, "Sequência correta! O painel foi ativado e abriu uma nova passagem. Você está cada vez mais perto de descobrir o que aconteceu.");
                            }
                        },
                        {
                            label: "🌙 Lua → ☀ Sol → ⭐ Estrela",
                            action: () => {
                                closeDialog();
                                showDialog("Sequência incorreta", "O painel não aceitou essa ordem. Consulte novamente as páginas antigas e tente outra sequência.");
                            }
                        },
                        {
                            label: "⭐ Estrela → 🌙 Lua → ☀ Sol",
                            action: () => {
                                closeDialog();
                                showDialog("Sequência incorreta", "Essa não é a sequência indicada pelas páginas. Pense na pista sobre o primeiro e o último símbolo.");
                            }
                        }
                    ]
                );
            }
            break;

        case "old_librarian":
            if (!state.oldLibrarianTalked) {
                state.oldLibrarianTalked = true;
                updateUI();

                showDialog(
                    "Antigo bibliotecário",
                    "Eu trabalhei aqui há muitos anos. Lembro que existia um catálogo especial com informações sobre livros raros. Se você encontrar esse catálogo, talvez descubra onde o livro foi guardado."
                );

                setLog("O antigo bibliotecário mencionou um catálogo especial.");
            } else {
                showDialog("Antigo bibliotecário", "Procure o catálogo. Ele deve conter a informação que falta para resolver o mistério.");
            }
            break;

        case "catalog":
            if (!state.flags.catalog_checked) {
                state.flags.catalog_checked = true;
                state.inventory.push({ name: "Anotação do catálogo", icon: "📚" });
                state.points += 40;
                updateUI();

                showDialog(
                    "Catálogo antigo",
                    "Você encontrou uma anotação: 'Os livros mais importantes ficam guardados no armário da sala restrita. A identificação correta é o número 7.'"
                );

                setLog("A anotação revelou o número do armário.");
            }
            break;

        case "cabinet":
            showDialog(
                "Armário fechado",
                "O armário possui três identificações. Qual delas corresponde à anotação do catálogo?",
                [
                    {
                        label: "Armário número 3",
                        action: () => {
                            closeDialog();
                            showDialog("Não é esse!", "O número não corresponde ao que você encontrou no catálogo. Tente novamente.");
                        }
                    },
                    {
                        label: "Armário número 7",
                        action: () => {
                            closeDialog();
                            transitionStage(5, "Correto! O armário número 7 guarda registros que foram deixados de lado. Antes de chegar ao livro, você precisa descobrir o que aconteceu com ele.");
                        }
                    },
                    {
                        label: "Armário número 9",
                        action: () => {
                            closeDialog();
                            showDialog("Não é esse!", "O armário não corresponde à anotação. Lembre-se do número que você encontrou no catálogo.");
                        }
                    }
                ]
            );
            break;

        case "record_keeper":
            showDialog("Responsável pelo arquivo", "Os registros foram alterados antes do desaparecimento. Encontre os três documentos e confira a mesa de registros.");
            break;
        case "record_a":
            collectItem("record_a", "Registro de entrada", "📄", "O registro mostra que alguém entrou na área reservada depois do fechamento.");
            break;
        case "record_b":
            collectItem("record_b", "Ficha de consulta", "📋", "A ficha indica que o livro foi consultado por alguém que conhecia os arquivos antigos.");
            break;
        case "record_c":
            collectItem("record_c", "Anotação rasgada", "📜", "A anotação diz: 'A verdade foi dividida em três partes'.");
            break;
        case "record_desk":
            if (state.flags.record_a && state.flags.record_b && state.flags.record_c) {
                state.flags.records_checked = true;
                updateUI();
                showDialog("Registros conferidos", "Os documentos mostram que o livro não foi roubado. Alguém o escondeu para protegê-lo.", [{
                    label: "Continuar",
                    action: () => { closeDialog(); transitionStage(6, "Agora reúna os fragmentos de uma mensagem escondida."); }
                }]);
            } else showDialog("Mesa de registros", "Ainda faltam documentos. Encontre os três registros antes de conferir a mesa.");
            break;
        case "message_keeper":
            showDialog("Guardião dos documentos", "Encontrei partes de uma mensagem espalhadas pela sala. Reúna os três fragmentos e monte a mensagem no quadro.");
            break;
        case "message_a":
            collectItem("message_a", "Fragmento 1", "🧩", "O fragmento diz: 'Não procure nas estantes...'");
            break;
        case "message_b":
            collectItem("message_b", "Fragmento 2", "🧩", "O segundo fragmento diz: '...procure onde a história...'");
            break;
        case "message_c":
            collectItem("message_c", "Fragmento 3", "🧩", "O último fragmento diz: '...fica guardada'.");
            break;
        case "message_board":
            if (state.flags.message_a && state.flags.message_b && state.flags.message_c) {
                state.flags.message_decoded = true;
                updateUI();
                transitionStage(7, "A mensagem completa é: 'Não procure nas estantes, procure onde a história fica guardada'. A próxima sala guarda uma combinação.");
            } else showDialog("Quadro de mensagens", "Você precisa encontrar os três fragmentos para reconstruir a mensagem.");
            break;
        case "code_keeper":
            showDialog("Catalogadora", "O código foi dividido em duas anotações. Uma revela o primeiro número e a outra revela o último. Encontre as duas.");
            break;
        case "code_hint_a":
            collectItem("code_hint_a", "Dica do código: primeiro número", "🔢", "A anotação revela que o primeiro número é 2.");
            break;
        case "code_hint_b":
            collectItem("code_hint_b", "Dica do código: último número", "🔢", "A anotação revela que o último número é 8.");
            break;
        case "final_panel":
            if (state.flags.code_hint_a && state.flags.code_hint_b) {
                showDialog("Painel de combinação", "As anotações revelam o início e o fim do código. Qual combinação abre o arquivo?", [
                    { label: "2 - 5 - 8", action: () => { closeDialog(); state.flags.code_solved = true; transitionStage(8, "Código correto! O arquivo foi aberto. Agora descubra quem escondeu o livro e por quê."); } },
                    { label: "2 - 8 - 5", action: () => { closeDialog(); showDialog("Código incorreto", "A ordem dos números não está correta. Pense nas duas anotações."); } },
                    { label: "8 - 5 - 2", action: () => { closeDialog(); showDialog("Código incorreto", "O código não corresponde às pistas encontradas."); } }
                ]);
            } else showDialog("Painel bloqueado", "Encontre as duas anotações antes de tentar o código.");
            break;
        case "witness":
            state.flags.witness_talked = true;
            updateUI();
            showDialog("Antiga funcionária", "Eu escondi o livro para protegê-lo de uma restauração malfeita. Deixei provas para que alguém descobrisse a verdade. Encontre os três documentos.");
            break;
        case "evidence_a":
            collectItem("evidence_a", "Relatório antigo", "📄", "O relatório confirma que o livro estava danificado e precisava de cuidados.");
            break;
        case "evidence_b":
            collectItem("evidence_b", "Carta guardada", "✉️", "A carta revela que a antiga funcionária queria impedir que o livro fosse descartado.");
            break;
        case "evidence_c":
            collectItem("evidence_c", "Página do diário", "📖", "O diário diz que o livro foi levado para uma câmara protegida.");
            break;
        case "evidence_box":
            if (state.flags.witness_talked && state.flags.evidence_a && state.flags.evidence_b && state.flags.evidence_c) {
                state.flags.evidence_opened = true;
                updateUI();
                showDialog("Caixa aberta", "As provas confirmam a história da antiga funcionária. O livro foi protegido, não roubado. A câmara de leitura está aberta.", [{
                    label: "Ir para a câmara",
                    action: () => { closeDialog(); transitionStage(9, "Você descobriu a verdade. Agora encontre o livro e veja o que foi escondido dentro dele."); }
                }]);
            } else showDialog("Caixa de documentos", "Converse com a antiga funcionária e reúna as três provas antes de abrir a caixa.");
            break;
        case "book_message":
            state.finalMessageRead = true;
            updateUI();
            showDialog("A mensagem escondida", "Dentro da capa há uma carta: 'Este livro guarda a memória de muitas pessoas. Protegi-o para que sua história nunca fosse esquecida. Obrigada por descobrir a verdade e trazê-lo de volta.' Agora volte à bibliotecária.");
            setLog("Você descobriu a verdadeira razão do desaparecimento.");
            break;
        case "lost_book":
            if (!state.bookFound) {
                state.bookFound = true;
                state.inventory.push({ name: "Livro perdido", icon: "📕" });
                state.points += 100;
                updateUI();

                showDialog(
                    "Livro encontrado!",
                    "Você encontrou o livro! Mas há um envelope escondido entre as páginas. A descoberta ainda não terminou: investigue a mensagem que está dentro dele."
                );

                setLog("O livro perdido foi encontrado!");
            }
            break;

        case "final_librarian":
            if (state.bookFound && state.finalMessageRead) {
                state.finished = true;
                state.stage = 10;
                state.points += 150;
                updateUI();
                setLog("Investigação concluída! A verdade sobre o livro foi revelada.");
                const ending = state.falseClueCount === 0
                    ? "Você investigou com cuidado, encontrou a verdade e recuperou o livro sem se deixar levar por pistas falsas. A bibliotecária agradece: a história do livro será preservada."
                    : "Você recuperou o livro e descobriu a verdade. Algumas pistas falsas atrasaram sua investigação, mas sua persistência permitiu concluir o caso.";
                showDialog("O mistério finalmente resolvido!", ending, [{
                    label: "Jogar novamente",
                    action: () => { closeDialog(); resetGame(); }
                }]);
            } else if (!state.bookFound) {
                showDialog("Bibliotecária", "Encontre o livro desaparecido e descubra o que há dentro dele.");
            } else {
                showDialog("Bibliotecária", "Ainda falta ler a mensagem escondida. Investigue o envelope antes de concluir.");
            }
            break;
    }

    updateUI();
}

function getNearestEntity() {
    const entities = entitiesForStage();
    let nearest = null;
    let smallestDistance = 48;

    for (const entity of entities) {
        const distance = Math.hypot(
            state.player.x - entity.x,
            state.player.y - entity.y
        );

        if (distance < smallestDistance) {
            smallestDistance = distance;
            nearest = entity;
        }
    }

    return nearest;
}

function interact() {
    if (state.dialogOpen) return;

    const entity = getNearestEntity();

    if (!entity) {
        showDialog("Nada por aqui", "Não há nada para interagir neste local. Explore um pouco mais a biblioteca.");
        return;
    }

    interactWith(entity);
}

document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
    }

    keys[key] = true;

    if (key === "e" && !event.repeat) {
        interact();
    }
});

document.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});

// Os controles de toque reutilizam as mesmas teclas do movimento por teclado.
const touchControls = document.getElementById("touchControls");
if (touchControls) {
    touchControls.querySelectorAll("[data-move]").forEach(button => {
        const key = button.dataset.move;
        const press = event => {
            event.preventDefault();
            keys[key] = true;
            button.classList.add("pressed");
            if (button.setPointerCapture && event.pointerId !== undefined) {
                try { button.setPointerCapture(event.pointerId); } catch (_) {}
            }
        };
        const release = event => {
            if (event) event.preventDefault();
            keys[key] = false;
            button.classList.remove("pressed");
        };
        button.addEventListener("pointerdown", press);
        ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"].forEach(type => button.addEventListener(type, release));
        button.addEventListener("contextmenu", event => event.preventDefault());
    });
    touchControls.querySelector("[data-interact]")?.addEventListener("click", event => {
        event.preventDefault();
        interact();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) touchControls.querySelectorAll("[data-move]").forEach(button => {
            keys[button.dataset.move] = false;
            button.classList.remove("pressed");
        });
    });
}

function isBlocked(x, y) {
    const radius = 12;

    if (
        x < 35 + radius ||
        x > 925 - radius ||
        y < 75 + radius ||
        y > 565 - radius
    ) {
        return true;
    }

    return obstacles.some(obstacle => (
        x + radius > obstacle.x &&
        x - radius < obstacle.x + obstacle.w &&
        y + radius > obstacle.y &&
        y - radius < obstacle.y + obstacle.h
    ));
}

function update(dt) {
    if (state.dialogOpen || state.stage >= 10) return;

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy -= 1;
        state.player.direction = "up";
    }

    if (keys["s"] || keys["arrowdown"]) {
        dy += 1;
        state.player.direction = "down";
    }

    if (keys["a"] || keys["arrowleft"]) {
        dx -= 1;
        state.player.direction = "left";
    }

    if (keys["d"] || keys["arrowright"]) {
        dx += 1;
        state.player.direction = "right";
    }

    if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
    }

    const nextX = state.player.x + dx * state.player.speed * dt;
    const nextY = state.player.y + dy * state.player.speed * dt;

    if (!isBlocked(nextX, state.player.y)) {
        state.player.x = nextX;
    }

    if (!isBlocked(state.player.x, nextY)) {
        state.player.y = nextY;
    }

    const nearby = getNearestEntity();

    if (nearby) {
        interactionHint.innerHTML = `
            <span class="hint-key">E</span>
            <span>Pressione E para interagir com <strong>${nearby.name}</strong>.</span>
        `;
    } else {
        interactionHint.innerHTML = `
            <span class="hint-key">E</span>
            <span>Explore a biblioteca e procure objetos para investigar.</span>
        `;
    }
}

// =====================================================
// NOVO VISUAL: BIBLIOTECA RPG PIXEL ART
// =====================================================

const colors = {
    wall: "#e8d4ad",
    wallLight: "#f5e8cb",
    wallShadow: "#b98d69",
    wood: "#70432f",
    woodDark: "#422b2b",
    woodLight: "#b77b4d",
    gold: "#e5bd75",
    goldLight: "#ffe2a3",
    burgundy: "#793b4b",
    burgundyDark: "#492638",
    floor: "#9a694b",
    floorLight: "#bd8960",
    floorDark: "#704735",
    green: "#527b55"
};

function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function shadow(x, y, w, h, alpha = 0.25) {
    ctx.fillStyle = `rgba(38, 23, 24, ${alpha})`;
    ctx.fillRect(x, y, w, h);
}

function drawFloor() {
    // Base de madeira
    rect(0, 0, 960, 600, "#8c5d43");

    // Tábuas do piso
    for (let row = 0; row < 15; row++) {
        const y = row * 40;
        const offset = row % 2 ? -38 : 0;

        for (let col = -1; col < 16; col++) {
            const x = col * 76 + offset;
            const variation = (row * 7 + col * 3) % 4;

            const tones = [
                "#a87552",
                "#b78059",
                "#956346",
                "#ad7955"
            ];

            rect(x + 1, y + 1, 74, 38, tones[variation]);
            rect(x + 4, y + 5, 42, 2, "rgba(255,225,180,0.13)");
            rect(x + 1, y + 36, 74, 3, "rgba(48,28,25,0.22)");
            rect(x + 22, y + 18, 18, 2, "rgba(55,31,27,0.12)");
        }
    }

    // Paredes externas
    rect(0, 0, 960, 60, "#583744");
    rect(0, 0, 28, 600, "#583744");
    rect(932, 0, 28, 600, "#583744");
    rect(0, 575, 960, 25, "#583744");

    // Painéis da parede
    rect(28, 60, 904, 12, "#8b5b4b");
    rect(28, 72, 904, 5, "#e3bd8a");

    for (let x = 42; x < 920; x += 72) {
        rect(x, 15, 43, 4, "#a97962");
        rect(x + 4, 24, 35, 2, "rgba(255,220,180,0.18)");
    }

    // Rodapé
    rect(28, 560, 904, 12, "#654039");
    rect(28, 560, 904, 3, "#d3a36f");
    rect(28, 568, 904, 3, "#422c2d");

    // Colunas decorativas
    for (const x of [35, 918]) {
        rect(x, 72, 8, 486, "#704b43");
        rect(x + 2, 72, 3, 486, "#c08d67");
        rect(x - 3, 72, 14, 7, "#e2bd86");
        rect(x - 3, 552, 14, 8, "#e2bd86");
    }

    // Tapete central
    drawRug();

    // Iluminação geral
    const light = ctx.createRadialGradient(480, 280, 70, 480, 280, 520);
    light.addColorStop(0, "rgba(255,231,183,0.10)");
    light.addColorStop(1, "rgba(42,22,30,0.24)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 960, 600);

    drawWindows();
}

function drawWindows() {
    for (const x of [75, 430, 785]) {
        // Luz projetada no chão
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = "#fff0c5";
        ctx.beginPath();
        ctx.moveTo(x + 10, 120);
        ctx.lineTo(x + 87, 120);
        ctx.lineTo(x + 155, 290);
        ctx.lineTo(x - 55, 290);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Sombra
        shadow(x - 7, 70, 108, 60, 0.35);

        // Moldura externa
        rect(x - 5, 65, 105, 59, "#422b2c");
        rect(x - 2, 68, 99, 53, "#b47b53");
        rect(x + 2, 72, 91, 45, "#f0d3a1");

        // Vidro
        rect(x + 6, 76, 83, 37, "#83b6b6");
        rect(x + 9, 79, 77, 31, "#b9d6c8");

        // Reflexos
        rect(x + 13, 82, 27, 3, "#f9f1d5");
        rect(x + 13, 88, 16, 2, "#e9eee0");
        rect(x + 56, 82, 20, 2, "rgba(255,255,255,0.55)");

        // Divisórias
        rect(x + 44, 76, 5, 37, "#81543d");
        rect(x + 6, 93, 83, 4, "#81543d");

        // Peitoril
        rect(x - 8, 118, 110, 8, "#754735");
        rect(x - 5, 117, 104, 4, "#e5b77c");
        rect(x - 1, 124, 96, 3, "#4a302e");
    }
}

function drawRug() {
    shadow(365, 355, 230, 50, 0.28);

    // Tapete
    rect(385, 345, 190, 48, "#53303b");
    rect(390, 349, 180, 39, "#d5a86d");
    rect(396, 354, 168, 29, "#8b4655");

    // Ornamentos
    rect(403, 359, 154, 3, "#f0d6a4");
    rect(403, 375, 154, 3, "#f0d6a4");

    for (let x = 408; x < 550; x += 14) {
        rect(x, 364, 5, 8, "#e7bd7e");
        rect(x + 1, 366, 3, 4, "#79404d");
    }

    rect(385, 345, 190, 3, "#f1d4a0");
    rect(385, 390, 190, 3, "#f1d4a0");

    // Franjas
    for (let x = 392; x < 570; x += 12) {
        rect(x, 393, 4, 4, "#e3bd86");
    }
}

function drawShelf(x, y, w, h) {
    // Sombra projetada
    shadow(x + 7, y + 9, w, h + 4, 0.36);

    // Estrutura externa
    rect(x - 5, y - 5, w + 10, h + 12, "#3d2928");
    rect(x - 2, y - 3, w + 4, h + 7, "#9a6344");
    rect(x + 3, y + 2, w - 6, h - 2, "#54343a");

    // Fundo de madeira
    rect(x + 7, y + 6, w - 14, h - 13, "#75483d");

    // Prateleira superior
    rect(x - 5, y - 5, w + 10, 7, "#d3a06a");
    rect(x - 3, y - 3, w + 6, 3, "#f0c58a");

    const bookColors = [
        "#b94f58", "#e1b45f", "#477f78", "#5c6f9d",
        "#8e557d", "#c47a4d", "#4f8790", "#d17a7c",
        "#71445b", "#e0c38c", "#55734d"
    ];

    let position = x + 10;
    let index = 0;

    while (position < x + w - 10) {
        const bookWidth = 9 + (index % 3) * 3;
        const bookHeight = 22 + (index % 4) * 2;
        const bookY = y + 10 + (25 - bookHeight);

        // Sombra do livro
        rect(position + 2, bookY + 2, bookWidth, bookHeight, "#34252b");

        // Capa
        rect(position, bookY, bookWidth, bookHeight, bookColors[index % bookColors.length]);

        // Lombada
        rect(position + 2, bookY + 2, 2, bookHeight - 5, "rgba(255,235,190,0.45)");
        rect(position + bookWidth - 2, bookY + 2, 2, bookHeight - 4, "rgba(35,20,25,0.25)");

        // Detalhes dourados
        rect(position + 2, bookY + bookHeight - 6, Math.max(4, bookWidth - 4), 2, "#e8c88c");
        rect(position + 2, bookY + 4, Math.max(3, bookWidth - 4), 2, "rgba(255,225,180,0.35)");

        position += bookWidth + 3;
        index++;
    }

    // Prateleira inferior e acabamento
    rect(x - 6, y + h - 8, w + 12, 11, "#4a2c2c");
    rect(x - 5, y + h - 8, w + 10, 4, "#d29b62");
    rect(x - 3, y + h - 4, w + 6, 3, "#754333");

    // Suportes laterais
    rect(x + 5, y + 3, 4, h - 8, "#c18a58");
    rect(x + w - 9, y + 3, 4, h - 8, "#c18a58");
}

function drawDesk(x, y, w, h) {
    // Sombra
    shadow(x + 7, y + 9, w, h, 0.35);

    // Pernas
    rect(x + 13, y + 20, 13, h - 16, "#55352f");
    rect(x + w - 27, y + 20, 13, h - 16, "#55352f");
    rect(x + 15, y + 22, 4, h - 20, "#b17a4f");
    rect(x + w - 25, y + 22, 4, h - 20, "#b17a4f");

    // Corpo da mesa
    rect(x + 5, y + 14, w - 10, h - 9, "#5b3730");

    // Tampo
    rect(x - 3, y - 3, w + 6, 24, "#734431");
    rect(x, y, w, 17, "#bd8555");
    rect(x + 5, y + 3, w - 10, 10, "#d3a16b");

    // Brilho
    rect(x + 9, y + 4, w - 28, 2, "rgba(255,235,190,0.45)");

    // Papéis
    rect(x + 39, y + 4, 40, 12, "#f4e5c5");
    rect(x + 42, y + 6, 16, 8, "#b85d67");
    rect(x + 61, y + 7, 14, 2, "#b58a60");

    // Livro pequeno
    rect(x + 104, y + 3, 18, 12, "#754052");
    rect(x + 107, y + 5, 12, 8, "#d6ad72");
    rect(x + 110, y + 6, 5, 5, "#f1e0b9");

    // Gaveta
    rect(x + 53, y + 25, 45, 13, "#704333");
    rect(x + 71, y + 29, 7, 3, "#e4bb78");
}

function drawPlant(x, y) {
    // Sombra
    ctx.fillStyle = "rgba(35,20,20,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Vaso
    rect(x - 16, y - 3, 32, 23, "#8d4c43");
    rect(x - 13, y, 26, 15, "#b96f53");
    rect(x - 17, y - 5, 34, 6, "#e1ae74");
    rect(x - 11, y + 15, 22, 3, "#75403c");

    // Terra
    rect(x - 11, y - 5, 22, 4, "#45302a");

    // Folhas
    rect(x - 4, y - 25, 8, 23, "#356b49");
    rect(x - 19, y - 18, 17, 12, "#3e8052");
    rect(x + 3, y - 21, 17, 12, "#477e50");
    rect(x - 14, y - 32, 13, 13, "#4b8c59");
    rect(x + 2, y - 35, 13, 15, "#39734b");
    rect(x - 2, y - 43, 8, 15, "#5c985d");

    // Luz nas folhas
    rect(x - 11, y - 28, 5, 5, "#8ab66b");
    rect(x + 6, y - 32, 5, 5, "#83b16b");
    rect(x - 16, y - 15, 6, 4, "#7cae68");
    rect(x + 9, y - 18, 5, 4, "#85b66d");
}

function drawRoomFurniture() {
    // As posições originais dos móveis permanecem iguais.
    drawShelf(250, 130, 170, 52);
    drawShelf(510, 130, 160, 52);
    drawShelf(760, 130, 145, 52);

    drawShelf(250, 420, 170, 52);
    drawShelf(510, 420, 160, 52);
    drawShelf(760, 420, 145, 52);

    drawDesk(65, 260, 150, 72);

    drawPlant(70, 520);
    drawPlant(870, 520);

    // Mesa central
    shadow(428, 286, 111, 68, 0.34);
    rect(438, 285, 90, 62, "#53342f");
    rect(445, 291, 8, 50, "#a66c47");
    rect(514, 291, 8, 50, "#a66c47");

    // Tampo
    rect(425, 273, 115, 15, "#754630");
    rect(430, 275, 105, 8, "#d19a61");
    rect(435, 277, 95, 3, "#e9bd7e");

    // Livro sobre a mesa
    rect(444, 287, 36, 8, "#f0dfbd");
    rect(444, 287, 36, 3, "#a64b5e");
    rect(488, 286, 29, 22, "#a84b5d");
    rect(493, 290, 19, 14, "#f0d5a5");
    rect(496, 293, 13, 2, "#9b6b4d");
    rect(496, 298, 10, 2, "#9b6b4d");

    drawDoorDecoration();
}

function drawDoorDecoration() {
    // Brilho da passagem
    if (state.stage >= 1) {
        const glow = ctx.createRadialGradient(895, 300, 5, 895, 300, 75);
        glow.addColorStop(0, "rgba(255,215,130,0.35)");
        glow.addColorStop(1, "rgba(255,215,130,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(820, 220, 140, 170);
    }

    shadow(879, 252, 47, 113, 0.35);

    // Moldura
    rect(870, 242, 57, 119, "#4a2d2d");
    rect(874, 246, 49, 111, "#d0a06b");
    rect(879, 251, 39, 102, "#654034");

    // Porta
    rect(883, 254, 31, 96, "#89543e");
    rect(887, 258, 23, 88, "#a96d4a");
    rect(890, 262, 3, 80, "rgba(255,225,180,0.25)");

    // Painel decorativo
    rect(889, 266, 19, 34, "#774338");
    rect(892, 269, 13, 28, "#bd8255");
    rect(889, 309, 19, 31, "#774338");
    rect(892, 312, 13, 25, "#bd8255");

    // Maçaneta
    rect(903, 303, 5, 7, "#f1d18a");
    rect(904, 305, 2, 3, "#fff0b8");

    // Topo da moldura
    rect(867, 239, 63, 7, "#e0b477");
    rect(871, 246, 55, 3, "#704333");
}

// =====================================================
// PERSONAGENS COM MAIS DETALHES
// =====================================================

function drawCharacter(x, y, kind = "player", direction = "down") {
    const isPlayer = kind === "player";
    const isOld = kind === "oldnpc";
    const isArchivist = kind === "archivist";

    const moving = isPlayer && (
        keys["w"] || keys["a"] || keys["s"] || keys["d"] ||
        keys["arrowup"] || keys["arrowdown"] ||
        keys["arrowleft"] || keys["arrowright"]
    );

    const walk = moving ? Math.sin(state.elapsed * 13) : 0;
    const bob = moving ? Math.abs(walk) * 2 : Math.sin(state.elapsed * 2) * 0.5;
    const legMove = moving ? Math.round(walk * 3) : 0;

    const top = y - 43 + bob;
    const bodyY = y - 23 + bob;

    const coat = isPlayer
        ? "#853d54"
        : isOld
            ? "#66536e"
            : isArchivist
                ? "#376b63"
                : "#a14d61";

    const coatLight = isPlayer
        ? "#c96d7d"
        : isOld
            ? "#9b8aa2"
            : isArchivist
                ? "#6c9c84"
                : "#d17a82";

    const hair = isOld ? "#d5d0bd" : isArchivist ? "#30252d" : "#432a32";
    const skin = isOld ? "#d6a889" : "#efbd98";
    const pants = isPlayer ? "#493847" : "#51404a";

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Sombra no chão
    ctx.fillStyle = "rgba(35,20,25,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mochila
    if (isPlayer) {
        rect(x - 16, bodyY + 2, 7, 16, "#573344");
        rect(x - 15, bodyY + 4, 5, 11, "#a84e66");
        rect(x - 14, bodyY + 7, 3, 3, "#e9c27d");
    }

    // Pernas
    rect(x - 9, y - 8 + bob + legMove, 7, 13, pants);
    rect(x + 2, y - 8 + bob - legMove, 7, 13, pants);

    // Botas
    rect(x - 11, y + 3 + bob + legMove, 10, 6, "#352832");
    rect(x + 1, y + 3 + bob - legMove, 10, 6, "#352832");
    rect(x - 9, y + 4 + bob + legMove, 5, 2, "#d2a66e");
    rect(x + 3, y + 4 + bob - legMove, 5, 2, "#d2a66e");

    // Corpo e roupa
    rect(x - 15, bodyY, 30, 24, "#422b35");
    rect(x - 13, bodyY, 26, 21, coat);
    rect(x - 9, bodyY + 2, 18, 16, coatLight);

    // Casaco aberto
    rect(x - 3, bodyY + 2, 6, 18, "#f0d5b0");
    rect(x - 1, bodyY + 2, 2, 18, "#a55b5d");

    // Mangas
    rect(x - 18, bodyY + 3, 6, 14, coat);
    rect(x + 12, bodyY + 3, 6, 14, coat);
    rect(x - 18, bodyY + 15, 6, 5, skin);
    rect(x + 12, bodyY + 15, 6, 5, skin);

    // Detalhes da roupa
    rect(x - 8, bodyY + 4, 3, 12, "rgba(255,235,205,0.35)");
    rect(x + 5, bodyY + 4, 3, 12, "rgba(40,20,25,0.20)");
    rect(x - 1, bodyY + 6, 3, 3, "#e9c27c");
    rect(x - 1, bodyY + 13, 3, 3, "#e9c27c");

    // Pescoço
    rect(x - 4, top + 16, 8, 7, skin);

    // Orelhas
    rect(x - 11, top + 9, 3, 6, skin);
    rect(x + 8, top + 9, 3, 6, skin);

    // Rosto
    rect(x - 9, top + 4, 18, 17, skin);
    rect(x - 7, top + 7, 14, 12, "#f3c6a1");

    // Cabelo
    rect(x - 10, top, 20, 9, hair);
    rect(x - 10, top + 5, 4, 11, hair);
    rect(x + 6, top + 5, 4, 11, hair);
    rect(x - 7, top - 2, 14, 4, hair);

    if (isPlayer) {
        // Cabelo do personagem principal
        rect(x - 9, top + 1, 5, 7, "#34242e");
        rect(x + 2, top - 3, 7, 6, "#34242e");
        rect(x + 7, top + 2, 4, 8, "#34242e");

        // Acessório
        rect(x + 7, top + 4, 4, 4, "#e9bd73");
        rect(x + 8, top + 5, 2, 2, "#fff0bd");

        // Emblema
        rect(x + 5, bodyY + 3, 4, 4, "#f4d28b");
    } else if (isOld) {
        // Cabelo grisalho
        rect(x - 8, top + 1, 6, 4, "#eee5d1");
        rect(x + 2, top + 1, 6, 4, "#eee5d1");
        rect(x - 11, top + 7, 3, 7, "#c5c1b5");
        rect(x + 8, top + 7, 3, 7, "#c5c1b5");

        // Barba
        rect(x - 5, top + 16, 10, 4, "#d8d0c1");
        rect(x - 3, top + 19, 6, 3, "#c4bcad");
    } else if (isArchivist) {
        // Óculos
        rect(x - 9, top + 8, 7, 5, "#d6b26f");
        rect(x + 2, top + 8, 7, 5, "#d6b26f");
        rect(x - 2, top + 9, 4, 2, "#d6b26f");
        rect(x - 7, top + 9, 3, 2, "#6e8790");
        rect(x + 4, top + 9, 3, 2, "#6e8790");

        // Crachá
        rect(x + 8, bodyY + 4, 5, 7, "#e3c17e");
    } else {
        // Presilha da bibliotecária
        rect(x + 6, top + 2, 5, 5, "#e9bd73");
        rect(x + 7, top + 3, 3, 3, "#fff0bd");
    }

    // Olhos e expressão
    if (direction !== "up") {
        rect(x - 5, top + 11, 3, 3, "#38252b");
        rect(x + 3, top + 11, 3, 3, "#38252b");
        rect(x - 1, top + 16, 3, 2, "#a65d59");
    }

    // Contorno inferior
    rect(x - 13, bodyY + 20, 26, 2, "rgba(35,20,25,0.35)");

    ctx.restore();
}

// =====================================================
// OBJETOS E PISTAS
// =====================================================

function drawEntity(entity) {
    const x = entity.x;
    const y = entity.y;
    const playerDistance = Math.hypot(state.player.x - x, state.player.y - y);

    if (entity.hidden && playerDistance > 105) return;

    ctx.save();

    if (entity.hidden && playerDistance > 58) {
        ctx.globalAlpha = 0.34;
    }

    // Personagens
    if (["npc", "archivist", "oldnpc"].includes(entity.type)) {
        drawCharacter(x, y, entity.type);

        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";

        const labelWidth = ctx.measureText(entity.name).width + 18;

        rect(x - labelWidth / 2, y - 69, labelWidth, 19, "#4a2c35");
        rect(x - labelWidth / 2, y - 69, labelWidth, 3, "#e5bd75");
        rect(x - labelWidth / 2 + 3, y - 51, labelWidth - 6, 1, "#a66b55");

        ctx.fillStyle = "#fff0d2";
        ctx.fillText(entity.name, x, y - 56);

        ctx.restore();
        return;
    }

    // Brilho dos objetos
    const pulse = Math.sin(state.elapsed * 3) * 3;

    ctx.fillStyle = "rgba(255,220,145,0.24)";
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 21 + pulse, 10 + pulse / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pistas falsas
    if (entity.type === "false") {
        if (entity.id === "false_ticket") {
            rect(x - 14, y - 16, 28, 31, "#a87551");
            rect(x - 11, y - 13, 22, 25, "#f0dfbd");
            rect(x - 8, y - 10, 16, 2, "#b58b61");
            rect(x - 8, y - 5, 15, 2, "#b58b61");
            rect(x - 8, y, 12, 2, "#b58b61");
            rect(x - 8, y + 5, 15, 2, "#b58b61");
            rect(x - 3, y - 11, 6, 2, "#d1a45e");
        } else if (entity.id === "false_box") {
            rect(x - 15, y - 13, 30, 27, "#553b3b");
            rect(x - 12, y - 10, 24, 21, "#a56b49");
            rect(x - 10, y - 8, 20, 3, "#d3a66d");
            rect(x - 3, y - 10, 6, 21, "#70452f");
            rect(x - 3, y - 2, 6, 6, "#e8c27c");
        } else if (entity.id === "false_folder") {
            rect(x - 15, y - 12, 30, 25, "#80543c");
            rect(x - 12, y - 9, 24, 19, "#c39a62");
            rect(x - 8, y - 6, 16, 13, "#f0dfbd");
            rect(x - 7, y - 3, 13, 2, "#a56b45");
            rect(x - 7, y + 1, 10, 2, "#a56b45");
        } else {
            rect(x - 18, y - 18, 36, 36, "#493144");
            ctx.strokeStyle = "#e9c477";
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 15, y - 15, 30, 30);
            ctx.fillStyle = "#ffdf91";
            ctx.font = "25px serif";
            ctx.textAlign = "center";
            ctx.fillText("✧", x, y + 9);
        }

        if (playerDistance < 58) {
            ctx.fillStyle = "#fff1d0";
            ctx.font = "bold 10px monospace";
            ctx.textAlign = "center";
            ctx.fillText(entity.name, x, y - 31);
        }

        ctx.restore();
        return;
    }

    // Papéis e catálogo
    if (entity.type === "paper" || entity.type === "catalog") {
        rect(x - 13, y - 13, 26, 29, "#986548");
        rect(x - 10, y - 11, 20, 24, "#f4e5c7");
        rect(x - 7, y - 6, 14, 2, "#b58b61");
        rect(x - 7, y - 1, 11, 2, "#b58b61");
        rect(x - 7, y + 4, 14, 2, "#b58b61");
        rect(x + 4, y - 11, 5, 5, "#d3ad75");
    }

    // Marca-página
    if (entity.type === "bookmark") {
        rect(x - 9, y - 17, 18, 32, "#3f6d92");
        rect(x - 5, y - 13, 10, 20, "#7fb7c2");
        rect(x - 9, y + 15, 18, 4, "#3f6d92");

        ctx.fillStyle = "#e7c47b";
        ctx.beginPath();
        ctx.moveTo(x - 9, y + 15);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x + 9, y + 15);
        ctx.fill();

        rect(x - 2, y - 8, 4, 4, "#f4df9b");
    }

    // Chave
    if (entity.type === "key") {
        ctx.fillStyle = "#e9c16a";
        ctx.beginPath();
        ctx.arc(x - 5, y - 4, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#65483a";
        ctx.beginPath();
        ctx.arc(x - 5, y - 4, 4, 0, Math.PI * 2);
        ctx.fill();

        rect(x + 2, y - 2, 19, 6, "#e9c16a");
        rect(x + 13, y + 2, 5, 7, "#e9c16a");
        rect(x + 18, y + 2, 4, 5, "#e9c16a");
        rect(x + 3, y - 1, 16, 2, "#fff0b5");
    }

    // Símbolos
    if (entity.type === "symbol") {
        rect(x - 19, y - 19, 38, 38, "#513545");
        rect(x - 15, y - 15, 30, 30, "#8a5b50");

        ctx.strokeStyle = "#f0ce88";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 15, y - 15, 30, 30);

        ctx.fillStyle = "#ffe3a0";
        ctx.font = "25px serif";
        ctx.textAlign = "center";
        ctx.fillText(entity.symbol, x, y + 9);
    }

    // Porta secreta
    if (entity.type === "door") {
        rect(x - 21, y - 46, 42, 59, "#3d2930");
        rect(x - 16, y - 41, 32, 54, "#986044");
        rect(x - 12, y - 36, 24, 44, "#b27a50");
        rect(x - 8, y - 31, 16, 34, "#77423d");
        rect(x + 7, y - 17, 4, 6, "#f0d18e");

        ctx.fillStyle = "#f0dcae";
        ctx.font = "bold 17px monospace";
        ctx.textAlign = "center";
        ctx.fillText("?", x, y - 17);
    }

    // Painel
    if (entity.type === "panel") {
        rect(x - 27, y - 26, 54, 41, "#4a3040");
        rect(x - 22, y - 21, 44, 31, "#b27c67");
        rect(x - 18, y - 17, 36, 23, "#573a4b");

        for (let i = 0; i < 3; i++) {
            rect(x - 15 + i * 11, y - 14, 8, 17, "#352b3b");
            rect(x - 13 + i * 11, y - 12, 4, 3, "#e9c477");
        }

        rect(x - 5, y - 23, 10, 2, "#f0d18e");
    }

    // Armário
    if (entity.type === "cabinet") {
        rect(x - 22, y - 31, 44, 45, "#49303a");
        rect(x - 18, y - 27, 36, 37, "#986144");
        rect(x - 14, y - 23, 28, 29, "#b67a4f");
        rect(x - 2, y - 10, 5, 7, "#e5bd75");
        rect(x - 12, y - 20, 24, 2, "#e3b57b");

        ctx.fillStyle = "#f5d58b";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText("7", x, y - 33);
    }

    // Livro perdido
    if (entity.type === "book") {
        shadow(x - 17, y - 17, 34, 34, 0.3);
        rect(x - 17, y - 20, 34, 36, "#59303a");
        rect(x - 14, y - 22, 28, 36, "#a94455");
        rect(x - 10, y - 17, 20, 26, "#e7bd76");
        rect(x - 4, y - 22, 5, 36, "#703849");
        rect(x - 7, y - 8, 14, 2, "#fff0c4");
        rect(x - 6, y - 13, 12, 2, "#fff0c4");
        rect(x - 2, y - 4, 4, 4, "#a34d57");
    }

    if (!entity.hidden || playerDistance < 58) {
        ctx.fillStyle = "#fff1d0";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(entity.name, x, y - 31);
    }

    ctx.restore();
}

function drawInteractionMarker(entity) {
    if (!entity) return;

    const float = Math.sin(state.elapsed * 5) * 3;

    ctx.fillStyle = "#fff0b3";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";

    ctx.fillText("E", entity.x, entity.y - 65 + float);

    ctx.fillStyle = "rgba(255,220,140,0.45)";
    ctx.fillRect(entity.x - 11, entity.y - 60 + float, 22, 3);
}

// =====================================================
// DESENHO PRINCIPAL
// =====================================================

function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawFloor();
    drawRoomFurniture();

    const entities = entitiesForStage();
    entities.forEach(drawEntity);

    drawCharacter(
        state.player.x,
        state.player.y,
        "player",
        state.player.direction
    );

    drawInteractionMarker(getNearestEntity());

    if (state.stage >= 10) {
        ctx.fillStyle = "rgba(37,19,29,0.72)";
        ctx.fillRect(0, 0, 960, 600);

        // Painel de conclusão
        rect(270, 205, 420, 175, "#4b2c3a");
        rect(278, 213, 404, 159, "#8c5a50");
        rect(285, 220, 390, 145, "#593545");
        rect(300, 235, 360, 4, "#e6bd79");
        rect(300, 345, 360, 4, "#e6bd79");

        ctx.fillStyle = "#ffe5a7";
        ctx.textAlign = "center";
        ctx.font = "bold 30px monospace";
        ctx.fillText("MISTÉRIO RESOLVIDO!", 480, 285);

        ctx.font = "16px monospace";
        ctx.fillStyle = "#f4e5c8";
        ctx.fillText("A verdade foi descoberta.", 480, 320);

        ctx.font = "22px serif";
        ctx.fillText("✦", 320, 265);
        ctx.fillText("✦", 640, 265);
    }
}

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - state.lastTime) / 1000 || 0, 0.035);

    state.lastTime = timestamp;
    state.elapsed += dt;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

function resetGame() {
    state.stage = 0;
    state.points = 0;
    state.inventory = [];
    state.started = false;
    state.archiveStarted = false;
    state.oldLibrarianTalked = false;
    state.bookFound = false;
    state.finished = false;
    state.flags = {};
    state.falseClueCount = 0;
    state.positionCache = {};
    state.finalMessageRead = false;

    state.player.x = 475;
    state.player.y = 535;

    updateUI();
    setLog("Sua investigação está prestes a começar.");

    showDialog(
        "Bem-vindo, investigador!",
        "Um livro desapareceu da Biblioteca Central. Explore o local, converse com os personagens, encontre pistas e resolva os enigmas. Use WASD ou as setas para andar e pressione E para interagir. Boa sorte!"
    );
}

restartButton.addEventListener("click", () => {
    if (confirm("Tem certeza de que deseja reiniciar a investigação? Todo o progresso será perdido.")) {
        closeDialog();
        resetGame();
    }
});

updateUI();
requestAnimationFrame(gameLoop);

showDialog(
    "Bem-vindo, investigador!",
    "Um livro desapareceu da Biblioteca Central. Explore o local, converse com os personagens, encontre pistas e resolva os enigmas. Use WASD ou as setas para andar e pressione E para interagir. Boa sorte!"
);
