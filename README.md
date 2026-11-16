# WINTER ARC — ATHLETIC PERFORMANCE

PWA pessoal de treino (iPhone primeiro): plano semanal oficial, programa de 12 semanas em 4 fases, registo de treino ao estilo Hevy, evolução de força e de performance atlética, corpo, nutrição, recuperação e relatórios de texto para o ChatGPT.

- **Sem conta, sem servidor, sem custos.** Todos os dados ficam na base de dados do teu navegador (IndexedDB).
- **Funciona offline** depois da primeira abertura (service worker + pré-cache).
- **PT-PT**, unidades métricas, fuso `Europe/Lisbon`, tema escuro por defeito (verde elétrico).
- Stack: React 19 · TypeScript · Vite · Tailwind v4 · Dexie (IndexedDB) · Recharts · Lucide · React Router (HashRouter) · vite-plugin-pwa · Vitest · Playwright.

## 1. Arrancar localmente

Requisitos: Node 20+ (testado com Node 26) e npm.

```bash
cd "winter arc"
npm install
npm run dev          # http://localhost:5173
```

Versão de produção (a mesma que vais publicar):

```bash
npm run build        # gera ./dist (inclui sw.js e manifest)
npm run preview      # http://localhost:4173
```

Outros comandos:

```bash
npm run typecheck    # tsc --noEmit
npm test             # testes unitários e de dados (Vitest)
npm run test:e2e     # testes E2E (Playwright: iPhone/WebKit + desktop/Chromium)
node scripts/make-icons.mjs   # regenera os ícones PNG a partir de public/icon.svg
```

## 2. Abrir no iPhone

Há duas formas:

**a) Só para experimentar (mesma rede Wi‑Fi)**

```bash
npm run build && npm run preview -- --host
```

Abre no Safari do iPhone o endereço `http://<IP-do-teu-Mac>:4173`. Funciona como página normal. **Atenção:** sem HTTPS o iOS não regista o service worker, por isso não há modo offline nem instalação fiável.

**b) Uso real (recomendado): publicar em HTTPS** — ver [`docs/PUBLICAR.md`](docs/PUBLICAR.md) (Cloudflare Pages, Netlify ou GitHub Pages, todos gratuitos). É só pastas estáticas: arrasta a pasta `dist`.

## 3. Instalar no ecrã principal do iPhone

1. Abre o endereço HTTPS no **Safari** (não funciona noutros navegadores no iOS).
2. Toca em **Partilhar** → **Adicionar ao ecrã principal** → **Adicionar**.
3. Abre a app a partir do ícone; abre em ecrã inteiro, sem barra do Safari.
4. Faz a primeira abertura com ligação à internet para o service worker pré‑carregar tudo; depois funciona offline.

Os dados da app instalada e do separador do Safari são **independentes** (o iOS isola o armazenamento). Escolhe um dos dois e usa sempre esse. Se mudares, exporta e importa uma cópia de segurança.

## 4. Onde ficam os dados (importante)

- Tudo fica em **IndexedDB** no dispositivo. Nada é enviado para servidores.
- A app pede armazenamento persistente (`navigator.storage.persist()`), mas **o iOS pode apagar dados** de sites que não são usados durante muito tempo (política ITP de 7 dias aplica-se a separadores do Safari; apps instaladas no ecrã principal estão isentas, mas não é garantido) e se limpares os dados do Safari.
- **Faz cópias de segurança regularmente** (Perfil → Cópia de segurança). A app mostra a data da última cópia.
- Fotografias de progresso ficam também no dispositivo e entram na cópia (opcional) como imagens redimensionadas.

## 5. Cópia de segurança e restauro

Perfil → **Cópia de segurança**:

- **Exportar**: ficheiro `winter-arc-backup-AAAA-MM-DD.json` versionado (`app: "winter-arc"`, `schemaVersion`). Opção de incluir ou não fotografias. Em iPhone, usa "Partilhar" para guardar em Ficheiros/iCloud Drive.
- **Importar**: escolhe o ficheiro → a app **valida** (estrutura, versão, tipos, intervalos) → mostra **resumo e plano** (quantos registos novos/atualizados/a apagar) → pede confirmação.
  - **Fundir** (recomendado): junta ao que já tens, por `id`; em conflito prevalece o registo mais recente (`updatedAt`); não duplica; sessões ativas não são sobrepostas.
  - **Substituir**: apaga os dados atuais e importa o ficheiro (confirmação reforçada; exporta antes).
  - Ficheiros inválidos ou de versão futura são **rejeitados sem alterar nada**; versões antigas são migradas.
- Todas as escritas da importação ocorrem numa **única transação**: ou entra tudo ou não entra nada.

## 6. Funcionalidades

| Área | O que faz |
| --- | --- |
| **Início** | Saudação, semana/fase, treino de hoje com "Iniciar treino", faixa da semana com estado de cada dia (planeado/concluído/parcial/falhado/adiado/descanso), resumo semanal, evolução de força, objetivos, recuperação, próxima sessão, atalho do relatório semanal, retoma de sessão em curso. |
| **Treinar** | Plano semanal oficial v2 (Seg Natação · Ter Push · Qua Pull · Qui Lower Strength & Vertical Jump · Sex Upper Hypertrophy & Core, com cardio opcional · Sáb Lower Hypertrophy & Explosive Speed, com variante A saltos / B sprints · Dom Descanso), com séries/reps ajustadas à fase; iniciar qualquer treino; treino livre; editor de treinos; biblioteca de exercícios. |
| **Sessão ativa** | kg/reps/RPE/RIR, tipo de série (aquecimento/normal/dropset/falha), valores da sessão anterior como referência (toque para copiar), temporizador de descanso por *timestamps* (sobrevive a recargas e ao ecrã bloqueado), som/vibração/notificação, auto‑guardar a cada alteração, retomar sessão interrompida, descartar com confirmação, adicionar/substituir/reordenar exercícios, sugestão de progressão dupla (nunca aplicada automaticamente). |
| **Registo atlético** | Saltos (altura/distância, aterragem 1–5), sprints (distância, tempo, intensidade), agilidade (percurso + tempo), natação (piscinas, distância, tempo total/efetivo, ritmo médio, estilo, pausas, RPE). |
| **Programa** | 12 semanas, 4 fases (Readaptação 1–2 → Construção 3–4 → Desenvolvimento 5–8 → Performance 9–12). A fase **não** depende só da data: podes prolongar fases e reduzir o volume em caso de fadiga/dor. As séries prescritas adaptam-se à fase sem alterar o teu plano. A pliometria só sobe de nível quando confirmas. |
| **Evolução** | Resumo; força por exercício (carga, melhor série, volume, e1RM *estimado* só para 1–10 reps); corpo (peso, média semanal, medidas, comparação de períodos, fotografias); performance atlética (valores medidos, protocolos separados — sprint 10 m ≠ 20 m); recordes (só valores reais); índice atlético interno opcional e transparente. |
| **Nutrição** | Metas 2600 kcal / 160 g P / 75 g G / 320 g H (editáveis), diário por refeição, alimentos próprios, refeições frequentes, água, creatina/suplementos, histórico. "Sem registo" nunca é 0. |
| **Recuperação** | Sono, fadiga, dor muscular, dor articular, stress, motivação, energia (1–5); sugestões prudentes (sem diagnósticos). |
| **Calendário** | Mês/semana, estado dos dias, abrir dia, adiar/planear sessões sem alterar o histórico. |
| **Relatórios** | Texto para ChatGPT (diário, semanal, mensal, exercício, performance) com **COPIAR RELATÓRIO** / **EXPORTAR RELATÓRIO** e a secção **PEDIDO AO CHATGPT**; relatório JSON estruturado ([`docs/RELATORIO-JSON.md`](docs/RELATORIO-JSON.md)). |
| **Definições** | Perfil, metas, descansos, som/vibração/notificações, manter ecrã ligado, tema, metas nutricionais, suplementos, repor plano oficial, limpar dados (com confirmação por escrito). |

## 7. Limitações conhecidas

- **Sem sincronização automática** entre dispositivos (por desenho). Usa exportar/importar.
- **iOS não permite agendar notificações com o ecrã bloqueado** a partir de uma PWA sem servidor push. O alerta de fim de descanso (som/vibração/notificação) só dispara com a app aberta ou em segundo plano recente; o contador, esse, é sempre correto porque usa horas absolutas. A vibração não é suportada no Safari/iOS.
- **Armazenamento do navegador é volátil** (ver secção 4) — faz cópias.
- **Vídeos**: a app não inclui vídeos nem URLs inventados. Cada exercício tem um **link rotulado de pesquisa** (YouTube) e podes guardar o teu próprio URL num exercício. Sem imagens de exercícios incluídas.
- Sem leitura de código de barras nem base de dados de alimentos: os valores nutricionais são introduzidos por ti (a app nunca inventa).
- A pesquisa de alimentos/relatórios depende apenas dos teus dados; sem dados, os relatórios dizem "sem registo".
- Testes E2E correm em WebKit/Chromium do Playwright; **não foi possível testar num iPhone físico neste ambiente** (ver [`docs/TESTES.md`](docs/TESTES.md)).
- O ficheiro JS principal tem ~1 MB (304 kB gzip); é pré‑carregado uma única vez pelo service worker.

## 8. Estrutura do projeto

```
src/lib        lógica pura e dados (types, db, repo, stats, reports, backup, program, calc…)
src/pages      ecrãs (Home, Train, Workout, Progress, Nutrition, Settings, Backup…)
src/components UI partilhada (ui, charts, Layout, WorkoutEditor, ExercisePicker…)
e2e            testes Playwright
docs           documentação (JSON, publicação, testes, manutenção)
```

Documentação adicional: [`docs/PUBLICAR.md`](docs/PUBLICAR.md) · [`docs/RELATORIO-JSON.md`](docs/RELATORIO-JSON.md) · [`docs/MANUTENCAO.md`](docs/MANUTENCAO.md) · [`docs/TESTES.md`](docs/TESTES.md)

> Esta app não substitui aconselhamento médico ou de um treinador. Se tiveres dor ou lesão, procura um profissional.


## Atualização do programa (v2)

O plano de treino foi substituído **sem reconstruir a app** nem apagar dados:

- Os 5 modelos antigos ficam **arquivados** (não aparecem no calendário, mas o histórico mantém-se intacto e as sessões antigas guardam a sua própria cópia dos exercícios).
- Os modelos novos são adicionados uma única vez (migração idempotente que corre ao abrir a app e após importar uma cópia de segurança antiga).
- As fases passam de 3 para 4; as datas de fase já guardadas são convertidas (`[3,7]` → `[3,5,9]`).
- Os ids dos exercícios equivalentes (supino, agachamento, leg curl, salto vertical, …) foram preservados, por isso o histórico, os recordes e os gráficos continuam ligados.
- Exercícios opcionais (cardio de sexta) não contam para a conclusão da sessão.
- Sábado pergunta a variante (A: Pogo + Broad Jump; B: acelerações + sprints curtos).
- O salto vertical medido é a **altura do salto** (diferença entre alcance em pé e alcance no ponto mais alto); a altura da caixa do Box Jump é guardada à parte e nunca conta como salto.
- Não há imagens demonstrativas nem links de vídeo diretos: cada exercício tem uma **pesquisa no YouTube** claramente rotulada.
