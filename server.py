
import json
import sqlite3
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Caminho da pasta do projeto e do banco de dados
BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"


class TecBookHandler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/livros":
            try:
                with sqlite3.connect(BANCO) as conexao:
                    conexao.row_factory = sqlite3.Row

                    livros = conexao.execute("""
                        SELECT id_livro, titulo, autor, genero,
                               editora, ano_publicacao, isbn
                        FROM livro
                        ORDER BY titulo
                    """).fetchall()

                resultado = [dict(livro) for livro in livros]
                dados = json.dumps(
                    resultado, ensure_ascii=False
                ).encode("utf-8")

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(dados)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(dados)

            except sqlite3.Error:
                dados = json.dumps({
                    "erro": "Não foi possível consultar os livros."
                }).encode("utf-8")

                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(dados)))
                self.end_headers()
                self.wfile.write(dados)

        else:
            super().do_GET()


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(
        ("0.0.0.0", 8000), TecBookHandler
    )

    print("TecBook iniciado na porta 8000!")
    print("Abra /api/livros no navegador para testar.")
    servidor.serve_forever()
