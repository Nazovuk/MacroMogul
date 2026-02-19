# 07 — UI & Rendering

This document details the visual experience, the isometric engine, and the complex data-oriented HUD.

---

## 1. Scene Layers

The game uses a tiered rendering approach for performance:

| Layer | Type | Content |
|-------|------|---------|
| **Layer 0: Background** | Texture | Static ground tiles (Grass, Dust, Pavement). |
| **Layer 1: Map Objects** | PixiJS Sprites | Buildings, roads, trees, vehicles. Sorted by Y-coordinate. |
| **Layer 2: FX/Particle** | Sprite Particles | Smoke from factories, dollar icons popping up. |
| **Layer 3: Heatmaps** | WebGL Overlay | Colored translucents for Traffic, Pollution, etc. |
| **Layer 4: HUD** | React / HTML | Menus, Top Bar, Mini-map, Popups. |

---

## 2. Isometric Coordinates

The map uses a **Diamond Isometric (2:1)** projection.

```typescript
// Transforming Screen to Map
function screenToMap(sx, sy) {
  const mx = (sx / TILE_WIDTH_HALF + sy / TILE_HEIGHT_HALF) / 2;
  const my = (sy / TILE_HEIGHT_HALF - sx / TILE_WIDTH_HALF) / 2;
  return { x: Math.floor(mx), y: Math.floor(my) };
}

// Transforming Map to Screen
function mapToScreen(mx, my) {
  const sx = (mx - my) * TILE_WIDTH_HALF;
  const sy = (mx + my) * TILE_HEIGHT_HALF;
  return { x: sx, y: sy };
}
```

---

## 3. Core UI Components

### 3.1 Top HUD Bar
- **Date/Time:** With speed controls (Pause, 1, 2, 5).
- **Cash Counter:** Flashes green/red on large gains/losses.
- **Stock Ticker:** Scrolling stock prices of top 5 companies.
- **Alert Center:** Notification bell for bankruptcies, tech breakthroughs, or shortages.

### 3.2 Main Toolbar (Bottom)
- **Build Menu:** Categorized by Farm, Factory, Store, etc.
- **Management Screens:** Corporate, Finance, R&D, Real Estate.
- **Map Overlays:** Toggle buttons for Traffic, Population, Range.
- **World Map:** Quick switch between Cities.

### 3.3 Firm Interior View (Deep Management)
This is a modal or slide-over panel.
- Shows the 9-slot grid (Variable sizes: 1x1, 2x2, 3x3, 4x4).
- Allows dragging units into slots.
- **The Linker:** Click a unit, then click its neighbor to draw a connecting line (Supply Path).
- **Unit Detail:** Clicking a unit shows its efficiency, throughput, and current stock.
- **Analysis View:** Toggle to overlay flow rates (units/day) on top of the links to find bottlenecks.

### 3.4 Manufacturer's Guide
A full-screen analytical tool for production planning.
- **Searchable List:** All products in the game.
- **Recipe Diagram:** Visual tree showing (Hammadde) → (Tedarik) → (Son Ürün).
- **Market Intel:** Displays global average price vs. current player production cost.
- **Profit Estimator:** Slider-based calculator to estimate monthly profit based on expected sales volume.

### 3.5 Management Staff (Expertise UI)
- **Executive Roster:** Grid of faces (AI-generated) of current hired executives.
- **Skill Meters:** 0-100 bars for Retailing, Manufacturing, R&D, etc.
- **Training Button:** Click to spend *Knowledge Points* to upgrade a specific executive skill.

---

## 4. Charts & Data Visualization

The game is "Spreadsheets with Sprites." We need a robust graphing library (e.g., **Recharts** or **Chart.js**):

- **Line Charts:** For Stock Price history and Revenue/Profit trends.
- **Bar Charts:** For Market Share comparisons in a city.
- **Pie Charts:** For Company Asset distribution.

---

## 5. Map Overlays (Heatmaps)

Rendered as a dynamic texture layer:

- **Traffic:** Red (High) to Green (Low).
- **Population:** Size-aware dots per residential building.
- **Pollution:** Purple clouds radiating from Industrial zones.
- **Logistics:** Blue lines showing current trade routes across the city.

---

## 6. Performance Optimization

- **Frustum Culling:** PixiJS only renders what matches the camera viewport.
- **Texture Packing:** All building sprites in one Large Atlas (2048x2048) to minimize draw calls.
- **Instanced Rendering:** For repetitive tiles (grass, roads).
- **Canvas Upscaling:** Option to render simulation at full resolution but UI at 1x to save GPU.

---

## 7. Acceptance Criteria

- [ ] Smooth 60fps panning and zooming (mouse wheel/drag).
- [ ] Correct Z-sorting (back buildings don't overlap front ones).
- [ ] HUD displays real-time cash/state from the ECS world.
- [ ] 3x3 grid drag-and-drop works flawlessly.
- [ ] Charts update dynamically as the simulation ticks.
- [ ] Overlays correctly visualize underlying data (Traffic).
