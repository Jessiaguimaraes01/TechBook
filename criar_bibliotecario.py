
import sqlite3
import hashlib
import secrets
import getpass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BANCO = BASE_DIR / "Dados" / "TechBok_Final.db"


def gerar_hash_senha(senha):
    salt = secrets.token_hex(16)
    hash_senha = hashlib.pbkdf2_hmac(
        "sha256",
        senha.encode("utf-8"),
        salt.encode("utf-8"),
        200000
    ).hex()
    return f"{salt}${hash_senha}"


def main():
    if not BANCO.exists():
        print("Banco de dados não encontrado:", BANCO)
        return

    print("=== Cadastro do bibliotecário ===")
    nome = input("Nome do bibliotecário: ").strip()
    usuario = input("Nome de usuário para entrar: ").strip()

    if not nome or not usuario:
        print("Nome e usuário são obrigatórios.")
        return

    senha = getpass.getpass("Crie uma senha (mínimo 10 caracteres): ")
    confirmar = getpass.getpass("Digite a senha novamente: ")

    if len(senha) < 10:
        print("A senha precisa ter pelo menos 10 caracteres.")
        return

    if senha != confirmar:
        print("As senhas não coincidem.")
        return

    try:
        with sqlite3.connect(BANCO) as conexao:
            existente = conexao.execute(
                "SELECT 1 FROM bibliotecario WHERE usuario = ?",
                (usuario,)
            ).fetchone()

            if existente:
                print("Esse nome de usuário já está cadastrado.")
                return

            conexao.execute("""
                INSERT INTO bibliotecario
                    (nome, usuario, senha_hash)
                VALUES (?, ?, ?)
            """, (nome, usuario, gerar_hash_senha(senha)))

        print("Conta de bibliotecário criada com sucesso!")

    except sqlite3.Error as erro:
        print("Erro ao criar a conta:", erro)


if __name__ == "__main__":
    main()
