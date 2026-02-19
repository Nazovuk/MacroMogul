# 03 — Products & Supply Chains

This document defines every product category, raw material, manufacturing recipe, and the supply-chain linking logic.

---

## 1. Resource Types

Resources are extracted from natural sites (mines, wells, forests, farms).

### Mining & Extraction

| Resource | Source Type | Base Cost/unit | Depletion? |
|----------|-----------|---------------|------------|
| Coal | Mine | $8 | Yes |
| Copper | Mine | $15 | Yes |
| Iron Ore | Mine | $12 | Yes |
| Silicon (Silica) | Mine | $20 | Yes |
| Aluminum | Mine | $18 | Yes |
| Gold | Mine | $800 | Yes |
| Silver | Mine | $120 | Yes |
| Chemical Minerals | Mine | $25 | Yes |
| Oil | Oil Well | $30 | Yes |
| Logs | Forest | $10 | Renewable |

### Farming — Crops

| Crop | Growing Season | Harvest Ticks | Base Yield/unit |
|------|---------------|--------------|-----------------|
| Wheat | Spring–Summer | 90 | 100 |
| Corn | Spring–Fall | 120 | 110 |
| Cotton | Summer | 100 | 80 |
| Flax | Spring | 80 | 70 |
| Tobacco | Summer | 110 | 60 |
| Sugar Cane | Year-round (tropical) | 150 | 130 |
| Cocoa | Year-round (tropical) | 180 | 50 |
| Grapes | Summer–Fall | 100 | 90 |
| Coconut | Year-round (tropical) | 200 | 40 |
| Lemon | Year-round (subtropical) | 120 | 60 |
| Rubber Plant | Year-round (tropical) | 200 | 30 |
| Strawberries | Spring–Summer | 60 | 70 |

### Farming — Livestock

| Animal | Maturity Ticks | Products |
|--------|---------------|----------|
| Cattle | 180 | Beef, Leather, Milk |
| Chicken | 60 | Chicken meat, Eggs |
| Pig | 120 | Pork |
| Sheep | 150 | Lamb, Wool |

---

## 2. Semi-Finished (Intermediate) Products

These are manufactured from raw resources and used as inputs for finished goods:

| Semi-Product | Inputs | Manufacturing Ticks |
|-------------|--------|-------------------|
| Steel | Iron Ore × 2 | 5 |
| Glass | Silica × 1 | 3 |
| Plastic | Oil × 1, Chemical Minerals × 1 | 4 |
| Rubber (processed) | Rubber Plant × 2 | 3 |
| Leather (processed) | Cattle Leather × 1 | 3 |
| Linen | Flax × 2 | 3 |
| Polyester | Oil × 1 | 4 |
| Paper | Logs × 2 | 3 |
| Flour | Wheat × 2 | 2 |
| Corn Syrup | Corn × 3 | 3 |
| Electronic Components | Silicon × 1, Copper × 1 | 6 |
| CPU | Silicon × 2, Gold × 0.1 | 8 |
| Car Body | Steel × 3, Aluminum × 1 | 10 |
| Citric Acid | Lemon × 3 | 2 |
| Grape Juice | Grapes × 3 | 2 |
| Frozen Beef | Cattle Beef × 1 | 2 |
| Frozen Chicken | Chicken Meat × 1 | 2 |
| Frozen Pork | Pork × 1 | 2 |
| Frozen Lamb | Lamb × 1 | 2 |
| Bottled Milk | Milk × 2 | 2 |

---

## 3. Finished (Consumer) Products

### Food & Beverages

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Cereal Bars | Flour × 1, Corn Syrup × 1 | Freshness, Brand | 0.15 |
| Cookies | Flour × 1, Sugar × 1 | Taste, Brand | 0.12 |
| Chocolate Bars | Cocoa × 1, Sugar × 1 | Cocoa quality, Brand | 0.18 |
| Cake | Flour × 1, Sugar × 1, Eggs × 1 | Freshness, Brand | 0.08 |
| Canned Soup | Frozen Beef × 1, Corn × 1 | Ingredients, Brand | 0.10 |
| Canned Corn | Corn × 1 | Freshness | 0.06 |
| Cola | Corn Syrup × 1, Citric Acid × 1 | Formula, Brand | 0.25 |
| Chewing Gum | Rubber × 0.5, Sugar × 0.5 | Flavor, Brand | 0.10 |

### Electronics

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Desktop Computer | CPU × 1, Electronic Components × 2, Steel × 1 | Performance, Brand | 0.08 |
| Notebook Computer | CPU × 1, Electronic Components × 2, Plastic × 1 | Performance, Weight, Brand | 0.12 |
| Smartphone | CPU × 1, Electronic Components × 1, Glass × 1 | Performance, Camera, Brand | 0.30 |
| Television | Electronic Components × 2, Glass × 1, Plastic × 1 | Screen size, Brand | 0.10 |
| Camera | Electronic Components × 1, Glass × 1, Plastic × 1 | Resolution, Brand | 0.04 |
| Hi-Fi System | Electronic Components × 2, Plastic × 1 | Sound quality, Brand | 0.03 |
| Printer | Electronic Components × 1, Plastic × 1 | Speed, Brand | 0.05 |

### Apparel & Leather Goods

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Leather Jacket | Leather × 2 | Material, Craftsmanship, Brand | 0.04 |
| Leather Bag | Leather × 1 | Material, Design, Brand | 0.06 |
| Leather Wallet | Leather × 0.5 | Material, Brand | 0.08 |
| Blazer | Polyester × 1, Linen × 1 | Fabric, Fit, Brand | 0.05 |
| Backpack | Polyester × 1, Plastic × 0.5 | Durability, Brand | 0.07 |

### Health & Beauty

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Perfume | Chemical Minerals × 1, Citric Acid × 0.5 | Fragrance, Brand | 0.06 |
| Body Lotion | Chemical Minerals × 1, Coconut × 1 | Ingredients, Brand | 0.10 |
| Cold Pills | Chemical Minerals × 2 | Effectiveness, Brand | 0.08 |
| Cough Syrup | Chemical Minerals × 1, Sugar × 0.5 | Effectiveness, Brand | 0.06 |
| Lipstick | Chemical Minerals × 1 | Color, Brand | 0.05 |

### Automotive

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Car | Car Body × 1, Electronic Components × 2, Rubber × 4, Glass × 2 | Safety, Performance, Brand | 0.02 |

### Household & Other

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Bed | Logs × 2, Cotton × 1 | Comfort, Brand | 0.03 |
| Chair | Logs × 1, Polyester × 0.5 | Comfort, Design, Brand | 0.04 |
| Detergent | Chemical Minerals × 2 | Cleaning power, Brand | 0.15 |
| Tissues | Paper × 1 | Softness, Brand | 0.20 |
| Cigarettes | Tobacco × 2, Paper × 0.5 | Blend, Brand | 0.08 |
| Gold Ring | Gold × 0.5 | Purity, Design, Brand | 0.01 |
| Golf Clubs | Steel × 1, Rubber × 0.5 | Material, Brand | 0.01 |

### Service & Digital Products (DLC)

| Product | Inputs | Quality Factors | Penetration Rate |
|---------|--------|----------------|-----------------|
| Quick Meal | Meat × 1, Flour × 1, Veggie × 1 | Freshness, Price, Brand | 0.35 |
| Premium Coffee | Cocoa × 0.2, Milk × 0.1 | Flavor, Brand | 0.25 |
| Software (OS) | Man-hours (Wages) | Stability, Features, Brand | 0.15 |
| Cloud Storage | Electricity, Steel × 0.1 | Speed, Brand | 0.10 |
| Insurance Policy | Underwriting, Brand | Service Quality, Price | 0.40 |
| Bank Loan | Capital, Interest Spread | Rate, Processing Speed | 0.30 |

**Special mechanics:**
- **Digital products** have 0 transport cost and 100% shelf life.
- **Services** are consumed instantly (no inventory accumulation at the retail unit).
- **Insurance/Loans** are "virtual products" generated by Bank/Insurance units.

---

## 4. Recipe Data Schema

All recipes are stored in `recipes.json`:

```json
{
  "id": "smartphone",
  "name": "Smartphone",
  "category": "electronics",
  "inputs": [
    { "itemId": "cpu", "quantity": 1 },
    { "itemId": "electronic_components", "quantity": 1 },
    { "itemId": "glass", "quantity": 1 }
  ],
  "manufacturingTicks": 8,
  "baseQuality": 50,
  "qualityFactors": ["performance", "camera", "brand"],
  "penetrationRate": 0.30,
  "priceElasticity": 1.5,
  "referencePrice": 600,
  "techLevel": 3,
  "obsolescenceRate": 0.02
}
```

---

## 5. Supply-Chain Linking

Units inside buildings are linked to form supply chains:

```
   [Farm/Mine]          [Factory A]             [Factory B]            [Retail Store]
   ┌─────────┐         ┌───────────────┐       ┌───────────────┐      ┌──────────────┐
   │ Resource │──sale──▶│ Purchase Unit │       │ Purchase Unit │◀─────│ Purchase Unit│
   │ Output   │         │     ↓         │       │     ↓         │      │     ↓        │
   └─────────┘         │ Mfg Unit      │──────▶│ Mfg Unit      │──────│ Sales Unit   │
                        │     ↓         │ semi  │     ↓         │ done │     ↓        │
                        │ Sales Unit    │product│ Sales Unit    │      │ Ad Unit      │
                        └───────────────┘       └───────────────┘      └──────────────┘
```

### Link Resolution Algorithm

```
Each tick:
  for each building with a UnitGrid:
    for each link (source_unit → dest_unit):
      available = source_unit.outputBuffer
      needed    = dest_unit.inputCapacity - dest_unit.inputBuffer
      transfer  = min(available, needed)
      
      if source and dest are in DIFFERENT buildings:
        apply freight_cost = base_freight * distance(src_building, dest_building)
        transfer_cost = transfer * freight_cost
      
      source_unit.outputBuffer -= transfer
      dest_unit.inputBuffer += transfer
```

### Freight Costs

```
freight_cost_per_unit = 0.5 + 0.1 * distance_tiles
// Clustering factories near farms/mines reduces costs
// Warehouses act as intermediate buffers with larger capacity
```

---

## 6. R&D and Product Quality

```
Each R&D tick (monthly):
  for each product being researched:
    rd_points = rd_spending * rd_effectiveness * specialist_bonus
    product.techProgress += rd_points
    
    if product.techProgress >= next_quality_threshold:
      product.quality += quality_increment
      // quality directly affects demand via quality_factor
    
    // Technology disruption:
    if global_tech_level advances past product.techLevel:
      product.obsolescenceRate *= 1.5
      product.demand_modifier *= 0.8
```

### Radical R&D (Subsidiary DLC feature)

```
radical_rd(product):
  success_chance = 0.3  // 30% chance
  roll = random()
  if roll < success_chance:
    product.quality += large_quality_boost (3× normal)
    product.techLevel += 1
  else:
    rd_spending_wasted = true  // no benefit this cycle
```

---

## 7. Acceptance Criteria

- [ ] All 50+ products manufacturable via recipe chains
- [ ] Supply chains link across buildings with freight costs
- [ ] R&D improves product quality over time
- [ ] Tech disruption makes old products obsolete
- [ ] Product catalog is fully data-driven (JSON)
- [ ] Adding a new product requires only a JSON entry + sprite
