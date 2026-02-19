# MacroMogul — Global Empire Simulation

## What Is MacroMogul?

MacroMogul is the next-generation successor to deep business-simulation classics. Players build and manage corporate empires across retail, manufacturing, and finance—all within a living macroeconomic simulation. 

**Key Enhancements:**
- **Languages:** Native Support for English (EN) and Turkish (TR).
- **Monetization:** Modular store for scenarios and premium UI themes.
- **Platform:** Browser-first execution with a dedicated downloadable desktop client (Tauri).
- **Memory:** Integrated Self-Documenting State (SDS) for persistent development continuity.

The game uses a **top-down isometric city map** where players place buildings (factories, stores, farms, mines, offices) and manage their internal 3×3 unit grids (purchasing → manufacturing → sales → advertising). Each building type has distinct functional units that can be linked together to form production and distribution chains.

---

## Scope of This Plan

This plan is organised into **10 numbered documents** that together give an AI model everything it needs to clone the game. Each document is self-contained but cross-references the others.

| # | File | Covers |
|---|------|--------|
| 00 | `00-overview.md` | This file — high-level summary and reading order |
| 01 | `01-architecture.md` | Tech stack, project structure, ECS design, data flow |
| 02 | `02-economic-simulation.md` | Macro economy, inflation, GDP, city dynamics, central bank |
| 03 | `03-products-and-supply-chains.md` | Full product catalog, raw materials, recipes, supply-chain logic |
| 04 | `04-buildings-and-units.md` | All building types, internal unit grids, placement rules |
| 05 | `05-corporate-finance.md` | Stock market, shares, bonds, loans, M&A, dividends, banking, insurance |
| 06 | `06-ai-competitors.md` | AI CEO behaviour trees, difficulty tuning, competitor strategies |
| 07 | `07-ui-and-rendering.md` | Isometric renderer, HUD, overlays, mini-map, menus, responsive layout |
| 08 | `08-scenarios-and-victory.md` | Scenario system, victory conditions, campaign progression |
| 09 | `09-dlc-modules.md` | Subsidiary, City Econ, Digital Age, Banking & Finance, Service Industry |
| 10 | `10-implementation-roadmap.md` | Phased milestones, sprint plan, MVP definition, verification |

---

## Guiding Principles

1. **Data-driven design** — every product, recipe, building cost, and economic parameter lives in JSON/YAML config files, not hard-coded.
2. **ECS (Entity-Component-System)** — the simulation core uses an ECS architecture so systems (economy tick, production tick, AI tick) run independently and can be unit-tested in isolation.
3. **Deterministic simulation** — given the same seed, the game produces identical results. This enables replay, multiplayer sync, and automated testing.
4. **Moddability from day one** — the config-driven approach means mods are just new data packs.
5. **Incremental delivery** — the roadmap is split into 6 phases, each producing a playable slice.

---

## Recommended Tech Stack (Summary)

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | **TypeScript** | Fast iteration, huge ecosystem, works in browser & Node |
| Rendering | **PixiJS v8** | 2-D WebGL renderer, perfect for isometric tile maps |
| State / ECS | **bitECS** or custom lightweight ECS | Cache-friendly, fast iteration over 100 k+ entities |
| UI Framework | **React + Zustand** | Overlays, menus, HUD panels on top of the PixiJS canvas |
| Data Format | **JSON / YAML** | Human-readable configs for products, recipes, buildings |
| Build Tool | **Vite** | Sub-second HMR, native TS support |
| Testing | **Vitest** | Fast unit & integration tests for simulation logic |
| Persistence | **IndexedDB (browser)** or **SQLite (Electron)** | Save/load game state |

> The full rationale and project folder structure is in [`01-architecture.md`](./01-architecture.md).

---

## How to Use This Plan

1. Read documents **01 → 10** in order.
2. Each document contains **exact data schemas, algorithm pseudocode, and acceptance criteria**.
3. Feed the documents to an AI coding assistant along with the prompt:
   > "Implement Phase N of the Capitalism Lab clone as described in the attached plan documents."
4. After each phase, run the verification checklist in `10-implementation-roadmap.md`.
