
import json
import sqlite3
import hashlib
import secrets
import hmac

from pathlib import Path
from datetime import datetime, date, timedelta
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit


# =========================================================
# CONFIGURAÇÕES
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"

SESSOES_BIBLIOTECARIOS = {}
DURACAO_SESSAO = 8 * 60 * 60

SESSOES_ALUNOS = {}
COOKIE_ALUNO = "techbook_aluno"

HOST = "0.0.0.0"
PORTA = 8000


# =========================================================
# BANCO DE DADOS
# =========================================================

def conectar_banco():
    conexao = sqlite3.connect(BANCO)
    conexao.row_factory = sqlite3.Row
    conexao.execute("PRAGMA foreign_keys = ON")
    return conexao


def executar_consulta(sql, parametros=(), obter_um=False):
    conexao = conectar_banco()

    try:
        cursor = conexao.execute(sql, parametros)

        if obter_um:
            resultado = cursor.fetchone()
        else:
            resultado = cursor.fetchall()

        return resultado

    finally:
        conexao.close()


# =========================================================
# SENHAS
# =========================================================

def gerar_senha_hash(senha):
    salt = secrets.token_hex(16)

    hash_senha = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode("utf-8"),
        salt.encode("utf-8"),
        200000
    ).hex()

    return f"{salt}${hash_senha}"


def verificar_senha(senha, senha_hash):
    try:
        salt, hash_original = senha_hash.split("$")

        hash_teste = hashlib.pbkdf2_hmac(
            "sha256",
            senha.encode("utf-8"),
            salt.encode("utf-8"),
            200000
        ).hex()

        return hmac.compare_digest(hash_teste, hash_original)

    except (ValueError, AttributeError):
        return False


# =========================================================
# RESPOSTAS HTTP
# =========================================================

def responder_json(handler, dados, status=200, headers_extra=None):
    corpo = json.dumps(
        dados,
        ensure_ascii=False,
        default=str
    ).encode("utf-8")

    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(corpo)))
    handler.send_header("Cache-Control", "no-store")

    if headers_extra:
        for nome, valor in headers_extra.items():
            handler.send_header(nome, valor)

    handler.end_headers()
    handler.wfile.write(corpo)


def responder_erro(handler, mensagem, status=400):
    responder_json(handler, {"erro": mensagem}, status)


def data_hoje():
    return date.today().isoformat()


def data_esta_atrasada(data_prevista):
    if not data_prevista:
        return False

    try:
        return date.fromisoformat(str(data_prevista)[:10]) < date.today()
    except ValueError:
        return False


# =========================================================
# SERVIDOR
# =========================================================

class TechBookHandler(SimpleHTTPRequestHandler):

    # -----------------------------------------------------
    # CONFIGURAÇÃO DE ARQUIVOS
    # -----------------------------------------------------

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, formato, *args):
        print("[TechBook]", formato % args)

    def caminho(self):
        return urlsplit(self.path).path

    def ler_json(self):
        try:
            tamanho = int(self.headers.get("Content-Length", 0))

            if tamanho <= 0:
                return {}

            corpo = self.rfile.read(tamanho)
            return json.loads(corpo.decode("utf-8"))

        except (ValueError, json.JSONDecodeError):
            return None

    def cookie_seguro(self):
        protocolo = self.headers.get("X-Forwarded-Proto", "")
        return protocolo.lower() == "https"

    # -----------------------------------------------------
    # SESSÃO DO BIBLIOTECÁRIO
    # -----------------------------------------------------

    def obter_token(self):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))

        if "techbook_bibliotecario" not in cookie:
            return None

        return cookie["techbook_bibliotecario"].value

    def obter_bibliotecario(self):
        token = self.obter_token()

        if not token:
            return None

        sessao = SESSOES_BIBLIOTECARIOS.get(token)

        if not sessao:
            return None

        if datetime.now().timestamp() > sessao["expira_em"]:
            SESSOES_BIBLIOTECARIOS.pop(token, None)
            return None

        return sessao

    def exige_bibliotecario(self):
        return self.obter_bibliotecario() is not None

    def cookie_sessao(self, token):
        cookie = (
            f"techbook_bibliotecario={token}; "
            f"HttpOnly; Path=/; SameSite=Strict; "
            f"Max-Age={DURACAO_SESSAO}"
        )

        if self.cookie_seguro():
            cookie += "; Secure"

        return cookie

    def cookie_encerrar(self):
        cookie = (
            "techbook_bibliotecario=; "
            "HttpOnly; Path=/; SameSite=Strict; Max-Age=0"
        )

        if self.cookie_seguro():
            cookie += "; Secure"

        return cookie
    
    # -----------------------------------------------------
    # SESSÃO DO ALUNO
    # -----------------------------------------------------

    def obter_token_aluno(self):
        cookie = SimpleCookie()

        try:
            cookie.load(self.headers.get("Cookie", ""))
            item = cookie.get(COOKIE_ALUNO)

            return item.value if item else None

        except Exception:
            return None

    def obter_aluno_atual(self):
        token = self.obter_token_aluno()

        if not token:
            return None

        sessao = SESSOES_ALUNOS.get(token)

        if not sessao:
            return None

        if datetime.now().timestamp() > sessao["expira_em"]:
            SESSOES_ALUNOS.pop(token, None)
            return None

        return sessao

    def cookie_sessao_aluno(self, token):
        cookie = (
            f"{COOKIE_ALUNO}={token}; "
            f"HttpOnly; Path=/; SameSite=Strict; "
            f"Max-Age={DURACAO_SESSAO}"
        )

        if self.cookie_seguro():
            cookie += "; Secure"

        return cookie

    def cookie_encerrar_aluno(self):
        cookie = (
            f"{COOKIE_ALUNO}=; "
            f"HttpOnly; Path=/; SameSite=Strict; Max-Age=0"
        )

        if self.cookie_seguro():
            cookie += "; Secure"

        return cookie

    # -----------------------------------------------------
    # GET
    # -----------------------------------------------------

    def do_GET(self):
        caminho = self.caminho()

                # Página do aluno protegida
        if caminho == "/perfil-aluno.html":
            if not self.obter_aluno_atual():
                self.send_response(302)
                self.send_header("Location", "/login.html")
                self.end_headers()
                return

            return super().do_GET()

        # Dados da sessão do aluno
        if caminho == "/api/sessao-aluno":
            aluno = self.obter_aluno_atual()

            if not aluno:
                return responder_erro(
                    self,
                    "Sessão não encontrada. Entre novamente.",
                    401
                )

            return responder_json(self, {
                "aluno": {
                    "id": aluno["id"],
                    "nome": aluno["nome"],
                    "matricula": aluno["matricula"],
                    "turma": aluno["turma"]
                }
            })

        # Empréstimos e histórico do aluno conectado
        if caminho == "/api/aluno/emprestimos":
            aluno = self.obter_aluno_atual()

            if not aluno:
                return responder_erro(
                    self,
                    "Acesso não autorizado.",
                    401
                )

            return self.api_aluno_emprestimos(aluno["id"])

        # Estatísticas do aluno conectado
        if caminho == "/api/aluno/resumo":
            aluno = self.obter_aluno_atual()

            if not aluno:
                return responder_erro(
                    self,
                    "Acesso não autorizado.",
                    401
                )

            return self.api_aluno_resumo(aluno["id"])

        # Página administrativa protegida
        if caminho == "/bibliotecario.html":
            if not self.exige_bibliotecario():
                self.send_response(302)
                self.send_header("Location", "/login-bibliotecario.html")
                self.end_headers()
                return

            return super().do_GET()

        # Sessão atual do bibliotecário
        if caminho == "/api/sessao-bibliotecario":
            bibliotecario = self.obter_bibliotecario()

            if not bibliotecario:
                return responder_erro(
                    self,
                    "Sessão não encontrada. Entre novamente.",
                    401
                )

            return responder_json(self, {
                "bibliotecario": {
                    "id": bibliotecario["id"],
                    "nome": bibliotecario["nome"],
                    "usuario": bibliotecario["usuario"]
                }
            })

        # Catálogo de livros
        if caminho == "/api/livros":
            return self.api_livros()

        # Rotas administrativas protegidas
        if caminho.startswith("/api/admin/"):
            if not self.exige_bibliotecario():
                return responder_erro(
                    self,
                    "Acesso não autorizado.",
                    401
                )

            if caminho == "/api/admin/resumo":
                return self.api_admin_resumo()

            if caminho == "/api/admin/alunos":
                return self.api_admin_alunos()

            if caminho == "/api/admin/emprestimos":
                return self.api_admin_emprestimos()

            if caminho == "/api/admin/exemplares-disponiveis":
                return self.api_exemplares_disponiveis()

            return responder_erro(self, "Rota não encontrada.", 404)

        return super().do_GET()

    # -----------------------------------------------------
    # POST
    # -----------------------------------------------------

    def do_POST(self):
        caminho = self.caminho()
        dados = self.ler_json()

        if dados is None:
            return responder_erro(self, "Dados enviados em formato inválido.")

        # Cadastro de aluno
        if caminho == "/api/cadastro":
            return self.api_cadastro_aluno(dados)

        # Login de aluno
        if caminho == "/api/login":
            return self.api_login_aluno(dados)

        # Login do bibliotecário
        if caminho == "/api/login-bibliotecario":
            return self.api_login_bibliotecario(dados)

        # Logout do bibliotecário
        if caminho == "/api/logout-bibliotecario":
            return self.api_logout_bibliotecario()

                # Logout do aluno
        if caminho == "/api/logout-aluno":
            token = self.obter_token_aluno()

            if token:
                SESSOES_ALUNOS.pop(token, None)

            return responder_json(
                self,
                {"mensagem": "Sessão encerrada."},
                headers_extra={
                    "Set-Cookie": self.cookie_encerrar_aluno()
                }
            )
                    # Solicitação de devolução pelo aluno
        if caminho == "/api/aluno/emprestimos/devolucao":
            aluno = self.obter_aluno_atual()

            if not aluno:
                return responder_erro(
                    self,
                    "Faça login para solicitar uma devolução.",
                    401
                )

            return self.api_aluno_solicitar_devolucao(
                aluno["id"],
                dados
            )
                # Empréstimo solicitado pelo aluno
        if caminho == "/api/aluno/emprestimos":
            aluno = self.obter_aluno_atual()

            if not aluno:
                return responder_erro(
                    self,
                    "Faça login para solicitar um empréstimo.",
                    401
                )

            return self.api_aluno_solicitar_emprestimo(aluno["id"], dados)

        # Rotas administrativas protegidas
        if caminho.startswith("/api/admin/"):
            if not self.exige_bibliotecario():
                return responder_erro(
                    self,
                    "Acesso não autorizado.",
                    401
                )

            if caminho == "/api/admin/livros":
                return self.api_cadastrar_livro(dados)

            if caminho == "/api/admin/emprestimos":
                return self.api_cadastrar_emprestimo(dados)

            if caminho == "/api/admin/devolucoes":
                return self.api_registrar_devolucao(dados)

            return responder_erro(self, "Rota não encontrada.", 404)

        responder_erro(self, "Rota não encontrada.", 404)

    # =====================================================
    # API: LIVROS
    # =====================================================

    def api_livros(self):
        try:
            livros = executar_consulta("""
                SELECT
                    l.id_livro,
                    l.ISBN AS isbn,
                    l.titulo,
                    l.genero,
                    l.editora,
                    l.autor,
                    l.ano_publicacao,

                    COUNT(
                        CASE
                            WHEN e.estado = 'Bom'
                            THEN e.id_exemplar
                        END
                    ) AS quantidade,

                    COUNT(
                        CASE
                            WHEN e.estado = 'Bom'
                            AND em.id_emprestimo IS NULL
                            THEN e.id_exemplar
                        END
                    ) AS disponiveis

                FROM livro l

                LEFT JOIN exemplar e
                    ON e.id_livro = l.id_livro

                LEFT JOIN emprestimo em
                    ON em.id_exemplar = e.id_exemplar
                    AND em.data_devolucao IS NULL

                GROUP BY
                    l.id_livro,
                    l.ISBN,
                    l.titulo,
                    l.genero,
                    l.editora,
                    l.autor,
                    l.ano_publicacao

                ORDER BY l.titulo
            """)

            return responder_json(
                self,
                [dict(livro) for livro in livros]
            )

        except sqlite3.Error as erro:
            print("Erro ao consultar livros:", erro)
            return responder_erro(
                self,
                "Não foi possível carregar o catálogo.",
                500
            )

    # =====================================================
    # API: CADASTRO DE ALUNO
    # =====================================================

    def api_cadastro_aluno(self, dados):
        nome = str(dados.get("nome", "")).strip()
        matricula = str(dados.get("matricula", "")).strip()
        turma = str(dados.get("turma", "")).strip()
        senha = str(dados.get("senha", ""))

        if not nome or not matricula or not turma or not senha:
            return responder_erro(
                self,
                "Preencha todos os campos obrigatórios."
            )

        if len(senha) < 6:
            return responder_erro(
                self,
                "A senha precisa ter pelo menos 6 caracteres."
            )

        senha_hash = gerar_senha_hash(senha)

        conexao = conectar_banco()

        try:
            conexao.execute("""
                INSERT INTO aluno (
                    matricula,
                    nome,
                    turma,
                    data_cadastro,
                    senha_hash
                )
                VALUES (?, ?, ?, ?, ?)
            """, (
                matricula,
                nome,
                turma,
                data_hoje(),
                senha_hash
            ))

            conexao.commit()

            return responder_json(
                self,
                {"mensagem": "Cadastro realizado com sucesso!"},
                201
            )

        except sqlite3.IntegrityError:
            return responder_erro(
                self,
                "Essa matrícula já está cadastrada."
            )

        except sqlite3.Error as erro:
            print("Erro no cadastro de aluno:", erro)
            return responder_erro(
                self,
                "Não foi possível realizar o cadastro.",
                500
            )

        finally:
            conexao.close()

    # =====================================================
    # API: LOGIN DE ALUNO
    # =====================================================

    def api_login_aluno(self, dados):
        matricula = str(dados.get("matricula", "")).strip()
        senha = str(dados.get("senha", ""))

        if not matricula or not senha:
            return responder_erro(
                self,
                "Informe a matrícula e a senha."
            )

        try:
            aluno = executar_consulta("""
                SELECT
                    id_aluno,
                    matricula,
                    nome,
                    turma,
                    senha_hash
                FROM aluno
                WHERE matricula = ?
            """, (matricula,), obter_um=True)

            if not aluno or not verificar_senha(
                senha,
                aluno["senha_hash"]
            ):
                return responder_erro(
                    self,
                    "Matrícula ou senha incorreta.",
                    401
                )

            token = secrets.token_urlsafe(32)

            SESSOES_ALUNOS[token] = {
                "id": aluno["id_aluno"],
                "nome": aluno["nome"],
                "matricula": aluno["matricula"],
                "turma": aluno["turma"],
                "expira_em": (
                    datetime.now().timestamp() + DURACAO_SESSAO
                )
            }

            return responder_json(
                self,
                {
                    "mensagem": "Login realizado com sucesso!",
                    "aluno": {
                        "id": aluno["id_aluno"],
                        "matricula": aluno["matricula"],
                        "nome": aluno["nome"],
                        "turma": aluno["turma"]
                    }
                },
                headers_extra={
                    "Set-Cookie": self.cookie_sessao_aluno(token)
                }
            )

        except sqlite3.Error as erro:
            print("Erro no login do aluno:", erro)

            return responder_erro(
                self,
                "Não foi possível realizar o login.",
                500
            )
    # =====================================================
    # API: LOGIN DO BIBLIOTECÁRIO
    # =====================================================

    def api_login_bibliotecario(self, dados):
        usuario = str(dados.get("usuario", "")).strip()
        senha = str(dados.get("senha", ""))

        if not usuario or not senha:
            return responder_erro(
                self,
                "Informe o usuário e a senha."
            )

        try:
            bibliotecario = executar_consulta("""
                SELECT
                    id_bibliotecario,
                    nome,
                    usuario,
                    senha_hash
                FROM bibliotecario
                WHERE usuario = ?
                AND ativo = 1
            """, (usuario,), obter_um=True)

            if not bibliotecario or not verificar_senha(
                senha,
                bibliotecario["senha_hash"]
            ):
                return responder_erro(
                    self,
                    "Usuário ou senha incorretos.",
                    401
                )

            token = secrets.token_urlsafe(32)

            SESSOES_BIBLIOTECARIOS[token] = {
                "id": bibliotecario["id_bibliotecario"],
                "nome": bibliotecario["nome"],
                "usuario": bibliotecario["usuario"],
                "expira_em": (
                    datetime.now().timestamp() + DURACAO_SESSAO
                )
            }

            return responder_json(
                self,
                {
                    "mensagem": "Login realizado com sucesso!",
                    "bibliotecario": {
                        "id": bibliotecario["id_bibliotecario"],
                        "nome": bibliotecario["nome"],
                        "usuario": bibliotecario["usuario"]
                    }
                },
                headers_extra={
                    "Set-Cookie": self.cookie_sessao(token)
                }
            )

        except sqlite3.Error as erro:
            print("Erro no login do bibliotecário:", erro)
            return responder_erro(
                self,
                "Não foi possível realizar o login.",
                500
            )

    # =====================================================
    # API: LOGOUT DO BIBLIOTECÁRIO
    # =====================================================

    def api_logout_bibliotecario(self):
        token = self.obter_token()

        if token:
            SESSOES_BIBLIOTECARIOS.pop(token, None)

        return responder_json(
            self,
            {"mensagem": "Sessão encerrada."},
            headers_extra={
                "Set-Cookie": self.cookie_encerrar()
            }
        )
            # =====================================================
    # API DO ALUNO: SOLICITAR DEVOLUÇÃO
    # =====================================================

    def api_aluno_solicitar_devolucao(self, id_aluno, dados):
        try:
            id_emprestimo = int(dados.get("id_emprestimo"))

        except (ValueError, TypeError):
            return responder_erro(
                self,
                "Empréstimo inválido."
            )

        conexao = conectar_banco()

        try:
            conexao.execute("BEGIN IMMEDIATE")

            emprestimo = conexao.execute("""
                SELECT
                    id_emprestimo,
                    data_devolucao,
                    data_solicitacao_devolucao
                FROM emprestimo
                WHERE id_emprestimo = ?
                AND id_aluno = ?
            """, (
                id_emprestimo,
                id_aluno
            )).fetchone()

            if not emprestimo:
                conexao.rollback()
                return responder_erro(
                    self,
                    "Empréstimo não encontrado.",
                    404
                )

            if emprestimo["data_devolucao"] is not None:
                conexao.rollback()
                return responder_erro(
                    self,
                    "Esse livro já foi devolvido."
                )

            if emprestimo["data_solicitacao_devolucao"] is not None:
                conexao.rollback()
                return responder_erro(
                    self,
                    "A devolução desse livro já foi solicitada."
                )

            conexao.execute("""
                UPDATE emprestimo
                SET data_solicitacao_devolucao = ?
                WHERE id_emprestimo = ?
                AND id_aluno = ?
                AND data_devolucao IS NULL
                AND data_solicitacao_devolucao IS NULL
            """, (
                data_hoje(),
                id_emprestimo,
                id_aluno
            ))

            conexao.commit()

            return responder_json(
                self,
                {
                    "mensagem": (
                        "Solicitação de devolução enviada com sucesso!"
                    )
                }
            )

        except sqlite3.Error as erro:
            conexao.rollback()
            print("Erro ao solicitar devolução:", erro)

            return responder_erro(
                self,
                "Não foi possível solicitar a devolução.",
                500
            )

        finally:
            conexao.close()

        # =====================================================
    # API DO ALUNO: EMPRÉSTIMOS E HISTÓRICO
    # =====================================================

    def api_aluno_emprestimos(self, id_aluno):
        try:
            emprestimos = executar_consulta("""
                SELECT
                    em.id_emprestimo,
                    em.data_emprestimo,
                    em.data_prevista_devolucao,
                    em.data_devolucao,
                    em.data_solicitacao_devolucao,

                    l.titulo,
                    l.autor,
                    l.genero,

                    ex.codigo AS codigo_exemplar,
                    ex.localizacao,

                    CASE
                        WHEN em.data_devolucao IS NULL
                        AND date(em.data_prevista_devolucao)
                            < date('now', 'localtime')
                        THEN 1
                        ELSE 0
                    END AS atrasado

                FROM emprestimo em

                JOIN exemplar ex
                    ON ex.id_exemplar = em.id_exemplar

                JOIN livro l
                    ON l.id_livro = ex.id_livro

                WHERE em.id_aluno = ?

                ORDER BY
                    CASE
                        WHEN em.data_devolucao IS NULL THEN 0
                        ELSE 1
                    END,
                    em.data_emprestimo DESC
            """, (id_aluno,))

            return responder_json(
                self,
                [dict(item) for item in emprestimos]
            )

        except sqlite3.Error as erro:
            print("Erro nos empréstimos do aluno:", erro)

            return responder_erro(
                self,
                "Não foi possível carregar seus empréstimos.",
                500
            )

    # =====================================================
    # API DO ALUNO: ESTATÍSTICAS
    # =====================================================

    def api_aluno_resumo(self, id_aluno):
        try:
            resumo = executar_consulta("""
                SELECT
                    COUNT(
                        CASE
                            WHEN data_devolucao IS NULL
                            THEN 1
                        END
                    ) AS emprestimos_ativos,

                    COUNT(
                        CASE
                            WHEN data_devolucao IS NOT NULL
                            THEN 1
                        END
                    ) AS livros_devolvidos,

                    COUNT(
                        CASE
                            WHEN data_devolucao IS NULL
                            AND date(data_prevista_devolucao)
                                < date('now', 'localtime')
                            THEN 1
                        END
                    ) AS atrasados

                FROM emprestimo
                WHERE id_aluno = ?
            """, (id_aluno,), obter_um=True)

            return responder_json(self, dict(resumo))

        except sqlite3.Error as erro:
            print("Erro nas estatísticas do aluno:", erro)

            return responder_erro(
                self,
                "Não foi possível carregar suas estatísticas.",
                500
            )

    # =====================================================
    # API ADMINISTRATIVA: RESUMO
    # =====================================================

    def api_admin_resumo(self):
        try:
            conexao = conectar_banco()

            try:
                total_livros = conexao.execute("""
                    SELECT COUNT(*) AS total FROM livro
                """).fetchone()["total"]

                total_alunos = conexao.execute("""
                    SELECT COUNT(*) AS total FROM aluno
                """).fetchone()["total"]

                ativos = conexao.execute("""
                    SELECT COUNT(*) AS total
                    FROM emprestimo
                    WHERE data_devolucao IS NULL
                """).fetchone()["total"]

                atrasados = conexao.execute("""
                    SELECT COUNT(*) AS total
                    FROM emprestimo
                    WHERE data_devolucao IS NULL
                    AND date(data_prevista_devolucao) < date('now', 'localtime')
                """).fetchone()["total"]

                recentes = conexao.execute("""
                    SELECT
                        em.id_emprestimo,
                        a.nome AS aluno,
                        l.titulo,
                        em.data_emprestimo,
                        em.data_prevista_devolucao

                    FROM emprestimo em

                    JOIN aluno a
                        ON a.id_aluno = em.id_aluno

                    JOIN exemplar e
                        ON e.id_exemplar = em.id_exemplar

                    JOIN livro l
                        ON l.id_livro = e.id_livro

                    WHERE em.data_devolucao IS NULL

                    ORDER BY em.id_emprestimo DESC
                    LIMIT 5
                """).fetchall()

                lista_recentes = []

                for item in recentes:
                    registro = dict(item)
                    registro["atrasado"] = data_esta_atrasada(
                        registro["data_prevista_devolucao"]
                    )
                    lista_recentes.append(registro)

                return responder_json(self, {
                    "livros": total_livros,
                    "alunos": total_alunos,
                    "emprestimos_ativos": ativos,
                    "atrasados": atrasados,
                    "recentes": lista_recentes
                })

            finally:
                conexao.close()

        except sqlite3.Error as erro:
            print("Erro no resumo administrativo:", erro)
            return responder_erro(
                self,
                "Não foi possível carregar o resumo.",
                500
            )

    # =====================================================
    # API ADMINISTRATIVA: ALUNOS
    # =====================================================

    def api_admin_alunos(self):
        try:
            alunos = executar_consulta("""
                SELECT
                    a.id_aluno,
                    a.matricula,
                    a.nome,
                    a.turma,
                    a.data_cadastro,

                    COUNT(
                        CASE
                            WHEN em.data_devolucao IS NULL
                            THEN em.id_emprestimo
                        END
                    ) AS emprestimos_ativos

                FROM aluno a

                LEFT JOIN emprestimo em
                    ON em.id_aluno = a.id_aluno

                GROUP BY
                    a.id_aluno,
                    a.matricula,
                    a.nome,
                    a.turma,
                    a.data_cadastro

                ORDER BY a.nome
            """)

            return responder_json(
                self,
                [dict(aluno) for aluno in alunos]
            )

        except sqlite3.Error as erro:
            print("Erro ao consultar alunos:", erro)
            return responder_erro(
                self,
                "Não foi possível carregar os alunos.",
                500
            )

    # =====================================================
    # API ADMINISTRATIVA: EMPRÉSTIMOS
    # =====================================================

    def api_admin_emprestimos(self):
        try:
            emprestimos = executar_consulta("""
                SELECT
                    em.id_emprestimo,
                    em.data_emprestimo,
                    em.data_prevista_devolucao,
                    em.data_devolucao,
                    em.data_solicitacao_devolucao,

                    a.nome AS aluno,
                    a.matricula,

                    l.titulo,
                    e.codigo AS codigo_exemplar

                FROM emprestimo em

                JOIN aluno a
                    ON a.id_aluno = em.id_aluno

                JOIN exemplar e
                    ON e.id_exemplar = em.id_exemplar

                JOIN livro l
                    ON l.id_livro = e.id_livro

                ORDER BY
                    CASE
                        WHEN em.data_devolucao IS NULL THEN 0
                        ELSE 1
                    END,
                    em.id_emprestimo DESC
            """)

            resultado = []

            for emprestimo in emprestimos:
                item = dict(emprestimo)

                item["atrasado"] = (
                    item["data_devolucao"] is None
                    and data_esta_atrasada(
                        item["data_prevista_devolucao"]
                    )
                )

                resultado.append(item)

            return responder_json(self, resultado)

        except sqlite3.Error as erro:
            print("Erro ao consultar empréstimos:", erro)
            return responder_erro(
                self,
                "Não foi possível carregar os empréstimos.",
                500
            )

    # =====================================================
    # API ADMINISTRATIVA: EXEMPLARES DISPONÍVEIS
    # =====================================================

    def api_exemplares_disponiveis(self):
        try:
            exemplares = executar_consulta("""
                SELECT
                    e.id_exemplar,
                    e.codigo,
                    e.localizacao,
                    l.titulo

                FROM exemplar e

                JOIN livro l
                    ON l.id_livro = e.id_livro

                WHERE e.estado = 'Bom'

                AND NOT EXISTS (
                    SELECT 1
                    FROM emprestimo em
                    WHERE em.id_exemplar = e.id_exemplar
                    AND em.data_devolucao IS NULL
                )

                ORDER BY l.titulo
            """)

            return responder_json(
                self,
                [dict(exemplar) for exemplar in exemplares]
            )

        except sqlite3.Error as erro:
            print("Erro ao consultar exemplares:", erro)
            return responder_erro(
                self,
                "Não foi possível carregar os exemplares disponíveis.",
                500
            )

    # =====================================================
    # API ADMINISTRATIVA: CADASTRAR LIVRO
    # =====================================================

    def api_cadastrar_livro(self, dados):
        titulo = str(dados.get("titulo", "")).strip()
        autor = str(dados.get("autor", "")).strip()
        genero = str(dados.get("genero", "")).strip()
        isbn = str(dados.get("isbn", "")).strip()
        editora = str(dados.get("editora", "")).strip()
        codigo = str(dados.get("codigo", "")).strip()
        localizacao = str(dados.get("localizacao", "")).strip()

        ano = dados.get("ano_publicacao")

        if not titulo or not autor:
            return responder_erro(
                self,
                "Informe o título e o autor do livro."
            )

        if not codigo or not localizacao:
            return responder_erro(
                self,
                "Informe o código e a localização do exemplar."
            )

        if ano in ("", None):
            ano = None
        else:
            try:
                ano = int(ano)
            except (ValueError, TypeError):
                return responder_erro(
                    self,
                    "O ano de publicação precisa ser um número."
                )

            if ano < 0 or ano > 2100:
                return responder_erro(
                    self,
                    "Informe um ano de publicação válido."
                )

        conexao = conectar_banco()

        try:
            cursor = conexao.execute("""
                INSERT INTO livro (
                    ISBN,
                    titulo,
                    genero,
                    editora,
                    autor,
                    ano_publicacao
                )
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                isbn or None,
                titulo,
                genero or None,
                editora or None,
                autor,
                ano
            ))

            id_livro = cursor.lastrowid

            conexao.execute("""
                INSERT INTO exemplar (
                    codigo,
                    id_livro,
                    localizacao,
                    estado
                )
                VALUES (?, ?, ?, ?)
            """, (
                codigo,
                id_livro,
                localizacao,
                "Bom"
            ))

            conexao.commit()

            return responder_json(
                self,
                {
                    "mensagem": "Livro e primeiro exemplar cadastrados com sucesso!",
                    "id_livro": id_livro
                },
                201
            )

        except sqlite3.IntegrityError as erro:
            conexao.rollback()
            print("Erro de integridade ao cadastrar livro:", erro)

            return responder_erro(
                self,
                "Não foi possível cadastrar. Verifique se o código do exemplar ou ISBN já está em uso."
            )

        except sqlite3.Error as erro:
            conexao.rollback()
            print("Erro ao cadastrar livro:", erro)

            return responder_erro(
                self,
                "Ocorreu um erro ao cadastrar o livro.",
                500
            )

        finally:
            conexao.close()

                # =====================================================
    # API DO ALUNO: SOLICITAR EMPRÉSTIMO
    # =====================================================

    def api_aluno_solicitar_emprestimo(self, id_aluno, dados):
        try:
            id_livro = int(dados.get("id_livro"))
            prazo = int(dados.get("prazo_dias"))

        except (ValueError, TypeError):
            return responder_erro(
                self,
                "Selecione um livro e um prazo válidos."
            )

        if prazo not in (7, 14, 16):
            return responder_erro(
                self,
                "O prazo deve ser de 7, 14 ou 16 dias."
            )

        data_emprestimo = date.today()
        data_prevista = (
            data_emprestimo + timedelta(days=prazo)
        ).isoformat()

        conexao = conectar_banco()

        try:
            # Impede que duas solicitações utilizem o mesmo exemplar
            # ao mesmo tempo.
            conexao.execute("BEGIN IMMEDIATE")

            aluno = conexao.execute("""
                SELECT id_aluno
                FROM aluno
                WHERE id_aluno = ?
            """, (id_aluno,)).fetchone()

            if not aluno:
                conexao.rollback()
                return responder_erro(
                    self,
                    "Aluno não encontrado.",
                    404
                )

            # Procura automaticamente um exemplar disponível
            exemplar = conexao.execute("""
                SELECT e.id_exemplar
                FROM exemplar e
                WHERE e.id_livro = ?
                AND e.estado = 'Bom'
                AND NOT EXISTS (
                    SELECT 1
                    FROM emprestimo em
                    WHERE em.id_exemplar = e.id_exemplar
                    AND em.data_devolucao IS NULL
                )
                ORDER BY e.id_exemplar
                LIMIT 1
            """, (id_livro,)).fetchone()

            if not exemplar:
                conexao.rollback()
                return responder_erro(
                    self,
                    "Este livro não possui exemplares disponíveis."
                )

            # Registra o empréstimo no banco de dados
            conexao.execute("""
                INSERT INTO emprestimo (
                    id_aluno,
                    id_exemplar,
                    data_emprestimo,
                    data_prevista_devolucao,
                    data_devolucao
                )
                VALUES (?, ?, ?, ?, NULL)
            """, (
                id_aluno,
                exemplar["id_exemplar"],
                data_emprestimo.isoformat(),
                data_prevista
            ))

            conexao.commit()

            return responder_json(
                self,
                {
                    "mensagem": "Empréstimo realizado com sucesso!",
                    "data_prevista_devolucao": data_prevista
                },
                201
            )

        except sqlite3.IntegrityError as erro:
            conexao.rollback()
            print("Erro de integridade no empréstimo do aluno:", erro)

            return responder_erro(
                self,
                "Não foi possível registrar esse empréstimo."
            )

        except sqlite3.Error as erro:
            conexao.rollback()
            print("Erro no empréstimo do aluno:", erro)

            return responder_erro(
                self,
                "Ocorreu um erro ao registrar o empréstimo.",
                500
            )

        finally:
            conexao.close()

    # =====================================================
    # API ADMINISTRATIVA: REGISTRAR EMPRÉSTIMO
    # =====================================================

    def api_cadastrar_emprestimo(self, dados):
        try:
            id_aluno = int(dados.get("id_aluno"))
            id_exemplar = int(dados.get("id_exemplar"))
        except (ValueError, TypeError):
            return responder_erro(
                self,
                "Selecione um aluno e um exemplar válidos."
            )

        data_prevista = str(
            dados.get("data_prevista_devolucao", "")
        ).strip()

        if not data_prevista:
            return responder_erro(
                self,
                "Informe a data prevista para devolução."
            )

        try:
            data_obj = date.fromisoformat(data_prevista)

            if data_obj < date.today():
                return responder_erro(
                    self,
                    "A data de devolução não pode estar no passado."
                )

        except ValueError:
            return responder_erro(
                self,
                "A data de devolução é inválida."
            )

        conexao = conectar_banco()

        try:
            aluno = conexao.execute("""
                SELECT id_aluno
                FROM aluno
                WHERE id_aluno = ?
            """, (id_aluno,)).fetchone()

            if not aluno:
                return responder_erro(
                    self,
                    "Aluno não encontrado."
                )

            exemplar = conexao.execute("""
                SELECT id_exemplar
                FROM exemplar
                WHERE id_exemplar = ?
                AND estado = 'Bom'
            """, (id_exemplar,)).fetchone()

            if not exemplar:
                return responder_erro(
                    self,
                    "Exemplar não encontrado ou não está em boas condições."
                )

            emprestimo_ativo = conexao.execute("""
                SELECT id_emprestimo
                FROM emprestimo
                WHERE id_exemplar = ?
                AND data_devolucao IS NULL
            """, (id_exemplar,)).fetchone()

            if emprestimo_ativo:
                return responder_erro(
                    self,
                    "Esse exemplar já está emprestado."
                )

            conexao.execute("""
                INSERT INTO emprestimo (
                    id_aluno,
                    id_exemplar,
                    data_emprestimo,
                    data_prevista_devolucao,
                    data_devolucao
                )
                VALUES (?, ?, ?, ?, NULL)
            """, (
                id_aluno,
                id_exemplar,
                data_hoje(),
                data_prevista
            ))

            conexao.commit()

            return responder_json(
                self,
                {"mensagem": "Empréstimo registrado com sucesso!"},
                201
            )

        except sqlite3.IntegrityError as erro:
            conexao.rollback()
            print("Erro de integridade no empréstimo:", erro)

            return responder_erro(
                self,
                "Não foi possível registrar esse empréstimo."
            )

        except sqlite3.Error as erro:
            conexao.rollback()
            print("Erro ao registrar empréstimo:", erro)

            return responder_erro(
                self,
                "Ocorreu um erro ao registrar o empréstimo.",
                500
            )

        finally:
            conexao.close()

    # =====================================================
    # API ADMINISTRATIVA: DEVOLUÇÃO
    # =====================================================

    def api_registrar_devolucao(self, dados):
        try:
            id_emprestimo = int(dados.get("id_emprestimo"))
        except (ValueError, TypeError):
            return responder_erro(
                self,
                "Empréstimo inválido."
            )

        conexao = conectar_banco()

        try:
            emprestimo = conexao.execute("""
                SELECT
                    id_emprestimo,
                    data_devolucao,
                    data_solicitacao_devolucao
                FROM emprestimo
                WHERE id_emprestimo = ?
            """, (id_emprestimo,)).fetchone()

            if not emprestimo:
                return responder_erro(
                    self,
                    "Empréstimo não encontrado.",
                    404
                )

            if emprestimo["data_devolucao"] is not None:
                return responder_erro(
                    self,
                    "Esse empréstimo já foi devolvido."
                )
            if emprestimo["data_solicitacao_devolucao"] is None:
                return responder_erro(
                    self,
                    "Esse empréstimo ainda não possui solicitação de devolução."
                )

                       cursor = conexao.execute("""
                UPDATE emprestimo
                SET data_devolucao = ?
                WHERE id_emprestimo = ?
                AND data_devolucao IS NULL
                AND data_solicitacao_devolucao IS NOT NULL
            """, (
                data_hoje(),
                id_emprestimo
            ))

            if cursor.rowcount != 1:
                conexao.rollback()
                return responder_erro(
                    self,
                    "Não foi possível confirmar essa devolução."
                )

            conexao.commit()

            return responder_json(
                self,
                {"mensagem": "Devolução registrada com sucesso!"}
            )

        except sqlite3.Error as erro:
            conexao.rollback()
            print("Erro ao registrar devolução:", erro)

            return responder_erro(
                self,
                "Não foi possível registrar a devolução.",
                500
            )

        finally:
            conexao.close()


# =========================================================
# INICIAR SERVIDOR
# =========================================================

if __name__ == "__main__":
    if not BANCO.exists():
        print("ERRO: Banco de dados não encontrado!")
        print("Caminho esperado:", BANCO)
        raise SystemExit(1)

    # Verificar e preparar a coluna de solicitação de devolução
    with conectar_banco() as conn:
        colunas = conn.execute(
            "PRAGMA table_info(emprestimo)"
        ).fetchall()

        nomes_colunas = [coluna["name"] for coluna in colunas]

        if "data_solicitacao_devolucao" not in nomes_colunas:
            conn.execute("""
                ALTER TABLE emprestimo
                ADD COLUMN data_solicitacao_devolucao TEXT
            """)

            print("Coluna de solicitação de devolução criada!")

        else:
            print("Coluna de solicitação de devolução já existe!")

    # Verificar a estrutura atual do banco de dados
    with conectar_banco() as conn:
        tabelas = conn.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
        """).fetchall()

        print("\nESTRUTURA DO BANCO DE DADOS:")

        for tabela in tabelas:
            print(f"\nTabela: {tabela['name']}")

            colunas = conn.execute(
                f"PRAGMA table_info({tabela['name']})"
            ).fetchall()

            for coluna in colunas:
                print(" -", coluna["name"])

    servidor = ThreadingHTTPServer(
        (HOST, PORTA),
        TechBookHandler
    )

    print("=" * 50)
    print("TECHBOOK - SERVIDOR INICIADO")
    print("=" * 50)
    print(f"Banco de dados: {BANCO}")
    print(f"Porta: {PORTA}")
    print("Servidor aguardando conexões...")
    print("Use a porta 8000 no ambiente de desenvolvimento.")
    print("=" * 50)

    try:
        servidor.serve_forever()

    except KeyboardInterrupt:
        print("\nEncerrando servidor...")

    finally:
        servidor.server_close()
        print("Servidor encerrado.")

        