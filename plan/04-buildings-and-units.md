# 04 — Buildings & Internal Units

This document specifies every building type, its internal 3×3 unit grid, functional units, placement rules, and costs.

---

## 1. Building Categories

| Category | Building Types |
|----------|---------------|
| **Production** | Factory (S/M/L), Farm, Mine, Oil Well, Logging Camp |
| **Retail** | Department Store, Specialty Store, Convenience Store |
| **Logistics** | Warehouse |
| **Real Estate** | Apartment Building, Commercial Building |
| **Corporate** | Headquarters, R&D Center |
| **Media** | TV Station, Radio Station, Newspaper |
| **Service** *(DLC)* | Shopping Mall, Fast-Food Restaurant, Coffee Shop |
| **Finance** *(DLC)* | Bank, Insurance Company |
| **City** *(DLC)* | Government Building, School, Hospital, Fire Station, Police Station |

---

## 2. Building Data Schema

```json
{
  "id": "apartment_luxury",
  "name": "Luxury Apartment",
  "category": "real_estate",
  "size": { "tiles": 3, "gridSlots": 1 },
  "constructionCost": 5000000,
  "monthlyUpkeep": 50000,
  "sprite": "isometric_city_apartment_base.png",
  "interactive": true
}
```

---

## 3. Asset & Visual Governance

To ensure premium quality without copyright issues:
- **AI-Generated Sprites:** All isometric assets (buildings, units) are generated using high-fidelity 4K prompts to ensure 100% ownership and unique aesthetic.
- **Visual Consistency:** Buildings follow a 2:1 isometric ratio (30-degree tilt) with consistent lighting from the top-right.

---

---

## 3. Building Specifications

### 3.1 Factories

| Property | Small | Medium | Large |
|----------|-------|--------|-------|
| Tiles | 2×2 | 3×3 | 4×4 |
| Grid Slots | 4 (2×2) | 9 (3×3) | 16 (4×4) |
| Construction Cost | $750,000 | $1,500,000 | $2,500,000 |
| Monthly Upkeep | $75,000 | $150,000 | $250,000 |
| Build Time | 30 ticks | 60 ticks | 90 ticks |

**Allowed units:** Purchasing, Manufacturing, Sales, Inventory, Advertising

### 3.2 Farms

| Property | Value |
|----------|-------|
| Tiles | 4×4 |
| Grid Slots | 9 (3×3) |
| Construction Cost | $500,000 |
| Monthly Upkeep | $50,000 |
| Required | Adjacent to fertile land (crop) or pasture (livestock) |

**Allowed units:** Crop Growing / Livestock Raising, Processing, Sales, Inventory

**Special mechanics:**
- Crops have **sowing seasons** and **harvest seasons** (configurable per crop)
- Livestock has a **maturity timer** before producing output
- Yield depends on land fertility rating (0.5–1.5 multiplier)

### 3.3 Mines & Wells

| Property | Mine | Oil Well | Logging Camp |
|----------|------|----------|-------------|
| Tiles | 3×3 | 2×2 | 3×3 |
| Grid Slots | 4 | 4 | 4 |
| Construction Cost | $1,000,000 | $2,000,000 | $400,000 |
| Monthly Upkeep | $100,000 | $200,000 | $40,000 |

**Special mechanics:**
- Resources have a **deposit amount** that depletes over time
- New deposits appear randomly as old ones exhaust
- Extraction rate = base_rate × technology_modifier
- Logging camps are renewable (forest regrows)

### 3.4 Retail Stores

| Property | Department Store | Specialty Store | Convenience Store |
|----------|-----------------|-----------------|-------------------|
| Tiles | 3×3 | 2×2 | 1×1 |
| Grid Slots | 9 (3×3) | 4 (2×2) | 1 |
| Construction Cost | $1,000,000 | $400,000 | $150,000 |
| Monthly Upkeep | $100,000 | $40,000 | $15,000 |
| Product Types | Any | 1 category | Any (limited) |
| Max Floors (DLC) | 3 | 2 | 1 |

**Allowed units:** Purchasing, Sales, Advertising

**Location matters:**
- `customer_traffic = city.population_density[tile] * accessibility_factor`
- Stores in high-traffic areas sell more
- Building near competitors splits traffic

### 3.5 Warehouses

| Property | Value |
|----------|-------|
| Tiles | 3×3 |
| Grid Slots | 9 (3×3) |
| Construction Cost | $800,000 |
| Monthly Upkeep | $80,000 |

**Allowed units:** Warehouse Input, Warehouse Storage, Warehouse Output
- Higher capacity than factory inventory units (3× throughput)
- Acts as a buffer to smooth supply chain fluctuations
- Can wholesale to other companies (B2B sales)

### 3.6 Real Estate (Interactive Hubs)

Apartments and Commercial buildings in **MacroMogul** are not passive income sources; they are active management hubs.

| Property | Apartment Building | Commercial Building |
|----------|--------------------|---------------------|
| Tiles | 3×3 | 3×3 |
| Floors | 1–50 (Upgradable) | 1–25 (Upgradable) |
| Construction Cost | $2,000,000 + $500,000/floor | $3,000,000 + $800,000/floor |
| Monthly Income | rent × occupancy | rent × occupancy |

**Deep Interaction (Interactive State):**
Clicking a Real Estate building opens a **Management Dashboard** with the following active controls:

1. **Occupancy & Population:** Real-time counter of residents/tenants.
2. **Dynamic Pricing:** Slider to adjust rent. High rent increases profit but risks vacancy and lowers "Tenant Happiness".
3. **Upgrades & Development:**
   - **Lobby Refurbishment:** Boosts attractiveness by +10%.
   - **Smart HVAC:** Reduces monthly maintenance costs.
   - **Rooftop Garden:** Increases luxury rating (allows higher rent).
4. **Maintenance & Dues:**
   - **Auto-Repair:** Set an automatic budget for building maintenance (0-100% scale).
   - **Management Fee:** Hire a "Building Manager" AI to auto-adjust rent based on city demand.
5. **Sales Policy:**
   - **Rental Mode:** Monthly recurring income.
   - **Condo Mode:** Immediate cash-out by selling individual units (reduces long-term income).

**Rental demand factors:**
- Quality of life in the city (Security, Pollution, Amenities).
- **Amenities Rating:** Distance to nearest Shopping Center/Hospital.
- **Proximity Bonus:** Buildings next to Parks or high-tier Retail gain +20% demand.

### 3.7 Headquarters

| Property | Value |
|----------|-------|
| Tiles | 2×2 |
| Construction Cost | $3,000,000 |
| Monthly Upkeep | $300,000 |

**Purpose:** Required to hire executive staff (CEO, COO, CTO, CMO). Executives provide company-wide bonuses:
- CEO: Overall operational efficiency +5–15%
- COO: Manufacturing throughput +10%
- CTO: R&D effectiveness +15%
- CMO: Brand building speed +20%

### 3.8 R&D Center

| Property | Value |
|----------|-------|
| Tiles | 2×2 |
| Grid Slots | 4 |
| Construction Cost | $2,000,000 |
| Monthly Upkeep | $200,000 |

**Allowed units:** Research Lab (select product to research)
- Each lab slot researches one product type
- R&D points generated per tick = spending × effectiveness × tech_specialist_bonus

### 3.9 Media Buildings

| Type | Cost | Upkeep | Revenue Model |
|------|------|--------|--------------|
| TV Station | $5,000,000 | $500,000 | Ad revenue + own-product promotion |
| Radio Station | $2,000,000 | $200,000 | Ad revenue + own-product promotion |
| Newspaper | $1,500,000 | $150,000 | Ad revenue + subscription |

**Media mechanics:**
- Reach = city.population × coverage_percentage
- Ad revenue = reach × ad_rate_per_viewer
- Self-promotion: boosts brand rating for selected products by promoting them through owned media

### 3.10 Banking & Insurance (DLC)

| Type | Tiles | Cost | Upkeep | Mechanics |
|------|-------|------|--------|-----------|
| Bank | 3×3 | $10,000,000 | $1,000,000 | Accepts deposits, issues loans to AI/NPCs |
| Insurance HQ | 3×3 | $8,000,000 | $800,000 | Core for policy management (Life/Auto/Home) |
| Front Office | 1×1 | $500,000 | $50,000 | Local city branch to sell insurance policies |

**Allowed units:** Bank Vault, Loan Processing, Insurance Underwriting, Customer Service.

### 3.11 Service Industry (DLC)

| Type | Tiles | Cost | Upkeep | Revenue Model |
|------|-------|------|--------|--------------|
| Shopping Mall | 4×4 | $20,000,000 | $2,000,000 | Rental income from floor slots + foot traffic bonus |
| Fast-Food | 1×1 | $300,000 | $30,000 | High-volume, low-margin food retail |
| Coffee Shop | 1×1 | $200,000 | $25,000 | High brand sensitivity, relies on traffic |

**Special mechanics:**
- **Malls** contain internal 4×4 slots where "Mini-stores" can be placed by the player or rented to AI.
- Foot traffic is the primary driver for service profitability.

### 3.12 City Resources (DLC)

*These are usually built by the city (Mayor) but can be private in certain scenarios.*

| Type | Tiles | Cost | Upkeep | City Effect |
|------|-------|------|--------|-------------|
| Hospital | 3×3 | $15,000,000 | $1,500,000 | Boosts QoL, reduces mortality |
| School | 2×2 | $5,000,000 | $400,000 | Increases labor skill/tech growth |
| Police Station | 2×2 | $3,000,000 | $300,000 | Reduces crime, stabilizes property values |
| Fire Station | 2×2 | $2,000,000 | $200,000 | Reduces risk of "Fire" disasters |

### 3.13 Software & Digital (DLC)

| Type | Tiles | Cost | Upkeep | Input | Output |
|------|-------|------|--------|-------|--------|
| Software Co. | 2×2 | $4,000,000 | $400,000 | Man-hours (Wages) | Digital License |
| Data Center | 3×3 | $12,000,000 | $1,200,000 | Electricity | Cloud Services |

---

## 4. Internal Unit Types

Each unit occupies one slot in the building's grid:

| Unit Type | Used In | Function |
|-----------|---------|----------|
| **Purchasing** | Factory, Store | Imports goods from supplier (own or external) |
| **Manufacturing** | Factory | Transforms inputs → outputs using a recipe |
| **Sales** | Factory, Store | Outputs goods for sale (to other buildings or consumers) |
| **Inventory** | Factory | Buffers goods between production stages |
| **Advertising** | Factory, Store | Increases brand rating for the product passing through |
| **Crop Growing** | Farm | Produces raw crop based on season |
| **Livestock Raising** | Farm | Produces animal products after maturity |
| **Processing** | Farm | Converts raw animal products to semi-products |
| **Extraction** | Mine, Well | Extracts resource from deposit |
| **Research Lab** | R&D Center | Generates R&D points for selected product |
| **Warehouse Input** | Warehouse | Receives goods from suppliers (high capacity) |
| **Warehouse Storage** | Warehouse | Stores goods with large buffer (3× factory inventory) |
| **Warehouse Output** | Warehouse | Distributes goods to buyers (high throughput) |

---

## 5. Unit Grid & Linking

### Grid Layout

Each building's interior is a grid. Example for a 3×3 factory:

```
┌─────────┬─────────┬─────────┐
│ Purchase │ Mfg     │ Sales   │
├─────────┼─────────┼─────────┤
│ Purchase │ Mfg     │ Sales   │
├─────────┼─────────┼─────────┤
│ Advert  │ Inventory│ Sales   │
└─────────┴─────────┴─────────┘
```

### Linking Rules

```
valid_links = {
  purchasing  → [manufacturing, inventory, sales],
  manufacturing → [sales, inventory, advertising],
  inventory   → [manufacturing, sales, purchasing],
  sales       → [],          // terminal node
  advertising → [],          // modifier node (boosts items passing through adjacent sales)
  crop_growing → [processing, sales],
  livestock   → [processing, sales],
  processing  → [sales, inventory]
}
```

- Links must be between **adjacent** slots (horizontally or vertically, not diagonal)
- A unit can output to multiple adjacent units (fan-out)
- A unit can receive from multiple adjacent units (fan-in)
- The **Advertising** unit boosts the brand rating of products in all adjacent **Sales** units

### Layout Plan Library

Players can save and load unit grid configurations as **Layout Plans**:

```json
{
  "name": "Standard 3-Product Factory",
  "gridSize": 3,
  "slots": [
    "purchasing", "manufacturing", "sales",
    "purchasing", "manufacturing", "sales",
    "purchasing", "manufacturing", "sales"
  ],
  "links": [
    [0,1], [1,2],
    [3,4], [4,5],
    [6,7], [7,8]
  ]
}
```

---

## 6. Building Placement Rules

```
canPlaceBuilding(building, tile):
  1. All tiles in the building's footprint must be:
     - Owned by the player (or purchasable)
     - Not occupied by another building
     - Compatible terrain (farms need fertile land, mines need resource deposits)
  
  2. Check city zoning:
     - Industrial zone: factories, mines, farms, warehouses
     - Commercial zone: stores, offices, media
     - Residential zone: apartments
     - Mixed zone: any
  
  3. Land cost = base_land_price[city][tile] * building.footprint_size
  
  4. Construction begins → building.state = "under_construction"
     After constructionTicks → building.state = "operational"
```

---

## 7. Acceptance Criteria

- [ ] All 15+ building types are constructible with correct costs
- [ ] 3×3 (and 2×2, 4×4) internal unit grids are functional
- [ ] Units can be placed, linked, and unlinked within the grid
- [ ] Supply chains flow goods from production → manufacturing → retail
- [ ] Farms respect growing seasons; mines deplete resources
- [ ] Media buildings generate ad revenue and boost own-product brands
- [ ] Warehouses buffer supply chains with higher capacity
- [ ] Layout Plan Library allows saving/loading grid configurations
- [ ] All building data is JSON-configurable
