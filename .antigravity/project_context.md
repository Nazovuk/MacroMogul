# MacroMogul Continuity Guide (Handoff)

## Current Stable State
- **Game Loop**: FIXED. `App.tsx` now correctly initializes ECS world and transitions to `playing`.
- **UI**: TopBar restored with Market, Finance, and Stocks triggers. Glass UI styles are active.
- **Build**: Passing. (Lint errors in `MainMenu` and `App` related to `onLoadGame` were fixed surgically).

## Strategic Backlog (Critical Agent Tasks)
1. **ECS Market Simulation**: Real competitors need to react to player pricing.
2. **Financial Systems**: Implement the backend logic for interest-bearing loans and bond issuance in `financialSystem.ts`.
3. **Save/Load Integrity**: Verify all ECS components (especially `CityEconomicData`) are correctly serialized.

## Opencode Backlog (Tactical Tasks)
1. **UI Polish**: Enhance glassmorphism in `Dashboard.css` and `MainMenu.css`.
2. **Copywriting**: Expand i18n keys for scenario descriptions and event notifications.
3. **Styling**: Standardize button hover effects across all sub-panels.

## Next Steps for AI Agent
1. Read `handoff_state.md` artifact.
2. Continue with Phase 4 in `task.md`.
