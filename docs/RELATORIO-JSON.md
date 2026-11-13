# Relatório JSON estruturado

Relatórios → **Exportar relatório em JSON**. É uma *fotografia de um período* pensada para análise externa (ChatGPT, folha de cálculo, scripts). **Não é uma cópia de segurança** e não pode ser importado; para isso usa Perfil → Cópia de segurança.

## Cabeçalho

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `schema` | `"winter-arc-report"` | Identifica o formato. |
| `schemaVersion` | `1` | Sobe quando houver alterações incompatíveis. |
| `generatedAt` | ISO 8601 UTC | Momento da exportação. |
| `period` | `{from, to}` | Datas `AAAA-MM-DD` (Europe/Lisbon). |
| `profile` | `{heightCm, startWeightKg}` | Perfil base. |

## Secções

- **`sessions[]`** — sessões **terminadas** no período.
  - `id`, `date`, `name`, `kind`, `status` (`completed` / `partial`), `startedAt`, `endedAt`, `durationSec`, `programWeek`, `phase`, `rpe`, `notes`, `volumeKg`.
  - `exercises[]`: `exerciseId`, `name`, `logType` (`strength|jump|sprint|agility|checklist|swim`), `plan {sets, repMin, repMax}`, `notes`, `surface`, `course`, `volumeKg`, `estimated1RMKg` (estimativa de Epley, só exercícios marcados e 1–10 reps; ausente caso contrário) e `sets[]`.
  - `sets[]`: `type` (`normal|warmup|drop|failure`), `done`, e conforme o tipo `weightKg`, `reps`, `rpe`, `rir`, `heightCm`, `distanceCm`, `landing`, `distanceM`, `timeS`, `restS`, `notes`, …
  - `swim`: `pool`, `laps`, `distanceM`, `totalSec`, `effectiveSec`, `stroke`, `restsCount`, `rpe`, `notes`.
- **`body[]`** — registos corporais (`date`, `weightKg`, `waistCm`, `chestCm`, `armCm`, `thighCm`, `hipCm`, `bodyFatPct`, `notes`). `bodyFatPct` só existe se foi **medida**.
- **`nutrition[]`** — por dia: `totals {kcal, protein, carbs, fat}`, `target`, `meals[]`.
- **`hydrationSupplements[]`** — registos diários de água, suplementos e atividade de descanso.
- **`recovery[]`** — escalas 1–5 (`sleepH`, `sleepQuality`, `fatigue`, `soreness`, `jointPain`, `stress`, `motivation`, `energy`, `notes`).
- **`performance{}`** — chaves por protocolo (`vertical-jump`, `broad-jump`, `sprint-10m`, `sprint-20m`, `run-1km`, `swim-pace`, `swim-distance`, `agility:<percurso>` …) → `{label, unit, protocol, better ("higher"|"lower"), points[{date, value, source}]}`.

## Regras de dados

- **Ausente ≠ zero.** Um campo em falta (ou a secção vazia) significa *sem registo*. Nunca se preenchem valores.
- Os valores de performance são **medidos**; recordes e *e1RM* são calculados a partir deles e `estimated1RMKg` é sempre uma estimativa.
- Protocolos diferentes nunca se misturam (sprint de 10 m ≠ 20 m; percursos de agilidade com nomes diferentes são séries diferentes).
- Datas `AAAA-MM-DD` na hora de Lisboa; instantes em ISO 8601 UTC.

## Exemplo (abreviado)

```json
{
  "schema": "winter-arc-report",
  "schemaVersion": 1,
  "generatedAt": "2026-11-20T09:30:00.000Z",
  "period": { "from": "2026-11-16", "to": "2026-11-22" },
  "profile": { "heightCm": 181, "startWeightKg": 80 },
  "sessions": [
    {
      "date": "2026-11-17",
      "name": "Upper Strength",
      "status": "completed",
      "volumeKg": 480,
      "exercises": [
        { "name": "Supino plano", "logType": "strength", "estimated1RMKg": 76,
          "sets": [{ "type": "normal", "done": true, "weightKg": 60, "reps": 8 }] }
      ]
    }
  ],
  "body": [], "nutrition": [], "hydrationSupplements": [], "recovery": [], "performance": {}
}
```
