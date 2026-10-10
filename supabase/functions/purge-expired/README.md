# purge-expired

Limpeza automática dos clips. O que apaga e quando:

| O quê | Quando |
| --- | --- |
| Clip (arquivo `.mp4`, miniatura e linha) | 24 h depois do fim previsto da partida (`clips.expires_at`) |
| Arquivos órfãos no bucket (sem clip no banco) | com mais de 24 h |
| Salas (e membros, casas, marcações) | 7 dias depois de expirar (48 h após criadas) |
| Eventos brutos | com mais de 90 dias |

Os clips são apagados **primeiro no Storage** (a API remove o arquivo de verdade) e só então a linha; se o
arquivo não sair, a linha fica e a próxima rodada tenta de novo.

## Como colocar no ar (pelo painel do Supabase)

1. **SQL Editor:** rodar `supabase/migrations/20261010000800_purge.sql`.
2. **Edge Functions → Deploy a new function → Via Editor:** nome `purge-expired`, colar o `index.ts` e fazer o deploy.
3. Nas **configurações da função**, desligar **Verify JWT** (quem protege é o segredo abaixo).
4. **Edge Functions → Secrets:** criar `PURGE_SECRET` com o mesmo valor que está em `.env.local` (`PURGE_SECRET=`).
5. Testar (nada é apagado com `dry=1`):

```bash
node --env-file=.env.local scripts/purge-check.mjs            # simulação com a data de agora
node --env-file=.env.local scripts/purge-check.mjs 2026-12-01 # simula uma data futura
```

## Agendamento

`.github/workflows/keepalive.yml` chama a função a cada 12 h. Precisa dos *secrets* do repositório
`SUPABASE_URL` e `PURGE_SECRET`.
