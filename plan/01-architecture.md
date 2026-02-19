# 01 — Architecture & Tech Stack

## Technology Choices

| Layer | Choice | Rationale |
| :--- | :--- | :--- |
| **Language** | TypeScript 5.x | Strong typing catches simulation bugs early; huge npm ecosystem |
| **Renderer** | PixiJS v8 | WebGL-accelerated 2-D rendering, excellent sprite-batch performance for isometric tile maps |
| **ECS** | bitECS (or thin custom ECS) | Struct-of-Arrays layout, zero-GC iteration over 100 k+ entities at 60 fps |
| **UI** | React 18 + Zustand | UI overlays (menus, HUD, popups, charts) rendered as an HTML layer on top of the PixiJS canvas |
| **Build** | Vite 5 | Sub-second HMR; native TS/JSX support |
| **Test** | Vitest + Playwright + CI | **Bulletproof Release:** No features proposed to user without passing local unit & E2E tests. CI/CD block on failures. |
| **Security** | Supabase Auth + RLS + Hashing | **Anti-Hack:** Row Level Security (RLS) ensures data isolation. Peppered hashing for tokens. |
| **Evolution** | AI-Assisted Balancing & Data | **Self-Educating:** Systems leverage AI for dynamic data generation and meta-balancing based on playstyle. |

---

## Project Folder Structure

```
capitalism-clone/
├── public/
│   ├── assets/               # Sprites, tiles, sounds
│   └── locales/              # i18n JSON files (en.json, tr.json)
├── src/
│   ├── main.ts               # Entry point — bootstrap Pixi + React
│   ├── core/
│   │   ├── ecs/
│   │   │   ├── world.ts            # ECS world init
│   │   │   ├── components.ts       # All component definitions
│   │   │   └── systems/
│   │   │       ├── economySystem.ts
│   │   │       ├── productionSystem.ts
│   │   │       ├── marketSystem.ts
│   │   │       ├── financeSystem.ts
│   │   │       ├── aiSystem.ts
│   │   │       ├── citySystem.ts
│   │   │       ├── bankingSystem.ts  # DLC: Banking logic
│   │   │       ├── insuranceSystem.ts # DLC: Insurance logic
│   │   │       └── eventSystem.ts
│   │   ├── simulation/
│   │   │   ├── clock.ts            # Game tick / speed control
│   │   │   ├── rng.ts              # Seeded PRNG for determinism
│   │   │   └── serializer.ts       # Save / Load
│   │   └── config/
│   │       ├── products.txt        # Primary data files (mimic CapLab format)
│   │       ├── recipes.txt
│   │       ├── buildings.txt
│   │       ├── scenarios.json
│   │       └── economyDefaults.json
│   ├── rendering/
│   │   ├── IsometricMap.ts         # Tile map renderer
│   │   ├── BuildingRenderer.ts     # Sprite placement on map
│   │   ├── OverlayRenderer.ts      # Heat maps (traffic, pollution, profit)
│   │   └── Camera.ts               # Pan, zoom, minimap
│   ├── ui/
│   │   ├── App.tsx                 # Root React component
│   │   ├── hud/
│   │   │   ├── TopBar.tsx          # Cash, date, speed controls
│   │   │   ├── MiniMap.tsx
│   │   │   └── Toolbar.tsx         # Build, demolish, overlays
│   │   ├── panels/
│   │   │   ├── BuildingPanel.tsx   # unit grid editor (3x3 up to 5x5)
│   │   │   ├── FinancePanel.tsx    # Stock, bonds, loans
│   │   │   ├── CityPanel.tsx       # City stats, GDP, pop, taxes
│   │   │   ├── CompanyPanel.tsx    # Balance sheet, P&L
│   │   │   ├── BankPanel.tsx       # DLC: Deposit/Loan rates
│   │   │   └── InsurancePanel.tsx  # DLC: Premiums/Claims
│   │   └── modals/
│   │       ├── NewGameModal.tsx
│   │       ├── SaveLoadModal.tsx
│   │       └── SettingsModal.tsx
│   └── ai/
│       ├── AIController.ts        # Per-company AI driver (CEO/COO/CMO)
│       ├── strategies/
│       │   ├── expansionStrategy.ts
│       │   ├── pricingStrategy.ts
│       │   └── investmentStrategy.ts
│       └── behaviorTree.ts        # BT nodes & traversal
├── data/
│   └── mods/                      # User mod packs (Replacement/Additive)
├── tests/
│   ├── unit/
│   │   ├── economySystem.test.ts
│   │   ├── productionSystem.test.ts
│   │   └── financeSystem.test.ts
│   └── e2e/
│       └── newGame.spec.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## ECS Design

### Core Components (defined in `components.ts`)

```ts
// Position on the isometric grid
Position      { x: u16, y: u16, cityId: u8 }

// What type of entity this is
EntityType    { kind: enum(Building, Product, Company, City, Resource, Bank) }

// Company ownership & Subsidiary info
Ownership     { companyId: u16, subsidiaryOf: u16, publicShares: f32, expertisePoints: u32 }

// Building specifics
Building      { type: enum, size: u8, constructionTick: u32, floors: u8, condition: f32, interactive: bool }

// Internal unit grid (Variable size depending on building)
UnitGrid      { slots: [UnitType; N], links: [LinkPair; M], efficiency: f32, autoManaged: bool }

// Production state
Production    { recipeId: u16, progress: f32, outputBuffer: u16, quality: f32, techLevel: u16, techAge: u16 }

// Financial state per company (Full P&L components)
Finance       { cash: f64, debt: f64, shares: u32, sharePrice: f64, creditRating: u8, dividendYield: f32, intangibleAssets: f64 }

// Banking & Insurance component (DLC)
BankState     { deposits: f64, loansGranted: f64, interestRateS: f32, interestRateL: f32, insurancePolicies: u32 }

// City macro state (Expanded)
CityEcon      { gdp: f64, population: u32, unemployment: f32, inflation: f32, mood: f32, taxRate: f32, trafficIndex: [u8; MAP_SIZE] }
```

### System Execution Order (per tick)

```
1. clockSystem          — advance date, handle speed multiplier, process script variables
2. eventSystem          — random events, scenario triggers, tech disruption
3. economySystem        — update GDP, inflation, unemployment per city, update trafficIndex
4. productionSystem     — run factory / farm / mine / warehouse cycles (with expertise modifiers)
5. marketSystem         — match supply ↔ demand, settle prices, update market share
6. financeSystem        — process loans, dividends, stock prices, bond payments, M&A logic
7. aiSystem             — AI behavior trees (Expertise-driven decision making)
8. citySystem           — update population, quality of life, real estate occupancy
9. digitalSystem        — software development cycles, digital downloads, server load
10. renderSystem        — push ECS state → PixiJS scene graph (if client)
```

Each system reads relevant components, mutates state, and is fully unit-testable by constructing a minimal ECS world with just the needed components.

---

## Data Flow

```
  ┌──────────┐     tick()      ┌─────────────┐
  │  Config   │ ──────────────▶│  ECS World   │
  │  (JSON)   │                │  Components  │
  └──────────┘                └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              economySystem    productionSystem   aiSystem ...
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  Zustand     │   (selected slices)
                              │  UI Store    │──────▶  React UI
                              └─────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  PixiJS      │   (positions, sprites)
                              │  Scene       │──────▶  Canvas
                              └─────────────┘
```

---

## Save / Load

- Each save is a **snapshot** of the entire ECS world (all component arrays) + the PRNG state + the current tick.
- Serialised as a compressed binary blob (e.g., via `fflate`) and stored in IndexedDB.
- On load, the world is reconstructed from the blob and simulation resumes deterministically.

---

---

## 🔐 Advanced Security & Robustness

### 1. Robustness First (Agent Protocol)
- **Verified Deliverables:** Agents MUST run `npm test` and verify visual fidelity before presenting code.
- **Error Boundaries:** React Error Boundaries + Global ECS Catch-alls to prevent "Black Screens".
- **State Integrity:** Checksum validation for save files to prevent corruption.

### 2. High-Level Security (Anti-Hack)
- **Supabase RLS:** Every database query is governed by Row Level Security. Users cannot "peek" or mutate other players' cloud saves.
- **Server-Side Validation:** Financial transactions (Golden Tokens) are validated via server-side edge functions, not client-side logic.
- **Deterministic Simulation:** The engine uses a seeded PRNG (`rng.ts`). Any state mutation that deviates from the seed is flagged as a desync/tamper.

---

## 🧠 AI-Driven Evolution & Gameplay

### 1. Self-Educating Simulation
- **Dynamic Balancing:** The engine tracks "Meta-Data" (most profitable items, common bankruptcy points). An offline AI agent analyzes this to adjust city GDP or competitor aggression.
- **Procedural Data Generation:** New product classes and market niches can be hallucinated by integrated LLM pipelines into `data/procedural/` to keep the end-game fresh.
- **Adaptive Competitors:** AI CEOs don't just follow scripts; they evolve tactics based on the player's recent market dominates (e.g., if player dominates Retail, AI pivots to R&D/Tech).

### 2. Premium Aesthetics & UX
- **Visual Fidelity:** PixiJS v8 high-bitrate sprites + custom shaders for weather/atmosphere.
- **User-Centric Design:** Context-aware UI. If a factory is low on raw materials, the UI highlights the supply-chain path automatically.
