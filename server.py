import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import date, datetime, timedelta
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

PASTA_PROJETO = os.path.dirname(os.path.abspath(__file__))
CAMINHO_BANCO = os.path.join(PASTA_PROJETO, "Dados", "TechBok_Final.db")
PORTA = int(os.environ.get("PORT", 8000))

SENHA_BIBLIOTECARIO = os.environ.get(
    "TECHBOOK_SENHA_BIBLIOTECARIO",
    "techbook2026"
)

SESSOES_ALUNOS = {}
SESSOES_BIBLIOTECARIOS = set()
COOKIE_ALUNO = "techbook_aluno"
COOKIE_BIBLIOTECARIO = "techbook_bibliotecario"


def conectar():
    conexao = sqlite3.connect(CAMINHO_BANCO)
    conexao.row_factory = sqlite3.Row
    conexao.execute("PRAGMA foreign_keys = ON;")
    return conexao


def iniciar_banco():
    """Cria o esquema atual e importa os registros do esquema legado sem apagá-los."""
    os.makedirs(os.path.dirname(CAMINHO_BANCO), exist_ok=True)

    def existe_tabela(conexao, nome):
        return conexao.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (nome,)
        ).fetchone() is not None

    def colunas(conexao, nome):
        return {linha["name"] for linha in conexao.execute(f"PRAGMA table_info({nome})")}

    with conectar() as conexao:
        conexao.executescript(
            """
            CREATE TABLE IF NOT EXISTS alunos (
                id_aluno INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                matricula TEXT NOT NULL UNIQUE,
                turma TEXT,
                senha_hash TEXT
            );

            CREATE TABLE IF NOT EXISTS livros (
                id_livro INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                autor TEXT NOT NULL,
                genero TEXT,
                isbn TEXT UNIQUE,
                editora TEXT,
                ano_publicacao INTEGER,
                capa_url TEXT
            );

            CREATE TABLE IF NOT EXISTS exemplares (
                id_exemplar INTEGER PRIMARY KEY AUTOINCREMENT,
                id_livro INTEGER NOT NULL,
                codigo TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'Disponivel'
                    CHECK (status IN ('Disponivel', 'Emprestado')),
                FOREIGN KEY (id_livro) REFERENCES livros (id_livro)
            );

            CREATE TABLE IF NOT EXISTS emprestimos (
                id_emprestimo INTEGER PRIMARY KEY AUTOINCREMENT,
                id_aluno INTEGER NOT NULL,
                id_exemplar INTEGER NOT NULL,
                data_emprestimo TEXT NOT NULL,
                data_prevista_devolucao TEXT NOT NULL,
                data_devolucao TEXT,
                data_solicitacao_devolucao TEXT,
                FOREIGN KEY (id_aluno) REFERENCES alunos (id_aluno),
                FOREIGN KEY (id_exemplar) REFERENCES exemplares (id_exemplar)
            );
            """
        )

        # Atualiza bancos que já tinham sido criados por versões anteriores do servidor.
        if "senha_hash" not in colunas(conexao, "alunos"):
            conexao.execute("ALTER TABLE alunos ADD COLUMN senha_hash TEXT")
        for nome, tipo in (("editora", "TEXT"), ("ano_publicacao", "INTEGER"), ("capa_url", "TEXT")):
            if nome not in colunas(conexao, "livros"):
                conexao.execute(f"ALTER TABLE livros ADD COLUMN {nome} {tipo}")
        if "data_solicitacao_devolucao" not in colunas(conexao, "emprestimos"):
            conexao.execute("ALTER TABLE emprestimos ADD COLUMN data_solicitacao_devolucao TEXT")

        # Importação idempotente: mantém as tabelas antigas intactas e copia IDs/dados.
        if existe_tabela(conexao, "aluno"):
            cols = colunas(conexao, "aluno")
            senha_expr = "senha_hash" if "senha_hash" in cols else "NULL"
            turma_expr = "turma" if "turma" in cols else "NULL"
            conexao.execute(f"""
                INSERT OR IGNORE INTO alunos (id_aluno, nome, matricula, turma, senha_hash)
                SELECT id_aluno, nome, matricula, {turma_expr}, {senha_expr} FROM aluno
            """)

        if existe_tabela(conexao, "livro"):
            cols = colunas(conexao, "livro")
            editora_expr = "editora" if "editora" in cols else "NULL"
            ano_expr = "ano_publicacao" if "ano_publicacao" in cols else "NULL"
            conexao.execute(f"""
                INSERT OR IGNORE INTO livros
                    (id_livro, isbn, titulo, genero, editora, autor, ano_publicacao)
                SELECT id_livro, isbn, titulo, genero, {editora_expr},
                       COALESCE(NULLIF(autor, ''), 'Autor não informado'), {ano_expr}
                FROM livro
            """)

        if existe_tabela(conexao, "exemplar"):
            conexao.execute("""
                INSERT OR IGNORE INTO exemplares (id_exemplar, codigo, id_livro, status)
                SELECT e.id_exemplar, e.codigo, e.id_livro,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM emprestimo em
                        WHERE em.id_exemplar = e.id_exemplar AND em.data_devolucao IS NULL
                    ) THEN 'Emprestado' ELSE 'Disponivel' END
                FROM exemplar e
            """)

        if existe_tabela(conexao, "emprestimo"):
            old_cols = colunas(conexao, "emprestimo")
            pedido_expr = "data_solicitacao_devolucao" if "data_solicitacao_devolucao" in old_cols else "NULL"
            conexao.execute(f"""
                INSERT OR IGNORE INTO emprestimos
                    (id_emprestimo, id_aluno, id_exemplar, data_emprestimo,
                     data_prevista_devolucao, data_devolucao, data_solicitacao_devolucao)
                SELECT id_emprestimo, id_aluno, id_exemplar, data_emprestimo,
                       data_prevista_devolucao, data_devolucao, {pedido_expr}
                FROM emprestimo
            """)

        # O estado de disponibilidade é derivado dos empréstimos ainda não devolvidos.
        conexao.execute("""
            UPDATE exemplares
            SET status = CASE WHEN EXISTS (
                SELECT 1 FROM emprestimos em
                WHERE em.id_exemplar = exemplares.id_exemplar
                  AND em.data_devolucao IS NULL
            ) THEN 'Emprestado' ELSE 'Disponivel' END
        """)


def gerar_hash_senha(senha):
    sal = secrets.token_hex(16)
    chave = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode("utf-8"),
        sal.encode("utf-8"),
        100_000
    ).hex()
    return f"{sal}${chave}"


def verificar_senha(senha, senha_salva):
    if not senha_salva or "$" not in senha_salva:
        return False
    sal, chave_original = senha_salva.split("$", 1)
    chave_nova = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode("utf-8"),
        sal.encode("utf-8"),
        100_000
    ).hex()
    return hmac.compare_digest(chave_nova, chave_original)


def normalizar_status(valor):
    return str(valor or "").strip().lower().replace("í", "i")


class ServidorTechBook(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA_PROJETO, **kwargs)

    def log_message(self, format, *args):
        print(f"[TechBook] {self.address_string()} - {format % args}")

    def enviar_json(self, dados, status=200, cookies=None):
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        if cookies:
            for cookie in cookies:
                self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(corpo)

    def redirecionar(self, destino):
        self.send_response(302)
        self.send_header("Location", destino)
        self.end_headers()

    def ler_json(self):
        tamanho = int(self.headers.get("Content-Length", "0"))
        if tamanho > 100_000:
            raise ValueError("Envio grande demais.")
        if tamanho == 0:
            return {}
        texto = self.rfile.read(tamanho).decode("utf-8")
        return json.loads(texto)

    def ler_cookies(self):
        bruto = self.headers.get("Cookie")
        if not bruto:
            return {}
        jarra = SimpleCookie()
        jarra.load(bruto)
        return {nome: item.value for nome, item in jarra.items()}

    def obter_aluno_logado(self):
        token = self.ler_cookies().get(COOKIE_ALUNO)
        id_aluno = SESSOES_ALUNOS.get(token)
        if not id_aluno:
            return None
        with conectar() as conexao:
            aluno = conexao.execute(
                "SELECT id_aluno, nome, matricula, turma FROM alunos WHERE id_aluno = ?",
                (id_aluno,)
            ).fetchone()
        if not aluno:
            return None
        return {
            "id": aluno["id_aluno"],
            "nome": aluno["nome"],
            "matricula": aluno["matricula"],
            "turma": aluno["turma"]
        }

    def obter_bibliotecario_logado(self):
        token = self.ler_cookies().get(COOKIE_BIBLIOTECARIO)
        return bool(token and token in SESSOES_BIBLIOTECARIOS)

    def do_GET(self):
        rota = urlparse(self.path).path

        if rota.startswith("/Dados") or rota.endswith(".db"):
            self.send_error(403, "Acesso nao permitido.")
            return

        if rota in ("/bibliotecario.html", "/emprestimos.html", "/emprestimo.html", "/techbook.html", "/scanner.html") and not self.obter_bibliotecario_logado():
            self.redirecionar("/login-bibliotecario.html")
            return

        if rota in ("/perfil-aluno.html", "/emprestimos-aluno.html", "/emprestimo-aluno.html") and not self.obter_aluno_logado():
            self.redirecionar("/login.html")
            return

        if rota == "/api/livros":
            with conectar() as conexao:
                livros = conexao.execute(
                    """
                    SELECT
                        l.id_livro, l.titulo, l.autor, l.genero, l.isbn, l.editora, l.ano_publicacao, l.capa_url,
                        COUNT(e.id_exemplar) AS quantidade,
                        SUM(CASE WHEN LOWER(REPLACE(e.status, 'í', 'i')) = 'disponivel' THEN 1 ELSE 0 END) AS disponiveis
                    FROM livros l
                    LEFT JOIN exemplares e ON e.id_livro = l.id_livro
                    GROUP BY l.id_livro
                    ORDER BY l.titulo COLLATE NOCASE
                    """
                ).fetchall()
            self.enviar_json([dict(livro) for livro in livros])
            return

        if rota == "/api/ranking":
            with conectar() as conexao:
                linhas = conexao.execute(
                    """
                    SELECT
                        a.id_aluno,
                        a.nome,
                        a.turma,
                        COUNT(e.id_emprestimo) AS total_emprestimos,
                        SUM(CASE WHEN e.data_devolucao IS NOT NULL THEN 1 ELSE 0 END) AS livros_lidos
                    FROM alunos a
                    LEFT JOIN emprestimos e ON e.id_aluno = a.id_aluno
                    GROUP BY a.id_aluno
                    ORDER BY livros_lidos DESC, total_emprestimos DESC, a.nome ASC
                    """
                ).fetchall()

            ranking = []
            for item in linhas:
                lidos = item["livros_lidos"] or 0
                ativos = (item["total_emprestimos"] or 0) - lidos
                pontos = (lidos * 150) + (ativos * 50) + 100
                ranking.append({
                    "id_aluno": item["id_aluno"],
                    "nome": item["nome"],
                    "turma": item["turma"] or "Leitor TechBook",
                    "livros_lidos": lidos,
                    "emprestimos_ativos": ativos,
                    "pontos": pontos
                })
            self.enviar_json(ranking)
            return

        if rota in ("/api/alunos-comunidade", "/api/alunos"):
            with conectar() as conexao:
                linhas = conexao.execute(
                    """
                    SELECT
                        a.id_aluno,
                        a.nome,
                        a.turma,
                        COUNT(e.id_emprestimo) AS total_livros
                    FROM alunos a
                    LEFT JOIN emprestimos e ON e.id_aluno = a.id_aluno
                    GROUP BY a.id_aluno
                    ORDER BY a.nome COLLATE NOCASE
                    """
                ).fetchall()
            self.enviar_json([dict(x) for x in linhas])
            return

        if rota == "/api/sessao-aluno":
            aluno = self.obter_aluno_logado()
            if not aluno:
                self.enviar_json({"erro": "Aluno nao autenticado."}, 401)
                return
            self.enviar_json({"aluno": aluno})
            return

        if rota == "/api/aluno/resumo":
            aluno = self.obter_aluno_logado()
            if not aluno:
                self.enviar_json({"erro": "Faca login primeiro."}, 401)
                return
            with conectar() as conexao:
                emprestimos = conexao.execute(
                    """
                    SELECT data_devolucao, data_prevista_devolucao
                    FROM emprestimos
                    WHERE id_aluno = ?
                    """,
                    (aluno["id"],)
                ).fetchall()

            hoje = date.today().isoformat()
            ativos = [e for e in emprestimos if not e["data_devolucao"]]
            devolvidos = [e for e in emprestimos if e["data_devolucao"]]
            atrasados = [
                e for e in ativos
                if (e["data_prevista_devolucao"] or "") < hoje
            ]

            self.enviar_json({
                "emprestimos_ativos": len(ativos),
                "livros_devolvidos": len(devolvidos),
                "atrasados": len(atrasados)
            })
            return

        if rota == "/api/aluno/emprestimos":
            aluno = self.obter_aluno_logado()
            if not aluno:
                self.enviar_json({"erro": "Faca login primeiro."}, 401)
                return
            with conectar() as conexao:
                linhas = conexao.execute(
                    """
                    SELECT
                        em.id_emprestimo,
                        em.data_emprestimo,
                        em.data_prevista_devolucao,
                        em.data_devolucao,
                        em.data_solicitacao_devolucao,
                        ex.codigo AS codigo_exemplar,
                        l.titulo,
                        l.autor
                    FROM emprestimos em
                    JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
                    JOIN livros l ON l.id_livro = ex.id_livro
                    WHERE em.id_aluno = ?
                    ORDER BY em.id_emprestimo DESC
                    """,
                    (aluno["id"],)
                ).fetchall()

            hoje = date.today().isoformat()
            resultado = []
            for item in linhas:
                registro = dict(item)
                registro["atrasado"] = int(
                    not item["data_devolucao"]
                    and (item["data_prevista_devolucao"] or "") < hoje
                )
                resultado.append(registro)

            self.enviar_json(resultado)
            return

        if rota == "/api/sessao-bibliotecario":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Bibliotecario nao autenticado."}, 401)
                return
            self.enviar_json({"autenticado": True})
            return

        if rota == "/api/admin/resumo":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return
            with conectar() as conexao:
                total_livros = conexao.execute("SELECT COUNT(*) FROM livros").fetchone()[0]
                total_exemplares = conexao.execute("SELECT COUNT(*) FROM exemplares").fetchone()[0]
                disponiveis = conexao.execute(
                    "SELECT COUNT(*) FROM exemplares WHERE LOWER(REPLACE(status, 'í', 'i')) = 'disponivel'"
                ).fetchone()[0]
                emprestimos_ativos = conexao.execute(
                    "SELECT COUNT(*) FROM emprestimos WHERE data_devolucao IS NULL"
                ).fetchone()[0]
                total_alunos = conexao.execute("SELECT COUNT(*) FROM alunos").fetchone()[0]

            self.enviar_json({
                "total_livros": total_livros,
                "total_exemplares": total_exemplares,
                "disponiveis": disponiveis,
                "emprestimos_ativos": emprestimos_ativos,
                "total_alunos": total_alunos
            })
            return

        if rota == "/api/admin/alunos":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return
            with conectar() as conexao:
                alunos = conexao.execute(
                    "SELECT id_aluno, nome, matricula, turma FROM alunos ORDER BY nome COLLATE NOCASE"
                ).fetchall()
            self.enviar_json([dict(a) for a in alunos])
            return

        if rota == "/api/admin/exemplares-disponiveis":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return
            with conectar() as conexao:
                exemplares = conexao.execute(
                    """
                    SELECT ex.id_exemplar, ex.codigo, l.id_livro, l.titulo, l.autor
                    FROM exemplares ex
                    JOIN livros l ON l.id_livro = ex.id_livro
                    WHERE LOWER(REPLACE(ex.status, 'í', 'i')) = 'disponivel'
                    ORDER BY l.titulo COLLATE NOCASE, ex.codigo
                    """
                ).fetchall()
            self.enviar_json([dict(e) for e in exemplares])
            return

        if rota == "/api/admin/emprestimos":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return
            with conectar() as conexao:
                linhas = conexao.execute(
                    """
                    SELECT
                        em.id_emprestimo,
                        em.data_emprestimo,
                        em.data_prevista_devolucao,
                        em.data_devolucao,
                        em.data_solicitacao_devolucao,
                        a.nome AS aluno,
                        a.matricula,
                        ex.codigo AS codigo_exemplar,
                        l.titulo
                    FROM emprestimos em
                    JOIN alunos a ON a.id_aluno = em.id_aluno
                    JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
                    JOIN livros l ON l.id_livro = ex.id_livro
                    ORDER BY em.id_emprestimo DESC
                    """
                ).fetchall()

            hoje = date.today().isoformat()
            lista = []
            for item in linhas:
                reg = dict(item)
                reg["atrasado"] = bool(
                    not item["data_devolucao"]
                    and (item["data_prevista_devolucao"] or "") < hoje
                )
                lista.append(reg)
            self.enviar_json(lista)
            return

        if rota == "/api/admin/livros":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return
            with conectar() as conexao:
                livros = conexao.execute(
                    """
                    SELECT
                        l.id_livro, l.titulo, l.autor, l.genero, l.isbn, l.editora, l.ano_publicacao, l.capa_url,
                        COUNT(e.id_exemplar) AS quantidade,
                        SUM(CASE WHEN LOWER(REPLACE(e.status, 'í', 'i')) = 'disponivel' THEN 1 ELSE 0 END) AS disponiveis
                    FROM livros l
                    LEFT JOIN exemplares e ON e.id_livro = l.id_livro
                    GROUP BY l.id_livro
                    ORDER BY l.id_livro DESC
                    """
                ).fetchall()
            self.enviar_json([dict(livro) for livro in livros])
            return

        super().do_GET()

    def do_POST(self):
        rota = urlparse(self.path).path

        try:
            dados = self.ler_json()
        except Exception:
            self.enviar_json({"erro": "Dados invalidos."}, 400)
            return

        if rota == "/api/cadastro":
            nome = str(dados.get("nome", "")).strip()
            matricula = str(dados.get("matricula", "")).strip()
            turma = str(dados.get("turma", "")).strip()
            senha = str(dados.get("senha", ""))

            if not nome or not matricula or not turma:
                self.enviar_json({"erro": "Preencha nome, matricula e turma."}, 400)
                return

            if len(senha) < 8:
                self.enviar_json({"erro": "A senha precisa ter pelo menos 8 caracteres."}, 400)
                return

            try:
                with conectar() as conexao:
                    conexao.execute(
                        "INSERT INTO alunos (nome, matricula, turma, senha_hash) VALUES (?, ?, ?, ?)",
                        (nome, matricula, turma, gerar_hash_senha(senha))
                    )
            except sqlite3.IntegrityError:
                self.enviar_json({"erro": "Essa matricula ja esta cadastrada."}, 409)
                return

            self.enviar_json({"mensagem": "Cadastro realizado com sucesso!"}, 201)
            return

        if rota == "/api/login":
            matricula = str(dados.get("matricula", "")).strip()
            senha = str(dados.get("senha", ""))

            with conectar() as conexao:
                aluno = conexao.execute(
                    "SELECT id_aluno, nome, matricula, turma, senha_hash FROM alunos WHERE matricula = ?",
                    (matricula,)
                ).fetchone()

            if not aluno or not verificar_senha(senha, aluno["senha_hash"]):
                self.enviar_json({"erro": "Matricula ou senha incorretas."}, 401)
                return

            token = secrets.token_urlsafe(32)
            SESSOES_ALUNOS[token] = aluno["id_aluno"]
            cookie = f"{COOKIE_ALUNO}={token}; Path=/; HttpOnly; SameSite=Strict"

            self.enviar_json(
                {
                    "mensagem": "Login realizado com sucesso!",
                    "aluno": {
                        "id": aluno["id_aluno"],
                        "nome": aluno["nome"],
                        "matricula": aluno["matricula"],
                        "turma": aluno["turma"]
                    }
                },
                cookies=[cookie]
            )
            return

        if rota == "/api/logout-aluno":
            token = self.ler_cookies().get(COOKIE_ALUNO)
            if token:
                SESSOES_ALUNOS.pop(token, None)
            cookie = f"{COOKIE_ALUNO}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
            self.enviar_json({"mensagem": "Sessao encerrada."}, cookies=[cookie])
            return

        if rota == "/api/aluno/emprestimos":
            aluno = self.obter_aluno_logado()
            if not aluno:
                self.enviar_json({"erro": "Faca login para solicitar um emprestimo."}, 401)
                return

            id_livro = int(dados.get("id_livro") or 0)
            prazo_dias = int(dados.get("prazo_dias") or 14)
            if prazo_dias not in (7, 14, 16):
                prazo_dias = 14

            if not id_livro:
                self.enviar_json({"erro": "Selecione um livro valido."}, 400)
                return

            with conectar() as conexao:
                exemplar = conexao.execute(
                    """
                    SELECT ex.id_exemplar, l.titulo
                    FROM exemplares ex
                    JOIN livros l ON l.id_livro = ex.id_livro
                    WHERE ex.id_livro = ?
                      AND LOWER(REPLACE(ex.status, 'í', 'i')) = 'disponivel'
                    LIMIT 1
                    """,
                    (id_livro,)
                ).fetchone()

                if not exemplar:
                    self.enviar_json({"erro": "Nenhum exemplar disponivel deste livro no momento."}, 409)
                    return

                hoje = date.today()
                prevista = hoje + timedelta(days=prazo_dias)

                conexao.execute(
                    """
                    INSERT INTO emprestimos (id_aluno, id_exemplar, data_emprestimo, data_prevista_devolucao)
                    VALUES (?, ?, ?, ?)
                    """,
                    (aluno["id"], exemplar["id_exemplar"], hoje.isoformat(), prevista.isoformat())
                )
                conexao.execute(
                    "UPDATE exemplares SET status = 'Emprestado' WHERE id_exemplar = ?",
                    (exemplar["id_exemplar"],)
                )

            self.enviar_json({
                "mensagem": f"Emprestimo de '{exemplar['titulo']}' registrado ate {prevista.strftime('%d/%m/%Y')}!"
            }, 201)
            return

        if rota == "/api/aluno/emprestimos/devolucao":
            aluno = self.obter_aluno_logado()
            if not aluno:
                self.enviar_json({"erro": "Faca login primeiro."}, 401)
                return

            id_emprestimo = int(dados.get("id_emprestimo") or 0)
            if not id_emprestimo:
                self.enviar_json({"erro": "Emprestimo invalido."}, 400)
                return

            with conectar() as conexao:
                emp = conexao.execute(
                    """
                    SELECT id_emprestimo, data_devolucao
                    FROM emprestimos
                    WHERE id_emprestimo = ? AND id_aluno = ?
                    """,
                    (id_emprestimo, aluno["id"])
                ).fetchone()

                if not emp:
                    self.enviar_json({"erro": "Emprestimo nao encontrado."}, 404)
                    return

                if emp["data_devolucao"]:
                    self.enviar_json({"erro": "Este livro ja foi devolvido."}, 409)
                    return

                ja_solicitada = conexao.execute(
                    "SELECT data_solicitacao_devolucao FROM emprestimos WHERE id_emprestimo = ?",
                    (id_emprestimo,)
                ).fetchone()["data_solicitacao_devolucao"]
                if ja_solicitada:
                    self.enviar_json({"erro": "A devolucao deste livro ja foi solicitada."}, 409)
                    return

                conexao.execute(
                    "UPDATE emprestimos SET data_solicitacao_devolucao = ? WHERE id_emprestimo = ? AND data_devolucao IS NULL",
                    (datetime.now().isoformat(timespec="seconds"), id_emprestimo)
                )

            self.enviar_json({
                "mensagem": "Solicitacao de devolucao enviada! Entregue o livro ao bibliotecario para confirmar."
            })
            return

        if rota == "/api/login-bibliotecario":
            senha = str(dados.get("senha", ""))
            if not hmac.compare_digest(senha, SENHA_BIBLIOTECARIO):
                self.enviar_json({"erro": "Senha administrativa incorreta."}, 401)
                return

            token = secrets.token_urlsafe(32)
            SESSOES_BIBLIOTECARIOS.add(token)
            cookie = f"{COOKIE_BIBLIOTECARIO}={token}; Path=/; HttpOnly; SameSite=Strict"
            self.enviar_json({"mensagem": "Acesso liberado."}, cookies=[cookie])
            return

        if rota == "/api/logout-bibliotecario":
            token = self.ler_cookies().get(COOKIE_BIBLIOTECARIO)
            SESSOES_BIBLIOTECARIOS.discard(token)
            cookie = f"{COOKIE_BIBLIOTECARIO}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"
            self.enviar_json({"mensagem": "Sessao encerrada."}, cookies=[cookie])
            return

        if rota == "/api/admin/emprestimos":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return

            id_aluno = int(dados.get("id_aluno") or 0)
            id_exemplar = int(dados.get("id_exemplar") or 0)
            data_prevista = str(dados.get("data_prevista_devolucao") or "").strip()

            if not id_aluno or not id_exemplar or not data_prevista:
                self.enviar_json({"erro": "Preencha aluno, exemplar e data prevista."}, 400)
                return

            with conectar() as conexao:
                ex = conexao.execute(
                    "SELECT status FROM exemplares WHERE id_exemplar = ?",
                    (id_exemplar,)
                ).fetchone()
                if not ex or normalizar_status(ex["status"]) != "disponivel":
                    self.enviar_json({"erro": "Este exemplar nao esta disponivel."}, 409)
                    return

                conexao.execute(
                    """
                    INSERT INTO emprestimos (id_aluno, id_exemplar, data_emprestimo, data_prevista_devolucao)
                    VALUES (?, ?, ?, ?)
                    """,
                    (id_aluno, id_exemplar, date.today().isoformat(), data_prevista)
                )
                conexao.execute(
                    "UPDATE exemplares SET status = 'Emprestado' WHERE id_exemplar = ?",
                    (id_exemplar,)
                )

            self.enviar_json({"mensagem": "Emprestimo registrado com sucesso!"}, 201)
            return

        if rota == "/api/admin/devolucoes":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return

            id_emprestimo = int(dados.get("id_emprestimo") or 0)
            if not id_emprestimo:
                self.enviar_json({"erro": "Emprestimo invalido."}, 400)
                return

            with conectar() as conexao:
                emp = conexao.execute(
                    "SELECT id_exemplar, data_devolucao, data_solicitacao_devolucao FROM emprestimos WHERE id_emprestimo = ?",
                    (id_emprestimo,)
                ).fetchone()

                if not emp:
                    self.enviar_json({"erro": "Registro nao encontrado."}, 404)
                    return

                if emp["data_devolucao"]:
                    self.enviar_json({"erro": "Devolucao ja registrada."}, 409)
                    return

                if not emp["data_solicitacao_devolucao"]:
                    self.enviar_json({"erro": "O aluno ainda nao solicitou a devolucao."}, 409)
                    return

                cursor = conexao.execute(
                    "UPDATE emprestimos SET data_devolucao = ? WHERE id_emprestimo = ? AND data_devolucao IS NULL AND data_solicitacao_devolucao IS NOT NULL",
                    (date.today().isoformat(), id_emprestimo)
                )
                if cursor.rowcount != 1:
                    self.enviar_json({"erro": "Nao foi possivel confirmar esta devolucao."}, 409)
                    return
                conexao.execute(
                    "UPDATE exemplares SET status = 'Disponivel' WHERE id_exemplar = ?",
                    (emp["id_exemplar"],)
                )

            self.enviar_json({"mensagem": "Devolucao confirmada e exemplar liberado!"})
            return

        if rota == "/api/admin/livros":
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return

            titulo = str(dados.get("titulo", "")).strip()
            autor = str(dados.get("autor", "")).strip()
            genero = str(dados.get("genero", "")).strip() or "Geral"
            isbn = str(dados.get("isbn", "")).strip() or None
            editora = str(dados.get("editora", "")).strip() or None
            ano_bruto = str(dados.get("ano_publicacao", "")).strip()
            ano_publicacao = int(ano_bruto) if ano_bruto.isdigit() else None
            capa_url = str(dados.get("capa_url", "")).strip() or None
            if capa_url and not capa_url.startswith("https://"):
                capa_url = None
            quantidade = int(dados.get("quantidade", 1))

            if not titulo or not autor:
                self.enviar_json({"erro": "Informe o titulo e o autor do livro."}, 400)
                return

            if quantidade < 1 or quantidade > 100:
                self.enviar_json({"erro": "Informe entre 1 e 100 exemplares."}, 400)
                return

            try:
                with conectar() as conexao:
                    livro_existente = None
                    if isbn:
                        livro_existente = conexao.execute(
                            "SELECT id_livro FROM livros WHERE isbn = ?",
                            (isbn,)
                        ).fetchone()

                    if livro_existente:
                        id_livro = livro_existente["id_livro"]
                        conexao.execute(
                            "UPDATE livros SET titulo = ?, autor = ?, genero = ?, editora = COALESCE(?, editora), ano_publicacao = COALESCE(?, ano_publicacao), capa_url = COALESCE(?, capa_url) WHERE id_livro = ?",
                            (titulo, autor, genero, editora, ano_publicacao, capa_url, id_livro)
                        )
                    else:
                        cursor = conexao.execute(
                            "INSERT INTO livros (titulo, autor, genero, isbn, editora, ano_publicacao, capa_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (titulo, autor, genero, isbn, editora, ano_publicacao, capa_url)
                        )
                        id_livro = cursor.lastrowid

                    prefixo = isbn if isbn else f"TB-{id_livro:04d}"
                    total_atual = conexao.execute(
                        "SELECT COUNT(*) FROM exemplares WHERE id_livro = ?",
                        (id_livro,)
                    ).fetchone()[0]

                    for numero in range(total_atual + 1, total_atual + quantidade + 1):
                        codigo = f"{prefixo}-{numero:02d}"
                        conexao.execute(
                            "INSERT INTO exemplares (id_livro, codigo, status) VALUES (?, ?, 'Disponivel')",
                            (id_livro, codigo)
                        )
            except sqlite3.IntegrityError:
                self.enviar_json({"erro": "Nao foi possivel cadastrar esse codigo de exemplar."}, 409)
                return

            self.enviar_json({"mensagem": "Livro adicionado ao acervo!"}, 201)
            return

        self.send_error(404, "Rota nao encontrada.")

    def do_DELETE(self):
        rota = urlparse(self.path).path

        if rota.startswith("/api/admin/livros/"):
            if not self.obter_bibliotecario_logado():
                self.enviar_json({"erro": "Acesso restrito ao bibliotecario."}, 401)
                return

            try:
                id_livro = int(rota.rsplit("/", 1)[-1])
            except ValueError:
                self.enviar_json({"erro": "Livro invalido."}, 400)
                return

            with conectar() as conexao:
                historico = conexao.execute(
                    """
                    SELECT COUNT(*) FROM emprestimos em
                    JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
                    WHERE ex.id_livro = ?
                    """,
                    (id_livro,)
                ).fetchone()[0]

                if historico > 0:
                    self.enviar_json({"erro": "Este livro possui historico de emprestimos e nao pode ser excluido."}, 409)
                    return

                conexao.execute("DELETE FROM exemplares WHERE id_livro = ?", (id_livro,))
                conexao.execute("DELETE FROM livros WHERE id_livro = ?", (id_livro,))

            self.enviar_json({"mensagem": "Livro removido do catalogo."})
            return

        self.send_error(404, "Rota nao encontrada.")


if __name__ == "__main__":
    iniciar_banco()
    servidor = ThreadingHTTPServer(("0.0.0.0", PORTA), ServidorTechBook)
    print(f"TechBook funcionando em http://localhost:{PORTA}")
    print(f"Banco SQLite conectado em: {CAMINHO_BANCO}")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")