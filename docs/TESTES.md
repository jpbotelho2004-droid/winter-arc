# Testes e verificação

Resultados da última execução (16/11/2026, macOS, Node 26) — programa de treino v2:

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Tipos (strict, sem variáveis por usar) | `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` | ✅ 0 erros |
| Unitários + dados (Vitest, `fake-indexeddb`) | `npm test` | ✅ 85/85 |
| Build de produção + PWA | `npm run build` | ✅ 44 ficheiros em pré‑cache, `sw.js` + manifest |
| E2E iPhone 13 (WebKit) | `npm run test:e2e` | ✅ 24 passam, 1 saltado |
| E2E Desktop (Chromium) | `npm run test:e2e` | ✅ 25/25 |

Total E2E: **49 passam, 1 saltado** (o teste de modo offline corre só em Chromium).

## O que cobrem os testes automáticos

**Unitários/dados (`src/lib/*.test.ts`)**: cálculos (volume, e1RM de Epley só 1–10 reps, ritmo, parsing/limites), datas (Lisboa, semanas, mês), programa v2 (estrutura de cada treino: 19/18/18/21/14 séries, ordem explosivo→pesado, 4 fases, conversão `[3,7]`→`[3,5,9]`, prolongar fase, ajuste de volume por fase, Box Jump só na fase 2, sprint de 20 m só na fase 3, reduzir volume, estados do dia), **migração do plano antigo** (arquivado, não apagado; histórico intacto; idempotente; também ao importar cópias antigas), variantes A/B, exercício opcional que não afeta a conclusão, séries planeadas vs. realizadas nos relatórios, altura da caixa ≠ altura de salto, progressão dupla, PRs (só valores medidos; sprint 10 m ≠ 20 m), fluxos de base de dados (sessão ativa única, retomar, descartar, finalizar), histórico imutável face a edição de modelos, relatórios (texto e JSON, "sem registo" ≠ 0), recuperação (conselhos prudentes), **backup**: exportar → validar → importar em fundir/substituir, deduplicação, ficheiros inválidos rejeitados sem alterar dados, sessão ativa importada com outra já ativa passa a parcial. A cadeia de migrações de esquema existe, mas como só há a versão 1 do esquema **não foi exercitada** na prática.

**E2E (`e2e/winter-arc.spec.ts`)** — mapeamento com os 24 cenários pedidos:

| # | Cenário | Teste |
| --- | --- | --- |
| 1 | Abrir a app | 1–3 |
| 2 | Navegar pelas 5 tabs | 1–3 |
| 3 | Ver o treino de terça (plano oficial completo) | 1–3, 24 (`/dia/2026-11-17`) |
| 4 | Abrir detalhe de exercício + vídeo como pesquisa rotulada | 4 |
| 5 | Iniciar treino | 5–10 |
| 6 | Registar Supino plano 60 kg × 8 e marcar | 5–10 |
| 7 | Cronómetro de descanso arranca | 5–10 |
| 8 | Terminar treino | 5–10 |
| 9 | Recarregar/reabrir: dados persistem (também a meio do treino) | 5–10, 12 |
| 10 | Aparece no histórico e na evolução (+ PR / "1RM estimado … (est.)") | 5–10, 11 |
| 11 | Sessão em curso sobrevive a navegação; retomar | 12 |
| 12 | Descartar com confirmação | 13 |
| 13 | Registar peso corporal | 14 |
| 14 | Sessão de natação | 15 |
| 15 | Salto vertical + evolução de performance | 16 |
| 16 | Refeição manual e totais (sem valores inventados) | 17 |
| 17 | Recuperação | 18 |
| 18 | Relatório semanal: pré‑visualização, **copiar** (clipboard verificado no Chromium) e **exportar** | 19–20 |
| 19 | Relatório JSON (`winter-arc-report`) | 21 |
| 20 | Exportar backup; **apagar tudo**; importar (substituir) e verificar consistência | 22 |
| 21 | Importar duas vezes em modo fundir não duplica | 23 |
| 22 | Ficheiro inválido rejeitado sem alterações | 22 |
| 23 | Layout móvel sem scroll horizontal em 9 páginas; sem erros de consola | layout / consola |
| 24 | Offline (service worker + recarregar sem rede) | PWA/offline (Chromium) |

Extra: fases do programa visíveis, tema persistente, manifest + ícones existem.

## O que NÃO foi verificado (honestidade)

- **iPhone físico**: nada foi testado num aparelho real. Foi usado o emulador iPhone 13 do WebKit do Playwright. Por isso **não verificado**: instalação "Adicionar ao ecrã principal", comportamento real do armazenamento ao fim de dias, teclado numérico do iOS, safe-areas reais, *wake lock*, partilha de ficheiros nativa (`navigator.share`), som ao fim do descanso com o ecrã bloqueado (sabe‑se que o iOS não o permite) e vibração (não suportada no Safari/iOS).
- **Cliques no emulador iPhone/WebKit**: `locator.click()` falha neste emulador até numa página HTML mínima (`<html> intercepts pointer events`); por isso o helper dos testes converte cliques em **toques** (`tap()`) no WebKit — o que é, aliás, o que um iPhone real faz. Está documentado em `e2e/helpers.ts`.
- **Offline em WebKit**: teste saltado (o Playwright não simula offline com service worker de forma fiável em WebKit). Verificado em Chromium.
- **Armazenamento persistente**: `navigator.storage.persist()` é pedido, mas a concessão depende do navegador; não é testável de forma determinística.
- **Notificações**: só a lógica de alerta é testada; a entrega real depende do sistema.
- **Estado "antes do início"**: a data de hoje no ambiente de teste era anterior ao início do programa (16/11/2026); o comportamento das semanas/fases em datas posteriores foi validado nos testes unitários de `program.ts`, não por E2E.
- **Cobertura visual**: verificação visual feita por capturas no emulador (Início e sessão ativa); as restantes páginas foram verificadas por DOM e ausência de overflow, não por revisão visual exaustiva.

## Como repetir

```bash
npm run typecheck && npm test && npm run test:e2e
```

O `test:e2e` faz `npm run build` e serve `dist` com `vite preview` na porta 4173 (reutiliza um servidor já a correr nessa porta).

## Notas da atualização do programa (v2)

- O E2E acrescenta: variante A/B de sábado, cardio opcional de sexta e redução de volume. Os restantes cenários foram adaptados ao novo plano (terça = Push).
- A medição do salto vertical (alcance em pé vs. alcance no ponto mais alto) é uma convenção de registo; a app não mede saltos.
- Não há imagens demonstrativas nem vídeos incorporados: o link de vídeo é sempre uma pesquisa rotulada.
