# 08 — Scenarios & Victory Conditions

This document outlines the campaign and custom game setup, objective tracking, and player progression.

---

## 1. Scenario Structure

A scenario is a JSON file that overrides starting conditions and defines "Objective Blocks."

```json
{
  "id": "tech_startup_dream",
  "title": "The Silicon Dream",
  "description": "Start with a small loan and dominate the Smartphone industry.",
  "startingConditions": {
    "cash": 2000000,
    "techLevels": { "smartphone": 10 },
    "cities": ["San Francisco"],
    "lockedProducts": ["tobacco", "car"]
  },
  "objectives": [
    {
      "type": "market_dominance",
      "target": "smartphone",
      "threshold": 0.5,
      "deadlineTicks": 3600
    },
    {
      "type": "personal_wealth",
      "threshold": 10000000
    }
  ]
}
```

---

## 2. Objective Types

The engine monitors these metrics every tick for victory/failure:

| Objective Type | Description |
|----------------|-------------|
| **Market Dominance** | Achieve X% market share in product class Y. |
| **Market Capitalization** | Reach total company value of $X. |
| **Personal Wealth** | Player's personal cash + value of shares reaches $X. |
| **Annual Profit** | Sustain $X profit for 12 consecutive months. |
| **Philanthropy** | Reach X% city satisfaction or donate $Y to city projects. |
| **Survival** | Do not go bankrupt for X years. |

---

## 3. Custom Game Setup

For sandbox play, the player configures "Game Constants":

- **Competitors:** Number of AI players (1 to 65).
- **Starting Capital:** Player and AI budget.
- **Economic Volatility:** 0% (Stable) to 100% (Chaotic).
- **Tech Level:** Start in "Stone Age" or "Modern Age."
- **City Count:** 1 to 7 interactive cities.

---

## 4. Score Calculation

At the end of a scenario (or on game over), a rank is calculated:

```
Score = (Profit_Growth * 10) + (Market_Share_Avg * 50) + (Tech_Lead * 20) - (Years_Elapsed * 5)
```

**Ranks:**
- E: Bottom Feeder
- D: Entrepreneur
- C: CEO
- B: Industrialist
- A: Magnate
- S: Capitalism Legend

---

## 5. Persistence (Career Mode)

Unlocked scenarios and high scores are saved to `globalProfile.json`.

- Completing "Tutorial" unlocks "Apparel Venture".
- Reaching "Magnate" in "Apparel" unlocks "Electronics Era".

---

## 6. Acceptance Criteria

- [ ] Objectives are correctly tracked and HUD displays "Task Progress."
- [ ] Scenario files successfully override engine defaults (cash, tech).
- [ ] Victory screen triggers immediately upon meeting objective conditions.
- [ ] Game over triggers if Bankruptcy is reached or Time Limit expires.
- [ ] Rank system provides meaningful feedback based on multi-factor scoring.
