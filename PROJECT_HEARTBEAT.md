# 💓 PROJECT HEARTBEAT (SDS_STATE)

**Last Update:** 2026-02-16 13:10 | **Current Phase:** Phase 1 (Foundations)

## 🆘 HANDOVER FORMULA (Copy/Paste this to start a new session)

> "Read `PROJECT_HEARTBEAT.md` as your first action and resume the project from [Current Step]. Use the provided context to maintain continuity. The game is a high-depth business simulation named **MacroMogul** (Global Empire Simulation)."

## 📍 Current Technical State

- **Branding:** **MacroMogul** (Full implementation).
- **Localization:** `react-i18next` deeply integrated. EN/TR JSON files updated.
- **Components:** `MainMenu`, `TopBar`, and `BottomToolbar` are fully localized with language detection.
- **Persistence:** Supabase DDL schema created in `supabase/migrations/`. `persistenceService` ready for cloud-sync.
- **Current Progress:**
  - Established premium glassmorphism language switcher.
  - Profiles and Saves tables defined (RLS enabled).
  - Monthly game date logic connected to localized month names.

## 🛠️ Memory Context (Algorithms & Info)

- **Supabase Schema:**
  - `profiles`: `id`, `username`, `company_name`, `level`, `exp`.
  - `saves`: `user_id`, `slot_id`, `data (jsonb)`, `game_date`.
- **Modding:** Assets in `public/locales` allow community translation (EN/TR default).

## ⏭️ Next Immediate Steps

1. **Engine Rendering:** Connect bitECS world state to isometric tile rendering logic in `IsometricMap`.
2. **Management Deepen:** Implement "Internal Management" logic (morale, training, productivity) in the ECS.
3. **Save/Load UI:** Add a "Load Game" modal to the Main Menu connected to `persistenceService`.

## ⚖️ Governance & Anti-Gravity Rules (Hard)

- **Verification Gate:** NO code shall be presented to the user unless it passes `npm run test` and `npm run check`.
- **Security First:** All cloud mutations MUST be validated via RLS. No "Trusting the Client" on financial or meta data.
- **Aesthetic Premium:** Every UI component must follow the glassmorphism/high-fidelity design system.

## 🧬 AI Evolution Strategy

- **Meta-Collecting:** Implement passive data listeners in the ECS to track simulation outliers for future AI-driven balancing.
- **Self-Generating Assets:** The pipeline is prepared for AI-assisted procedural data generation in `data/procedural`.
