# Diseño: TraceLens — Monitor de agentes Claude Code en tiempo real

**Fecha:** 2026-03-27
**Estado:** Aprobado

---

## Problema

Claude Code puede tener múltiples sesiones activas simultáneamente, cada una con sub-agentes. No existe ninguna herramienta que muestre en tiempo real qué agentes están corriendo, cuántos tokens consumen, cuánto cuestan, y si el ritmo de consumo pone en riesgo el límite de la ventana de 5h.

## Objetivo

Herramienta CLI (`tracelens`) que muestra un árbol visual en la terminal con todas las sesiones activas de Claude Code y sus agentes, con métricas en tiempo real y alertas de color progresivas basadas en la proyección de consumo.

---

## Arquitectura

### Capas

```
CLI (cli.ts)
  └── UI Layer (Ink + React)
        └── State Layer (funciones puras)
              └── Data Layer (providers)
```

**Principio de diseño:** cada capa comunica con la siguiente a través de interfaces tipadas. Agregar una fuente de datos nueva = implementar `DataProvider<T>`. Agregar un modelo nuevo = una entrada en el pricing registry.

---

### Data Layer — `src/providers/`

Cada provider implementa la misma interfaz:

```typescript
interface DataProvider<T> {
  start(): void
  stop(): void
  on(event: 'data', handler: (data: T) => void): void
}
```

| Provider | Archivo | Fuente | Qué entrega |
|----------|---------|--------|-------------|
| `SessionProvider` | `session.ts` | `~/.claude/sessions/*.json` | Sesiones activas: `{ sessionId, pid, cwd, startedAt }` |
| `JournalProvider` | `journal.ts` | `~/.claude/projects/**/*.jsonl` + `subagents/` via chokidar | Por cada turno: `{ sessionId, agentId?, model, usage, timestamp, isSidechain }` |
| `WindowProvider` | `window.ts` | `/tmp/ctx-ceiling-*.json` + `/tmp/ctx-window-marker-*` | Estado de ventana 5h: `{ windowStart, windowEnd, estimatedCeiling, ceilingLevel }` |

**Notas:**
- `JournalProvider` usa FSEvents (chokidar) en macOS → latencia ~10-50ms.
- La estructura de directorios de Claude Code codifica la jerarquía: `{sessionId}.jsonl` es el orquestador; `{sessionId}/subagents/agent-{name}-{hash}.jsonl` son los sub-agentes.
- `WindowProvider` hace polling cada 30s (el ceiling cache tiene TTL de 60s).

---

### State Layer — `src/state/`

Funciones puras, sin side effects, fáciles de testear.

#### `TokenAccumulator` (`accumulator.ts`)
Acumula tokens por sesión/agente dentro de la ventana activa:
```
tokens_en_ventana = sum(usage) donde timestamp >= windowStart
```
Campos por nodo: `{ inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, totalTokens, cost }`

#### `BurnTracker` (`burn-tracker.ts`)
Calcula burn rate con ventana deslizante de 5 minutos:
```
burn_rate = tokens_en_últimos_5min / 5   (tokens/minuto)
```

#### `AlertEngine` (`alert-engine.ts`)
Calcula `dangerRatio` para determinar el color de cada rama:
```
projected = current_tokens + burn_rate × remaining_minutes
danger_ratio = projected / estimatedCeiling
```

| Rango | Color | Significado |
|-------|-------|-------------|
| 0.00–0.50 | verde `#3fb950` | Seguro |
| 0.50–0.70 | amarillo-verde | Atención baja |
| 0.70–0.85 | amarillo `#e3b341` | Moderado |
| 0.85–0.95 | naranja `#f0883e` | Riesgo alto |
| 0.95–1.00 | naranja-rojizo | Inminente |
| >1.00 | rojo `#f85149` | Proyecta exceder |

El `dangerRatio` se calcula a nivel de **agente individual**. El color de la rama (la línea de conexión) toma el color del nodo hijo.

Sesiones **sin sub-agentes**: siempre gris `#484f58`, independientemente del consumo.

#### `TreeBuilder` (`tree-builder.ts`)
Construye el árbol a partir de la estructura de directorios y los datos de sesiones activas:
```
projects/
  {sessionId}.jsonl              → nodo orquestador
  {sessionId}/subagents/
    agent-{name}-{hash}.jsonl   → nodo sub-agente
```

---

### UI Layer — `src/ui/`

Construida con Ink (React para terminal). El estado fluye desde los providers → store → componentes. Ningún componente accede a archivos directamente.

#### Componentes

| Componente | Responsabilidad |
|------------|-----------------|
| `App.tsx` | Root. Orquesta providers, mantiene el store, ciclo de render a ~300ms. |
| `WindowHeader.tsx` | Barra superior: `TRACELENS │ 5h: X% │ Ceiling │ Reset │ Total` |
| `SessionTree.tsx` | Renderiza todos los proyectos activos como árboles independientes. |
| `AgentNode.tsx` | Nodo individual: caja con nombre, modelo, tokens, costo, burn rate. Las líneas de conexión usan el color del nodo hijo. |

#### Layout visual

```
TRACELENS  │  5h: 19% [Alto]  │  Ceiling: 72.9M  │  Reset: 4h 38m  │  $11.28 total
─────────────────────────────────────────────────────────────────────────────

                        ╔════════════════════╗          ← azul
                        ║ ~/.claude/projects ║
                        ╚══════════╤═════════╝
                                   │
             ┌─────────────────────┴───────────────────────┐
             │ (verde)                          (gris)     │
     ╔═══════╧════════════╗             ╔═══════╧════════════╗
     ║ ivuo-app           ║             ║ TraceLens          ║  ← gris (sin agentes)
     ║ Session 2336fd75   ║             ╚════════════════════╝
     ║ claude-sonnet-4-6  ║
     ║ 2.6M tok · $7.20   ║
     ║ burn: 84k/min      ║
     ╚═══════╤════════════╝
             │
      ┌──────┴─────────────────┐
      │ (verde)       (rojo)   │
  ╔═══╧═══════════╗    ╔═══╧════════════════════╗
  ║ aside_q       ║    ║ structural-review ⚠    ║  ← rojo (proyecta exceder)
  ║ sonnet-4-6    ║    ║ sonnet-4-6             ║
  ║ 850k · $2.50  ║    ║ 1.2M · $3.60           ║
  ╚═══════════════╝    ║ burn: 200k/min         ║
                       ╚════════════════════════╝
```

---

### Pricing Registry — `src/models/pricing.ts`

Mapa `modelId → PricingEntry`. Extendible sin tocar lógica:

```typescript
interface PricingEntry {
  inputCostPerMToken:      number
  outputCostPerMToken:     number
  cacheWriteCostPerMToken: number
  cacheReadCostPerMToken:  number
}
```

Valores por defecto:

| Modelo | Input | Output | Cache write | Cache read |
|--------|-------|--------|-------------|------------|
| `claude-sonnet-4-6` | $3.00 | $15.00 | $3.75 | $0.30 |
| `claude-opus-4-6` | $15.00 | $75.00 | $18.75 | $1.50 |
| `claude-haiku-4-5` | $0.80 | $4.00 | $1.00 | $0.08 |

Configuración personalizada via `~/.tracelens.json` (override por modelo).

---

### CLI — `src/cli.ts`

| Comando | Comportamiento |
|---------|----------------|
| `tracelens` | Modo live: árbol reactivo, refresco ~300ms |
| `tracelens --snapshot` | One-shot: imprime el árbol una vez y sale |
| `tracelens --all` | Incluye sesiones de las últimas 24h (activas + terminadas) |
| `tracelens --project <path>` | Filtra por directorio de proyecto |

---

## Flujo de datos

```
FSEvents (chokidar)
  → JournalProvider (nuevas líneas JSONL)
  → TokenAccumulator (acumula tokens en ventana)
  → BurnTracker (calcula burn rate)
  → AlertEngine (calcula danger_ratio por agente)
  → TreeBuilder (construye árbol con colores)
  → Ink render (~300ms)
  → Terminal

SessionProvider (fs.watch sobre ~/.claude/sessions/)
  → detecta sesiones nuevas/terminadas
  → actualiza SessionRegistry

WindowProvider (poll cada 30s sobre /tmp/ctx-ceiling-*.json)
  → actualiza windowStart, windowEnd, estimatedCeiling
```

---

## Casos borde

| Caso | Comportamiento |
|------|----------------|
| Sin ceiling cache (`/tmp/ctx-ceiling-*.json` no existe) | Muestra tokens sin porcentaje. Sin alertas de color. |
| Sesión activa sin actividad reciente (burn = 0) | `danger_ratio = current / ceiling`. Color estático. |
| Sub-agente sin entradas de usage todavía | Muestra "iniciando..." en lugar de métricas. |
| Ventana 5h se resetea mientras TraceLens corre | WindowProvider detecta nuevo `windowStart`, acumulador se reinicia. |
| Proyecto con muchas sesiones (>10) | SessionTree pagina o colapsa sesiones inactivas automáticamente. |

---

## Stack técnico

| Tecnología | Uso |
|------------|-----|
| TypeScript (strict) | Todo el proyecto |
| Ink + React | Terminal UI reactiva |
| chokidar | File watching via FSEvents |
| Node.js ≥ 18 | Runtime |

Sin dependencias de `ccusage`. Sin configuración de hooks adicionales.

---

## Fuera de scope

- Soporte Linux (usa BSD date syntax del ctx-5h-monitor; ajustable a futuro)
- Histórico multi-ventana
- Export a JSON/CSV
- Notificaciones push (macOS notifications)
