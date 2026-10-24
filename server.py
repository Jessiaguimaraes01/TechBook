
import json
import sqlite3
import hashlib
import secrets
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"
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


def responder_json(handler, status, dados):
    conteudo = json.dumps(
        dados,
        ensure_ascii=False
    ).encode("utf-8")

    handler.send_response(status)
    handler.send_header(
        "Content-Type",
        "application/json; charset=utf-8"
    )
    handler.send_header("Content-Length", str(len(conteudo)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(conteudo)

class TechBookHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/livros":
            try:
                with sqlite3.connect(BANCO) as conexao:
                    conexao.row_factory = sqlite3.Row

                    livros = conexao.execute("""
                        SELECT
                            l.id_livro,
                            l.isbn,
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
                            l.isbn,
                            l.titulo,
                            l.genero,
                            l.editora,
                            l.autor,
                            l.ano_publicacao
                        ORDER BY l.titulo
                    """).fetchall()

                dados = json.dumps(
                    [dict(livro) for livro in livros],
                    ensure_ascii=False
                ).encode("utf-8")

                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )
                self.send_header("Content-Length", str(len(dados)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(dados)

            except sqlite3.Error:
                dados = json.dumps({
                    "erro": "Não foi possível consultar os livros."
                }).encode("utf-8")

                self.send_response(500)
                self.send_header(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)

        else:
            super().do_GET()


    def do_POST(self):
        if self.path != "/api/cadastro":
            responder_json(self, 404, {
                "erro": "Rota não encontrada."
            })
            return

        try:
            tamanho = int(self.headers.get("Content-Length", "0"))

            if tamanho <= 0 or tamanho > 10000:
                responder_json(self, 400, {
                    "erro": "Dados inválidos."
                })
                return

            recebido = json.loads(
                self.rfile.read(tamanho).decode("utf-8")
            )

            nome = str(recebido.get("nome", "")).strip()
            matricula = str(recebido.get("matricula", "")).strip()
            turma = str(recebido.get("turma", "")).strip()
            senha = recebido.get("senha", "")

            if not nome or not matricula or not turma:
                responder_json(self, 400, {
                    "erro": "Preencha todos os campos."
                })
                return

            if not isinstance(senha, str) or len(senha) < 8:
                responder_json(self, 400, {
                    "erro": "A senha precisa ter pelo menos 8 caracteres."
                })
                return

            if len(nome) > 100 or len(matricula) > 30 or len(turma) > 30:
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

        except (ValueError, json.JSONDecodeError):
            responder_json(self, 400, {
                "erro": "Dados inválidos."
            })

        except sqlite3.Error:
            responder_json(self, 500, {
                "erro": "Erro ao salvar o cadastro."
            })

if __name__ == "__main__":
    servidor = ThreadingHTTPServer(
        ("0.0.0.0", 8000),
        TechBookHandler
    )

    print("TechBook iniciado na porta 8000!")
    print("Abra /api/livros no navegador para testar.")
    servidor.serve_forever()


      