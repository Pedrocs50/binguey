import { BingueyError, type RpcError } from "@binguey/shared";

const MESSAGES: Record<RpcError, string> = {
  not_authenticated: "Sua sessão não foi iniciada. Recarregue a página.",
  profile_required: "Digite um apelido primeiro.",
  not_member: "Você não faz parte desta sala.",
  not_host: "Só o anfitrião pode fazer isso.",
  room_not_found: "Sala não encontrada. Confira o código.",
  room_closed: "Esta sala já terminou.",
  room_not_running: "A partida não está em andamento.",
  already_started: "A partida já começou.",
  already_marked: "Alguém marcou essa casa primeiro.",
  invalid_cell: "Essa casa não existe.",
  invalid_size: "Tamanho inválido.",
  invalid_duration: "Duração inválida.",
  invalid_target_lines: "Número de linhas inválido para esse tabuleiro.",
  invalid_clip_policy: "Política de clips inválida.",
  invalid_path: "Caminho de clip inválido.",
  not_enough_goals: "Faltam objetivos para preencher o tabuleiro. Escreva mais alguns ou escolha mais jogos.",
  too_many_rooms: "Você já tem 3 salas abertas. Termine uma antes de criar outra.",
  rate_limited: "Muito rápido. Espere um instante e tente de novo.",
  mark_not_found: "Marcação não encontrada.",
  clips_disabled: "Esta sala não aceita clips.",
  clip_limit: "Você já enviou o máximo de clips desta partida.",
  clip_not_found: "Clip não encontrado.",
};

export function errorMessage(e: unknown): string {
  if (e instanceof BingueyError && e.code !== "unknown") return MESSAGES[e.code];
  return "Algo deu errado. Tente de novo.";
}
