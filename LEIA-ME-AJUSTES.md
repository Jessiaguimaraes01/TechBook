# TechBook — pacote de ajustes

Este pacote reúne os ajustes nas páginas solicitadas e mantém o projeto original dentro de uma cópia separada.

## O que foi ajustado

- `techbook.html`: mantém o visual do TechScanner com a corujinha; consulta e grava livros no acervo do servidor, em vez de guardar os cadastros somente no navegador.
- `scanner.html`: agora encaminha para o TechScanner escolhido (`techbook.html`).
- `bibliotecario.html`: atalhos do scanner apontam para `techbook.html`; atalho de empréstimos usa `emprestimo.html`.
- `emprestimos-aluno.html`: página do aluno reconstruída, com solicitação de empréstimo, acompanhamento e pedido de devolução.
- `emprestimos.html` e `assets/js/emprestimos.js`: controle do bibliotecário mantido e corrigido para confirmar devoluções solicitadas.
- `emprestimo.html` e `emprestimo-aluno.html`: atalhos com os nomes no singular para as páginas principais existentes.
- `server.py`: migração idempotente dos registros das tabelas antigas (`aluno`, `livro`, `exemplar`, `emprestimo`) para as tabelas atuais; campos de editora, ano e capa; rotas usadas pelas páginas; confirmação de devolução protegida.
- `clubes.html` e `assets/css/clubes.css`: caminhos de CSS/JavaScript corrigidos e identidade visual harmonizada.
- `minha_estante_virtual_cabecalho_vinho.html` e `amigos_de_leitura_completo.html`: ajustes de identidade visual para combinar com o tema principal.
- `login.html` e `cadastro.html`: textos existentes preservados e tipografia dos títulos/campos ampliada.
- `jogos.html`: página reservada para o futuro jogo, sem integrar o jogo ainda.

## O que foi preservado

- `index.html` não foi alterado.
- `ranking.html` não foi alterado.
- O banco original `Dados/TechBok_Final.db` foi incluído sem modificação. Na primeira inicialização, `server.py` copia os registros antigos para as tabelas atuais sem apagar as tabelas antigas. A migração pode ser executada novamente sem duplicar os registros já copiados.
- `app.py` continua vazio e não é necessário: o servidor utilizado pelo projeto é `server.py`.

## Observações importantes

- Faça uma cópia de segurança do seu repositório antes de substituir arquivos.
- A primeira execução de `server.py` aplica a migração no banco que estiver na pasta `Dados`. Não apague as tabelas antigas: elas são mantidas como origem dos dados.
- Contas antigas que não possuem `senha_hash` continuam preservadas, mas não conseguem autenticar com senha até que tenham uma senha cadastrada por um processo administrativo seguro. Não foi criada uma senha padrão para elas.
- A Estante, Amigos e Clubes mantêm recursos locais que usam `localStorage`; esses dados não são sincronizados entre dispositivos pelo servidor nesta versão.
- A câmera do TechScanner depende de permissão do navegador e de contexto seguro (HTTPS ou localhost). A busca de metadados usa Google Books/Open Library e depende de conexão com a internet.

## Verificações realizadas

- Compilação/sintaxe Python de `server.py`.
- Sintaxe JavaScript dos arquivos externos e dos scripts inline revisados.
- Migração testada em uma cópia temporária do banco, sem alterar o banco incluído no ZIP.
- Testes HTTP em servidor temporário: leitura do acervo, cadastro pelo scanner, cadastro/login de aluno, empréstimo, solicitação de devolução e confirmação pelo bibliotecário.

A câmera física e a aparência em todos os tamanhos de tela ainda precisam de conferência no navegador usado pela equipe.
