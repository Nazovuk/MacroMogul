/**
 * TextureManager — Premium Procedural Isometric Building & Tile Library
 * 
 * Each building TYPE has a unique architectural silhouette:
 *   FARM     → low barn + silo, red pitched roof, fenced area
 *   MINE     → industrial shed with minecart track, ore pile
 *   FACTORY  → wide industrial building with smokestacks
 *   RETAIL   → storefront with glass windows, colorful awning
 *   WAREHOUSE→ wide low corrugated metal building, rolling doors
 *   OFFICE   → tall glass & steel office tower
 *
 * Tile types: grass, forest, water, sand, concrete, dirt, road, plaza
 */

import { Texture, Renderer } from 'pixi.js'

// ━━━━ SINGLE SOURCE OF TRUTH FOR TILE DIMENSIONS ━━━━
export const TILE_WIDTH = 64
export const TILE_HEIGHT = 32
export const TILE_DEPTH = 8

export type TileType = 'grass' | 'water' | 'concrete' | 'dirt' | 'sand' | 'forest' | 'road' | 'plaza'

// Visual building category — maps 1:1 to the data-model BuildingType enum values
export type VisualBuildingCategory = 'FARM' | 'MINE' | 'FACTORY' | 'RETAIL' | 'WAREHOUSE' | 'OFFICE' | 'RESIDENTIAL' | 'SUPERMARKET' | 'HOSPITAL' | 'GYM' | 'CINEMA' | 'KINDERGARTEN' | 'RESTAURANT' | 'HOTEL' | 'BANK'

// ━━━━ TILE PALETTES ━━━━
interface TilePal { top: string[]; left: string; right: string; stroke: string; noise: string }

const TILE_PALETTE: Record<TileType, TilePal> = {
  grass:    { top: ['#6abf4b','#4da63a','#5cb347'], left: '#357a25', right: '#3f8a2f', stroke: 'rgba(180,255,180,0.12)', noise: 'rgba(0,60,0,0.10)' },
  forest:   { top: ['#2d7a2d','#1a5c1a','#256825'], left: '#143d14', right: '#1c5a1c', stroke: 'rgba(100,200,100,0.08)', noise: 'rgba(0,40,0,0.15)' },
  water:    { top: ['#2980b9','#2471a3','#5dade2'], left: '#1a5276', right: '#2471a3', stroke: 'rgba(150,220,255,0.15)', noise: 'rgba(255,255,255,0.06)' },
  concrete: { top: ['#c0c4c8','#a8adb2','#b5bac0'], left: '#808890', right: '#98a0a8', stroke: 'rgba(255,255,255,0.10)', noise: 'rgba(0,0,0,0.05)' },
  dirt:     { top: ['#c4955a','#a67c52','#b8874e'], left: '#7a5a35', right: '#96703f', stroke: 'rgba(220,200,160,0.08)', noise: 'rgba(60,30,0,0.08)' },
  sand:     { top: ['#f0d9a0','#e8c88a','#f5e2b0'], left: '#c4a56b', right: '#d9be85', stroke: 'rgba(255,240,200,0.12)', noise: 'rgba(80,60,20,0.05)' },
  road:     { top: ['#555555','#4a4a4a','#606060'], left: '#383838', right: '#454545', stroke: 'rgba(255,255,255,0.06)', noise: 'rgba(0,0,0,0.04)' },
  plaza:    { top: ['#d4c4a0','#c8b890','#ddd0b0'], left: '#a09070', right: '#b0a080', stroke: 'rgba(255,240,200,0.10)', noise: 'rgba(60,40,0,0.06)' },
}

// ━━━━ TEXTURE MANAGER SINGLETON ━━━━
class TextureManagerClass {
  private textures: Map<string, Texture> = new Map()

  public async initialize(_renderer: Renderer, _preferExternal: boolean = false) {
    // FORCE PROCEDURAL GENERATION for reliability.
    // The external asset system is causing checkerboard issues due to missing/partial files.
    // consistently generating textures on the fly is the 'magnificent' and robust solution.
    this.generateAllTextures()
    
    // Only load external assets if explicitly requested and we are sure they exist
    // For now, we disable this to guarantee a working map.
  }


  public generateAllTextures() {
    console.log('[TextureManager] Generating premium procedural textures...')

    // Tile textures
    for (const type of Object.keys(TILE_PALETTE) as TileType[]) {
      this.textures.set(`tile_${type}`, this.createTileTexture(type))
    }

    // Building textures — one per category
    const categories: VisualBuildingCategory[] = [
      'FARM', 'MINE', 'FACTORY', 'RETAIL', 'WAREHOUSE', 'OFFICE',
      'RESIDENTIAL', 'SUPERMARKET', 'HOSPITAL', 'GYM', 'CINEMA',
      'KINDERGARTEN', 'RESTAURANT', 'HOTEL', 'BANK',
    ]
    for (const cat of categories) {
      this.textures.set(`building_${cat}`, this.createBuildingTexture(cat))
    }

    // Trees
    this.textures.set('tree_conifer', this.createTreeTexture('conifer'))
    this.textures.set('tree_leafy', this.createTreeTexture('leafy'))

    // UI highlights
    this.textures.set('highlight_tile', this.createHighlightTexture())
    this.textures.set('placement_valid', this.createPlacementTexture(true))
    this.textures.set('placement_invalid', this.createPlacementTexture(false))

    console.log(`[TextureManager] Generated ${this.textures.size} textures`)
  }

  // ================================================================
  // TILE TEXTURE
  // ================================================================
  private createTileTexture(type: TileType): Texture {
    const w = TILE_WIDTH, h = TILE_HEIGHT, d = TILE_DEPTH
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h + d
    const ctx = canvas.getContext('2d')!
    const cx = w / 2, cy = h / 2
    const c = TILE_PALETTE[type]

    // Fallback if palette is missing (shouldn't happen)
    if (!c) {
      console.error(`[TextureManager] Missing palette for ${type}`)
      ctx.fillStyle = '#ff00ff'
      ctx.fillRect(0, 0, w, h + d)
      return Texture.from(canvas)
    }

    // Left depth face
    ctx.fillStyle = c.left
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx, h); ctx.lineTo(cx, h + d); ctx.lineTo(0, cy + d); ctx.closePath(); ctx.fill()
    // Right depth face
    ctx.fillStyle = c.right
    ctx.beginPath(); ctx.moveTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(cx, h + d); ctx.lineTo(w, cy + d); ctx.closePath(); ctx.fill()

    // Top face gradient
    const gr = ctx.createLinearGradient(0, 0, w, h)
    c.top.forEach((cl, i) => gr.addColorStop(i / (c.top.length - 1), cl))
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath(); ctx.fill()

    // Organic noise dots
    const seed = type.charCodeAt(0) * 137
    ctx.fillStyle = c.noise
    for (let i = 0; i < 30; i++) {
      const nx = (seed + i * 73) % w, ny = (seed + i * 41) % h
      if (Math.abs(nx - cx) / (w / 2) + Math.abs(ny - cy) / (h / 2) < 0.85) ctx.fillRect(nx, ny, 1.5, 1.5)
    }

    // Water waves
    if (type === 'water') {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(cx - 14 + i * 3, cy - 3 + i * 4)
        ctx.quadraticCurveTo(cx, cy - 5 + i * 4, cx + 14 - i * 3, cy - 3 + i * 4); ctx.stroke()
      }
    }
    // Road lane marks
    if (type === 'road') {
      ctx.strokeStyle = 'rgba(255,255,200,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - 4); ctx.lineTo(cx + 8, cy + 4); ctx.stroke(); ctx.setLineDash([])
    }
    // Edge highlight
    ctx.strokeStyle = c.stroke; ctx.lineWidth = 0.5
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath(); ctx.stroke()

    return Texture.from(canvas)
  }

  // ================================================================
  // BUILDING TEXTURES — each category is architecturally unique
  // ================================================================
  private createBuildingTexture(cat: VisualBuildingCategory): Texture {
    switch (cat) {
      case 'FARM':         return this.drawFarm()
      case 'MINE':         return this.drawMine()
      case 'FACTORY':      return this.drawFactory()
      case 'RETAIL':       return this.drawRetail()
      case 'WAREHOUSE':    return this.drawWarehouse()
      case 'OFFICE':       return this.drawOffice()
      case 'RESIDENTIAL':  return this.drawResidential()
      case 'SUPERMARKET':  return this.drawSupermarket()
      case 'HOSPITAL':     return this.drawHospital()
      case 'GYM':          return this.drawGym()
      case 'CINEMA':       return this.drawCinema()
      case 'KINDERGARTEN': return this.drawKindergarten()
      case 'RESTAURANT':   return this.drawRestaurant()
      case 'HOTEL':        return this.drawHotel()
      case 'BANK':         return this.drawBank()
    }
  }

  // ────── FARM: low barn + silo + green field ──────
  private drawFarm(): Texture {
    const cw = 80, ch = 70
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8

    // Ground / field (green patch)
    ctx.fillStyle = 'rgba(100,180,60,0.4)'
    ctx.beginPath()
    ctx.moveTo(cx, baseY - 6); ctx.lineTo(cx + 28, baseY + 8); ctx.lineTo(cx, baseY + 22); ctx.lineTo(cx - 28, baseY + 8)
    ctx.closePath(); ctx.fill()

    // Field rows
    ctx.strokeStyle = 'rgba(60,120,30,0.3)'; ctx.lineWidth = 0.5
    for (let r = 0; r < 4; r++) {
      ctx.beginPath(); ctx.moveTo(cx - 18 + r * 4, baseY + r * 3)
      ctx.lineTo(cx + 18 + r * 2, baseY + r * 3 + 4); ctx.stroke()
    }

    // Barn — left wall
    const barnH = 25, barnW = 18, barnD = 9
    ctx.fillStyle = '#8B4513'
    ctx.beginPath()
    ctx.moveTo(cx - barnW, baseY); ctx.lineTo(cx, baseY + barnD)
    ctx.lineTo(cx, baseY + barnD - barnH); ctx.lineTo(cx - barnW, baseY - barnH)
    ctx.closePath(); ctx.fill()
    // Barn — right wall
    ctx.fillStyle = '#A0522D'
    ctx.beginPath()
    ctx.moveTo(cx + barnW, baseY); ctx.lineTo(cx, baseY + barnD)
    ctx.lineTo(cx, baseY + barnD - barnH); ctx.lineTo(cx + barnW, baseY - barnH)
    ctx.closePath(); ctx.fill()
    // Barn — pitched roof
    const roofPeak = baseY - barnH - 10
    ctx.fillStyle = '#CC3333'
    ctx.beginPath(); ctx.moveTo(cx, roofPeak); ctx.lineTo(cx - barnW - 2, baseY - barnH); ctx.lineTo(cx, baseY + barnD - barnH); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#DD4444'
    ctx.beginPath(); ctx.moveTo(cx, roofPeak); ctx.lineTo(cx + barnW + 2, baseY - barnH); ctx.lineTo(cx, baseY + barnD - barnH); ctx.closePath(); ctx.fill()
    // Barn door
    ctx.fillStyle = '#5a2d0c'
    ctx.fillRect(cx - 4, baseY + barnD - 12, 8, 12)
    // Hay loft window
    ctx.fillStyle = '#FFD700'
    ctx.fillRect(cx - 2, baseY - barnH + 4, 4, 4)

    // Silo (cylinder to the right)
    const siloX = cx + barnW + 8, siloR = 5, siloH = 30
    ctx.fillStyle = '#8899AA'
    ctx.fillRect(siloX - siloR, baseY - siloH, siloR * 2, siloH)
    // Silo dome
    ctx.fillStyle = '#AABBCC'
    ctx.beginPath(); ctx.ellipse(siloX, baseY - siloH, siloR, 4, 0, Math.PI, 0); ctx.fill()
    // Silo highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(siloX - 1, baseY - siloH, 2, siloH)

    // Fence posts
    ctx.strokeStyle = '#6B4226'; ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const fx = cx - 22 + i * 10, fy = baseY + 1
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 5); ctx.stroke()
    }
    ctx.beginPath(); ctx.moveTo(cx - 22, baseY - 3); ctx.lineTo(cx + 18, baseY - 3); ctx.stroke()

    return Texture.from(canvas)
  }

  // ────── MINE: industrial shed + ore pile + track ──────
  private drawMine(): Texture {
    const cw = 80, ch = 70
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 10

    // Ore pile (brown mound)
    ctx.fillStyle = '#8B6914'
    ctx.beginPath(); ctx.moveTo(cx + 12, baseY + 5); ctx.quadraticCurveTo(cx + 20, baseY - 6, cx + 32, baseY + 5); ctx.fill()
    ctx.fillStyle = '#A07818'
    ctx.beginPath(); ctx.moveTo(cx + 14, baseY + 4); ctx.quadraticCurveTo(cx + 22, baseY - 3, cx + 30, baseY + 4); ctx.fill()

    // Mine shaft shed — left wall
    const shedH = 22, shedW = 16, shedD = 8
    ctx.fillStyle = '#5a5a5a'
    ctx.beginPath()
    ctx.moveTo(cx - shedW, baseY); ctx.lineTo(cx, baseY + shedD)
    ctx.lineTo(cx, baseY + shedD - shedH); ctx.lineTo(cx - shedW, baseY - shedH)
    ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#707070'
    ctx.beginPath()
    ctx.moveTo(cx + shedW, baseY); ctx.lineTo(cx, baseY + shedD)
    ctx.lineTo(cx, baseY + shedD - shedH); ctx.lineTo(cx + shedW, baseY - shedH)
    ctx.closePath(); ctx.fill()
    // Flat corrugated roof
    ctx.fillStyle = '#888888'
    ctx.beginPath()
    ctx.moveTo(cx, baseY + shedD - shedH - 2); ctx.lineTo(cx + shedW + 2, baseY - shedH - 2)
    ctx.lineTo(cx, baseY - shedD - shedH); ctx.lineTo(cx - shedW - 2, baseY - shedH - 2)
    ctx.closePath(); ctx.fill()
    // Corrugation lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.4
    for (let i = 0; i < 4; i++) {
      const yy = baseY - shedH + 5 + i * 5
      ctx.beginPath(); ctx.moveTo(cx - shedW + 2, yy); ctx.lineTo(cx - 1, yy + shedD / 2); ctx.stroke()
    }

    // Headframe / derrick (A-frame above shaft)
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx - 6, baseY - shedH); ctx.lineTo(cx, baseY - shedH - 18); ctx.lineTo(cx + 6, baseY - shedH); ctx.stroke()
    // Pulley wheel
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, baseY - shedH - 16, 3, 0, Math.PI * 2); ctx.stroke()
    // Cable
    ctx.strokeStyle = '#333'; ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.moveTo(cx, baseY - shedH - 13); ctx.lineTo(cx, baseY - shedH + 2); ctx.stroke()

    // Mine cart track
    ctx.strokeStyle = '#444'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx + 4, baseY + shedD); ctx.lineTo(cx + 25, baseY + 8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + 1, baseY + shedD + 2); ctx.lineTo(cx + 22, baseY + 10); ctx.stroke()
    // Track ties
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 0.8
    for (let t = 0; t < 4; t++) {
      const tx = cx + 6 + t * 5, ty = baseY + shedD + 1 - t * 0.5
      ctx.beginPath(); ctx.moveTo(tx - 1, ty - 2); ctx.lineTo(tx + 2, ty + 2); ctx.stroke()
    }

    // Entrance dark
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(cx - 3, baseY + shedD - 10, 6, 10)

    return Texture.from(canvas)
  }

  // ────── FACTORY: wide building + smokestacks + smoke ──────
  private drawFactory(): Texture {
    const cw = 88, ch = 85
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 10

    const factH = 30, factW = 26, factD = 13

    // Left wall
    ctx.fillStyle = '#6a6a6a'
    ctx.beginPath()
    ctx.moveTo(cx - factW, baseY); ctx.lineTo(cx, baseY + factD)
    ctx.lineTo(cx, baseY + factD - factH); ctx.lineTo(cx - factW, baseY - factH)
    ctx.closePath(); ctx.fill()
    // Corrugation on left wall
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5
    for (let i = 0; i < 6; i++) {
      const lx = cx - factW + 3 + i * 4
      ctx.beginPath()
      ctx.moveTo(lx, baseY - factH + 3); ctx.lineTo(lx + i * 0.4, baseY - 2 + i * 0.7)
      ctx.stroke()
    }

    // Right wall
    ctx.fillStyle = '#808080'
    ctx.beginPath()
    ctx.moveTo(cx + factW, baseY); ctx.lineTo(cx, baseY + factD)
    ctx.lineTo(cx, baseY + factD - factH); ctx.lineTo(cx + factW, baseY - factH)
    ctx.closePath(); ctx.fill()

    // Factory windows (few, large, yellow-tinted)
    ctx.fillStyle = 'rgba(255,200,50,0.45)'
    for (let wi = 0; wi < 3; wi++) {
      const t = (wi + 0.5) / 3
      // Left wall windows
      ctx.fillRect(cx - factW + 3 + t * factW, baseY - factH + 8 + t * (factD / 2), 5, 8)
      // Right wall windows
      ctx.fillRect(cx + 2 + t * factW, baseY - factH + 8 + (1 - t) * (factD / 2), 5, 8)
    }

    // Flat roof
    ctx.fillStyle = '#999'
    ctx.beginPath()
    ctx.moveTo(cx, baseY + factD - factH - 2); ctx.lineTo(cx + factW, baseY - factH - 2)
    ctx.lineTo(cx, baseY - factD - factH); ctx.lineTo(cx - factW, baseY - factH - 2)
    ctx.closePath(); ctx.fill()

    // Loading dock doors (bottom front)
    ctx.fillStyle = '#444'
    for (let d = 0; d < 2; d++) {
      ctx.fillRect(cx - 7 + d * 10, baseY + factD - 10, 6, 10)
    }
    // Striped hazard tape above doors
    ctx.fillStyle = '#FFD700'
    ctx.fillRect(cx - 8, baseY + factD - 11, 18, 1.5)

    // ── SMOKESTACKS ──
    const stacks = [
      { x: cx - 8, h: 26 },
      { x: cx + 4, h: 32 },
    ]
    for (const st of stacks) {
      const sy = baseY - factH - 2
      // Stack cylinder
      ctx.fillStyle = '#555'
      ctx.fillRect(st.x - 3, sy - st.h, 6, st.h)
      // Stack rim
      ctx.fillStyle = '#666'
      ctx.beginPath(); ctx.ellipse(st.x, sy - st.h, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill()
      // Red warning band
      ctx.fillStyle = '#cc3333'
      ctx.fillRect(st.x - 3, sy - st.h + 2, 6, 2)
      // Smoke puffs
      ctx.fillStyle = 'rgba(180,180,180,0.35)'
      ctx.beginPath(); ctx.arc(st.x + 1, sy - st.h - 6, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(200,200,200,0.25)'
      ctx.beginPath(); ctx.arc(st.x + 4, sy - st.h - 12, 6, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(210,210,210,0.15)'
      ctx.beginPath(); ctx.arc(st.x + 6, sy - st.h - 19, 7, 0, Math.PI * 2); ctx.fill()
    }

    // Red accent stripe on front edge
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(cx - 0.5, baseY + factD - factH, 1, factH)

    return Texture.from(canvas)
  }

  // ────── RETAIL: storefront + glass + awning ──────
  private drawRetail(): Texture {
    const cw = 70, ch = 60
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const shopH = 22, shopW = 20, shopD = 10

    // Left wall
    ctx.fillStyle = '#d4a76a'
    ctx.beginPath()
    ctx.moveTo(cx - shopW, baseY); ctx.lineTo(cx, baseY + shopD)
    ctx.lineTo(cx, baseY + shopD - shopH); ctx.lineTo(cx - shopW, baseY - shopH)
    ctx.closePath(); ctx.fill()
    // Right wall (full glass)
    ctx.fillStyle = '#86c5da'
    ctx.beginPath()
    ctx.moveTo(cx + shopW, baseY); ctx.lineTo(cx, baseY + shopD)
    ctx.lineTo(cx, baseY + shopD - shopH); ctx.lineTo(cx + shopW, baseY - shopH)
    ctx.closePath(); ctx.fill()
    // Glass reflection
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.moveTo(cx + shopW - 5, baseY - 2); ctx.lineTo(cx + 2, baseY + shopD - 4)
    ctx.lineTo(cx + 2, baseY + shopD - shopH + 4); ctx.lineTo(cx + shopW - 5, baseY - shopH + 2)
    ctx.closePath(); ctx.fill()

    // Roof
    ctx.fillStyle = '#b8956a'
    ctx.beginPath()
    ctx.moveTo(cx, baseY + shopD - shopH - 2); ctx.lineTo(cx + shopW, baseY - shopH - 2)
    ctx.lineTo(cx, baseY - shopD - shopH); ctx.lineTo(cx - shopW, baseY - shopH - 2)
    ctx.closePath(); ctx.fill()

    // ── AWNING (colorful striped) ──
    const awningH = 6
    ctx.fillStyle = '#e74c3c'
    ctx.beginPath()
    ctx.moveTo(cx - shopW, baseY - shopH + 3)
    ctx.lineTo(cx, baseY + shopD - shopH + 3)
    ctx.lineTo(cx, baseY + shopD - shopH + 3 + awningH)
    ctx.lineTo(cx - shopW - 3, baseY - shopH + 3 + awningH)
    ctx.closePath(); ctx.fill()
    // White stripes
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    for (let s = 0; s < 4; s++) {
      const sx = cx - shopW + 2 + s * 5
      ctx.fillRect(sx, baseY - shopH + 4, 2, awningH - 1)
    }
    // Right awning
    ctx.fillStyle = '#e74c3c'
    ctx.beginPath()
    ctx.moveTo(cx + shopW, baseY - shopH + 3)
    ctx.lineTo(cx, baseY + shopD - shopH + 3)
    ctx.lineTo(cx, baseY + shopD - shopH + 3 + awningH)
    ctx.lineTo(cx + shopW + 3, baseY - shopH + 3 + awningH)
    ctx.closePath(); ctx.fill()

    // Shop sign
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(cx - 8, baseY - shopH - 6, 16, 5)
    ctx.fillStyle = '#ecf0f1'
    ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('SHOP', cx, baseY - shopH - 2.5)

    // Door
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(cx - 3, baseY + shopD - 9, 6, 9)
    // Door handle
    ctx.fillStyle = '#f1c40f'
    ctx.fillRect(cx + 1, baseY + shopD - 5, 1, 2)

    // Display items in window
    ctx.fillStyle = 'rgba(255,220,100,0.5)'
    ctx.fillRect(cx + 5, baseY + shopD - 6, 3, 3)
    ctx.fillRect(cx + 10, baseY + shopD - 8, 3, 5)

    return Texture.from(canvas)
  }

  // ────── WAREHOUSE: wide low metal building ──────
  private drawWarehouse(): Texture {
    const cw = 84, ch = 55
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const whH = 20, whW = 28, whD = 14

    // Left wall (corrugated metal)
    ctx.fillStyle = '#7a8a7a'
    ctx.beginPath()
    ctx.moveTo(cx - whW, baseY); ctx.lineTo(cx, baseY + whD)
    ctx.lineTo(cx, baseY + whD - whH); ctx.lineTo(cx - whW, baseY - whH)
    ctx.closePath(); ctx.fill()
    // Corrugation lines
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.4
    for (let l = 0; l < 7; l++) {
      const lx = cx - whW + 3 + l * 4
      ctx.beginPath(); ctx.moveTo(lx, baseY - whH + 2); ctx.lineTo(lx + l * 0.5, baseY - 1 + l); ctx.stroke()
    }

    // Right wall
    ctx.fillStyle = '#8a9a8a'
    ctx.beginPath()
    ctx.moveTo(cx + whW, baseY); ctx.lineTo(cx, baseY + whD)
    ctx.lineTo(cx, baseY + whD - whH); ctx.lineTo(cx + whW, baseY - whH)
    ctx.closePath(); ctx.fill()

    // Slightly pitched roof
    ctx.fillStyle = '#aab8aa'
    ctx.beginPath()
    ctx.moveTo(cx, baseY - whD - whH + 2)
    ctx.lineTo(cx + whW + 1, baseY - whH - 1)
    ctx.lineTo(cx, baseY + whD - whH - 2)
    ctx.lineTo(cx - whW - 1, baseY - whH - 1)
    ctx.closePath(); ctx.fill()

    // Rolling doors (3 bays)
    for (let d = 0; d < 3; d++) {
      const dx = cx - 6 + d * 8
      ctx.fillStyle = '#556655'
      ctx.fillRect(dx - 2, baseY + whD - 12, 5, 12)
      // Door ribbing
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.3
      for (let r = 0; r < 5; r++) {
        ctx.beginPath(); ctx.moveTo(dx - 2, baseY + whD - 12 + r * 2.5)
        ctx.lineTo(dx + 3, baseY + whD - 12 + r * 2.5); ctx.stroke()
      }
    }

    // Forklift symbol
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('▣', cx + whW - 6, baseY - 4)

    // Loading dock platform
    ctx.fillStyle = '#9a8a7a'
    ctx.beginPath()
    ctx.moveTo(cx - 6, baseY + whD); ctx.lineTo(cx + 20, baseY + whD + 3)
    ctx.lineTo(cx + 20, baseY + whD + 5); ctx.lineTo(cx - 6, baseY + whD + 2)
    ctx.closePath(); ctx.fill()

    return Texture.from(canvas)
  }

  // ────── OFFICE: tall glass tower ──────
  private drawOffice(): Texture {
    const cw = 64, ch = 140
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12

    const offH = 110, fpW = 18, fpH = 9
    const floors = 10, floorH = offH / floors

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4, fpW + 3, fpH + 1, 0, 0, Math.PI * 2); ctx.fill()

    // Left wall (dark glass)
    ctx.fillStyle = '#1a3a5c'
    ctx.beginPath()
    ctx.moveTo(cx - fpW, baseY); ctx.lineTo(cx, baseY + fpH)
    ctx.lineTo(cx, baseY + fpH - offH); ctx.lineTo(cx - fpW, baseY - offH)
    ctx.closePath(); ctx.fill()
    // Left wall gradient
    const lg = ctx.createLinearGradient(cx - fpW, 0, cx, 0)
    lg.addColorStop(0, 'rgba(0,0,0,0.30)'); lg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lg; ctx.fill()

    // Right wall (lighter glass)
    ctx.fillStyle = '#2a5a8c'
    ctx.beginPath()
    ctx.moveTo(cx + fpW, baseY); ctx.lineTo(cx, baseY + fpH)
    ctx.lineTo(cx, baseY + fpH - offH); ctx.lineTo(cx + fpW, baseY - offH)
    ctx.closePath(); ctx.fill()
    // Highlight strip
    const rg = ctx.createLinearGradient(cx, 0, cx + fpW, 0)
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.7, 'rgba(255,255,255,0.06)')
    ctx.fillStyle = rg; ctx.fill()

    // Windows
    const ww = 3, wh = 4, wpf = 3, litSeed = 42
    for (let f = 0; f < floors; f++) {
      const fy = baseY - 3 - f * floorH
      for (let w = 0; w < wpf; w++) {
        const t = (w + 0.5) / wpf
        const isLit = ((litSeed + f * 7 + w * 13) % 5) < 2
        const wc = isLit ? '#ffdd44' : 'rgba(180,220,255,0.6)'
        ctx.fillStyle = wc
        // Left
        ctx.fillRect(cx - fpW + 2 + t * fpW, fy - wh - t * fpH, ww, wh)
        // Right
        ctx.fillRect(cx + 1 + t * fpW, fy - wh - (1 - t) * fpH, ww, wh)
      }
      // Floor line
      ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 0.4
      ctx.beginPath(); ctx.moveTo(cx - fpW, fy); ctx.lineTo(cx, fy + fpH); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, fy + fpH); ctx.lineTo(cx + fpW, fy); ctx.stroke()
    }

    // Flat roof
    const ry = baseY - offH
    ctx.fillStyle = '#3a7abc'
    ctx.beginPath()
    ctx.moveTo(cx, ry - fpH); ctx.lineTo(cx + fpW, ry); ctx.lineTo(cx, ry + fpH); ctx.lineTo(cx - fpW, ry)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.8; ctx.stroke()

    // Helipad
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.ellipse(cx, ry, fpW * 0.35, fpH * 0.35, 0, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `bold ${fpH * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('H', cx, ry)

    // Antenna
    ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(cx, ry - fpH); ctx.lineTo(cx, ry - fpH - 16); ctx.stroke()
    ctx.fillStyle = '#ff3333'
    ctx.beginPath(); ctx.arc(cx, ry - fpH - 16, 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,50,50,0.3)'
    ctx.beginPath(); ctx.arc(cx, ry - fpH - 16, 4, 0, Math.PI * 2); ctx.fill()

    // Vertical edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.moveTo(cx, baseY + fpH); ctx.lineTo(cx, baseY + fpH - offH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx - fpW, baseY); ctx.lineTo(cx - fpW, baseY - offH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(cx + fpW, baseY); ctx.lineTo(cx + fpW, baseY - offH); ctx.stroke()

    // Entrance
    ctx.fillStyle = '#e94560'; ctx.globalAlpha = 0.7
    ctx.fillRect(cx - 3, baseY + fpH - 6, 6, 6)
    ctx.globalAlpha = 1.0

    return Texture.from(canvas)
  }

  // ────── RESIDENTIAL: apartment with balconies ──────
  private drawResidential(): Texture {
    const cw = 60, ch = 100
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 10
    const h = 70, w = 16, d = 8, floors = 6, fh = h / floors
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 3, w + 2, d, 0, 0, Math.PI * 2); ctx.fill()
    // Left wall (warm beige)
    ctx.fillStyle = '#c4a882'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#d4b892'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Windows + balconies
    for (let f = 0; f < floors; f++) {
      const fy = baseY - 4 - f * fh
      for (let wi = 0; wi < 2; wi++) {
        const t = (wi + 0.5) / 2
        ctx.fillStyle = ((f + wi) % 3 === 0) ? '#ffdd44' : 'rgba(180,220,255,0.6)'
        ctx.fillRect(cx - w + 2 + t * w, fy - 4 - t * d, 3, 4)
        ctx.fillRect(cx + 1 + t * w, fy - 4 - (1 - t) * d, 3, 4)
      }
      // Balcony railing on right side
      if (f % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5
        ctx.beginPath(); ctx.moveTo(cx + w + 1, fy - 1); ctx.lineTo(cx + w + 4, fy); ctx.lineTo(cx + w + 4, fy - 5); ctx.stroke()
      }
    }
    // Flat roof
    ctx.fillStyle = '#b09870'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Water tank
    ctx.fillStyle = '#888'; ctx.fillRect(cx - 3, baseY - h - 8, 6, 5)
    // Entrance door
    ctx.fillStyle = '#6B4226'; ctx.fillRect(cx - 2, baseY + d - 8, 4, 8)
    return Texture.from(c)
  }

  // ────── SUPERMARKET: wide + cart corral + sign ──────
  private drawSupermarket(): Texture {
    const cw = 80, ch = 55
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 20, w = 26, d = 13
    // Left wall (light blue)
    ctx.fillStyle = '#a8d8ea'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#c8e8f8'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Glass front
    ctx.fillStyle = 'rgba(180,230,255,0.4)'
    ctx.fillRect(cx - 10, baseY + d - 12, 20, 12)
    // Roof
    ctx.fillStyle = '#2196F3'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w + 2, baseY - h - 2); ctx.lineTo(cx, baseY - d - h + 2); ctx.lineTo(cx - w - 2, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Sign
    ctx.fillStyle = '#1565C0'; ctx.fillRect(cx - 12, baseY - h - 8, 24, 6)
    ctx.fillStyle = '#fff'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('MARKET', cx, baseY - h - 3.5)
    // Shopping carts
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6
    for (let i = 0; i < 3; i++) { ctx.strokeRect(cx + w - 8 + i * 3, baseY - 3, 2, 3) }
    // Entrance
    ctx.fillStyle = '#0D47A1'; ctx.fillRect(cx - 4, baseY + d - 8, 8, 8)
    return Texture.from(c)
  }

  // ────── HOSPITAL: white building + red cross ──────
  private drawHospital(): Texture {
    const cw = 70, ch = 80
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 10
    const h = 50, w = 20, d = 10
    // Left wall (white)
    ctx.fillStyle = '#e8e8e8'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#f0f0f0'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Windows (rows)
    for (let f = 0; f < 5; f++) {
      const fy = baseY - 4 - f * (h / 5)
      ctx.fillStyle = 'rgba(180,220,255,0.5)'
      for (let wi = 0; wi < 2; wi++) {
        const t = (wi + 0.5) / 2
        ctx.fillRect(cx - w + 3 + t * w, fy - 3 - t * d, 3, 3)
        ctx.fillRect(cx + 2 + t * w, fy - 3 - (1 - t) * d, 3, 3)
      }
    }
    // Roof
    ctx.fillStyle = '#ddd'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Red cross sign
    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(cx - 1.5, baseY - h + 4, 3, 9)
    ctx.fillRect(cx - 4.5, baseY - h + 7, 9, 3)
    // Ambulance entrance
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(cx - 5, baseY + d - 8, 10, 8)
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(cx - 5, baseY + d - 9, 10, 1.5)
    return Texture.from(c)
  }

  // ────── GYM: sporty building ──────
  private drawGym(): Texture {
    const cw = 70, ch = 55
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 22, w = 22, d = 11
    // Left wall (orange)
    ctx.fillStyle = '#e67e22'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#f39c12'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Large windows
    ctx.fillStyle = 'rgba(200,230,255,0.5)'
    ctx.fillRect(cx - w + 3, baseY - h + 6, w - 5, h - 12)
    // Roof
    ctx.fillStyle = '#d35400'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h + 1); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Dumbbell icon
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx - 4, baseY - h - 5); ctx.lineTo(cx + 4, baseY - h - 5); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 6, baseY - h - 7, 3, 4); ctx.fillRect(cx + 3, baseY - h - 7, 3, 4)
    // Entrance
    ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 3, baseY + d - 8, 6, 8)
    return Texture.from(c)
  }

  // ────── CINEMA: marquee + screen ──────
  private drawCinema(): Texture {
    const cw = 76, ch = 60
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 25, w = 24, d = 12
    // Left wall (dark purple)
    ctx.fillStyle = '#4a1a6b'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#5a2a7b'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Roof
    ctx.fillStyle = '#3a0a5b'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h + 1); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Marquee sign (bright)
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 14, baseY - h - 8, 28, 7)
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('CINEMA', cx, baseY - h - 3)
    // Marquee lights
    ctx.fillStyle = '#ff6b6b'
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(cx - 12 + i * 3.5, baseY - h - 9, 1, 0, Math.PI * 2); ctx.fill() }
    // Screen poster
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(cx + 3, baseY + d - 14, 8, 10)
    ctx.fillStyle = 'rgba(255,200,50,0.3)'; ctx.fillRect(cx + 4, baseY + d - 13, 6, 8)
    // Entrance
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx - 4, baseY + d - 8, 8, 8)
    return Texture.from(c)
  }

  // ────── KINDERGARTEN: colorful building ──────
  private drawKindergarten(): Texture {
    const cw = 70, ch = 50
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 18, w = 20, d = 10
    // Left wall (soft pink)
    ctx.fillStyle = '#f8bbd0'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall (soft green)
    ctx.fillStyle = '#c8e6c9'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Pitched roof (blue)
    ctx.fillStyle = '#42a5f5'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 8); ctx.lineTo(cx - w - 2, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#64b5f6'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 8); ctx.lineTo(cx + w + 2, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    // Colorful windows
    const colors = ['#ffeb3b', '#ff9800', '#4caf50', '#e91e63']
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(cx - w + 3 + i * 6, baseY - h + 5 + i * 2, 4, 4)
    }
    // Fence
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8
    for (let f = 0; f < 5; f++) {
      ctx.beginPath(); ctx.moveTo(cx - 16 + f * 8, baseY + 2); ctx.lineTo(cx - 16 + f * 8, baseY - 3); ctx.stroke()
    }
    ctx.beginPath(); ctx.moveTo(cx - 16, baseY - 1); ctx.lineTo(cx + 16, baseY - 1); ctx.stroke()
    // Door
    ctx.fillStyle = '#ff7043'; ctx.fillRect(cx - 2, baseY + d - 7, 4, 7)
    return Texture.from(c)
  }

  // ────── RESTAURANT: bistro with chimney ──────
  private drawRestaurant(): Texture {
    const cw = 68, ch = 55
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 22, w = 20, d = 10
    // Left wall (warm brown)
    ctx.fillStyle = '#8d6e63'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#a1887f'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Pitched terracotta roof
    ctx.fillStyle = '#bf360c'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 6); ctx.lineTo(cx - w - 2, baseY - h + 1); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#d84315'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 6); ctx.lineTo(cx + w + 2, baseY - h + 1); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    // Chimney with smoke
    ctx.fillStyle = '#5d4037'; ctx.fillRect(cx + w - 4, baseY - h - 12, 4, 8)
    ctx.fillStyle = 'rgba(200,200,200,0.3)'
    ctx.beginPath(); ctx.arc(cx + w - 2, baseY - h - 15, 3, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(210,210,210,0.2)'
    ctx.beginPath(); ctx.arc(cx + w, baseY - h - 20, 4, 0, Math.PI * 2); ctx.fill()
    // Awning
    ctx.fillStyle = '#c62828'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY - h + 4); ctx.lineTo(cx, baseY + d - h + 4); ctx.lineTo(cx, baseY + d - h + 8); ctx.lineTo(cx - w - 2, baseY - h + 8); ctx.closePath(); ctx.fill()
    // Window
    ctx.fillStyle = '#ffcc80'; ctx.fillRect(cx + 4, baseY + d - 14, 6, 6)
    // Door
    ctx.fillStyle = '#3e2723'; ctx.fillRect(cx - 3, baseY + d - 8, 6, 8)
    return Texture.from(c)
  }

  // ────── HOTEL: multi-story with entrance canopy ──────
  private drawHotel(): Texture {
    const cw = 64, ch = 110
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 10
    const h = 80, w = 18, d = 9, floors = 7, fh = h / floors
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 3, w + 2, d, 0, 0, Math.PI * 2); ctx.fill()
    // Left wall (gold/cream)
    ctx.fillStyle = '#c8a86e'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#d8b87e'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Windows
    for (let f = 0; f < floors; f++) {
      const fy = baseY - 3 - f * fh
      for (let wi = 0; wi < 2; wi++) {
        const t = (wi + 0.5) / 2
        ctx.fillStyle = ((f * 3 + wi) % 4 < 2) ? '#ffdd44' : 'rgba(180,220,255,0.5)'
        ctx.fillRect(cx - w + 2 + t * w, fy - 3 - t * d, 3, 3)
        ctx.fillRect(cx + 1 + t * w, fy - 3 - (1 - t) * d, 3, 3)
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 0.3
      ctx.beginPath(); ctx.moveTo(cx - w, fy); ctx.lineTo(cx, fy + d); ctx.lineTo(cx + w, fy); ctx.stroke()
    }
    // Roof
    ctx.fillStyle = '#b8986e'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // Entrance canopy
    ctx.fillStyle = '#8B0000'
    ctx.fillRect(cx - 6, baseY + d - 3, 12, 3)
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(cx - 7, baseY + d - 4, 14, 1.5)
    // Entrance
    ctx.fillStyle = '#3a1a0a'; ctx.fillRect(cx - 3, baseY + d - 8, 6, 8)
    // Star rating
    ctx.fillStyle = '#f1c40f'; ctx.font = '4px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('★★★', cx, baseY - h - 5)
    return Texture.from(c)
  }

  // ────── BANK: classical columns + vault ──────
  private drawBank(): Texture {
    const cw = 70, ch = 65
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 8
    const h = 30, w = 22, d = 11
    // Left wall (marble grey)
    ctx.fillStyle = '#c0c0c0'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#d0d0d0'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    // Triangular pediment
    ctx.fillStyle = '#e0e0e0'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 10); ctx.lineTo(cx - w, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#e8e8e8'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 10); ctx.lineTo(cx + w, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    // Columns (front face)
    ctx.fillStyle = '#f5f5f5'
    for (let col = 0; col < 4; col++) {
      const t = (col + 0.5) / 4
      ctx.fillRect(cx - w + 2 + t * w, baseY - h + 2 + t * (d / 2), 2, h - 6)
    }
    // Door (vault-like)
    ctx.fillStyle = '#333'; ctx.fillRect(cx - 4, baseY + d - 12, 8, 12)
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.arc(cx, baseY + d - 6, 3, 0, Math.PI * 2); ctx.stroke()
    // $ symbol
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('$', cx, baseY - h - 5)
    return Texture.from(c)
  }

  // ================================================================
  // TREE TEXTURES
  // ================================================================
  private createTreeTexture(type: 'conifer' | 'leafy'): Texture {
    const canvas = this.mkCanvas(20, 30)
    const ctx = canvas.getContext('2d')!
    const cx = 10, base = 28

    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(cx - 1.5, base - 8, 3, 8)

    if (type === 'conifer') {
      const layers = [{ y: base - 8, w: 8, h: 7 }, { y: base - 14, w: 6, h: 7 }, { y: base - 19, w: 4, h: 6 }]
      for (const l of layers) {
        ctx.fillStyle = '#1a6b1a'
        ctx.beginPath(); ctx.moveTo(cx, l.y - l.h); ctx.lineTo(cx + l.w / 2, l.y); ctx.lineTo(cx - l.w / 2, l.y); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#2a8a2a'
        ctx.beginPath(); ctx.moveTo(cx, l.y - l.h); ctx.lineTo(cx + l.w / 2, l.y); ctx.lineTo(cx, l.y - 1); ctx.closePath(); ctx.fill()
      }
    } else {
      ctx.fillStyle = '#1a5a1a'
      ctx.beginPath(); ctx.arc(cx + 1, base - 13, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#2d8b2d'
      ctx.beginPath(); ctx.arc(cx, base - 14, 7, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#4ac04a'
      ctx.beginPath(); ctx.arc(cx - 2, base - 16, 3.5, 0, Math.PI * 2); ctx.fill()
    }
    return Texture.from(canvas)
  }

  // ================================================================
  // UI HIGHLIGHTS
  // ================================================================
  private createHighlightTexture(): Texture {
    const w = TILE_WIDTH, h = TILE_HEIGHT
    const canvas = this.mkCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    const cx = w / 2, cy = h / 2
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke()
    return Texture.from(canvas)
  }

  private createPlacementTexture(valid: boolean): Texture {
    const w = TILE_WIDTH, h = TILE_HEIGHT
    const canvas = this.mkCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    const cx = w / 2, cy = h / 2
    const col = valid ? '0,255,200' : '255,60,60'
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath()
    ctx.fillStyle = `rgba(${col},0.25)`; ctx.fill()
    ctx.strokeStyle = `rgba(${col},0.8)`; ctx.lineWidth = 2.5; ctx.setLineDash([4, 3]); ctx.stroke()
    return Texture.from(canvas)
  }

  // ================================================================
  // GETTERS
  // ================================================================
  public getTileTexture(type: TileType): Texture | undefined {
    return this.textures.get(`tile_${type}`) ?? this.createTileTexture(type)
  }

  /**
   * Get building texture by CATEGORY (FARM, MINE, FACTORY, etc.)
   * This is the primary API — called with BuildingData.type from the DataStore
   */
  public getBuildingTexture(category: string): Texture | undefined {
    const key = `building_${category}`
    if (this.textures.has(key)) return this.textures.get(key)
    // Fallback: try as-is, then default to OFFICE
    return this.textures.get('building_OFFICE')
  }

  public getTreeTexture(variant: 'conifer' | 'leafy'): Texture | undefined {
    return this.textures.get(`tree_${variant}`)
  }

  public getTexture(name: string): Texture | undefined {
    return this.textures.get(name)
  }

  public getAllTileTypes(): TileType[] {
    return Object.keys(TILE_PALETTE) as TileType[]
  }

  // UTIL
  private mkCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    return c
  }
}

export const TextureManager = new TextureManagerClass()
