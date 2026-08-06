# Young Inventor / Юный изобретатель

Оригинальная браузерная физическая головоломка про машины Руба Голдберга. Проект изучает **общие системные принципы** классических machine-puzzle игр, но использует собственный код, графику, уровни, интерфейс и бренд.

## Текущее направление

- full 3D PBR presentation;
- touch-first **2.75D construction**: X/Y drag + BACK / MAIN / FRONT layers;
- Rapier3D для новых полноценных уровней;
- Three.js для визуального слоя;
- фиксированный physics timestep;
- отдельные visual meshes и physics colliders;
- оригинальный AAA-child Inventor Workshop visual target;
- реальные причинно-следственные цепочки без scripted success.

## Clean-room foundation

Главные документы:

- [`docs/TIM_CLEANROOM_SPEC.md`](docs/TIM_CLEANROOM_SPEC.md) — обязательные IP/architecture границы;
- [`docs/TIM_MECHANICS_BIBLE.md`](docs/TIM_MECHANICS_BIBLE.md) — функциональные механические архетипы;
- `src/mechanicsCatalog.ts` — типизированный runtime-каталог;
- `src/machineGraph.ts` — reusable graph деталей и соединений.

Никакие коммерческие sprites, модели, звуки, исходный код или оригинальные уровни TIM не являются shipping assets этого проекта.

## Current playable reference

Stage 02 — **Balance & Reaction** — используется как текущий reference runtime для:

- iPad pointer input;
- X/Y placement;
- discrete depth layers;
- Rapier3D causal chain;
- bright workshop visual direction.

Route:

```text
?stage=workshop-02
```

## Core machine architecture

Каждая деталь описывается как generic contract:

```text
inputs -> physics -> outputs
            +
      compatible ports
            +
      runtime states
```

Базовые связи:

- rope / pulley;
- belt / shaft;
- gear mesh;
- electrical producer / switch / consumer;
- physical contact / pressure / impulse.

Уровни должны собирать эти механики через общий graph/ports API, а не через скрытый level-specific код.

## Technology

- TypeScript
- Vite
- Three.js
- Rapier3D
- legacy Planck modules for some earlier isolated part labs
- Vitest
- Playwright
- Cloudflare Pages

## Local development

```bash
npm install
npm run dev
```

## Production verification

```bash
npm run build
npm run test:e2e
```

`npm run build` запускает unit tests, TypeScript build и Vite production build.

## Product rule

Young Inventor должен быть самостоятельной игрой: современная физика, лёгкое управление на iPad, оригинальные уровни и светлая реалистично-стилизованная 3D-мастерская. Системная свобода важнее копирования внешнего вида любой существующей игры.
