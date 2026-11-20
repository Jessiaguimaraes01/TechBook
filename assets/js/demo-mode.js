/* TechBook: demonstração local. Os dados ficam apenas nesta aba e são reiniciados ao fechá-la. */
(function(){
 const KEY='techbook_demo_state_v1';
 const books=[
 {id:1,titulo:'O Pequeno Príncipe',autor:'Antoine de Saint-Exupéry',genero:'Aventura',sinopse:'Um clássico sobre amizade, afeto e o olhar curioso sobre o mundo.',capa:'assets/img/capas/livro-1.svg',quantidade:5,disponiveis:4,duracao:'curta'},
 {id:2,titulo:'Dom Casmurro',autor:'Machado de Assis',genero:'Romance',sinopse:'Um dos grandes romances da literatura brasileira, narrado por Bentinho.',capa:'assets/img/capas/livro-2.svg',quantidade:4,disponiveis:3,duracao:'longa'},
 {id:3,titulo:'Alice no País das Maravilhas',autor:'Lewis Carroll',genero:'Fantasia',sinopse:'Uma aventura fantástica por um mundo cheio de personagens inesperados.',capa:'assets/img/capas/livro-3.svg',quantidade:4,disponiveis:3,duracao:'curta'},
 {id:4,titulo:'A Menina que Roubava Livros',autor:'Markus Zusak',genero:'Drama',sinopse:'Uma história emocionante sobre livros, coragem e humanidade.',capa:'assets/img/capas/livro-4.svg',quantidade:3,disponiveis:2,duracao:'longa'},
 {id:5,titulo:'O Hobbit',autor:'J. R. R. Tolkien',genero:'Fantasia',sinopse:'Bilbo Bolseiro parte para uma jornada inesperada pela Terra-média.',capa:'assets/img/capas/livro-5.svg',quantidade:5,disponiveis:4,duracao:'longa'},
 {id:6,titulo:'Extraordinário',autor:'R. J. Palacio',genero:'Drama',sinopse:'Uma história sobre empatia, amizade e respeito às diferenças.',capa:'assets/img/capas/livro-6.svg',quantidade:4,disponiveis:4,duracao:'curta'},
 {id:7,titulo:'A Ilha do Tesouro',autor:'Robert Louis Stevenson',genero:'Aventura',sinopse:'Uma clássica aventura de mapas, mistérios e descobertas.',capa:'assets/img/capas/livro-7.svg',quantidade:3,disponiveis:3,duracao:'longa'},
 {id:8,titulo:'O Mistério do Cinco Estrelas',autor:'Marcos Rey',genero:'Mistério',sinopse:'Um jovem mensageiro se envolve em um mistério intrigante.',capa:'assets/img/capas/livro-8.svg',quantidade:3,disponiveis:3,duracao:'curta'}
 ];
 function load(){try{return JSON.parse(sessionStorage.getItem(KEY))||null}catch(e){return null}}
 function save(s){sessionStorage.setItem(KEY,JSON.stringify(s))}
 let state=load(); if(!state){state={loans:[
 {id:1,bookId:1,status:'emprestado',start:today(),due:addDays(10),returned:''},
 {id:2,bookId:3,status:'emprestado',start:today(),due:addDays(14),returned:''}
 ],nextId:3};save(state)}
 function today(){return new Date().toISOString().slice(0,10)}
 function addDays(n){let d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
 function getBooks(){return books.map(b=>({...b,disponiveis:Math.max(0,b.quantidade-state.loans.filter(l=>l.bookId===b.id&&!l.returned).length)}));}
 function getLoans(){return state.loans.map(l=>{const b=books.find(x=>x.id===l.bookId)||books[0];return {id_emprestimo:l.id,id:l.id,id_livro:b.id,titulo:b.titulo,autor:b.autor,codigo_exemplar:'TB-'+String(l.id).padStart(3,'0'),data_emprestimo:l.start,data_prevista_devolucao:l.due,data_devolucao:l.returned||'',status:l.status,atrasado:!l.returned&&l.due<today()}})}
 function requestLoan(bookId){const b=books.find(x=>x.id===Number(bookId));if(!b)throw Error('Livro não encontrado.');const active=state.loans.filter(l=>l.bookId===b.id&&!l.returned).length;if(active>=b.quantidade)throw Error('Não há exemplares disponíveis.');const l={id:state.nextId++,bookId:b.id,status:'emprestado',start:today(),due:addDays(14),returned:''};state.loans.push(l);save(state);return l}
 function returnLoan(id){const l=state.loans.find(x=>x.id===Number(id));if(!l||l.returned)throw Error('Este empréstimo já foi finalizado.');l.returned=today();l.status='devolvido';save(state);return l}
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 window.TB_DEMO={books,getBooks,getLoans,requestLoan,returnLoan,student:{nome:'Visitante TechBook',matricula:'DEMO-2026',turma:'2º Ano B'},reset(){sessionStorage.removeItem(KEY);location.reload()},esc};
})();
