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

import { Texture, Renderer, Assets } from 'pixi.js'

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
    this.generateAllTextures()
    
    // Asynchronously attempt to load premium external assets if requested
    if (_preferExternal) {
        await this.loadExternalAssets()
    }
  }

  private async loadExternalAssets() {
      const categories: VisualBuildingCategory[] = [
        'FARM', 'MINE', 'FACTORY', 'RETAIL', 'WAREHOUSE', 'OFFICE',
        'RESIDENTIAL', 'SUPERMARKET', 'HOSPITAL', 'GYM', 'CINEMA',
        'KINDERGARTEN', 'RESTAURANT', 'HOTEL', 'BANK',
      ]

      console.log(`[TextureManager] Loading premium high-res external assets...`)
      
      const loadPromises = categories.map(async (cat) => {
        const url = `/assets/buildings/${cat}.png`
        try {
          const texture = await Assets.load(url)
          if (texture) {
            console.log(`[TextureManager] ✓ Loaded external asset: ${cat}`)
            this.textures.set(`ext_building_${cat}`, texture)
          }
        } catch (_e) {
          console.warn(`[TextureManager] ✗ External asset missing: ${cat}, using procedural`)
        }
      });

      await Promise.allSettled(loadPromises)
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

    // UI highlights & Shadows
    this.textures.set('highlight_tile', this.createHighlightTexture())
    this.textures.set('placement_valid', this.createPlacementTexture(true))
    this.textures.set('placement_invalid', this.createPlacementTexture(false))
    this.textures.set('building_shadow', this.createShadowTexture())

    console.log(`[TextureManager] Generated ${this.textures.size} textures`)
  }

  /**
   * Creates a soft Ambient Occlusion (AO) shadow texture 
   * to ground buildings and prevent them from appearing 'floating'.
   */
  private createShadowTexture(): Texture {
    const w = 80, h = 40
    const canvas = this.mkCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    
    const grd = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2)
    grd.addColorStop(0, 'rgba(0,0,0,0.35)')
    grd.addColorStop(0.6, 'rgba(0,0,0,0.15)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.ellipse(w/2, h/2, w/2, h/4, 0, 0, Math.PI * 2)
    ctx.fill()
    
    return Texture.from(canvas)
  }

  // ================================================================
  // TILE TEXTURE
  // ================================================================
  private createTileTexture(type: TileType, elevation: number = 0): Texture {
    const w = TILE_WIDTH, h = TILE_HEIGHT, base_d = TILE_DEPTH
    const elev_d = Math.max(0, elevation)
    const total_d = base_d + elev_d
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h + total_d
    const ctx = canvas.getContext('2d')!
    const cx = w / 2, cy = h / 2
    const c = TILE_PALETTE[type]

    // Fallback if palette is missing
    if (!c) {
      ctx.fillStyle = '#ff00ff'
      ctx.fillRect(0, 0, w, h + total_d)
      return Texture.from(canvas)
    }

    // --- SIDE WALLS ---
    // Left face
    ctx.fillStyle = c.left
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx, h); ctx.lineTo(cx, h + total_d); ctx.lineTo(0, cy + total_d); ctx.closePath(); ctx.fill()
    
    // Right face
    ctx.fillStyle = c.right
    ctx.beginPath(); ctx.moveTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(cx, h + total_d); ctx.lineTo(w, cy + total_d); ctx.closePath(); ctx.fill()

    // --- TOP FACE ---
    const gr = ctx.createLinearGradient(0, 0, w, h)
    c.top.forEach((cl, i) => gr.addColorStop(i / (c.top.length - 1), cl))
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath(); ctx.fill()

    // --- PROCEDURAL NOISE (Texture detail) ---
    // Only apply noise to non-water terrain to make water look smoother, and ground look rougher
    if (type !== 'water') {
      ctx.save()
      ctx.clip() // Clip to the top face polygon we just drew
      ctx.globalAlpha = 0.05 + Math.random() * 0.03
      // Draw 50-100 random little dots/blotches for texture
      const noiseCount = 50 + Math.random() * 50
      for (let i = 0; i < noiseCount; i++) {
        const nx = Math.random() * w
        const ny = Math.random() * h
        const nr = Math.random() * 2 + 1
        ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000'
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    } else {
      // Water ripples
      ctx.save()
      ctx.clip()
      ctx.globalAlpha = 0.1
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const ry = (cy * 0.5) + Math.random() * cy
        const rw = 10 + Math.random() * 20
        const rx = cx - rw/2 + (Math.random() * 20 - 10)
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.stroke()
      }
      ctx.restore()
    }

    // Edge highlight
    ctx.strokeStyle = c.stroke; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(w, cy); ctx.lineTo(cx, h); ctx.lineTo(0, cy); ctx.closePath(); ctx.stroke()

    // --- STRATA LAYERS (Realistic Rock / Sedimentary Detailing) ---
    if (total_d > base_d) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1

      // Draw jagged strata lines instead of perfect straight ones
      const strataCount = Math.floor(elev_d / 6)
      for (let layer = 1; layer <= strataCount; layer++) {
        // Base height for this strata
        const ly = cy + (layer * 6) + (Math.random() * 2 - 1)
        
        if (ly < cy + total_d) {
           // Left Face Strata (jagged)
           ctx.beginPath()
           ctx.moveTo(0, ly)
           const midLeftX = cx / 2
           const midLeftY = ly + (h - cy)/2 + (Math.random() * 3 - 1.5)
           ctx.lineTo(midLeftX, midLeftY)
           ctx.lineTo(cx, h + (ly - cy))
           ctx.stroke()
           
           // Right Face Strata (jagged)
           ctx.beginPath()
           ctx.moveTo(cx, h + (ly - cy))
           const midRightX = cx + cx / 2
           const midRightY = h + (ly - cy) - (h - cy)/2 + (Math.random() * 3 - 1.5)
           ctx.lineTo(midRightX, midRightY)
           ctx.lineTo(w, cy + (ly - cy))
           ctx.stroke()
           
           // Random little rock discolorations
           if (Math.random() > 0.5) {
               ctx.beginPath()
               ctx.moveTo(cx, h + (ly - cy))
               ctx.lineTo(cx, h + (ly - cy) + 4)
               ctx.stroke()
           }
        }
      }
    }

    const tex = Texture.from(canvas)
    this.textures.set(`tile_${type}_${elevation}`, tex)
    return tex
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
      default:             return this.drawOffice()
    }
  }

  /**
   * UTIL: Isometric Block Drawer (Canvas)
   * Creates a solid-looking 3D block with hard shading.
   */
  private drawIsoBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, baseColor: string) {
    const left = this.shadeColor(baseColor, -15);
    const right = this.shadeColor(baseColor, -35);
    const top = baseColor;
    const stroke = '#111';

    // Left face
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - w, y - w/2);
    ctx.lineTo(x - w, y - w/2 - h);
    ctx.lineTo(x, y - h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();

    // Right face
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d/2);
    ctx.lineTo(x + d, y - d/2 - h);
    ctx.lineTo(x, y - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - w, y - w/2 - h);
    ctx.lineTo(x - w + d, y - (w+d)/2 - h);
    ctx.lineTo(x + d, y - d/2 - h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sharp internal edge highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - w, y - w/2 - h); ctx.stroke();
  }

  // ────── FARM: Large Industrial Farm Complex ──────
  private drawFarm(): Texture {
    const cw = 256, ch = 256
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 50

    // 1. Concrete / Dirt Base
    ctx.fillStyle = '#6b4c33'; ctx.beginPath()
    ctx.moveTo(cx, baseY - 64); ctx.lineTo(cx + 128, baseY); ctx.lineTo(cx, baseY + 64); ctx.lineTo(cx - 128, baseY); ctx.fill()

    // 2. Main High-Contrast Red Barn (Blocky)
    this.drawIsoBlock(ctx, cx - 20, baseY + 10, 60, 40, 45, '#8B0000');
    
    // 3. Barn Roof (Pitched block)
    ctx.fillStyle = '#440000'
    ctx.beginPath()
    ctx.moveTo(cx - 20, baseY + 10 - 45); ctx.lineTo(cx - 80, baseY - 30 - 45); ctx.lineTo(cx - 20, baseY - 60 - 45); ctx.lineTo(cx + 20, baseY - 20 - 45);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // 4. Silo Cluster (Geometric cylinders/prisms)
    this.drawIsoBlock(ctx, cx + 50, baseY + 15, 15, 15, 85, '#999999');
    this.drawIsoBlock(ctx, cx + 75, baseY, 12, 12, 60, '#aaaaaa');

    return Texture.from(canvas)
  }

  // ────── FACTORY: Huge Industrial Plant ──────
  private drawFactory(): Texture {
    const cw = 256, ch = 256
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 50

    // 1. Foundation
    ctx.fillStyle = '#222'; ctx.beginPath()
    ctx.moveTo(cx, baseY - 80); ctx.lineTo(cx + 160, baseY); ctx.lineTo(cx, baseY + 80); ctx.lineTo(cx - 160, baseY); ctx.fill()

    // 2. Multi-Level Production Blocks
    this.drawIsoBlock(ctx, cx - 30, baseY + 20, 80, 50, 40, '#667788');
    this.drawIsoBlock(ctx, cx + 50, baseY + 30, 40, 40, 25, '#8899aa');

    // 3. Sawtooth Roof Pattern (High definition)
    ctx.fillStyle = '#445566'
    const stroke = '#111';
    for(let i=0; i<3; i++) {
        const ox = cx - 110 + i*30, oy = baseY - 25
        ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox+15, oy-20); ctx.lineTo(ox+15, oy); ctx.closePath(); ctx.fill(); ctx.stroke()
    }

    // 4. Industrial Smokestacks
    for(let i=0; i<2; i++) {
        const sx = cx + 80 + i*25, sy = baseY - 10
        this.drawIsoBlock(ctx, sx, sy, 10, 10, 100, '#333333');
        // Red caution bands
        ctx.fillStyle = '#c0392b'; ctx.fillRect(sx-5, sy-95, 10, 5); ctx.fillRect(sx-5, sy-75, 10, 5)
    }

    return Texture.from(canvas)
  }

  // ────── MINE: Extraction Site ──────
  private drawMine(): Texture {
    const cw = 256, ch = 256
    const canvas = this.mkCanvas(cw, ch)
    const ctx = canvas.getContext('2d')!
    const cx = cw / 2, baseY = ch - 50

    // Excavation Crater
    ctx.fillStyle = '#3d2b1f'; ctx.beginPath(); ctx.ellipse(cx, baseY, 90, 45, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke()

    // Headframe (Geometric Support)
    this.drawIsoBlock(ctx, cx, baseY, 10, 10, 80, '#222222');
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(cx-20, baseY); ctx.lineTo(cx, baseY-80); ctx.lineTo(cx+20, baseY); ctx.stroke()

    return Texture.from(canvas)
  }

  private shadeColor(color: string, percent: number): string {
    let R = parseInt(color.substring(1,3), 16)
    let G = parseInt(color.substring(3,5), 16)
    let B = parseInt(color.substring(5,7), 16)
    R = Math.floor(R * (100 + percent) / 100); G = Math.floor(G * (100 + percent) / 100); B = Math.floor(B * (100 + percent) / 100)
    R = Math.min(255, R); G = Math.min(255, G); B = Math.min(255, B); R = Math.max(0, R); G = Math.max(0, G); B = Math.max(0, B)
    const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16))
    const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16))
    const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16))
    return "#"+RR+GG+BB
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

    // Shadow - Integrated soft AO
    const grd = ctx.createRadialGradient(cx, baseY + 4, 0, cx, baseY + 4, fpW + 8)
    grd.addColorStop(0, 'rgba(0,0,0,0.3)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4, fpW + 6, fpH + 2, 0, 0, Math.PI * 2); ctx.fill()

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
    const cw = 76, ch = 65
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 26, w = 30, d = 16

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, w + 4, d + 4, 0, 0, Math.PI * 2); ctx.fill()

    // Left wall (vibrant orange/red combo)
    ctx.fillStyle = '#e67e22'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#f39c12'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    
    // Aesthetic side stripes
    ctx.fillStyle = '#c0392b'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY - h/2); ctx.lineTo(cx, baseY + d - h/2); ctx.lineTo(cx, baseY + d - h/2 - 4); ctx.lineTo(cx - w, baseY - h/2 - 4); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#e74c3c'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY - h/2); ctx.lineTo(cx, baseY + d - h/2); ctx.lineTo(cx, baseY + d - h/2 - 4); ctx.lineTo(cx + w, baseY - h/2 - 4); ctx.closePath(); ctx.fill()

    // Large glass facade for treadmill view
    ctx.fillStyle = 'rgba(180,220,255,0.6)'
    ctx.fillRect(cx - w + 6, baseY - h + 10, w - 8, h - 8)
    ctx.fillRect(cx + 4, baseY + d - 20, w - 10, h - 14)
    
    // Gym equipment silhouettes behind glass
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(cx - w + 10, baseY + d - 18, 4, 4)
    ctx.fillRect(cx - w + 18, baseY + d - 16, 4, 4)

    // Metallic curved roof
    ctx.fillStyle = '#7f8c8d'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h + 1); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    
    // Dumbbell icon on huge signboard
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(cx - 10, baseY - h - 12, 20, 10)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cx - 5, baseY - h - 7); ctx.lineTo(cx + 5, baseY - h - 7); ctx.stroke()
    ctx.fillStyle = '#3498db'; ctx.fillRect(cx - 7, baseY - h - 9, 3, 5); ctx.fillRect(cx + 4, baseY - h - 9, 3, 5)
    
    // Entrance with sliding doors
    ctx.fillStyle = '#34495e'; ctx.fillRect(cx - 6, baseY + d - 10, 12, 10)
    ctx.fillStyle = '#1abc9c'; ctx.fillRect(cx - 4, baseY + d - 8, 4, 8); ctx.fillRect(cx + 1, baseY + d - 8, 4, 8)
    
    return Texture.from(c)
  }

  // ────── CINEMA: marquee + screen ──────
  private drawCinema(): Texture {
    const cw = 80, ch = 74
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 32, w = 28, d = 14
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, w + 4, d + 4, 0, 0, Math.PI * 2); ctx.fill()

    // Base podium
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath(); ctx.moveTo(cx - w - 2, baseY); ctx.lineTo(cx, baseY + d + 2); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx - w - 2, baseY - 2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#34495e'
    ctx.beginPath(); ctx.moveTo(cx + w + 2, baseY); ctx.lineTo(cx, baseY + d + 2); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx + w + 2, baseY - 2); ctx.closePath(); ctx.fill()

    // Left wall (dark purple)
    ctx.fillStyle = '#4a1a6b'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY - 2); ctx.lineTo(cx, baseY + d - 2); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#5a2a7b'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY - 2); ctx.lineTo(cx, baseY + d - 2); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    
    // Roof (flat, industrial AC units on top)
    ctx.fillStyle = '#3a0a5b'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 2); ctx.lineTo(cx + w, baseY - h - 2); ctx.lineTo(cx, baseY - d - h + 1); ctx.lineTo(cx - w, baseY - h - 2); ctx.closePath(); ctx.fill()
    // AC unit
    ctx.fillStyle = '#95a5a6'; ctx.fillRect(cx - 4, baseY - h - 8, 8, 6)

    // Grand Marquee sign (bright) projecting outwards
    ctx.fillStyle = '#f1c40f'
    ctx.beginPath(); ctx.moveTo(cx - 18, baseY - h - 6); ctx.lineTo(cx, baseY - h - 2); ctx.lineTo(cx + 18, baseY - h - 6); ctx.lineTo(cx + 18, baseY - h - 14); ctx.lineTo(cx, baseY - h - 10); ctx.lineTo(cx - 18, baseY - h - 14); ctx.fill()
    ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('CINEMA', cx, baseY - h - 6)
    
    // Marquee lights (chasing)
    ctx.fillStyle = '#ff6b6b'
    for (let i = 0; i < 11; i++) { 
        if (i%2===0) {
            ctx.beginPath(); ctx.arc(cx - 16 + i * 3.2, baseY - h - 14 + Math.abs(i-5)*0.5, 1.5, 0, Math.PI * 2); ctx.fill() 
        }
    }
    
    // Giant Movie Poster / Display Screen on facade
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(cx + 4, baseY + d - 22, 14, 18)
    ctx.fillStyle = '#e74c3c'; ctx.font = '3px sans-serif'; ctx.fillText('NOW', cx + 11, baseY + d - 18)
    ctx.fillStyle = 'rgba(255,200,50,0.8)'; ctx.fillRect(cx + 6, baseY + d - 16, 10, 10) // Explosion graphic
    
    // Red Carpet & Entrance
    ctx.fillStyle = '#c0392b'
    ctx.beginPath(); ctx.moveTo(cx - 6, baseY + d); ctx.lineTo(cx, baseY + d + 4); ctx.lineTo(cx + 6, baseY + d); ctx.lineTo(cx, baseY + d - 4); ctx.fill()
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx - 7, baseY + d - 8, 14, 8)
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx - 6, baseY + d - 7, 5, 7); ctx.fillRect(cx + 1, baseY + d - 7, 5, 7)
    
    return Texture.from(c)
  }

  // ────── KINDERGARTEN: colorful building ──────
  private drawKindergarten(): Texture {
    const cw = 76, ch = 65
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 20, w = 26, d = 14
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, w + 4, d + 4, 0, 0, Math.PI * 2); ctx.fill()

    // Left wall (soft pink)
    ctx.fillStyle = '#f8bbd0'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall (soft green)
    ctx.fillStyle = '#c8e6c9'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    
    // Fun colorful blocks added to the side
    ctx.fillStyle = '#ffd54f'
    ctx.beginPath(); ctx.moveTo(cx + w + 2, baseY - 4); ctx.lineTo(cx + w + 8, baseY); ctx.lineTo(cx + w + 8, baseY - 6); ctx.lineTo(cx + w + 2, baseY - 10); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#4fc3f7'
    ctx.beginPath(); ctx.moveTo(cx + w + 2, baseY - 10); ctx.lineTo(cx + w + 8, baseY - 6); ctx.lineTo(cx + w + 8, baseY - 12); ctx.lineTo(cx + w + 2, baseY - 16); ctx.closePath(); ctx.fill()

    // Pitched roof (blue and wavy/playful looking)
    ctx.fillStyle = '#42a5f5'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 12); ctx.lineTo(cx - w - 4, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#64b5f6'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 12); ctx.lineTo(cx + w + 4, baseY - h); ctx.lineTo(cx, baseY + d - h); ctx.closePath(); ctx.fill()
    
    // Roof highlights
    ctx.strokeStyle = '#90caf9'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 12); ctx.lineTo(cx + w, baseY - h - 2); ctx.stroke()

    // Colorful Windows (Playful circular/arched)
    const colors = ['#ffeb3b', '#ff9800', '#4caf50', '#e91e63', '#ab47bc']
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i % colors.length]
      ctx.beginPath(); ctx.arc(cx - w + 6 + i * 8, baseY - h + 8 + i * 3, 3, 0, Math.PI * 2); ctx.fill()
    }
    
    // Safe Playground Fence (Colorful pickets)
    for (let f = 0; f < 8; f++) {
      ctx.strokeStyle = colors[(f+2) % colors.length]; ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(cx - 20 + f * 6, baseY + 6); ctx.lineTo(cx - 20 + f * 6, baseY - 2); ctx.stroke()
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx - 22, baseY + 2); ctx.lineTo(cx + 26, baseY + 2); ctx.stroke()
    
    // Door (Double wide colorful)
    ctx.fillStyle = '#ff7043'; ctx.fillRect(cx - 5, baseY + d - 10, 10, 10)
    ctx.fillStyle = '#81c784'; ctx.fillRect(cx - 4, baseY + d - 8, 4, 8)
    ctx.fillStyle = '#64b5f6'; ctx.fillRect(cx + 1, baseY + d - 8, 4, 8)
    
    return Texture.from(c)
  }

  // ────── RESTAURANT: bistro with chimney ──────
  private drawRestaurant(): Texture {
    const cw = 76, ch = 70
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 28, w = 30, d = 16
    
    // Draw base shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, w + 4, d + 2, 0, 0, Math.PI * 2); ctx.fill()

    // Left wall (warm brown/brick)
    ctx.fillStyle = '#8d6e63'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#a1887f'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w, baseY - h); ctx.closePath(); ctx.fill()
    
    // Brick texture lines
    ctx.strokeStyle = '#795548'; ctx.lineWidth = 0.5
    for(let i = 0; i < h; i += 4) {
      ctx.beginPath(); ctx.moveTo(cx - w, baseY - i); ctx.lineTo(cx, baseY + d - i); ctx.lineTo(cx + w, baseY - i); ctx.stroke()
    }

    // Pitched terracotta roof
    ctx.fillStyle = '#bf360c'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 14); ctx.lineTo(cx - w - 4, baseY - h + 2); ctx.lineTo(cx, baseY + d - h + 2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#d84315'
    ctx.beginPath(); ctx.moveTo(cx, baseY - h - 14); ctx.lineTo(cx + w + 4, baseY - h + 2); ctx.lineTo(cx, baseY + d - h + 2); ctx.closePath(); ctx.fill()
    
    // Chimney with smoke
    ctx.fillStyle = '#5d4037'; ctx.fillRect(cx + w - 8, baseY - h - 20, 6, 12)
    ctx.fillStyle = 'rgba(220,220,220,0.4)'
    ctx.beginPath(); ctx.arc(cx + w - 5, baseY - h - 25, 5, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(cx + w - 2, baseY - h - 32, 7, 0, Math.PI * 2); ctx.fill()
    
    // Striped Awning
    const awningSteps = 6
    for(let a=0; a<awningSteps; a++) {
      ctx.fillStyle = (a % 2 === 0) ? '#c62828' : '#fff'
      const startX = cx - w + (a * (w / awningSteps))
      const endX = cx - w + ((a+1) * (w / awningSteps))
      ctx.beginPath()
      ctx.moveTo(startX, baseY - h + 10 + (a*(d/awningSteps)))
      ctx.lineTo(startX, baseY + d - h + 14 + (a*(d/awningSteps)))
      ctx.lineTo(endX, baseY + d - h + 14 + ((a+1)*(d/awningSteps)))
      ctx.lineTo(endX, baseY - h + 10 + ((a+1)*(d/awningSteps)))
      ctx.fill()
    }

    // Warm inviting Windows
    ctx.fillStyle = '#ffe082'
    ctx.fillRect(cx + 6, baseY + d - 18, 10, 10)
    ctx.fillRect(cx + 20, baseY + d - 24, 6, 10)
    
    // Door
    ctx.fillStyle = '#3e2723'; ctx.fillRect(cx - 6, baseY + d - 12, 8, 12)
    return Texture.from(c)
  }

  // ────── HOTEL: multi-story with entrance canopy ──────
  private drawHotel(): Texture {
    const cw = 70, ch = 130
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 100, w = 24, d = 12, floors = 9, fh = h / floors
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 4, w + 4, d + 2, 0, 0, Math.PI * 2); ctx.fill()
    
    // Base Floor (Marble)
    ctx.fillStyle = '#e8e4d9'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - fh*2); ctx.lineTo(cx - w, baseY - fh*2); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#f4f1ea'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY); ctx.lineTo(cx, baseY + d); ctx.lineTo(cx, baseY + d - fh*2); ctx.lineTo(cx + w, baseY - fh*2); ctx.closePath(); ctx.fill()

    // Left wall (Main Tower - Pale yellow/cream)
    ctx.fillStyle = '#d4c4a8'
    ctx.beginPath(); ctx.moveTo(cx - w + 2, baseY - fh*2); ctx.lineTo(cx, baseY + d - fh*2); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx - w + 2, baseY - h); ctx.closePath(); ctx.fill()
    // Right wall (Main Tower)
    ctx.fillStyle = '#eaddbe'
    ctx.beginPath(); ctx.moveTo(cx + w - 2, baseY - fh*2); ctx.lineTo(cx, baseY + d - fh*2); ctx.lineTo(cx, baseY + d - h); ctx.lineTo(cx + w - 2, baseY - h); ctx.closePath(); ctx.fill()
    
    // Windows Array
    for (let f = 2; f < floors; f++) {
      const fy = baseY - 4 - f * fh
      for (let wi = 0; wi < 3; wi++) {
        const t = (wi + 0.5) / 3
        // Some windows have lights on, some off
        ctx.fillStyle = ((f * 5 + wi) % 7 < 3) ? '#ffeaa7' : '#2d3436'
        ctx.fillRect(cx - w + 4 + t * (w-2), fy - 4 - t * d, 4, 5)
        ctx.fillRect(cx + 2 + t * (w-2), fy - 4 - (1 - t) * d, 4, 5)
      }
    }
    
    // Roof Parapet
    ctx.fillStyle = '#a89f91'
    ctx.beginPath(); ctx.moveTo(cx, baseY + d - h - 3); ctx.lineTo(cx + w - 2, baseY - h - 3); ctx.lineTo(cx, baseY - d - h - 1); ctx.lineTo(cx - w + 2, baseY - h - 3); ctx.closePath(); ctx.fill()
    
    // Entrance canopy (Grand red awning)
    ctx.fillStyle = '#8B0000'
    ctx.beginPath(); ctx.moveTo(cx - 10, baseY + d - 2); ctx.lineTo(cx + 6, baseY + d - 8); ctx.lineTo(cx + 10, baseY + d - 4); ctx.lineTo(cx - 6, baseY + d + 2); ctx.fill()
    
    // Entrance Glass Doors
    ctx.fillStyle = '#81ecec'; ctx.fillRect(cx - 6, baseY + d - 10, 12, 10)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(cx - 6, baseY + d - 10, 12, 10)
    ctx.strokeRect(cx, baseY + d - 10, 0.1, 10)
    
    // Star rating
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 5px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('★★★★★', cx, baseY - h - 8)
    return Texture.from(c)
  }

  // ────── BANK: classical columns + vault ──────
  private drawBank(): Texture {
    const cw = 76, ch = 76
    const c = this.mkCanvas(cw, ch), ctx = c.getContext('2d')!
    const cx = cw / 2, baseY = ch - 12
    const h = 35, w = 30, d = 15
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6, w + 4, d + 4, 0, 0, Math.PI * 2); ctx.fill()

    // Base podium (Dark grey stone)
    const ph = 6
    ctx.fillStyle = '#7f8c8d'
    ctx.beginPath(); ctx.moveTo(cx - w - 2, baseY); ctx.lineTo(cx, baseY + d + 2); ctx.lineTo(cx, baseY + d + 2 - ph); ctx.lineTo(cx - w - 2, baseY - ph); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#95a5a6'
    ctx.beginPath(); ctx.moveTo(cx + w + 2, baseY); ctx.lineTo(cx, baseY + d + 2); ctx.lineTo(cx, baseY + d + 2 - ph); ctx.lineTo(cx + w + 2, baseY - ph); ctx.closePath(); ctx.fill()

    // Left wall (marble grey)
    ctx.fillStyle = '#bdc3c7'
    ctx.beginPath(); ctx.moveTo(cx - w, baseY - ph); ctx.lineTo(cx, baseY + d - ph); ctx.lineTo(cx, baseY + d - ph - h); ctx.lineTo(cx - w, baseY - ph - h); ctx.closePath(); ctx.fill()
    // Right wall
    ctx.fillStyle = '#ecf0f1'
    ctx.beginPath(); ctx.moveTo(cx + w, baseY - ph); ctx.lineTo(cx, baseY + d - ph); ctx.lineTo(cx, baseY + d - ph - h); ctx.lineTo(cx + w, baseY - ph - h); ctx.closePath(); ctx.fill()
    
    // Triangular pediment (Grand roof)
    ctx.fillStyle = '#7f8c8d'
    ctx.beginPath(); ctx.moveTo(cx - w - 4, baseY - ph - h); ctx.lineTo(cx, baseY + d - ph - h); ctx.lineTo(cx, baseY - d - ph - h - 14); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#95a5a6'
    ctx.beginPath(); ctx.moveTo(cx + w + 4, baseY - ph - h); ctx.lineTo(cx, baseY + d - ph - h); ctx.lineTo(cx, baseY - d - ph - h - 14); ctx.closePath(); ctx.fill()
    
    // Pediment details
    ctx.fillStyle = '#2c3e50'
    ctx.beginPath(); ctx.moveTo(cx, baseY - ph - h - 2); ctx.lineTo(cx - w + 2, baseY - ph - h - 7); ctx.lineTo(cx, baseY - d - ph - h - 10); ctx.fill()

    // 3D Columns (front face left and right walls)
    ctx.fillStyle = '#ffffff'
    for (let col = 0; col < 6; col++) {
      const t = (col + 0.5) / 6
      // Let's just put columns on the right facade as it's the "front"
      ctx.fillRect(cx + 2 + t * w, baseY - ph - h + 2 + t * d, 3, h)
      // Add column shading
      ctx.fillStyle = '#ecf0f1'; ctx.fillRect(cx + 4 + t * w, baseY - ph - h + 2 + t * d, 1, h)
      ctx.fillStyle = '#ffffff'
    }
    
    // Heavy Steel Vault Door (Visible on the left facade)
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(cx - w + 8, baseY - ph - 16, 12, 16)
    ctx.fillStyle = '#34495e'; ctx.fillRect(cx - w + 10, baseY - ph - 14, 8, 12)
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx - w + 14, baseY - ph - 8, 4, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(cx - w + 13.5, baseY - ph - 9.5, 3, 3)
    
    // Front Doors (Right Facade)
    ctx.fillStyle = '#8B4513'; ctx.fillRect(cx + 10, baseY + d - ph - 16, 8, 14)

    // Huge GOLDEN $ Symbol on roof
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText('$', cx, baseY - ph - h - 12)
    ctx.strokeStyle = '#d35400'; ctx.lineWidth = 0.5; ctx.strokeText('$', cx, baseY - ph - h - 12)

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
  public getTileTexture(type: TileType, elevation: number = 0): Texture | undefined {
    return this.textures.get(`tile_${type}_${elevation}`) ?? this.createTileTexture(type, elevation)
  }

  /**
   * Get building texture by CATEGORY (FARM, MINE, FACTORY, etc.)
   * This is the primary API — called with BuildingData.type from the DataStore
   */
  public getBuildingTexture(category: string): Texture | undefined {
    // 1. First, attempt to use high-quality external asset
    const externalKey = `ext_building_${category}`
    if (this.textures.has(externalKey)) {
        return this.textures.get(externalKey)
    }

    // 2. Fallback to procedural generation
    const key = `building_${category}`
    if (this.textures.has(key)) return this.textures.get(key)

    // 3. Absolute fallback
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
