// Biblioteca de objetivos do Binguey: é o que move o app.
//
// Regras para escrever um objetivo:
//  - é uma CONQUISTA de jogo: concluir, derrotar, vencer, desbloquear, construir. Nada de piada, de
//    "morrer de um jeito bobo" nem de tarefa de menu;
//  - o jogo costuma mostrar algo na tela quando se cumpre ("Missão concluída", "Chefe derrotado"), e o CLIP de
//    20 s é a prova: prefira o que se VÊ;
//  - frase curta no infinitivo, até 80 caracteres, sem apóstrofo;
//  - dificuldade 1 a 5 (a maioria entre 2 e 4; 5 = raro ou muito difícil).
//
// Tipos: B chefe · C combate · L coletar/construir · N missões e personagens · E explorar/progredir · M partidas e habilidade
// Depois de editar:  node supabase/goals/build.mjs   (valida e gera supabase/seed.sql)

/** Objetivos que servem para (quase) qualquer jogo. */
export const generic = [
  // ---- chefes
  ["Derrotar um chefe", "B", 3],
  ["Derrotar um mini-chefe", "B", 2],
  ["Derrotar um chefe de primeira", "B", 5],
  ["Derrotar um chefe sem usar cura", "B", 5],
  ["Derrotar um chefe sem tomar dano", "B", 5],
  ["Derrotar um chefe sem morrer", "B", 4],
  ["Derrotar um chefe opcional", "B", 4],
  ["Derrotar um chefe em menos de 2 minutos", "B", 4],
  ["Derrotar um chefe usando só ataques à distância", "B", 4],
  ["Derrotar um chefe com a ajuda de um aliado", "B", 3],
  ["Derrotar um chefe sozinho que o jogo recomenda em grupo", "B", 5],
  ["Derrotar dois chefes seguidos", "B", 4],
  ["Derrotar um chefe depois de perder para ele", "B", 3],
  ["Derrotar o chefe final de um jogo", "B", 5],
  ["Superar a segunda fase de um chefe", "B", 3],
  ["Derrotar um chefe com uma arma que você nunca usou", "B", 4],
  ["Derrotar um chefe em dificuldade alta", "B", 5],

  // ---- combate
  ["Derrotar 10 inimigos seguidos sem morrer", "C", 3],
  ["Derrotar 20 inimigos sem tomar dano", "C", 4],
  ["Vencer um combate sem tomar dano", "C", 4],
  ["Vencer uma luta com menos de 10% de vida", "C", 4],
  ["Derrotar um inimigo muito mais forte que você", "C", 4],
  ["Derrotar um grupo de inimigos sozinho", "C", 3],
  ["Derrotar um inimigo com um tiro na cabeça", "C", 3],
  ["Derrotar 5 inimigos à distância", "C", 2],
  ["Derrotar um inimigo pelas costas sem ser visto", "C", 3],
  ["Derrotar dois inimigos com um só ataque", "C", 3],
  ["Defender ou aparar um ataque no tempo certo", "C", 3],
  ["Esquivar de um ataque no último instante", "C", 3],
  ["Fazer um combo de 5 golpes ou mais", "C", 3],
  ["Acertar um golpe crítico", "C", 2],
  ["Derrotar um inimigo voador", "C", 2],
  ["Derrotar um inimigo com fogo, veneno ou gelo", "C", 3],
  ["Derrotar um inimigo usando o cenário", "C", 4],
  ["Derrotar um inimigo com uma habilidade especial", "C", 2],
  ["Passar por uma área inteira sem ser detectado", "C", 4],
  ["Derrotar todos os inimigos de uma área", "C", 3],
  ["Vencer uma luta cercado por inimigos", "C", 4],
  ["Fugir de uma luta perdida e sobreviver", "C", 2],
  ["Derrotar um inimigo de elite", "C", 3],
  ["Quebrar a guarda de um inimigo forte", "C", 3],
  ["Vencer uma luta sem usar nenhum item", "C", 3],
  ["Usar um item de cura no último segundo e vencer", "C", 3],
  ["Derrotar um inimigo com uma arma que você nunca usou", "C", 3],
  ["Eliminar um alvo com um único golpe ou tiro", "C", 3],
  ["Derrotar 30 inimigos em 10 minutos", "C", 3],
  ["Derrotar um grupo inteiro sem sofrer dano", "C", 5],
  ["Sobreviver a uma emboscada", "C", 3],
  ["Vencer uma luta usando só ataques corpo a corpo", "C", 2],
  ["Vencer uma luta usando só magia ou habilidades", "C", 3],

  // ---- coletar, construir, evoluir
  ["Encontrar um item raro", "L", 3],
  ["Encontrar um item lendário ou épico", "L", 5],
  ["Melhorar um equipamento até um nível alto", "L", 4],
  ["Construir ou fabricar um item avançado", "L", 3],
  ["Juntar 100 unidades de um recurso", "L", 3],
  ["Completar um conjunto de equipamento", "L", 4],
  ["Completar uma coleção", "L", 4],
  ["Abrir 5 baús ou tesouros", "L", 2],
  ["Encontrar um tesouro escondido", "L", 3],
  ["Comprar um item caro em uma loja", "L", 3],
  ["Juntar uma quantia grande de dinheiro ou pontos", "L", 3],
  ["Desbloquear uma habilidade nova", "L", 2],
  ["Desbloquear uma conquista ou troféu", "L", 3],
  ["Desbloquear um troféu raro", "L", 5],
  ["Melhorar uma arma ao máximo", "L", 5],
  ["Montar uma build ou equipe completa", "L", 3],
  ["Pescar ou caçar algo raro", "L", 3],
  ["Minerar um recurso raro", "L", 3],
  ["Construir uma base ou abrigo completo", "L", 4],
  ["Fabricar uma arma nova", "L", 3],
  ["Encontrar todos os itens de uma área", "L", 4],
  ["Desbloquear um personagem ou classe novo", "L", 3],
  ["Gastar todos os pontos de habilidade disponíveis", "L", 2],
  ["Conseguir um item de uma missão secundária", "L", 3],
  ["Encontrar uma receita ou projeto raro", "L", 3],
  ["Conseguir um veículo ou montaria nova", "L", 3],
  ["Preparar uma refeição ou poção que dê bônus", "L", 2],
  ["Montar um inventário completo para uma missão difícil", "L", 2],
  ["Subir um personagem ou arma de nível", "L", 2],

  // ---- missões e personagens
  ["Concluir uma missão", "N", 3],
  ["Concluir 3 missões", "N", 4],
  ["Concluir uma missão secundária", "N", 3],
  ["Concluir uma missão difícil", "N", 4],
  ["Concluir uma missão sem ser visto", "N", 4],
  ["Concluir uma missão de escolta ou defesa", "N", 4],
  ["Recrutar um aliado ou companheiro", "N", 3],
  ["Salvar um aliado em perigo", "N", 3],
  ["Fazer uma escolha importante na história", "N", 3],
  ["Concluir um capítulo da história", "N", 4],
  ["Vencer um duelo contra um personagem", "N", 4],
  ["Ajudar outro jogador a concluir um objetivo", "N", 3],
  ["Concluir uma missão cooperativa", "N", 3],
  ["Concluir um contrato de caça", "N", 4],
  ["Concluir uma missão com resultado perfeito", "N", 5],
  ["Concluir um evento do jogo e receber a recompensa", "N", 3],
  ["Completar uma campanha curta ou tutorial", "N", 2],
  ["Fazer uma aliança ou um acordo na história", "N", 3],
  ["Concluir uma missão em menos tempo que o sugerido", "N", 4],

  // ---- exploração e progresso
  ["Descobrir uma área nova", "E", 2],
  ["Descobrir 3 áreas novas", "E", 3],
  ["Encontrar um segredo escondido", "E", 4],
  ["Achar uma sala secreta", "E", 4],
  ["Chegar ao ponto mais alto do mapa", "E", 3],
  ["Chegar ao limite do mapa", "E", 3],
  ["Entrar em uma masmorra e chegar ao final", "E", 4],
  ["Concluir uma masmorra ou fase difícil", "E", 4],
  ["Resolver um quebra-cabeça", "E", 3],
  ["Resolver um quebra-cabeça difícil", "E", 4],
  ["Concluir uma fase", "E", 2],
  ["Concluir uma fase sem morrer", "E", 4],
  ["Concluir 3 fases seguidas", "E", 3],
  ["Concluir uma fase em menos tempo que o seu recorde", "E", 4],
  ["Descobrir um atalho", "E", 2],
  ["Abrir um caminho que estava bloqueado", "E", 3],
  ["Atravessar uma área perigosa sem tomar dano", "E", 4],
  ["Completar um desafio de plataforma ou parkour", "E", 3],
  ["Escalar uma montanha ou parede alta", "E", 3],
  ["Concluir um percurso cronometrado", "E", 3],
  ["Encontrar um colecionável escondido", "E", 3],
  ["Desbloquear uma nova região do mapa", "E", 3],
  ["Subir de nível", "E", 2],
  ["Subir 3 níveis", "E", 3],
  ["Chegar a um nível alto com um personagem", "E", 4],
  ["Desbloquear a próxima etapa da campanha", "E", 3],
  ["Superar um obstáculo que te travou", "E", 4],
  ["Passar por uma sequência de plataformas sem errar", "E", 3],
  ["Fugir de um perseguidor e sobreviver", "E", 3],
  ["Chegar a um local indicado só por uma pista", "E", 3],
  ["Concluir um modo de jogo novo", "E", 3],

  // ---- partidas, habilidade e multiplayer
  ["Vencer uma partida online", "M", 4],
  ["Vencer 2 partidas seguidas", "M", 5],
  ["Vencer uma partida contra jogadores melhores", "M", 4],
  ["Ficar entre os 5 últimos em um battle royale", "M", 4],
  ["Vencer um battle royale", "M", 5],
  ["Fazer 10 abates em uma partida", "M", 4],
  ["Fazer 5 abates seguidos", "M", 4],
  ["Ser o jogador com mais pontos da partida", "M", 4],
  ["Capturar um objetivo da partida", "M", 2],
  ["Defender um objetivo até o fim", "M", 3],
  ["Fazer uma jogada decisiva que vira a partida", "M", 4],
  ["Vencer uma rodada", "M", 2],
  ["Vencer uma partida em equipe", "M", 3],
  ["Vencer uma disputa 1 contra 1", "M", 4],
  ["Vencer uma partida sem morrer", "M", 5],
  ["Terminar uma partida com mais abates do que mortes", "M", 3],
  ["Completar uma corrida em primeiro lugar", "M", 4],
  ["Terminar uma corrida no pódio", "M", 3],
  ["Marcar um gol ou ponto decisivo", "M", 3],
  ["Virar uma partida no último minuto", "M", 4],
  ["Subir de rank ou de liga", "M", 5],
  ["Concluir um desafio diário ou semanal", "M", 3],
  ["Jogar uma partida cooperativa até o fim", "M", 3],
  ["Sobreviver a uma onda de inimigos", "M", 3],
  ["Sobreviver 15 minutos em um modo de sobrevivência", "M", 4],
  ["Concluir uma missão cooperativa sem ninguém cair", "M", 5],
  ["Ganhar um troféu ou uma medalha", "M", 3],
  ["Bater um recorde pessoal", "M", 4],
  ["Fazer a maior pontuação que você já fez", "M", 4],
  ["Salvar um colega de equipe em apuros", "M", 2],

  // ---- trocar de jogo é parte da graça: conquista + gênero
  ["Concluir uma fase em um jogo 2D", "M", 3],
  ["Concluir uma missão em um jogo de mundo aberto", "M", 3],
  ["Vencer uma partida em um jogo de tiro", "M", 4],
  ["Derrotar um chefe em um jogo de ação ou RPG", "M", 3],
  ["Concluir uma fase em um jogo de terror", "M", 3],
  ["Vencer uma partida em um jogo de luta", "M", 4],
  ["Terminar uma corrida em um jogo de corrida", "M", 3],
  ["Marcar um gol em um jogo de esporte", "M", 3],
  ["Resolver um quebra-cabeça em um jogo de puzzle", "M", 3],
  ["Construir algo grande em um jogo de construção ou sobrevivência", "M", 4],
  ["Concluir uma fase em um jogo de plataforma", "M", 3],
  ["Vencer uma batalha em um jogo de estratégia", "M", 3],
  ["Concluir uma missão em um jogo cooperativo", "M", 3],
  ["Vencer uma partida em um jogo de cartas ou tabuleiro", "M", 3],
  ["Progredir em um jogo que você nunca tinha aberto", "M", 3],
  ["Concluir uma missão em um jogo de 10 anos atrás ou mais", "M", 3],
  ["Avançar em um jogo que você ainda não tinha terminado", "M", 3],
  ["Subir de nível em um jogo novo", "M", 2],
  ["Voltar a um jogo já jogado hoje e superar algo novo", "M", 3],
  ["Concluir uma fase em um jogo indie", "M", 3],
];

/** Extras por jogo: entram só se o anfitrião escolher o jogo. */
export const games = [
  { slug: "minecraft", name: "Minecraft", goals: [
    ["Minerar diamante", "L", 4], ["Entrar no Nether", "E", 4], ["Derrotar o Ender Dragon", "B", 5], ["Derrotar o Wither", "B", 5],
    ["Craftar uma picareta de ferro", "L", 2], ["Construir um abrigo antes de anoitecer", "L", 2], ["Sobreviver à primeira noite", "M", 2],
    ["Encontrar uma aldeia", "E", 2], ["Domar um animal", "N", 2], ["Encantar um item", "L", 3], ["Preparar uma poção", "L", 3],
    ["Encontrar uma fortaleza ou um bastião", "E", 4],
  ] },
  { slug: "elden-ring", name: "Elden Ring", goals: [
    ["Derrotar um chefe de masmorra", "B", 3], ["Derrotar um chefe do mundo aberto", "B", 3], ["Derrotar um dragão", "B", 4],
    ["Acender 3 Sítios da Graça novos", "E", 2], ["Invocar um espírito para uma luta", "C", 2], ["Entrar em uma masmorra subterrânea", "E", 3],
    ["Derrotar um chefe sem invocar ajuda", "B", 4], ["Derrotar um dos portadores de Grande Runa", "B", 4], ["Concluir a missão de um NPC", "N", 3],
  ] },
  { slug: "hollow-knight", name: "Hollow Knight", goals: [
    ["Derrotar um chefe", "B", 3], ["Derrotar o Falso Cavaleiro", "B", 2], ["Conseguir uma habilidade nova de movimento", "L", 3],
    ["Derrotar um chefe sem tomar dano", "B", 5], ["Conquistar um amuleto novo", "L", 2], ["Descobrir uma área nova", "E", 2], ["Derrotar o Mestre de Almas", "B", 4],
  ] },
  { slug: "silksong", name: "Hollow Knight: Silksong", goals: [
    ["Derrotar um chefe", "B", 3], ["Conseguir uma ferramenta nova", "L", 2], ["Descobrir uma área nova", "E", 2], ["Achar um atalho novo", "E", 3],
    ["Derrotar um chefe sem tomar dano", "B", 5], ["Conseguir uma melhoria de movimento", "L", 3],
  ] },
  { slug: "stardew-valley", name: "Stardew Valley", goals: [
    ["Colher uma plantação", "L", 2], ["Pescar um peixe raro", "L", 3], ["Descer 10 andares na mina", "E", 3], ["Descer 40 andares na mina", "E", 4],
    ["Concluir um pedido do quadro de avisos", "N", 3], ["Aumentar a amizade com um morador", "N", 2], ["Fabricar um item novo", "L", 2],
    ["Participar de um festival", "E", 2], ["Derrotar um monstro difícil na mina", "C", 3], ["Melhorar uma ferramenta", "L", 3],
  ] },
  { slug: "terraria", name: "Terraria", goals: [
    ["Derrotar o Olho de Cthulhu", "B", 3], ["Derrotar o Rei Slime", "B", 3], ["Derrotar o Devorador de Mundos ou o Cérebro de Cthulhu", "B", 4],
    ["Derrotar o Esqueletron", "B", 4], ["Cavar até a caverna profunda", "E", 2], ["Construir uma casa para um NPC", "N", 2],
    ["Fabricar uma armadura nova", "L", 3], ["Chegar ao Inferno", "E", 4], ["Sobreviver a uma Lua de Sangue", "M", 3],
  ] },
  { slug: "hades", name: "Hades", goals: [
    ["Escapar de uma sala de chefe com a vida cheia", "B", 4], ["Derrotar uma das Fúrias", "B", 3], ["Derrotar a Hidra de Ossos de Lerna", "B", 3],
    ["Derrotar Teseu e Asterius", "B", 4], ["Derrotar Hades", "B", 5], ["Limpar uma sala sem tomar dano", "C", 3], ["Concluir uma fuga até a superfície", "M", 5],
  ] },
  { slug: "hades-2", name: "Hades II", goals: [
    ["Derrotar um chefe", "B", 3], ["Derrotar um chefe sem tomar dano", "B", 5], ["Concluir uma tentativa até o fim", "M", 4],
    ["Limpar uma sala sem tomar dano", "C", 3], ["Colher recursos para melhorias", "L", 2],
  ] },
  { slug: "zelda", name: "The Legend of Zelda", goals: [
    ["Resolver um santuário", "E", 3], ["Derrotar um Guardião", "C", 4], ["Escalar uma torre", "E", 2], ["Concluir uma masmorra", "E", 4],
    ["Encontrar 5 Koroks", "L", 2], ["Derrotar um Hinox ou um Talus", "B", 3], ["Cozinhar uma refeição que dê bônus", "L", 2], ["Domar um cavalo", "E", 2],
  ] },
  { slug: "skyrim", name: "Skyrim", goals: [
    ["Derrotar um dragão", "B", 4], ["Aprender um Grito de dragão", "L", 3], ["Concluir uma missão de facção", "N", 4], ["Derrotar um Draugr", "C", 2],
    ["Entrar em uma cidade nova", "E", 2], ["Limpar uma cripta ou masmorra", "E", 3], ["Fabricar uma poção ou um equipamento", "L", 2],
    ["Subir uma habilidade de nível", "L", 2], ["Comprar uma casa", "L", 4],
  ] },
  { slug: "dark-souls", name: "Dark Souls", goals: [
    ["Derrotar um chefe", "B", 4], ["Derrotar um chefe sem invocar ajuda", "B", 5], ["Acender uma fogueira nova", "E", 2], ["Abrir um atalho", "E", 3],
    ["Derrotar um inimigo difícil de uma área", "C", 3], ["Melhorar uma arma", "L", 3], ["Chegar a uma área nova", "E", 3], ["Derrotar o Demônio de Touro", "B", 3],
  ] },
  { slug: "sekiro", name: "Sekiro", goals: [
    ["Derrotar um mini-chefe", "B", 2], ["Derrotar Genichiro", "B", 4], ["Dar um Golpe Mortal em um mini-chefe", "C", 4],
    ["Derrotar um chefe sem usar itens", "B", 5], ["Descansar em um novo Ídolo do Escultor", "E", 2], ["Concluir uma área", "E", 4],
    ["Aparar uma sequência de golpes seguidos", "C", 4], ["Vencer uma luta usando a Prótese Shinobi", "C", 2],
  ] },
  { slug: "black-myth-wukong", name: "Black Myth: Wukong", goals: [
    ["Derrotar um Rei Yaoguai", "B", 3], ["Derrotar um chefe sem usar a cabaça", "B", 5], ["Desbloquear uma transformação", "L", 3], ["Concluir um capítulo", "E", 4],
    ["Derrotar um chefe sem tomar dano", "B", 5], ["Encontrar uma área escondida", "E", 4], ["Fabricar ou melhorar um equipamento", "L", 2],
  ] },
  { slug: "clair-obscur", name: "Clair Obscur: Expedition 33", goals: [
    ["Derrotar um chefe", "B", 3], ["Aparar 5 ataques seguidos", "C", 4], ["Derrotar um inimigo opcional difícil", "C", 4], ["Equipar um Picto novo", "L", 2],
    ["Concluir um capítulo da expedição", "E", 4], ["Conseguir um equipamento raro", "L", 3], ["Vencer um combate sem tomar dano", "C", 4],
  ] },
  { slug: "baldurs-gate-3", name: "Baldur's Gate 3", goals: [
    ["Concluir uma missão", "N", 3], ["Recrutar um companheiro", "N", 3], ["Convencer alguém em um teste difícil de persuasão", "N", 3],
    ["Derrotar um chefe da história", "B", 4], ["Subir de nível", "E", 2], ["Aumentar a aprovação de um companheiro", "N", 3],
    ["Vencer um combate sem ninguém cair", "C", 4], ["Concluir um ato da história", "E", 5],
  ] },
  { slug: "the-witcher-3", name: "The Witcher 3", goals: [
    ["Concluir um contrato de monstro", "N", 3], ["Derrotar um monstro difícil", "C", 4], ["Ganhar uma partida de Gwent", "M", 3],
    ["Concluir uma missão da história principal", "N", 4], ["Fabricar uma poção ou um óleo", "L", 2], ["Subir de nível", "E", 2],
    ["Encontrar um tesouro", "L", 3], ["Derrotar um chefe", "B", 4],
  ] },
  { slug: "cyberpunk-2077", name: "Cyberpunk 2077", goals: [
    ["Concluir um serviço (gig)", "N", 3], ["Concluir uma missão principal", "N", 4], ["Hackear inimigos para vencer uma luta", "C", 3],
    ["Comprar um implante", "L", 3], ["Eliminar inimigos sem ser visto", "C", 3], ["Invadir um local sem disparar o alarme", "C", 4],
    ["Derrotar um chefe", "B", 4], ["Concluir uma missão secundária", "N", 3],
  ] },
  { slug: "red-dead-redemption-2", name: "Red Dead Redemption 2", goals: [
    ["Caçar e esfolar um animal", "L", 2], ["Concluir uma missão da história", "N", 4], ["Vencer um duelo", "C", 4], ["Concluir uma missão de estranho", "N", 3],
    ["Pescar um peixe grande", "L", 3], ["Capturar um fora da lei", "N", 3], ["Caçar um animal lendário", "L", 5],
  ] },
  { slug: "gta-v", name: "GTA V", goals: [
    ["Concluir uma missão da história", "N", 3], ["Escapar da polícia com 3 estrelas ou mais", "M", 4], ["Completar uma corrida de rua", "M", 3],
    ["Concluir um assalto", "N", 5], ["Comprar uma propriedade ou um veículo", "L", 3], ["Concluir uma missão secundária", "N", 3],
    ["Pilotar um avião ou helicóptero até pousar", "E", 3],
  ] },
  { slug: "resident-evil", name: "Resident Evil", goals: [
    ["Resolver um quebra-cabeça", "E", 3], ["Derrotar um chefe", "B", 4], ["Chegar a uma nova área segura", "E", 2], ["Escapar de um perseguidor", "M", 4],
    ["Concluir um capítulo", "E", 4], ["Encontrar um item raro", "L", 3], ["Criar munição combinando itens", "L", 2], ["Derrotar um inimigo forte sem gastar munição", "C", 4],
  ] },
  { slug: "monster-hunter", name: "Monster Hunter", goals: [
    ["Derrotar um monstro grande", "B", 3], ["Capturar um monstro", "B", 3], ["Cortar a cauda de um monstro", "C", 3], ["Montar um equipamento novo", "L", 3],
    ["Concluir uma caçada em menos de 10 minutos", "B", 4], ["Concluir uma caçada sem desmaiar", "B", 4], ["Montar em um monstro", "C", 4],
  ] },
  { slug: "assassins-creed", name: "Assassin's Creed", goals: [
    ["Concluir uma missão sem ser detectado", "N", 4], ["Eliminar um alvo principal", "C", 3], ["Sincronizar um ponto alto", "E", 2], ["Dar um Salto de Fé", "E", 2],
    ["Concluir uma missão da história", "N", 3], ["Escapar de uma perseguição de guardas", "M", 3],
  ] },
  { slug: "god-of-war", name: "God of War", goals: [
    ["Derrotar um chefe", "B", 4], ["Resolver um puzzle de runas", "E", 3], ["Vencer uma luta usando a Fúria", "C", 3], ["Concluir uma missão", "N", 3],
    ["Derrotar uma Valquíria", "B", 5], ["Executar 5 finalizadores", "C", 3], ["Abrir um baú lendário", "L", 3],
  ] },
  { slug: "hogwarts-legacy", name: "Hogwarts Legacy", goals: [
    ["Concluir uma missão", "N", 3], ["Derrotar inimigos usando feitiços", "C", 2], ["Descobrir um segredo no castelo", "E", 3],
    ["Resolver um enigma de porta", "E", 3], ["Concluir uma missão de aula", "N", 2], ["Derrotar um chefe", "B", 4],
  ] },
  { slug: "super-mario", name: "Super Mario", goals: [
    ["Concluir uma fase", "E", 2], ["Derrotar um chefe", "B", 3], ["Concluir uma fase sem tomar dano", "E", 4], ["Pegar todas as moedas especiais de uma fase", "L", 4],
    ["Achar uma saída secreta", "E", 4], ["Concluir um mundo", "E", 4],
  ] },
  { slug: "pokemon", name: "Pokémon", goals: [
    ["Vencer uma batalha de treinador", "C", 2], ["Capturar um Pokémon novo", "L", 2], ["Evoluir um Pokémon", "L", 3], ["Derrotar um líder de ginásio", "B", 4],
    ["Encontrar um Pokémon raro", "E", 4], ["Vencer uma batalha sem usar itens", "C", 3], ["Concluir uma rota nova", "E", 2], ["Capturar um Pokémon shiny", "L", 5],
  ] },
  { slug: "celeste", name: "Celeste", goals: [
    ["Concluir uma tela sem morrer", "E", 3], ["Concluir um capítulo", "E", 4], ["Pegar um morango difícil", "L", 3],
    ["Concluir uma tela difícil em menos de 5 tentativas", "E", 4], ["Fazer uma sequência de dashes sem errar", "E", 3],
  ] },
  { slug: "slay-the-spire", name: "Slay the Spire", goals: [
    ["Derrotar um chefe do ato", "B", 3], ["Concluir um ato", "E", 4], ["Vencer uma luta de elite", "C", 3], ["Montar uma combinação forte de cartas", "C", 3],
    ["Vencer uma luta sem perder vida", "C", 3], ["Chegar ao ato 3", "E", 5],
  ] },
  { slug: "balatro", name: "Balatro", goals: [
    ["Vencer uma rodada", "M", 2], ["Derrotar um Boss Blind", "B", 3], ["Chegar ao Ante 5", "E", 4], ["Jogar um Full House ou melhor", "M", 2],
    ["Vencer uma rodada com um Flush", "M", 3], ["Comprar um Coringa raro", "L", 3],
  ] },
  { slug: "vampire-survivors", name: "Vampire Survivors", goals: [
    ["Sobreviver por 10 minutos", "M", 3], ["Evoluir uma arma", "L", 3], ["Abrir um baú de chefe", "L", 2], ["Derrotar 1000 inimigos", "C", 3],
    ["Sobreviver por 20 minutos", "M", 4], ["Desbloquear um personagem", "L", 3],
  ] },
  { slug: "factorio", name: "Factorio", goals: [
    ["Automatizar a produção de um item", "L", 4], ["Pesquisar uma tecnologia", "L", 2], ["Defender a base de um ataque", "C", 3], ["Construir um trem", "L", 4],
    ["Ligar a primeira eletricidade", "L", 2], ["Automatizar a ciência vermelha e verde", "L", 4], ["Lançar um foguete", "M", 5],
  ] },
  { slug: "satisfactory", name: "Satisfactory", goals: [
    ["Construir uma fábrica funcionando", "L", 3], ["Pesquisar no M.A.M.", "L", 2], ["Entregar itens ao HUB", "L", 2], ["Automatizar a produção de um item", "L", 3],
    ["Montar uma linha de produção completa", "L", 4], ["Desbloquear um novo nível do projeto", "E", 3],
  ] },
  { slug: "subnautica", name: "Subnautica", goals: [
    ["Construir uma base submarina", "L", 4], ["Fabricar um veículo", "L", 4], ["Escanear 5 criaturas", "E", 2], ["Mergulhar a 200 metros", "E", 4],
    ["Entrar em uma caverna profunda", "E", 3], ["Escapar de um Leviatã", "C", 4], ["Fabricar uma ferramenta", "L", 2],
  ] },
  { slug: "valheim", name: "Valheim", goals: [
    ["Derrotar Eikthyr", "B", 3], ["Construir uma casa", "L", 3], ["Construir um barco e navegar", "L", 3], ["Derrotar um Troll", "C", 3],
    ["Descobrir um bioma novo", "E", 3], ["Derrotar o chefe de um bioma", "B", 4], ["Fabricar equipamento de bronze", "L", 3],
  ] },
  { slug: "palworld", name: "Palworld", goals: [
    ["Capturar um Pal", "L", 2], ["Construir uma base", "L", 3], ["Derrotar um chefe de torre", "B", 4], ["Derrotar um Pal Alfa", "B", 3],
    ["Capturar um Pal raro", "L", 4], ["Colocar Pals para trabalhar na base", "N", 2], ["Subir o nível de um Pal", "L", 2],
  ] },
  { slug: "rust", name: "Rust", goals: [
    ["Construir uma base", "L", 3], ["Sobreviver à primeira noite", "M", 3], ["Fabricar uma arma", "L", 3], ["Eliminar um jogador", "C", 4],
    ["Encontrar um monumento", "E", 3], ["Sobreviver por 1 hora", "M", 4], ["Defender a base de um ataque", "C", 4],
  ] },
  { slug: "sea-of-thieves", name: "Sea of Thieves", goals: [
    ["Cavar e vender um tesouro", "L", 3], ["Afundar um navio inimigo", "C", 4], ["Concluir uma viagem de missão", "N", 3], ["Derrotar um Kraken ou um Megalodonte", "B", 5],
    ["Ancorar em uma ilha nova", "E", 2], ["Derrotar esqueletos em uma fortaleza", "C", 3],
  ] },
  { slug: "lethal-company", name: "Lethal Company", goals: [
    ["Voltar para a nave com sucata", "L", 2], ["Bater a cota de sucata", "L", 4], ["Escapar de um monstro", "C", 3], ["Sobreviver a um dia inteiro", "M", 3],
    ["Sair da instalação com um item grande", "L", 3], ["Concluir um ciclo de 3 dias", "M", 5],
  ] },
  { slug: "phasmophobia", name: "Phasmophobia", goals: [
    ["Identificar o tipo de fantasma", "E", 4], ["Achar uma evidência de fantasma", "E", 3], ["Tirar uma foto do fantasma", "L", 3], ["Sobreviver a uma caçada", "M", 3],
    ["Concluir uma investigação", "N", 4], ["Concluir uma investigação sem ninguém morrer", "N", 5],
  ] },
  { slug: "left-4-dead-2", name: "Left 4 Dead 2", goals: [
    ["Derrotar uma horda", "C", 2], ["Derrotar um Tank", "B", 4], ["Chegar à sala segura", "E", 3], ["Concluir um capítulo da campanha", "E", 4],
    ["Salvar um colega", "N", 2], ["Concluir um mapa sem ninguém cair", "M", 5],
  ] },
  { slug: "dead-by-daylight", name: "Dead by Daylight", goals: [
    ["Consertar um gerador", "M", 2], ["Escapar do assassino", "M", 4], ["Salvar um colega do gancho", "N", 3], ["Abrir o portão de saída", "E", 3],
    ["Derrubar 3 sobreviventes como assassino", "C", 4], ["Concluir uma partida como assassino", "M", 3],
  ] },
  { slug: "among-us", name: "Among Us", goals: [
    ["Fazer todas as tarefas", "M", 3], ["Descobrir o impostor", "M", 3], ["Vencer como tripulante", "M", 3], ["Vencer como impostor", "M", 4],
    ["Eliminar 2 jogadores como impostor", "C", 4], ["Consertar uma sabotagem", "M", 3],
  ] },
  { slug: "fall-guys", name: "Fall Guys", goals: [
    ["Chegar à linha de chegada", "E", 2], ["Passar para a próxima rodada", "M", 2], ["Vencer uma rodada de equipes", "M", 3], ["Pegar a coroa", "M", 5], ["Chegar à final", "M", 4],
  ] },
  { slug: "overcooked", name: "Overcooked", goals: [
    ["Entregar 5 pedidos a tempo", "M", 3], ["Concluir uma fase com 3 estrelas", "M", 4], ["Concluir uma fase sem queimar nada", "M", 3], ["Concluir uma fase nova", "E", 2],
    ["Concluir uma fase sem derrubar nada no vazio", "M", 3],
  ] },
  { slug: "portal-2", name: "Portal 2", goals: [
    ["Resolver uma sala de teste", "E", 3], ["Resolver uma sala difícil sem dicas", "E", 4], ["Concluir um capítulo", "E", 4], ["Usar gel para atravessar uma sala", "E", 3],
    ["Concluir uma sala cooperativa", "M", 4],
  ] },
  { slug: "the-sims", name: "The Sims", goals: [
    ["Construir uma casa", "L", 3], ["Conseguir um emprego ou uma promoção", "N", 3], ["Concluir um desejo ou aspiração", "N", 3], ["Subir uma habilidade de nível", "L", 2],
    ["Fazer um Sim formar amizade ou romance", "N", 3],
  ] },
  { slug: "civilization", name: "Civilization", goals: [
    ["Fundar uma cidade", "L", 2], ["Construir uma maravilha", "L", 4], ["Pesquisar uma tecnologia", "L", 2], ["Vencer uma guerra", "C", 4],
    ["Fazer um acordo diplomático", "N", 3], ["Chegar à era seguinte", "E", 4],
  ] },
  { slug: "genshin-impact", name: "Genshin Impact", goals: [
    ["Derrotar um chefe do mundo", "B", 3], ["Abrir um baú de tesouro raro", "L", 3], ["Concluir uma Comissão", "N", 2], ["Subir um personagem de nível", "L", 3],
    ["Ativar uma Estátua dos Sete", "E", 2], ["Concluir um domínio", "E", 4], ["Completar um andar do Abismo", "M", 5],
  ] },
  { slug: "world-of-warcraft", name: "World of Warcraft", goals: [
    ["Concluir uma masmorra", "E", 4], ["Concluir uma missão", "N", 2], ["Derrotar um chefe de masmorra", "B", 4], ["Subir de nível", "E", 3],
    ["Conseguir um equipamento raro", "L", 3], ["Concluir uma série de missões", "N", 3],
  ] },
  { slug: "roblox", name: "Roblox", goals: [
    ["Concluir um obby", "E", 3], ["Chegar ao fim de um obby difícil", "E", 4], ["Ganhar uma partida", "M", 3], ["Concluir uma missão do jogo", "N", 2],
    ["Desbloquear um item no jogo", "L", 2],
  ] },
  { slug: "cs2", name: "Counter-Strike 2", goals: [
    ["Ganhar um round", "C", 2], ["Fazer um ace", "C", 5], ["Plantar ou desarmar a bomba", "M", 3], ["Ganhar um clutch 1v2", "C", 4],
    ["Eliminar 3 inimigos em um round", "C", 4], ["Vencer uma partida", "M", 4], ["Eliminar alguém com a AWP", "C", 2], ["Fazer 10 abates em uma partida", "M", 4],
  ] },
  { slug: "valorant", name: "VALORANT", goals: [
    ["Ganhar um round", "C", 2], ["Fazer um ace", "C", 5], ["Plantar ou desarmar o Spike", "M", 3], ["Eliminar 3 inimigos em um round", "C", 4],
    ["Vencer uma partida", "M", 4], ["Usar a habilidade suprema e eliminar alguém", "C", 3], ["Fazer 15 abates em uma partida", "M", 5],
  ] },
  { slug: "league-of-legends", name: "League of Legends", goals: [
    ["Derrubar uma torre", "C", 3], ["Derrotar um campeão inimigo", "C", 2], ["Derrotar o Barão Nashor ou um Dragão", "B", 4], ["Vencer uma partida", "M", 4],
    ["Fazer 5 abates ou mais", "M", 4], ["Conseguir o primeiro abate da partida", "C", 3], ["Terminar com mais abates do que mortes", "M", 3],
  ] },
  { slug: "dota-2", name: "Dota 2", goals: [
    ["Derrubar uma torre", "C", 3], ["Derrotar um herói inimigo", "C", 2], ["Derrotar o Roshan", "B", 4], ["Vencer uma partida", "M", 4],
    ["Terminar com mais abates do que mortes", "M", 3], ["Fazer 10 abates", "M", 4], ["Comprar um item de mais de 4000 de ouro", "L", 3],
  ] },
  { slug: "apex-legends", name: "Apex Legends", goals: [
    ["Eliminar um inimigo", "C", 2], ["Reviver um colega", "N", 2], ["Ficar entre os 5 últimos", "M", 4], ["Vencer como Campeão Apex", "M", 5],
    ["Pegar um item roxo ou dourado", "L", 3], ["Fazer 3 abates em uma partida", "M", 4], ["Derrubar um esquadrão inteiro", "C", 4],
  ] },
  { slug: "fortnite", name: "Fortnite", goals: [
    ["Eliminar um jogador", "C", 3], ["Ficar entre os 10 últimos", "M", 4], ["Vencer uma partida (Vitória Magnífica)", "M", 5], ["Abrir um baú dourado", "L", 2],
    ["Fazer 5 eliminações em uma partida", "M", 4], ["Vencer uma luta construindo uma estrutura", "C", 3],
  ] },
  { slug: "pubg", name: "PUBG", goals: [
    ["Eliminar um jogador", "C", 3], ["Ficar entre os 10 últimos", "M", 4], ["Vencer uma partida", "M", 5], ["Fazer 5 abates em uma partida", "M", 4],
    ["Sobreviver até o terceiro círculo", "M", 3],
  ] },
  { slug: "overwatch-2", name: "Overwatch 2", goals: [
    ["Eliminar 5 inimigos", "C", 3], ["Vencer uma partida", "M", 4], ["Capturar um objetivo", "M", 2], ["Aparecer na Melhor Jogada", "M", 5],
    ["Usar a ultimate e eliminar alguém", "C", 3],
  ] },
  { slug: "marvel-rivals", name: "Marvel Rivals", goals: [
    ["Eliminar 5 inimigos", "C", 3], ["Vencer uma partida", "M", 4], ["Capturar um objetivo", "M", 2], ["Usar um ataque em equipe e eliminar alguém", "C", 3],
    ["Usar uma ultimate e eliminar alguém", "C", 3],
  ] },
  { slug: "deadlock", name: "Deadlock", goals: [
    ["Derrotar um herói inimigo", "C", 2], ["Derrubar um Guardião", "C", 3], ["Vencer uma partida", "M", 4], ["Comprar um item de nível alto", "L", 3],
    ["Usar a habilidade suprema e eliminar alguém", "C", 3],
  ] },
  { slug: "rocket-league", name: "Rocket League", goals: [
    ["Marcar um gol", "M", 2], ["Vencer uma partida", "M", 4], ["Dar uma assistência", "M", 3], ["Fazer uma defesa decisiva", "M", 3],
    ["Marcar 3 gols em uma partida", "M", 4], ["Vencer na prorrogação", "M", 4], ["Demolir um adversário", "C", 3],
  ] },
  { slug: "rainbow-six-siege", name: "Rainbow Six Siege", goals: [
    ["Vencer um round", "C", 3], ["Plantar o desativador", "M", 3], ["Eliminar 3 inimigos em um round", "C", 4], ["Vencer uma partida", "M", 4], ["Fazer um headshot", "C", 2],
  ] },
  { slug: "arc-raiders", name: "ARC Raiders", goals: [
    ["Extrair com vida e com saque", "M", 4], ["Derrotar uma máquina ARC", "C", 3], ["Encontrar um item raro", "L", 3], ["Extrair com um item raro", "M", 5],
    ["Derrotar uma máquina ARC grande", "B", 5], ["Entrar em um mapa novo", "E", 2],
  ] },
  { slug: "ea-fc", name: "EA Sports FC", goals: [
    ["Marcar um gol", "M", 2], ["Vencer uma partida", "M", 4], ["Dar uma assistência", "M", 3], ["Marcar um gol de fora da área", "M", 4],
    ["Vencer com 2 gols de diferença ou mais", "M", 4], ["Fazer um hat-trick", "M", 5], ["Defender um pênalti", "M", 4],
  ] },
  { slug: "helldivers-2", name: "Helldivers 2", goals: [
    ["Concluir uma missão", "N", 3], ["Extrair com vida", "M", 3], ["Derrotar um Bile Titan", "B", 4], ["Concluir o objetivo principal de uma missão", "N", 3],
    ["Concluir uma missão em dificuldade alta", "N", 5], ["Concluir uma missão sem ninguém morrer", "N", 5],
  ] },
  { slug: "peak", name: "PEAK", goals: [
    ["Chegar ao topo de um trecho", "E", 3], ["Salvar um amigo caído", "N", 2], ["Escalar por 3 minutos sem cair", "E", 4], ["Concluir a subida", "E", 5],
    ["Superar um trecho difícil sem usar atalhos", "E", 4],
  ] },
  { slug: "repo", name: "R.E.P.O.", goals: [
    ["Levar 3 objetos valiosos ao caminhão", "L", 3], ["Concluir uma fase da missão", "N", 4], ["Escapar de um monstro", "C", 3], ["Alcançar a cota da fase", "L", 4],
    ["Sobreviver a uma fase inteira", "M", 4],
  ] },
];
