# 05 — City Travel & World Map

This document outlines the implementation and functionality of the City Travel system and World Map navigation.

## 1. World Map System

The **World Map** is a global navigation interface allowing players to expand their corporate empire across multiple regions.

### 1.1 City List & Data
The game currently supports the following regions, each with distinct economic parameters:

| ID | Name | Region | Pop | GDP | Seed |
|----|------|--------|-----|-----|------|
| city_01 | New York | North America | 8.4M | $1.8T | 785438037 |
| city_02 | London | Europe | 8.9M | $1.2T | 334928123 |
| city_03 | Tokyo | Asia | 13.9M | $1.6T | 992837412 |
| city_04 | Shanghai | Asia | 26.3M | $1.1T | 44829103 |
| city_05 | Paris | Europe | 2.1M | $0.9T | 123987456 |
| city_06 | Sydney | Oceania | 5.3M | $0.4T | 567890123 |
| city_07 | Singapore | Asia | 5.6M | $0.5T | 890123456 |
| city_08 | Dubai | Middle East | 3.3M | $0.2T | 345678901 |

### 1.2 Travel Mechanics
- **Travel Time:** Simulates a 1.5s delay with a loading screen to represent travel and data initialization.
- **Cost:** Currently free (Phase 1), but future updates may implement travel costs or "Regional HQ" establishment fees.
- **State Persistence:** 
  - Each city has a unique **GameWorld** instance.
  - When traveling, the current world context is swapped.
  - **Procedural Generation:** Use of deterministic seeds ensures that `city_01` always generates the same terrain layout for accurate multi-session play.

## 2. Terrain Generation

### 2.1 Seed-Based Generation
- **Algorithm:** Perlin-like noise using `Math.sin` and `Math.cos` functions combined with the City Seed.
- **Consistency:** The same seed always produces the same terrain map.
- **Variety:** 
  - `seed % large_prime` ensures phase shifts in noise functions.
  - Generates distinct Water, Grass, Dirt, and Concrete patterns for each city.

### 2.2 Re-Initialization Fix
- Addressed a bug where the `RenderingSystem` would not re-initialize when switching worlds.
- **Solution:** Explicitly destroy and nullify `PIXI.Application` and `RenderingSystem` references in the `useIsometricRenderer` cleanup function, forcing a full re-mount and map generation upon city change.

## 3. UI Integration

### 3.1 Top Bar
- Displays the **Current City Name** (e.g., "NEW YORK", "LONDON") next to the Game Date.
- Updates dynamically upon arrival in a new city.

### 3.2 Loading Screen
- Displays immersive text like "Traveling to Region..." and "Establishing local headquarters..." during the transition.
- Hides the map and controls to prevent interaction during state swaps.

## 4. Future Roadmap (City System)
- [ ] **Regional Economy:** Specific demand/supply modifiers per city (e.g., Tokyo demands more 'Consumer Electronics', Paris demands 'Fashion').
- [ ] **Travel Cost:** Ticket price or private jet maintenance cost.
- [ ] **Local Competitors:** Distinct AI competitors in each region.
- [ ] **Freight:** Logistics cost for moving goods between cities.
