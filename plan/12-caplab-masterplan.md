# 12 — Global Empire & Digital Age Masterplan (CapLab Deep Research)

This document integrates the absolute depth of **Capitalism Lab** (and its DLCs: Digital Age, Banking, Subsidiary, Real Estate) into the **MacroMogul** core.

---

## 1. Advanced Scripting Engine (The World's Genome)

The script engine allows for near-infinite replayability by defining hundreds of variables before a game starts.

### 1.1 Environmental & Economic Scripts
- **Macro Volatility:** Inflation rate (min/max), initial city GDP multipliers, and "Economic Cyclicity" (length of peaks/troughs).
- **Tech Disruption:** Global tech level cap, innovation speed multiplier, and "Technology Obsolescence" speed.
- **Seaports:** Frequency of seaport imports and quality/brand level of imported global goods.

### 1.2 Resource & Mod Integration
- **Real World Mod Logic:** The engine supports mapping `products.json` to real-world brands and historical timelines.
- **Random Product Disablement:** Ability to lock certain industries (e.g., "No Electronics until 1995") via script.

---

## 2. Industry-Specific Deep Mechanics

### 2.1 Retail & Customer Dynamics
- **Traffic Sensitivity:** Plot success depends on a 0-100 traffic index. 
- **Product Class Expertise:** Selling a specific product class (e.g., Apparel) over time increases a "Retail Expertise" multiplier, boosting brand loyalty.

### 2.2 Warehouse & Logistics
- **The Buffer Logic:** Warehouses act as buffers. If a factory produces 1000 units but the store only sells 500, the warehouse stores the surplus to prevent factory shutdown during low-demand months.
- **Distribution Nodes:** A single Warehouse can supply up to 20 retail stores, centralizing supply chain management.

### 2.3 Media & Advertising
- **Content Influence:** Media ownership allows "Indirect Brand Boosting." If you own a TV station, your products gain brand rating 2x faster in that city.
- **Audience Reach:** Revenue is a function of city population vs. channel rating.

---

## 3. Human Capital & Expertise (The Intelligence Layer)

### 3.1 Management Staff (Executives)
- **COO (Chief Operating Officer):** Manages internal 3x3 units across all firms. High expertise reduces "Internal Friction" (efficiency loss).
- **CTO (Chief Technical Officer):** Essential for R&D centers. Boosts tech-point generation.
- **CMO (Chief Marketing Officer):** Manages pricing and advertising budgets automatically based on target market share.

### 3.2 Knowledge Points
- Earned through achieving corporate goals (e.g., "$100M Revenue").
- Spent on **Executive Training** to boost 0-100 Expertise stats (Manufacturing, Retailing, R&D, etc.).

---

## 4. Digital Age & Software Simulation

### 4.1 Software Development Cycle
- **Pre-Alpha → Gold:** Development of Operating Systems, Graphics Software, and Games.
- **Maintenance:** Post-release man-hours required to reduce "Bug Rate" and maintain market share.
- **Digital Licenses:** Selling unlimited copies with zero manufacturing cost (only distribution/server upkeep).

### 4.2 Cloud & Online Services
- **Data Centers:** Required to host online services (Gaming, E-Commerce, Social Media).
- **Subscription Models:** Recurring revenue based on active user counts vs. server capacity.

---

## 5. Real Estate & Banking (The Financial DLC)

### 5.1 Real Estate Empire
- **Speculation:** Buying land plots to prevent competitor expansion or betting on city growth.
- **Property Management:** Occupancy management (Residential vs. Commercial). High-quality amenities (parks nearby) increase max rent.

### 5.2 Banking & Insurance
- **Deposit/Loan Rates:** Managing the spread to generate profit.
- **Underwriting:** Assessing risk for insurance policies based on city "Crime/Fire" stats.

---

## 6. Implementation Checklist (Structural Updates)
- [ ] Implement `TechAge` component in the ECS for product obsolescence.
- [ ] Add `KnowledgePoints` to the global Player state.
- [ ] Create `WarehouseSystem` to handle multi-node distribution.
- [ ] Build the "Manufacturer's Guide" UI with integrated market supply/demand curves.
- [ ] Script Engine: Create a JSON parser for the CapLab-style configuration tags.
