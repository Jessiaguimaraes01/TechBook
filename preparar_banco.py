
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"

with sqlite3.connect(BANCO) as conexao:
    colunas = conexao.execute(
        "PRAGMA table_info(aluno)"
    ).fetchall()

    nomes_colunas = [coluna[1] for coluna in colunas]

    if "senha_hash" not in nomes_colunas:
        conexao.execute(
            "ALTER TABLE aluno ADD COLUMN senha_hash TEXT"
        )
        print("Coluna de senha protegida criada!")

    else:
        print("A coluna senha_hash já existe.")

print("Preparação concluída!")
