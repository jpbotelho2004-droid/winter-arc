# Manutenção

## Arquitetura em 60 segundos

- **`src/lib/types.ts`** — todos os tipos persistidos. Mexer aqui implica pensar em **migrações** (ver abaixo).
- **`src/lib/db.ts`** — Dexie (`WinterDB`, 14 tabelas). `requestPersistence()` pede armazenamento persistente.
- **`src/lib/snapshot.ts`** — `loadSnapshot()` lê tudo (apenas leitura!) e `useLiveQuery` torna a UI reativa. Nunca escrever dentro de uma *live query*.
- **`src/lib/repo.ts`** — escritas de alto nível (sessões, corpo, nutrição, definições, plano).
- **`src/lib/sessionOps.ts`** — operações **puras** sobre uma sessão (adicionar série, alternar série concluída, descanso…). A página de treino aplica-as e grava a cada alteração.
- **`src/lib/stats.ts`** — histórico, PRs, progressão dupla, volume semanal, métricas de performance, recuperação, índice atlético. Funções puras sobre o `Snapshot`.
- **`src/lib/reports.ts`** — relatórios de texto e JSON (puros).
- **`src/lib/backup.ts`** — exportar, validar, planear e importar (transação única).
- **`src/lib/program.ts`** — plano oficial (`defaultTemplates`), fases, ajuste de volume por fase, estado dos dias.
- **`src/lib/exercises.ts`** — biblioteca de exercícios (PT/EN, instruções, pliometria). Sem URLs de vídeo.
- **`src/lib/dates.ts`** — datas ISO calculadas em UTC sobre strings; "hoje" em `Europe/Lisbon`.

Princípios que **não se devem quebrar**:

1. Nunca inventar dados. Ausente ≠ zero (usar `undefined` e "sem registo").
2. A sessão guarda uma **cópia** (snapshot) dos exercícios/séries → editar um treino-modelo nunca altera o histórico.
3. Sugestões (progressão, fase, pliometria) nunca são aplicadas automaticamente.
4. O temporizador de descanso usa `endsAt` (timestamp) — nunca contadores em memória.
5. Cada alteração de sessão é gravada imediatamente (sem botão "guardar").

## Alterar o plano oficial

`defaultTemplates()` em `src/lib/program.ts`. Os utilizadores existentes mantêm o que têm; "Repor plano oficial" (Definições) reaplica os modelos oficiais sem apagar histórico.

## Adicionar um exercício à biblioteca

Acrescentar uma entrada em `LIBRARY` (`src/lib/exercises.ts`) com `id` estável (kebab-case), `namePt`, `nameEn`, `logType`, músculos, equipamento, instruções, erros comuns e segurança. Para pliometria, preencher o guia detalhado. **Não** colocar URLs de vídeo que não tenham sido verificadas.

## Alterar o esquema da base de dados / backup

1. Mudar o tipo em `types.ts`.
2. Se mudar a estrutura guardada: incrementar a versão em `db.ts` (`this.version(n).stores(...).upgrade(...)`).
3. Se mudar o formato do ficheiro de cópia: incrementar `BACKUP_SCHEMA_VERSION` e acrescentar uma função ao mapa de migrações em `backup.ts` (`vN → vN+1`). Ficheiros de versões antigas são migrados na importação; versões futuras são rejeitadas.
4. Atualizar `docs/RELATORIO-JSON.md` se o relatório JSON mudar (e `REPORT_SCHEMA_VERSION`).
5. Acrescentar/ajustar testes em `src/lib/data.test.ts`.

## Atualizações da app (PWA)

`vite-plugin-pwa` com `registerType: 'prompt'`: o novo service worker espera até o utilizador tocar em "Atualizar agora" (bloqueado durante um treino ativo). Para forçar nova versão basta publicar um novo `dist`.

## Ícones

Edita `public/icon.svg` e corre `node scripts/make-icons.mjs` (gera `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon-maskable-512.png`).

## Testes

```bash
npm run typecheck
npm test            # unitários/dados (Vitest, fake-indexeddb)
npm run test:e2e    # Playwright (faz build + preview na porta 4173)
```

Ver `docs/TESTES.md` para o que está coberto e o que **não** foi verificado.

## Dependências

`npm outdated` de vez em quando. Depois de atualizar: `npm run build && npm test && npm run test:e2e`.
