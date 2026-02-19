# 02 — Economic Simulation

This document specifies the macroeconomic layer that drives prices, demand, wages, and the overall business environment across all cities in the game.

---

## 1. Game Clock

| Property | Value |
|----------|-------|
| Base tick | 1 tick = 1 in-game day |
| Month | 30 ticks |
| Year | 360 ticks |
| Speed multipliers | ×1, ×2, ×5, ×10, Pause |

All economic recalculations happen at the **monthly** boundary (every 30 ticks). Production and sales settle daily.

---

## 2. City-Level Economy

Each city is an independent economic zone with these parameters:

```json
{
  "cityId": 1,
  "name": "New York",
  "population": 8500000,
  "gdp": 450000000000,
  "gdpGrowthRate": 0.02,
  "unemploymentRate": 0.05,
  "inflationRate": 0.02,
  "avgWageRate": 4500,
  "consumerConfidence": 0.7,
  "qualityOfLife": 0.65,
  "housingSupply": 2100000,
  "housingDemand": 2300000,
  "pollutionLevel": 0.3,
  "taxRate": 0.25,
  "interestRate": 0.04
}
```

### Monthly Update Algorithm

```
for each city:
  1. GDP_new = GDP * (1 + gdpGrowthRate + random_shock(-0.005, 0.005))
  2. unemployment = max(0.01, unemployment + Δ_from_job_creation - Δ_from_layoffs)
  3. consumerConfidence = f(gdpGrowthRate, unemployment, inflation)
                        = 0.5 + 0.3*(gdpGrowthRate/0.05) - 0.2*(unemployment/0.1) - 0.15*(inflation/0.05)
                        clamp to [0.1, 1.0]
  4. inflation = centralBank.targetInflation + demand_pull + cost_push + monetary_effect
     where:
       demand_pull  = 0.01 * (aggregate_demand / aggregate_supply - 1)
       cost_push    = 0.005 * (wage_growth + commodity_price_growth)
       monetary_effect = 0.008 * (money_supply_growth - 0.02)
  5. avgWageRate *= (1 + inflation + 0.002 * (1 - unemployment/0.05))
  6. population += immigration(qualityOfLife, unemployment) + natural_growth(0.001)
  7. qualityOfLife = weighted_avg(
       housing_adequacy   * 0.25,
       employment_rate    * 0.20,
       pollution_inverse  * 0.15,
       public_services    * 0.15,
       avg_income         * 0.15,
       entertainment      * 0.10
     )
```

---

## 3. Central Bank

The central bank is a global entity (shared across all cities).

```json
{
  "targetInflation": 0.02,
  "interestRate": 0.04,
  "moneySupplyGrowth": 0.03,
  "policy": "neutral"  // "loose" | "neutral" | "tight"
}
```

### Policy Rules

```
every quarter (90 ticks):
  avg_inflation = mean(city.inflationRate for all cities)
  
  if avg_inflation > targetInflation + 0.01:
    policy = "tight"
    interestRate += 0.0025
    moneySupplyGrowth -= 0.005
  elif avg_inflation < targetInflation - 0.01:
    policy = "loose"
    interestRate -= 0.0025
    moneySupplyGrowth += 0.005
  else:
    policy = "neutral"
  
  interestRate = clamp(interestRate, 0.001, 0.15)
```

### Effects of Policy

| Policy | Stock Market | Real Estate | Loan Cost | Consumer Spending |
|--------|-------------|-------------|-----------|-------------------|
| Loose | Bubble risk (+15 % volatility) | Prices ↑ 5–10 % | Cheaper | ↑ 3–5 % |
| Neutral | Normal | Stable | Market rate | Baseline |
| Tight | Bear pressure (-10 % avg) | Prices ↓ 3–7 % | Expensive | ↓ 2–4 % |

---

## 4. Consumer Demand Model

Demand for each product in a city is calculated monthly:

```
base_demand = city.population * product.penetrationRate * city.consumerConfidence

price_elasticity_factor = (reference_price / actual_price) ^ product.priceElasticity
  // priceElasticity typically 0.5 (necessities) to 2.0 (luxury)

quality_factor = (product.quality / market_avg_quality) ^ 0.6

brand_factor = 1 + 0.3 * (product.brandRating / 100)

final_demand = base_demand * price_elasticity_factor * quality_factor * brand_factor
```

### Demand Split Across Sellers

When multiple companies sell the same product in a city, demand is split proportionally:

```
seller_attractiveness[i] = (1/price[i]) * quality[i] * brand[i] * accessibility[i]
market_share[i] = seller_attractiveness[i] / sum(seller_attractiveness)
units_sold[i] = final_demand * market_share[i]
```

---

## 5. Inflation Effects

Inflation is not just a number — it concretely affects gameplay:

| Affected Value | How |
|----------------|-----|
| Raw material costs | All resource prices *= (1 + monthly_inflation) |
| Wages | All employee wages *= (1 + monthly_inflation * 0.8) |
| Building construction costs | *= (1 + monthly_inflation * 0.5) |
| Product reference prices | Shift the "normal" price band upward |
| Loan interest | Adjusts with central bank rate |
| Stock P/E multiples | Compressed during high inflation |

---

## 6. Economic Cycles

The simulation generates organic boom-bust cycles:

```
cycle_phase: "expansion" | "peak" | "contraction" | "trough"
cycle_duration: 60–120 months (randomised per cycle)
current_phase_progress: 0.0 → 1.0

Effects on gdpGrowthRate:
  expansion:   base + 0.01 * phase_progress
  peak:        base + 0.012 (diminishing to 0)
  contraction: base - 0.005 * phase_progress
  trough:      base - 0.008 (recovering to 0)
```

---

## 7. Random Economic Events

Events fire with configurable probability each month:

```json
[
  {
    "id": "commodity_boom",
    "probability": 0.03,
    "duration_months": 6,
    "effects": { "raw_material_prices": 1.3, "mining_profit": 1.5 }
  },
  {
    "id": "recession",
    "probability": 0.02,
    "duration_months": 12,
    "effects": { "consumer_confidence": -0.2, "gdp_growth": -0.03 }
  },
  {
    "id": "tech_breakthrough",
    "probability": 0.01,
    "duration_months": 24,
    "effects": { "rd_effectiveness": 1.5, "tech_product_demand": 1.4 }
  },
  {
    "id": "housing_bubble",
    "probability": 0.015,
    "duration_months": 18,
    "effects": { "real_estate_prices": 1.4, "construction_costs": 1.2 }
  }
]
```

---

## 8. Acceptance Criteria

- [ ] Inflation visibly changes product and wage costs over time
- [ ] Consumer demand responds to price, quality, and brand
- [ ] Central bank policy shifts interest rates and creates market effects
- [ ] Economic cycles produce organic booms and recessions
- [ ] City population grows or shrinks based on quality of life
- [ ] Random events trigger and resolve over their duration
- [ ] All parameters are data-driven (JSON config, no magic numbers)
