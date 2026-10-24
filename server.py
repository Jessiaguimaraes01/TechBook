
import json
import sqlite3
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"


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


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(
        ("0.0.0.0", 8000),
        TechBookHandler
    )

    print("TechBook iniciado na porta 8000!")
    print("Abra /api/livros no navegador para testar.")
    servidor.serve_forever()
