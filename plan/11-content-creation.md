# 11 — Content Creation & AI Asset Pipeline

This document defines the protocols, tools, and criteria for generating every asset in the **MacroMogul** ecosystem—ensuring 100% unique ownership, premium fidelity, and simulation-depth consistency.

---

## 🎨 1. Visual Asset Pipeline (Zero-Cost Operation)

All visual assets must follow the **"MacroMogul Gold Standard"**. We will leverage the USER's existing professional subscriptions and integrated agent tools to avoid any additional costs.

### 1.1 Generation Strategy
- **Primary Tool:** `generate_image` (Integrated Agent Tool). We utilize his professional AI context to trigger high-fidelity generations directly.
- **Alternative:** Manual prompting via **ChatGPT Plus (DALL-E 3)** or **Gemini Advanced** (Imagen 3) if the agent tool requires specific fine-tuning.
- **Criteria:** 
    - Isolated on transparent/solid background.
    - Lighting: Directional from Top-Right (Sun at 45°).
    - Palette: Vibrant but professional (No "cartoon" saturations).
- **Prompt Template:** `[Building Type] isometric 2D sprite, high fidelity, modern architectural style, SimCity 4 aesthetic, 8k, game asset, sharp edges, clean windows, rooftop details, top-down 30-degree perspective --no background`

### 1.2 Life-Sim Assets (People, Cars)
- **Faces:** Generated via high-quality portrait models to avoid bias and copyright. Used for Executives (CEOs) and Citizen feedback.
- **Vehicles:** Tiny 32x32 to 64x64 sprites generated in batches to populate high-traffic retail areas.

---

## 📊 2. Data & Simulation Ecosystem

The data isn't just "typed"—it is synthesized based on real-world economic benchmarks.

### 2.1 Product & Recipe Synthesis
- **Source:** AI-augmented market research (Standard Industrial Classification - SIC codes).
- **Criteria:** 
    - Every product must have a logic chain: (Raw Material) → (Intermediate) → (Final Consumer Good).
    - Prices are benchmarked against 2024-2025 global average indices.
- **Format:** Pure JSON files in `data/config/products.json`.

### 2.2 City & Macro Data
- **Real-World Benchmarking:** Initial city data (GDP, Pop, Unemployment) modeled after 50 global hubs (Istanbul, New York, Tokyo, London, etc.).
- **Dynamic Logic:** Cities "learn" from player actions. High industrial pollution lowers residential property values automatically.

---

## 🧪 3. Content Creation Tools & Stack

| Category | Tool / Utility | Purpose |
|----------|----------------|---------|
| **Image Generation** | Agent `generate_image` / ChatGPT Pro / Gemini Pro | Sprites, icons, backgrounds (No additional cost) |
| **Image Post-Processing** | Sharp / Jimp (Node.js libraries) | Automatic background removal & texture atlasing (Free/Local) |
| **Data Generation** | Gemini Pro / GPT-4 (via Pro Subs) | Synthesizing hundreds of product tags, descriptions, and news events |
| **Database** | Supabase (Free Tier / Post-paid) | Persistent storage of the evolved global asset library |

---

## 🛠️ 4. Asset Integration Workflow (Automated)

1. **Synthesis:** AI generates an asset (Image or Data chunk).
2. **Quality Gate:** Asset is passed through a "Validation Shader/Script" to check for isometric alignment and color balance.
3. **Database Injection:** Final assets are uploaded to Supabase Storage/DB.
4. **HMR Loading:** Game engine (Vite) detects new files in the `public/` directory and hot-reloads the assets without restart.

---

## 🎯 5. The "Mogul" Quality Criteria
- **No Placeholders:** A building cannot exist in the game without a unique sprite.
- **Active Data Only:** Every data point (even a citizen's face) must be connected to an active simulation variable (e.g., happiness, wealth).
- **Infinite Variety:** Use AI to generate "variations" of the same building type (e.g., 5 different styles for a Medium Factory) to avoid city repetition.
