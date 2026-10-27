
import json
import sqlite3
import hashlib
import secrets
import hmac
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"

# Sessões ativas dos bibliotecários.
# As sessões são encerradas quando o servidor é reiniciado.
SESSOES_BIBLIOTECARIOS = {}
DURACAO_SESSAO = 8 * 60 * 60  # 8 horas


def gerar_hash_senha(senha, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)

    hash_senha = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode("utf-8"),
        salt.encode("utf-8"),
        200000
    ).hex()

    return f"{salt}${hash_senha}"


def verificar_senha(senha, hash_salvo):
    try:
        salt, hash_original = hash_salvo.split("$", 1)
        hash_teste = hashlib.pbkdf2_hmac(
            "sha256",
            senha.encode("utf-8"),
            salt.encode("utf-8"),
            200000
        ).hex()

        return hmac.compare_digest(hash_teste, hash_original)

    except (AttributeError, ValueError):
        return False


def responder_json(handler, status, dados, cabecalhos=None):
    conteudo = json.dumps(
        dados, ensure_ascii=False
    ).encode("utf-8")

    handler.send_response(status)
    handler.send_header(
        "Content-Type", "application/json; charset=utf-8"
    )
    handler.send_header("Content-Length", str(len(conteudo)))
    handler.send_header("Cache-Control", "no-store")

    if cabecalhos:
        for nome, valor in cabecalhos.items():
            handler.send_header(nome, valor)

    handler.end_headers()
    handler.wfile.write(conteudo)


def cookie_seguro(handler):
    # No Codespaces com HTTPS, ativa a proteção Secure.
    return (
        handler.headers.get("X-Forwarded-Proto", "").lower()
        == "https"
    )


class TechBookHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(
            *args, directory=str(BASE_DIR), **kwargs
        )

    def caminho_requisicao(self):
        return urlsplit(self.path).path

    def obter_sessao_bibliotecario(self):
        cookies = SimpleCookie()

        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None

        item = cookies.get("techbook_bibliotecario")
        if item is None:
            return None

        token = item.value

        if not token:
            return None

        return SESSOES_BIBLIOTECARIOS.get(token)

    def bibliotecario_autenticado(self):
        return self.obter_sessao_bibliotecario() is not None

    def enviar_cookie_sessao(self, token):
        partes = [
            f"techbook_bibliotecario={token}",
            "Path=/",
            f"Max-Age={DURACAO_SESSAO}",
            "HttpOnly",
            "SameSite=Strict"
        ]

        if cookie_seguro(self):
            partes.append("Secure")

        return "; ".join(partes)

    def apagar_cookie_sessao(self):
        partes = [
            "techbook_bibliotecario=",
            "Path=/",
            "Max-Age=0",
            "HttpOnly",
            "SameSite=Strict"
        ]

        if cookie_seguro(self):
            partes.append("Secure")

        return "; ".join(partes)

    def do_GET(self):
        caminho = self.caminho_requisicao()

        # A página administrativa exige login.
        if caminho == "/bibliotecario.html":
            if not self.bibliotecario_autenticado():
                mensagem = (
                    "Acesso restrito. Entre como bibliotecário "
                    "para acessar esta página."
                ).encode("utf-8")

                self.send_response(401)
                self.send_header(
                    "Content-Type", "text/plain; charset=utf-8"
                )
                self.send_header(
                    "Content-Length", str(len(mensagem))
                )
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(mensagem)
                return

        # Proteção para futuras rotas administrativas.
        if caminho.startswith("/api/admin/"):
            if not self.bibliotecario_autenticado():
                responder_json(
                    self, 401,
                    {"erro": "Faça login como bibliotecário."}
                )
                return

        # Verifica se o bibliotecário continua autenticado.
        if caminho == "/api/sessao-bibliotecario":
            bibliotecario = self.obter_sessao_bibliotecario()

            if bibliotecario is None:
                responder_json(
                    self, 401,
                    {"autenticado": False}
                )
                return

            responder_json(self, 200, {
                "autenticado": True,
                "bibliotecario": bibliotecario
            })
            return

        # Catálogo público, preservando a consulta existente.
        if caminho == "/api/livros":
            try:
                with sqlite3.connect(BANCO) as conexao:
                    conexao.row_factory = sqlite3.Row

                    livros = conexao.execute("""
                        SELECT
                            l.id_livro, l.isbn, l.titulo, l.genero,
                            l.editora, l.autor, l.ano_publicacao,
                            COUNT(
                                CASE WHEN e.estado = 'Bom'
                                THEN e.id_exemplar END
                            ) AS quantidade,
                            COUNT(
                                CASE WHEN e.estado = 'Bom'
                                AND em.id_emprestimo IS NULL
                                THEN e.id_exemplar END
                            ) AS disponiveis
                        FROM livro l
                        LEFT JOIN exemplar e
                            ON e.id_livro = l.id_livro
                        LEFT JOIN emprestimo em
                            ON em.id_exemplar = e.id_exemplar
                            AND em.data_devolucao IS NULL
                        GROUP BY
                            l.id_livro, l.isbn, l.titulo, l.genero,
                            l.editora, l.autor, l.ano_publicacao
                        ORDER BY l.titulo
                    """).fetchall()

                responder_json(
                    self, 200,
                    [dict(livro) for livro in livros]
                )

            except sqlite3.Error:
                responder_json(self, 500, {
                    "erro": "Não foi possível consultar os livros."
                })

            return

        super().do_GET()

    def do_POST(self):
        caminho = self.caminho_requisicao()

        # Todas as futuras operações administrativas exigirão sessão.
        if caminho.startswith("/api/admin/"):
            if not self.bibliotecario_autenticado():
                responder_json(self, 401, {
                    "erro": "Faça login como bibliotecário."
                })
                return

            responder_json(self, 404, {
                "erro": "Função administrativa ainda não implementada."
            })
            return

        rotas_permitidas = (
            "/api/cadastro",
            "/api/login",
            "/api/login-bibliotecario",
            "/api/logout-bibliotecario"
        )

        if caminho not in rotas_permitidas:
            responder_json(self, 404, {
                "erro": "Rota não encontrada."
            })
            return

        # Encerrar a sessão do bibliotecário.
        if caminho == "/api/logout-bibliotecario":
            cookies = SimpleCookie()

            try:
                cookies.load(self.headers.get("Cookie", ""))
            except Exception:
                pass

            item = cookies.get("techbook_bibliotecario")

            if item is not None:
                SESSOES_BIBLIOTECARIOS.pop(item.value, None)

            responder_json(
                self, 200,
                {"mensagem": "Sessão encerrada."},
                {
                    "Set-Cookie": self.apagar_cookie_sessao()
                }
            )
            return

        try:
            tamanho = int(
                self.headers.get("Content-Length", "0")
            )

            if tamanho <= 0 or tamanho > 10000:
                responder_json(self, 400, {
                    "erro": "Dados inválidos."
                })
                return

            recebido = json.loads(
                self.rfile.read(tamanho).decode("utf-8")
            )

            if not isinstance(recebido, dict):
                responder_json(self, 400, {
                    "erro": "Dados inválidos."
                })
                return

            # LOGIN DO BIBLIOTECÁRIO
            if caminho == "/api/login-bibliotecario":
                usuario = recebido.get("usuario", "")
                senha = recebido.get("senha", "")

                if (
                    not isinstance(usuario, str)
                    or not isinstance(senha, str)
                ):
                    responder_json(self, 400, {
                        "erro": "Dados inválidos."
                    })
                    return

                usuario = usuario.strip()

                if not usuario or not senha:
                    responder_json(self, 400, {
                        "erro": "Informe o usuário e a senha."
                    })
                    return

                with sqlite3.connect(BANCO) as conexao:
                    conexao.row_factory = sqlite3.Row

                    bibliotecario = conexao.execute("""
                        SELECT
                            id_bibliotecario, nome, usuario, senha_hash
                        FROM bibliotecario
                        WHERE usuario = ? AND ativo = 1
                    """, (usuario,)).fetchone()

                if (
                    bibliotecario is None
                    or not verificar_senha(
                        senha, bibliotecario["senha_hash"]
                    )
                ):
                    responder_json(self, 401, {
                        "erro": "Usuário ou senha incorretos."
                    })
                    return

                # Gera um token aleatório para a sessão.
                token = secrets.token_urlsafe(32)

                dados_bibliotecario = {
                    "id": bibliotecario["id_bibliotecario"],
                    "nome": bibliotecario["nome"],
                    "usuario": bibliotecario["usuario"]
                }

                SESSOES_BIBLIOTECARIOS[token] = dados_bibliotecario

                responder_json(
                    self, 200,
                    {
                        "mensagem": "Login realizado com sucesso!",
                        "bibliotecario": dados_bibliotecario
                    },
                    {
                        "Set-Cookie": self.enviar_cookie_sessao(token)
                    }
                )
                return

            # LOGIN DO ALUNO
            if caminho == "/api/login":
                matricula = recebido.get("matricula", "")
                senha = recebido.get("senha", "")

                if (
                    not isinstance(matricula, str)
                    or not isinstance(senha, str)
                ):
                    responder_json(self, 400, {
                        "erro": "Dados inválidos."
                    })
                    return

                matricula = matricula.strip()

                if not matricula or not senha:
                    responder_json(self, 400, {
                        "erro": "Informe a matrícula e a senha."
                    })
                    return

                with sqlite3.connect(BANCO) as conexao:
                    conexao.row_factory = sqlite3.Row

                    aluno = conexao.execute("""
                        SELECT
                            id_aluno, nome, matricula, turma, senha_hash
                        FROM aluno
                        WHERE matricula = ?
                    """, (matricula,)).fetchone()

                if (
                    aluno is None
                    or not aluno["senha_hash"]
                    or not verificar_senha(
                        senha, aluno["senha_hash"]
                    )
                ):
                    responder_json(self, 401, {
                        "erro": "Matrícula ou senha incorreta."
                    })
                    return

                responder_json(self, 200, {
                    "mensagem": "Login realizado com sucesso!",
                    "aluno": {
                        "id": aluno["id_aluno"],
                        "nome": aluno["nome"],
                        "matricula": aluno["matricula"],
                        "turma": aluno["turma"]
                    }
                })
                return

            # CADASTRO DO ALUNO
            nome = recebido.get("nome", "")
            matricula = recebido.get("matricula", "")
            turma = recebido.get("turma", "")
            senha = recebido.get("senha", "")

            if not all(
                isinstance(campo, str)
                for campo in (nome, matricula, turma, senha)
            ):
                responder_json(self, 400, {
                    "erro": "Dados inválidos."
                })
                return

            nome = nome.strip()
            matricula = matricula.strip()
            turma = turma.strip()

            if not nome or not matricula or not turma:
                responder_json(self, 400, {
                    "erro": "Preencha todos os campos."
                })
                return

            if len(senha) < 8:
                responder_json(self, 400, {
                    "erro": "A senha precisa ter pelo menos 8 caracteres."
                })
                return

            if (
                len(nome) > 100
                or len(matricula) > 30
                or len(turma) > 30
            ):
                responder_json(self, 400, {
                    "erro": "Confira o tamanho dos campos."
                })
                return

            senha_hash = gerar_hash_senha(senha)

            with sqlite3.connect(BANCO) as conexao:
                existente = conexao.execute(
                    "SELECT 1 FROM aluno WHERE matricula = ?",
                    (matricula,)
                ).fetchone()

                if existente:
                    responder_json(self, 409, {
                        "erro": "Matrícula já cadastrada."
                    })
                    return

                cursor = conexao.execute("""
                    INSERT INTO aluno
                    (matricula, nome, turma, data_cadastro, senha_hash)
                    VALUES (?, ?, ?, date('now'), ?)
                """, (matricula, nome, turma, senha_hash))

                id_aluno = cursor.lastrowid

            responder_json(self, 201, {
                "mensagem": "Cadastro realizado com sucesso!",
                "aluno": {
                    "id": id_aluno,
                    "nome": nome,
                    "matricula": matricula,
                    "turma": turma
                }
            })

        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            responder_json(self, 400, {
                "erro": "Dados inválidos."
            })

        except sqlite3.Error:
            responder_json(self, 500, {
                "erro": "Erro ao consultar ou salvar os dados."
            })


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(
        ("0.0.0.0", 8000),
        TechBookHandler
    )

    print("TechBook iniciado na porta 8000!")
    print("Catálogo: /api/livros")
    servidor.serve_forever()
