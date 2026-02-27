/**
 * ECS Rendering System
 * Bridges bitECS world state → PixiJS visualization
 * 
 * Features:
 * - Fractal noise terrain with biome mixing
 * - Isometric tile rendering with 3D depth
 * - Tree decoration on forest/grass tiles
 * - Building rendering by DATA MODEL type (FARM/MINE/FACTORY/RETAIL/WAREHOUSE/OFFICE)
 * - Data overlay rendering
 * - Tile hover/placement highlights
 */

import { defineQuery, IWorld, hasComponent } from 'bitecs'
import { Container, Sprite, Graphics, Rectangle, Texture } from 'pixi.js'
import {
  Position,
  Renderable,
  Isometric,
  Building as BuildingComponent,
  EntityType,
  EntityKind,
} from '../../core/ecs/components'
import { Text, TextStyle } from 'pixi.js'
import { TextureManager } from '../TextureManager'
import { getTileFromNoise, fbm, hash, TILE_WIDTH, TILE_HEIGHT } from '@/rendering/utils'
import type { TileType } from '@/rendering/utils'
// DataStore removed
import type { GameDataStore } from '../../core/data/types'
import { LogisticSupply } from '../../core/ecs/components'
import { CITIES } from '../../core/data/cities'

export type { TileType }

// ━━━━ TYPES ━━━━

export interface EntityVisual {
  entityId: number
  sprite: Container
  shadowSprite?: Sprite // Dynamic shadow mapping
  screenX: number
  screenY: number
  buildingCategory: string | null   // track category to detect changes
}

// ━━━━ UTILS IMPORTED FROM ../utils ━━━━

// ━━━━ RENDERING SYSTEM ━━━━

export class RenderingSystem {
  private world: IWorld
  private dataStore: GameDataStore | null = null
  private mapContainer: Container

  private tileLayer: Container
  private treeLayer: Container
  private shadowLayer: Container // Added
  private cloudLayer: Container  // Added for atmospheric depth
  private highlightLayer: Container
  private overlayContainer: Container
  private entityLayer: Container
  private logisticsLayer: Container
  private logisticsGraphics: Graphics

  private overlayGraphics: Graphics
  private activeOverlay: string | null = null

  private visuals: Map<number, EntityVisual> = new Map()
  private tileSprites: Sprite[][] = []
  private tileTypes: TileType[][] = []

  private mapW: number = 40
  private mapH: number = 40

  private renderableQuery = defineQuery([Position, Renderable, Isometric])

  constructor(
    _app: unknown,
    world: IWorld,
    mapContainer: Container,
    dataStore?: GameDataStore,
  ) {
    this.world = world
    this.dataStore = dataStore ?? null
    this.mapContainer = mapContainer
    this.mapContainer.sortableChildren = true
    this.mapContainer.hitArea = new Rectangle(-10000, -10000, 20000, 20000)

    this.tileLayer = new Container()
    this.tileLayer.zIndex = 0
    this.tileLayer.sortableChildren = true
    this.mapContainer.addChild(this.tileLayer)

    this.treeLayer = new Container()
    this.treeLayer.zIndex = 500
    this.treeLayer.sortableChildren = true
    this.mapContainer.addChild(this.treeLayer)

    this.shadowLayer = new Container() // Added
    this.shadowLayer.zIndex = 1500 // Added, below entities but above trees
    this.mapContainer.addChild(this.shadowLayer) // Added

    this.cloudLayer = new Container()
    this.cloudLayer.zIndex = 5000 // High altitude
    this.cloudLayer.alpha = 0.4
    this.mapContainer.addChild(this.cloudLayer)

    this.overlayContainer = new Container()
    this.overlayContainer.zIndex = 1000
    this.mapContainer.addChild(this.overlayContainer)
    this.overlayGraphics = new Graphics()
    this.overlayContainer.addChild(this.overlayGraphics)

    this.highlightLayer = new Container()
    this.highlightLayer.zIndex = 2000
    this.mapContainer.addChild(this.highlightLayer)

    this.entityLayer = new Container()
    this.entityLayer.zIndex = 3000
    this.entityLayer.sortableChildren = true
    this.mapContainer.addChild(this.entityLayer)

    this.logisticsLayer = new Container()
    this.logisticsLayer.zIndex = 4000
    this.mapContainer.addChild(this.logisticsLayer)
    this.logisticsGraphics = new Graphics()
    this.logisticsLayer.addChild(this.logisticsGraphics)
  }

  public setWorld(ecsWorld: IWorld, dataStore: GameDataStore) {
    if (this.world === ecsWorld && this.dataStore === dataStore) return;
    
    this.world = ecsWorld
    this.dataStore = dataStore
    this.renderableQuery = defineQuery([Position, Renderable, Isometric]) 
    
    // Clear existing visuals for a truly new world
    this.visuals.forEach(v => {
      v.sprite.destroy()
      if (v.shadowSprite) v.shadowSprite.destroy() // Destroy shadow too
    })
    this.visuals.clear()
    this.entityLayer.removeChildren()
    this.shadowLayer.removeChildren() // Clear shadows
  }

  // ━━━━ MAP GENERATION ━━━━

  public initializeMap(
    width: number,
    height: number,
    _tileData?: TileType[][],
    seed: number = 12345,
  ) {
    this.mapW = width
    this.mapH = height
    this.tileLayer.removeChildren()
    this.treeLayer.removeChildren()
    this.tileSprites = []
    this.tileTypes = []

    console.log(`[RenderingSystem] Generating ${width}×${height} terrain (seed: ${seed})...`)


    for (let x = 0; x < width; x++) {
      this.tileSprites[x] = []
      this.tileTypes[x] = []

      for (let y = 0; y < height; y++) {
        const elevation = fbm(x * 0.08, y * 0.08, seed, 4)
        const moisture = fbm(x * 0.1 + 100, y * 0.1 + 100, seed + 7777, 3)
        const urbanNoise = fbm(x * 0.35, y * 0.35, seed + 3333, 2)

        const dx = (x - width / 2) / (width / 2)
        const dy = (y - height / 2) / (height / 2)
        const distFromCenter = Math.sqrt(dx * dx + dy * dy)

        const tileType = getTileFromNoise(elevation, moisture, distFromCenter, urbanNoise)
        
        let finalTileType = tileType
        let nearCity = false
        let closestCityDist = Infinity
        for (const city of CITIES) {
          const cityMapX = Math.floor((city.x / 100) * width)
          const cityMapY = Math.floor((city.y / 100) * height)
          const dist = Math.sqrt((x - cityMapX) ** 2 + (y - cityMapY) ** 2)
          if (dist < closestCityDist) closestCityDist = dist
          
          if (dist < 6 && tileType !== 'water') {
             nearCity = true
             if (dist < 2) finalTileType = 'plaza'
             else finalTileType = 'concrete'
             break
          }
        }
        
        if (!nearCity && closestCityDist < 10 && closestCityDist >= 6 && tileType !== 'water') {
          if (y % 8 === 0) finalTileType = 'road'
        }
        
        this.tileTypes[x][y] = finalTileType

        const elevOffset = finalTileType === 'water' ? 0 : Math.floor(elevation * 40)
        const texture = TextureManager.getTileTexture(finalTileType, elevOffset)
        if (!texture) continue

        const sprite = new Sprite(texture)
        const screen = this.mapToScreen(x, y)
        sprite.x = screen.x
        sprite.y = screen.y - elevOffset
        sprite.anchor.set(0.5, 1.0) 
        // Correct sorting: higher elevations on same tile coordinate drawn later/higher
        sprite.zIndex = (x + y) * 10 + elevOffset;
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        (sprite as any).mapX = x;
        (sprite as any).mapY = y;
        (sprite as any).elevation = elevOffset;

        this.tileLayer.addChild(sprite)
        this.tileSprites[x][y] = sprite

        if (finalTileType === 'forest' || (finalTileType === 'grass' && hash(x, y, seed + 999) > 0.82)) {
          this.addTreeDecoration(x, y, seed, elevOffset)
        }
      }
    }
    console.log(`[RenderingSystem] Terrain ready: ${width * height} tiles`)

    // 4. Initialize Cloud Layer Patterns
    this.cloudLayer.removeChildren()
    for (let i = 0; i < 8; i++) {
        const cloudTexture = this.createCloudTexture()
        const cloud = new Sprite(cloudTexture)
        cloud.x = Math.random() * this.mapW * TILE_WIDTH
        cloud.y = Math.random() * this.mapH * TILE_HEIGHT
        cloud.alpha = 0.15 + Math.random() * 0.2
        cloud.scale.set(2.0 + Math.random() * 2)
        this.cloudLayer.addChild(cloud)
    }
  }

  private createCloudTexture(): Texture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    
    // Smooth blob using radical gradient
    const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grd.addColorStop(0, 'rgba(255,255,255,0.4)')
    grd.addColorStop(0.5, 'rgba(255,255,255,0.1)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
    ctx.fill()
    
    return Texture.from(canvas)
  }

  private addTreeDecoration(x: number, y: number, seed: number, elevOffset: number = 0) {
    const count = this.tileTypes[x][y] === 'forest' ? 1 + Math.floor(hash(x, y, seed + 111)) : 1
    for (let t = 0; t < count; t++) {
      const variant: 'conifer' | 'leafy' = hash(x + t, y, seed + 222) > 0.5 ? 'conifer' : 'leafy'
      const tex = TextureManager.getTreeTexture(variant)
      if (!tex) continue
      const sp = new Sprite(tex)
      sp.anchor.set(0.5, 1.0)
      const ox = (hash(x, y + t, seed + 333) - 0.5) * 10
      const oy = (hash(x + t, y, seed + 444) - 0.5) * 5
      const screen = this.mapToScreen(x, y)
      sp.x = screen.x + ox
      sp.y = screen.y + oy - 2 - elevOffset
      sp.zIndex = (x + y) * 10 + elevOffset + 1
      sp.scale.set(0.5 + hash(x, y, seed + 555 + t) * 0.2)
      this.treeLayer.addChild(sp)
    }
  }

  // ━━━━ COORDINATE CONVERSION ━━━━

  public mapToScreen(mapX: number, mapY: number): { x: number; y: number } {
    return {
      x: (mapX - mapY) * (TILE_WIDTH / 2),
      y: (mapX + mapY) * (TILE_HEIGHT / 2),
    }
  }

  public screenToMap(screenX: number, screenY: number): { x: number; y: number } {
    const halfW = TILE_WIDTH / 2
    const halfH = TILE_HEIGHT / 2
    return {
      x: Math.floor((screenY / halfH + screenX / halfW) / 2),
      y: Math.floor((screenY / halfH - screenX / halfW) / 2),
    }
  }

  public getMapCoordinatesAt(globalX: number, globalY: number): { x: number; y: number } {
    const localPoint = this.mapContainer.toLocal({ x: globalX, y: globalY })
    
    // javidx9 'Height-Slicing' Algorithm
    // We start from the maximum possible elevation and work downwards to see which tile we 'hit'.
    // Max elevation in our system is 40.
    const maxElev = 60;
    
    for (let h = maxElev; h >= 0; h -= 2) {
      const worldX = localPoint.x;
      const worldY = localPoint.y + h; // Adjust for the vertical height slice
      
      const coords = this.screenToMap(worldX, worldY);
      
      if (coords.x >= 0 && coords.x < this.mapW && coords.y >= 0 && coords.y < this.mapH) {
        const actualElev = this.getElevation(coords.x, coords.y);
        // If our slice is at or below the actual elevation of this tile, we've found our hit!
        if (h <= actualElev) {
          return coords;
        }
      }
    }
    
    return this.screenToMap(localPoint.x, localPoint.y)
  }

  // ━━━━ INTERACTION ━━━━

  public highlightTile(x: number, y: number, color: number = 0x00FFCC, size: number = 1) {
    this.highlightLayer.removeChildren()
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return

    const sprite = this.tileSprites[x]?.[y]
    const elev = (sprite as any)?.elevation || 0
    const screen = this.mapToScreen(x, y)
    
    const container = new Container()
    container.x = screen.x
    container.y = screen.y - elev

    const halfW = (TILE_WIDTH / 2) * size
    const halfH = (TILE_HEIGHT / 2) * size

    // 1. Outer Holographic Ring (Thick, low alpha)
    const outer = new Graphics()
      .poly([0, -halfH - 2, halfW + 4, 0, 0, halfH + 2, -halfW - 4, 0])
      .stroke({ width: 4, color, alpha: 0.25 })
    container.addChild(outer)

    // 2. Inner Glow (Filled, pulses)
    const inner = new Graphics()
      .poly([0, -halfH, halfW, 0, 0, halfH, -halfW, 0])
      .fill({ color, alpha: 0.15 })
      .stroke({ width: 2, color, alpha: 0.9 })
    
    // Add a simple pulse animation
    const startTime = Date.now()
    const pulse = () => {
      if (inner.destroyed) return
      const t = (Date.now() - startTime) / 1000
      inner.alpha = 0.6 + Math.sin(t * 8) * 0.2
      requestAnimationFrame(pulse)
    }
    pulse()

    container.addChild(inner)
    
    // 3. Corner Brackets (for that high-tech look)
    const bracketSize = 8
    const brackets = new Graphics()
    // Top corner
    brackets.moveTo(-bracketSize/2, -TILE_HEIGHT/2 - 4).lineTo(0, -TILE_HEIGHT/2 - 6).lineTo(bracketSize/2, -TILE_HEIGHT/2 - 4)
    // Bottom corner
    brackets.moveTo(-bracketSize/2, TILE_HEIGHT/2 + 4).lineTo(0, TILE_HEIGHT/2 + 6).lineTo(bracketSize/2, TILE_HEIGHT/2 + 4)
    brackets.stroke({ width: 2, color, alpha: 1.0 })
    container.addChild(brackets)

    this.highlightLayer.addChild(container)
  }

  public showPlacementGhost(x: number, y: number, _type: string) {
    this.highlightTile(x, y, 0x00FFCC)
  }

  public clearHighlight() {
    this.highlightLayer.removeChildren()
  }

  // ━━━━ ENTITY SYNC ━━━━

  /**
   * Resolve the visual category for a building entity.
   * Uses the DataStore to look up BuildingData.type from the buildingTypeId.
   */
  private resolveBuildingCategory(entityId: number): string {
    if (!hasComponent(this.world, BuildingComponent, entityId)) {
      return 'OFFICE'
    }

    const typeId = BuildingComponent.buildingTypeId[entityId]
    if (this.dataStore) {
      const bd = this.dataStore.getBuilding(typeId)
      if (bd) {
        return bd.type
      }
    }

    return 'OFFICE'
  }

  /**
   * Cities are rendered as clusters of buildings or special skyscrapers.
   */
  private syncCity(entityId: number) {
    if (!hasComponent(this.world, Position, entityId)) return

    let visual = this.visuals.get(entityId)
    if (!visual) {
      const container = new Container()
      container.sortableChildren = true
      
      const cityIdx = Position.cityId[entityId] - 1
      const cityData = CITIES[cityIdx]
      const cityName = cityData ? cityData.name : `City ${Position.cityId[entityId]}`
      const baseSeed = 1000 + cityIdx * 7

      // Procedural City Cluster Generation
      // 1. Center piece — prominent but proportional
      const centerTex = TextureManager.getBuildingTexture('OFFICE')
      if (centerTex) {
        const centerSprite = new Sprite(centerTex)
        centerSprite.anchor.set(0.5, 1.0)
        // Allow up to 4 tiles tall for the main skyscraper
        const maxHeight = TILE_HEIGHT * 4.5 // ~144px
        const heightScale = Math.min(1.0, maxHeight / (centerTex.height || 140))
        centerSprite.scale.set(heightScale)
        centerSprite.zIndex = 1000
        container.addChild(centerSprite)
      }

      // 2. Surrounding urban sprawl — use SHORT building types (RETAIL, RESIDENTIAL, SUPERMARKET)
      const sprawlTypes = ['RESIDENTIAL', 'RETAIL', 'SUPERMARKET', 'WAREHOUSE', 'RETAIL', 'RESIDENTIAL']
      const sprawlCount = 4 + Math.floor(hash(baseSeed, 1, 1) * 3) // 4 to 6
      for (let i = 0; i < sprawlCount; i++) {
        const cat = sprawlTypes[i % sprawlTypes.length]
        const tex = TextureManager.getBuildingTexture(cat)
        
        if (tex) {
           const sp = new Sprite(tex)
           sp.anchor.set(0.5, 1.0)
           
           // Spread within 1.5-tile radius
           const angle = (i / sprawlCount) * Math.PI * 2 + hash(baseSeed, i, 3) * 0.5
           const radius = 1.0 + hash(baseSeed, i, 4) * 1.0
           const mapOffsetX = Math.cos(angle) * radius
           const mapOffsetY = Math.sin(angle) * radius
           
           const screenOff = this.mapToScreen(mapOffsetX, mapOffsetY)
           sp.x = screenOff.x
           sp.y = screenOff.y
           
           // Visible height — up to 3 tiles tall for sprawl
           const maxH = TILE_HEIGHT * 3
           const hScale = Math.min(0.7, maxH / (tex.height || 70))
           sp.scale.set(hScale)
           sp.zIndex = mapOffsetX + mapOffsetY
           
           container.addChild(sp)
        }
      }

      // Add City Name Label
      const style = new TextStyle({
        fontFamily: 'Outfit, Inter, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowBlur: 5,
        dropShadowColor: '#000000',
        dropShadowDistance: 3,
        letterSpacing: 2,
      } as any)
      
      const label = new Text({ text: cityName.toUpperCase(), style })
      label.anchor.set(0.5, 1.5) // Positioned above the building tops
      label.zIndex = 2000 // Topmost label
      container.addChild(label)

      // Add a small light glow under the city center
      const glow = new Graphics().circle(0, 0, 40).fill({ color: 0x3b82f6, alpha: 0.15 })
      glow.zIndex = 1
      container.addChild(glow)

      this.entityLayer.addChild(container)
      visual = { entityId, sprite: container, screenX: 0, screenY: 0, buildingCategory: 'CITY' }
      this.visuals.set(entityId, visual)
    }

    const mx = Position.x[entityId];
    const my = Position.y[entityId];
    const elev = this.getElevation(mx, my);
    const screen = this.mapToScreen(mx, my);
    visual.sprite.visible = true;
    visual.sprite.position.set(screen.x, screen.y - elev);
    visual.sprite.zIndex = mx + my + elev + 500; // Cities are visually prioritized
  }

  private _debugLogThrottle = 0

  public update(_dt: number): number[] {
    if (!this.world) return []
    const entities = this.renderableQuery(this.world)
    const currentIds = new Set(entities)

    // Diagnostic logging (throttled to once per 120 frames ≈ 2s)
    this._debugLogThrottle++
    if (this._debugLogThrottle % 120 === 1) {
      const cityCount = entities.filter((id: number) => EntityType.kind[id] === EntityKind.City).length
      const buildingCount = entities.filter((id: number) => EntityType.kind[id] === EntityKind.Building).length
      console.log(`[RenderingSystem] Frame ${this._debugLogThrottle}: ${entities.length} renderable entities (${cityCount} cities, ${buildingCount} buildings), ${this.visuals.size} sprites`)
    }

    // Remove stale visuals
    for (const [id] of this.visuals) {
      if (!currentIds.has(id)) {
        this.removeEntityVisual(id)
      }
    }

    // Sync active entities
    for (const id of entities) {
      const kind = EntityType.kind[id]
      if (kind === EntityKind.City) {
        this.syncCity(id)
      } else {
        this.syncEntity(id)
      }
    }

    if (this.activeOverlay === 'logistics') {
      this.renderLogisticsFlow()
    } else if (this.logisticsGraphics.visible) {
      this.logisticsGraphics.clear()
      this.logisticsGraphics.visible = false
    }

    // 4. Atmospheric Movement (Clouds)
    this.cloudLayer.children.forEach((c, i) => {
        c.x += 0.2 + (i % 3) * 0.1
        c.y += 0.1
        if (c.x > this.mapW * TILE_WIDTH + 200) c.x = -200
        if (c.y > this.mapH * TILE_HEIGHT + 200) c.y = -200
    })

    return Array.from(entities)
  }

  private _syncedEntitiesLogged = new Set<number>()

  private syncEntity(entityId: number) {
    if (!hasComponent(this.world, Renderable, entityId) ||
        !hasComponent(this.world, Position, entityId)) {
      this.removeEntityVisual(entityId)
      return
    }

    // Handle visibility properly
    const visible = Renderable.visible[entityId]
    if (visible === 0) {
      const existing = this.visuals.get(entityId)
      if (existing) {
        existing.sprite.visible = false
        if (existing.shadowSprite) existing.shadowSprite.visible = false // Hide shadow too
      }
      return
    }

    const mx = Position.x[entityId];
    const my = Position.y[entityId];
    const elev = this.getElevation(mx, my);
    const category = this.resolveBuildingCategory(entityId);
    const kind = EntityType.kind[entityId]; // Get entity kind

    // One-time debug log per entity
    if (!this._syncedEntitiesLogged.has(entityId)) {
      this._syncedEntitiesLogged.add(entityId)
      const screen = this.mapToScreen(mx, my)
      console.log(`[RenderingSystem] NEW ENTITY ${entityId}: category=${category} map=(${mx},${my}) screen=(${screen.x.toFixed(0)},${screen.y.toFixed(0)}) visible=${visible} alpha=${Renderable.alpha[entityId]}`)
    }

    let visual = this.visuals.get(entityId)

    // Detect if architectural category changed (e.g. during drag-build selection)
    if (!visual || visual.buildingCategory !== category) {
      if (visual) {
        this.removeEntityVisual(entityId)
      }

      // Create new premium visual
      const container = new Container()
      const texture = TextureManager.getBuildingTexture(category)
      if (!texture) {
        console.error(`[RenderingSystem] No texture for category: ${category}`)
        return
      }

      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5, 0.9) // Sit on the foundation pad
      
      // --- PREMIUM SCALING (Footprint Fix) ---
      // This MUST match the sizes in useIsometricRenderer.ts
      const getFootprintSize = () => {
        const cat = (category || '').toUpperCase()
        if (cat === 'FARM') return 3.0
        if (cat === 'FACTORY') return 4.0
        if (cat === 'MINE') return 3.0
        if (cat === 'WAREHOUSE') return 2.0
        return 1.2
      }
      const footprintSize = getFootprintSize()
      const desiredWidth = TILE_WIDTH * footprintSize 
      const widthScale = desiredWidth / (texture.width || 256)
      
      // Let it be tall! We want impressive silos.
      sprite.scale.set(widthScale)
      sprite.zIndex = 10

      container.addChild(sprite)
      this.entityLayer.addChild(container)

      const alpha = Renderable.alpha[entityId] || 1.0
      container.alpha = alpha

      let shadowSprite: Sprite | undefined = undefined; // Initialize shadowSprite
      // Add Shadow beneath building
      if (kind === EntityKind.Building) {
          const shadowTex = TextureManager.getTexture('building_shadow')
          if (shadowTex) {
              const shadow = new Sprite(shadowTex)
              shadow.anchor.set(0.5, 0.4) // Center on base
              shadow.alpha = 0.6
              this.shadowLayer.addChild(shadow)
              shadowSprite = shadow; // Assign to shadowSprite
          }
      }

      visual = { 
        entityId, 
        sprite: container, 
        screenX: 0, 
        screenY: 0, 
        buildingCategory: category,
        shadowSprite: shadowSprite // Store shadow sprite in visual
      };
      this.visuals.set(entityId, visual);
    }

    const screen = this.mapToScreen(mx, my);
    visual.sprite.visible = true;
    visual.sprite.position.set(screen.x, screen.y - elev);
    
    // Z-Ordering for isometric depth
    // Map coords +Y and +X both increase depth. 10 is offset above terrain.
    visual.sprite.zIndex = mx + my + elev + 10;

    // Update shadow position and visibility
    if (visual.shadowSprite) {
      visual.shadowSprite.visible = true;
      visual.shadowSprite.position.set(screen.x, screen.y - elev);
      visual.shadowSprite.zIndex = mx + my + elev; // Shadows are below the building
    }

    // Visual feedback for operational status
    if (hasComponent(this.world, BuildingComponent, entityId)) {
        const isOperational = BuildingComponent.isOperational[entityId] === 1
        const renderSprite = visual.sprite.children[0] as Sprite
        if (renderSprite) {
           // Better visual: desaturate and darken when inactive
           if (!isOperational) {
             renderSprite.tint = 0x556677 // Bluish dark grey
             renderSprite.alpha = 0.7
           } else {
             renderSprite.tint = 0xFFFFFF
             renderSprite.alpha = 1.0
           }
        }
    }
  }

  private renderLogisticsFlow() {
    this.logisticsGraphics.clear()
    this.logisticsGraphics.visible = true

    const supplyQuery = defineQuery([LogisticSupply, Position])
    const entities = supplyQuery(this.world)

    for (const destId of entities) {
      if (BuildingComponent.isOperational[destId] === 0) continue

      const sources = [
        LogisticSupply.source1Id[destId],
        LogisticSupply.source2Id[destId],
        LogisticSupply.source3Id[destId]
      ].filter(s => s > 0)

      const destPos = this.mapToScreen(Position.x[destId], Position.y[destId])
      
      for (const srcId of sources) {
        if (!hasComponent(this.world, Position, srcId)) continue
        
        const srcPos = this.mapToScreen(Position.x[srcId], Position.y[srcId])
        
        // Offset lines slightly to not overlap exactly with building centers
        const startX = srcPos.x
        const startY = srcPos.y - 15
        const endX = destPos.x
        const endY = destPos.y - 15

        // Determine line style based on distance (inefficiency indicator)
        const dx = Position.x[destId] - Position.x[srcId]
        const dy = Position.y[destId] - Position.y[srcId]
        const dist = Math.sqrt(dx*dx + dy*dy)
        
        const color = dist > 30 ? 0xff4757 : 0x00d9a5 // Red for long distance, green for local
        const alpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.2 // Pulsing effect

        this.logisticsGraphics.beginPath()
        this.logisticsGraphics.moveTo(startX, startY)
        this.logisticsGraphics.bezierCurveTo(
          startX, startY - 50,
          endX, endY - 50,
          endX, endY
        )
        this.logisticsGraphics.stroke({ width: 2, color, alpha })
        
        // Draw small arrow head or dot moving along the line
        const t = (Date.now() / 2000) % 1.0
        const pt = this.getBezierPoint(startX, startY, startX, startY - 50, endX, endY - 50, endX, endY, t)
        
        this.logisticsGraphics.circle(pt.x, pt.y, 4).fill({ color, alpha: 1.0 })
      }
    }
  }

  private getBezierPoint(x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number, t: number) {
    const invT = (1 - t)
    const invT2 = invT * invT
    const invT3 = invT2 * invT
    const t2 = t * t
    const t3 = t2 * t

    const xt = invT3 * x1 + 3 * invT2 * t * cp1x + 3 * invT * t2 * cp2x + t3 * x2
    const yt = invT3 * y1 + 3 * invT2 * t * cp1y + 3 * invT * t2 * cp2y + t3 * y2

    return { x: xt, y: yt }
  }


  public removeEntityVisual(entityId: number) {
    const visual = this.visuals.get(entityId)
    if (visual?.sprite) {
      visual.sprite.destroy()
      if (visual.shadowSprite) visual.shadowSprite.destroy() // Destroy shadow too
      this.visuals.delete(entityId)
    }
  }

  // ━━━━ DATA OVERLAYS ━━━━

  public setOverlay(type: string | null) {
    if (this.activeOverlay === type) return
    this.activeOverlay = type
    this.renderOverlays()
  }

  private renderOverlays() {
    this.overlayGraphics.clear()
    if (!this.activeOverlay) return

    const halfW = TILE_WIDTH / 2
    const halfH = TILE_HEIGHT / 2

    const getOverlayColor = (t: string): number => {
      switch (t) {
        case 'pollution': return 0xff4757
        case 'traffic': return 0xffa502
        case 'land_value': return 0x2ed573
        case 'sales_volume': return 0x1e90ff
        case 'brand_awareness': return 0xa55eea
        case 'logistics': return 0x00d9a5
        default: return 0xffffff
      }
    }
    const color = getOverlayColor(this.activeOverlay)

    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        let value = 0
        if (this.activeOverlay === 'pollution') {
          const dist = Math.sqrt((x - this.mapW / 2) ** 2 + (y - this.mapH / 2) ** 2)
          value = Math.max(0, 1 - dist / 15)
        } else if (this.activeOverlay === 'land_value') {
          const dist = Math.sqrt((x - this.mapW / 2) ** 2 + (y - this.mapH / 2) ** 2)
          value = Math.max(0, Math.min(1, 0.2 + 0.8 * (1 - dist / 25)))
        } else {
          value = (Math.sin(x * 0.5) + Math.cos(y * 0.5) + 2) / 4
        }

        if (value > 0.1) {
          const elevation = fbm(x * 0.08, y * 0.08, 12345, 4) // Re-calculate or fetch seed
          const tileType = this.getTileType(x, y)
          const elevOffset = tileType === 'water' ? 0 : Math.floor(elevation * 40)
          const screen = this.mapToScreen(x, y)
          const sy = screen.y - elevOffset
          this.overlayGraphics
            .poly([screen.x, sy - halfH, screen.x + halfW, sy, screen.x, sy + halfH, screen.x - halfW, sy])
            .fill({ color, alpha: value * 0.5 })
        }
      }
    }
  }

  // ━━━━ UTILITY ━━━━

  public getElevation(x: number, y: number): number {
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return 0
    return (this.tileSprites[x]?.[y] as any)?.elevation || 0
  }

  public reorderByDepth() { /* handled by sortableChildren */ }

  public getTileType(x: number, y: number): TileType | null {
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return null
    return this.tileTypes[x]?.[y] ?? null
  }

  /** Set tile type at runtime (e.g. road placement). Updates both data + visual. */
  public setTileType(x: number, y: number, type: TileType): boolean {
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return false
    if (this.tileTypes[x][y] === type) return false // no change
    
    this.tileTypes[x][y] = type
    
    // Update the visual sprite
    const elevOffset = this.getElevation(x, y)
    const texture = TextureManager.getTileTexture(type, elevOffset)
    if (texture && this.tileSprites[x]?.[y]) {
      this.tileSprites[x][y].texture = texture
    }
    return true
  }

  public getBuildingAt(mapX: number, mapY: number): number | null {
    // Iterate over tracked visuals to find a building at these coordinates
    // We use the visuals map because it only contains rendered entities
    for (const [entityId, _visual] of this.visuals.entries()) {
      if (!hasComponent(this.world, BuildingComponent, entityId)) continue;
      
      const ex = Position.x[entityId];
      const ey = Position.y[entityId];
      // Fallback to size 1 if not set (or 0)
      const size = BuildingComponent.size[entityId] || 1; 

      if (mapX >= ex && mapX < ex + size &&
          mapY >= ey && mapY < ey + size) {
        return entityId;
      }
    }
    return null;
  }

  public canPlaceBuilding(startX: number, startY: number, size: number, ignoreEntityId?: number): boolean {
    const intSize = Math.ceil(size);
    for (let x = startX; x < startX + intSize; x++) {
      for (let y = startY; y < startY + intSize; y++) {
        // 1. Check bounds
        if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return false;
        
        // 2. Check terrain (e.g., no water)
        const tileType = this.getTileType(x, y);
        if (tileType === 'water') return false;
        
        // 3. Check overlaps with existing buildings
        const hitId = this.getBuildingAt(x, y);
        if (hitId !== null && hitId !== ignoreEntityId) return false;
      }
    }
    return true;
  }

  public destroy() {
    this.visuals.forEach(v => {
      v.sprite.destroy()
      if (v.shadowSprite) v.shadowSprite.destroy() // Destroy shadow too
    })
    this.visuals.clear()
    this.tileLayer.removeChildren()
    this.treeLayer.removeChildren()
    this.shadowLayer.removeChildren() // Clear shadow layer
    this.highlightLayer.removeChildren()
    this.overlayContainer.removeChildren()
    this.entityLayer.removeChildren()
    this.logisticsLayer.removeChildren() // Clear logistics layer
    this.mapContainer.removeChildren()
  }
}
