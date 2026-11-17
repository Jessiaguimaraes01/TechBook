
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"

with sqlite3.connect(BANCO) as conexao:
    tabelas = conexao.execute("""
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
    """).fetchall()

    for (tabela,) in tabelas:
        print(f"\n=== TABELA: {tabela} ===")

        colunas = conexao.execute(
            f'PRAGMA table_info("{tabela}")'
        ).fetchall()

        for coluna in colunas:
            print(f"- {coluna[1]} ({coluna[2]})")
