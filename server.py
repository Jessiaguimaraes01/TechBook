
import sqlite3
from pathlib import Path

# Localiza o banco de dados do TecBook
BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"

def testar_banco():
    conexao = sqlite3.connect(BANCO)

    livros = conexao.execute(
        "SELECT id_livro, titulo, autor FROM livro LIMIT 5"
    ).fetchall()

    print("Conexão com o banco realizada!")
    print("\nPrimeiros livros encontrados:")

    for livro in livros:
        print(livro)

    conexao.close()

if __name__ == "__main__":
    testar_banco()
