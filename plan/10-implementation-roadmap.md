# 10 — Implementation Roadmap

This document provides the step-by-step sprint plan for an AI or developer to clone the game from scratch.

---

## Phase 0: Project Governance & SDS Setup (1-3 Days)
*Objective: Establish memory persistence and project standards.*

1. **SDS Implementation:** Create and maintain `PROJECT_HEARTBEAT.md`.
2. **Foundational Config:** Set up absolute path rules and i18n structure.
3. **Environment Sync:** Establish Supabase connection for global user state.
4. **Security Hardening:** Define RLS (Row Level Security) policies and data sanitization layers.
5. **Testing Framework:** Initialize Vitest & Playwright; establish "No-Test No-Merge" protocol.

---

## Phase 0.5: AI Content Pipeline (3-5 Days)
*Objective: Establish the "Gold Standard" for assets (Visual & Data).*

1. **Visual Synthesis:** Script for AI-driven isometric sprite generation (Buildings, Cars, Faces).
2. **Data Engine:** Implement JSON-based product & recipe synthesizer using LLM assistance.
3. **Asset Automation:** Setup ImageMagick/Post-processing for background removal and atlasing.
4. **Initial Library:** Generate first 20 buildings and 50 core product types.

---

## Phase 1: The Engine Foundation (1-2 Weeks)
*Objective: A navigable, multi-language isometric map with basic architecture.*

1. **ECS Setup:** Implement `bitECS` core components.
2. **Localization:** Initialize `i18next` with `en.json` and `tr.json` foundations.
3. **Isometric Renderer:** Build the tile map loader and camera controller.
4. **Desktop Build:** Initialize Tauri project for native distribution tests.

---

## Phase 2: Simple Production Cycle (1-2 Weeks)
*Objective: Build a retail store and sell a pre-seeded product.*

1. **Building Logic:** Implement the construction timer and building placement.
2. **Unit Grid:** Implement the 3x3 internal unit grid and linking logic.
3. **Retail Flow:** Connect a Purchase Unit to a Sales Unit. Simple script to "inject" stock into the Purchase unit.
4. **Demand System:** Implement the City Demand algorithm (population * confidence).
5. **HUD v1:** Display Cash, Date, and basic Firm details.

---

## Phase 3: Manufacturing & Supply Chain (2-3 Weeks)
*Objective: Farm → Factory → Retail.*

1. **Farming Module:** Season-aware harvest and yield logic.
2. **Manufacturing System:** Recipe processing (Input + Time = Output).
3. **Inter-Building Freight:** Calculate travel time and cost between locations.
4. **Inventory Buffers:** Handle stock limits and overflows.
5. **Profit & Loss:** Generate the first basic Income Statement.

---

## Phase 4: Corporate Finance & Market (2-3 Weeks)
*Objective: Stocks, Loans, and Competitors.*

1. **Stock Market Engine:** Automated share price calculation based on EPS.
2. **Finance UI:** Screens for issuing shares/loans and buying other stocks.
3. **AI Base:** Implement the "Aggressive Expander" archetype logic.
4. **R&D System:** Tech progress and product quality increments.
5. **Real Estate:** Apartment/Commercial rental income logic.

---

## Phase 5: AI-Driven Evolution & High-Fidelity Polish (Ongoing)
*Objective: Advanced simulation depth, premium visuals, and AI self-education.*

1. **Self-Educating Meta-Data:** Implement "Meta-Collectors" that feed gameplay patterns (profitability, failure rates) to a balancing AI.
2. **AI-Assisted Balancing:** Dynamic difficulty adjustment where the world reacts to the player's skill (e.g., city GDP shifts to challenge dominant players).
3. **Procedural Data Pipelines:** Integrated LLM triggers to generate new periodic product classes/trends to prevent "solving" the meta.
4. **High-Fidelity Visuals:** PixiJS v8 high-quality lighting, atmospheric shaders (weather/smog), and fluid UI animations.
5. **Final Security Audit:** Penetration testing on Supabase endpoints and verification of simulation determinism (Anti-Cheat).

---

## Verification Checklist (Post-Implementation)

| Requirement | Test |
|-------------|------|
| **Determinism** | Do two identical seeds produce the same city GDP at year 10? |
| **Performance** | Can the engine handle 5,000 buildings and 100+ evolveable AI companies at 60fps? |
| **Balance** | Does the AI-Balancing loop keep the game challenging across a 50-year campaign? |
| **Security** | Are all cloud mutations validated via Supabase RLS and server-side logic? |
| **UX** | Is the interface responsive, aesthetically premium, and fully localized? |
| **Save/Load** | Does a loaded game state match the exact moment it was saved (checksum verified)? |

---

## Final Goal
By following this roadmap, you will have a fully functional, moddable, and high-performance business simulation game that captures the "Core Loop" of Capitalism Lab: **Identify Gap → Build Chain → Dominate Market → Diversify.**
