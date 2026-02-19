# 09 — DLC Modules

This document describes the modular expansion system and the mechanics for each major functional addon, updated with detailed sub-mechanics from the latest Capitalism Lab expansions.

---

## 1. Modular Architecture

DLCs are treated as **Feature Flags** in the engine. Enabling a DLC unlocks specific building types, unit types, and AI behaviors.

```typescript
if (world.dlcEnabled("Banking")) {
  systems.add(bankingSystem);
  ui.unlock(BankInterface);
}
```

---

## 2. Subsidiary DLC

*Conglomerate management and corporate restructuring.*

- **Initial Public Offerings (IPO):** Player can take a 100%-owned subsidiary public.
- **Spin-offs:** Transfer specific assets/buildings into a new entity and list it on the exchange.
- **AI Executive Delegation:**
  - **CEO:** Strategic expansion and capital allocation.
  - **COO:** Internal unit optimization and pricing.
  - **CMO:** Marketing budget and brand strategy.
- **Mass Transfer:** Tool to move multiple firms between parent and subsidiaries in bulk.
- **Internal Market:** Subsidiaries can be forced to buy/sell to each other at cost or market price.

---

## 3. City Economic Simulation DLC

*Urban management and political strategy.*

- **Mayorship & Politics:**
  - Form/Join political parties.
  - Campaigning: Spend funds to increase city-wide approval.
  - Elections: Win votes based on city quality of life (QoL) and economic performance.
- **Public Policy:** 
  - Adjust Corporate, Income, and Sales taxes at the city level.
  - Zoning laws: Restrict or encourage specific industries.
- **City Facilities:** Build and manage Schools, Hospitals, Police Stations, and Fire Stations using the city budget.
- **Infrastructure:** Upgrade roads and public transport to boost "Traffic" for retail stores.

---

## 4. Banking & Finance DLC

*The sophisticated financial engine.*

- **Banking Mechanics:**
  - **Deposits:** Attract NPC cash by setting competitive savings rates.
  - **Lending:** Manage loan books for AI companies and other players.
  - **Federal Reserve:** Borrow from the central bank when liquidity is low.
- **Insurance Mechanics:**
  - **Policies:** Offer Life, Home, and Car insurance.
  - **Underwriting:** Set premiums based on city-wide risk factors.
  - **Service Quality:** Driven by staff training and "Customer Waiting Time" metrics.
  - **Investment Float:** Reinvest insurance premiums into the stock market before claims occur.
- **Advanced Stock Market:** Adds Short Selling, Options, and Leveraged Buyouts (LBO).

---

## 5. Service Industry DLC

*High-frequency retail and logistics.*

- **Shopping Mall Management:**
  - Build "Mega-Malls" where tiles are rented as slots.
  - **Tenant Management:** Rent to NPC retailers or open your own stores in the slots.
  - **Foot Traffic heatmaps:** Mall success depends on "Anchor Stores" and location.
- **Hospitality:** Fast-food chains and Coffee shops with high brand sensitivity and location-dependency.
- **Logistics:** Specialized Warehouse units for Import/Export businesses.

---

## 6. Digital Age & E-Commerce

*Technology and the virtual economy.*

- **Software Development:** Uses "Man-hours" and "Tech level" instead of physical inputs.
- **Internet Services:** E-commerce sites, Search Engines, and Social Media platforms.
- **Cybersecurity:** Hire "White-hats" to defend against AI hacks that steal cash or tech.

---

## 7. Implementation Strategy

1. **Phase DL-1:** Subsidiary logic (IPO/Delegation).
2. **Phase DL-2:** Service industry & Malls.
3. **Phase DL-3:** Banking & Insurance (Math-heavy).
4. **Phase DL-4:** City Politics & Resources.

---

## 8. Acceptance Criteria

- [ ] Subsidiaries can be taken public via IPO.
- [ ] Insurance premiums are calculated based on risk and service quality.
- [ ] Shopping malls allow renting slots to third-party AI companies.
- [ ] Mayor mechanics affect city-wide tax rates and QoL.
- [ ] Digital products (Software) have 0 material cost but high "Wage Stacks".
- [ ] Banking reserve ratios are enforced by the engine.
