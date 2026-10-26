

        else:
            super().do_GET()

    def do_POST(self):
        if self.path not in ("/api/cadastro", "/api/login"):
            responder_json(self, 404, {"erro": "Rota não encontrada."})
            return

        try:
            tamanho = int(self.headers.get("Content-Length", "0"))
            if tamanho <= 0 or tamanho > 10000:
                responder_json(self, 400, {"erro": "Dados inválidos."})
                return

            recebido = json.loads(self.rfile.read(tamanho).decode("utf-8"))
            if not isinstance(recebido, dict):
                responder_json(self, 400, {"erro": "Dados inválidos."})
                return

            if self.path == "/api/login":
                matricula = recebido.get("matricula", "")
                senha = recebido.get("senha", "")
                if not isinstance(matricula, str) or not isinstance(senha, str):
                    responder_json(self, 400, {"erro": "Dados inválidos."})
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
                        SELECT id_aluno, nome, matricula, turma, senha_hash
                        FROM aluno WHERE matricula = ?
                    """, (matricula,)).fetchone()

                if (aluno is None or not aluno["senha_hash"]
                        or not verificar_senha(senha, aluno["senha_hash"])):
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

            nome = str(recebido.get("nome", "")).strip()
            matricula = str(recebido.get("matricula", "")).strip()
            turma = str(recebido.get("turma", "")).strip()
            senha = recebido.get("senha", "")

            if not nome or not matricula or not turma:
                responder_json(self, 400, {"erro": "Preencha todos os campos."})
                return
            if not isinstance(senha, str) or len(senha) < 8:
                responder_json(self, 400, {
                    "erro": "A senha precisa ter pelo menos 8 caracteres."
                })
                return
            if len(nome) > 100 or len(matricula) > 30 or len(turma) > 30:
                responder_json(self, 400, {"erro": "Confira o tamanho dos campos."})
                return

            senha_hash = gerar_hash_senha(senha)
            with sqlite3.connect(BANCO) as conexao:
                existente = conexao.execute(
                    "SELECT 1 FROM aluno WHERE matricula = ?", (matricula,)
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
            responder_json(self, 400, {"erro": "Dados inválidos."})
        except sqlite3.Error:
            responder_json(self, 500, {
                "erro": "Erro ao consultar ou salvar os dados."
            })


if __name__ == "__main__":
    servidor = ThreadingHTTPServer(("0.0.0.0", 8000), TechBookHandler)
    print("TechBook iniciado na porta 8000!")
    print("Abra /api/livros no navegador para testar.")
    servidor.serve_forever()
