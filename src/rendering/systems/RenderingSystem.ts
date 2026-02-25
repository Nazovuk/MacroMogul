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
import { Container, Sprite, Graphics, Rectangle } from 'pixi.js'
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
import { getTileFromNoise, fbm, hash, TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH } from '@/rendering/utils'
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
    this.mapContainer.eventMode = 'static'
    this.mapContainer.hitArea = new Rectangle(-10000, -10000, 20000, 20000)

    this.tileLayer = new Container()
    this.tileLayer.zIndex = 0
    this.tileLayer.sortableChildren = true
    this.mapContainer.addChild(this.tileLayer)

    this.treeLayer = new Container()
    this.treeLayer.zIndex = 500
    this.treeLayer.sortableChildren = true
    this.mapContainer.addChild(this.treeLayer)

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
    this.visuals.forEach(v => v.sprite.destroy())
    this.visuals.clear()
    this.entityLayer.removeChildren()
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

    const canvasH = TILE_HEIGHT + TILE_DEPTH

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
        this.tileTypes[x][y] = tileType

        const texture = TextureManager.getTileTexture(tileType)
        if (!texture) continue

        const sprite = new Sprite(texture)
        const screen = this.mapToScreen(x, y)
        sprite.x = screen.x
        sprite.y = screen.y
        sprite.anchor.set(0.5, (TILE_HEIGHT / 2) / canvasH)
        sprite.zIndex = x + y
        sprite.eventMode = 'static'
        sprite.cursor = 'pointer';
        (sprite as any).mapX = x;
        (sprite as any).mapY = y

        this.tileLayer.addChild(sprite)
        this.tileSprites[x][y] = sprite

        // Trees on forest/grass
        if (tileType === 'forest' || (tileType === 'grass' && hash(x, y, seed + 999) > 0.73)) {
          this.addTreeDecoration(x, y, seed)
        }
      }
    }
    console.log(`[RenderingSystem] Terrain ready: ${width * height} tiles`)
  }

  private addTreeDecoration(x: number, y: number, seed: number) {
    const count = this.tileTypes[x][y] === 'forest' ? 2 + Math.floor(hash(x, y, seed + 111) * 2) : 1
    for (let t = 0; t < count; t++) {
      const variant: 'conifer' | 'leafy' = hash(x + t, y, seed + 222) > 0.5 ? 'conifer' : 'leafy'
      const tex = TextureManager.getTreeTexture(variant)
      if (!tex) continue
      const sp = new Sprite(tex)
      sp.anchor.set(0.5, 1.0)
      const ox = (hash(x, y + t, seed + 333) - 0.5) * 16
      const oy = (hash(x + t, y, seed + 444) - 0.5) * 8
      const screen = this.mapToScreen(x, y)
      sp.x = screen.x + ox
      sp.y = screen.y + oy - 2
      sp.zIndex = x + y + 1
      sp.scale.set(0.7 + hash(x, y, seed + 555 + t) * 0.5)
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
    return this.screenToMap(localPoint.x, localPoint.y)
  }

  // ━━━━ INTERACTION ━━━━

  public highlightTile(x: number, y: number, color: number = 0xFFFFFF) {
    this.highlightLayer.removeChildren()
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return

    const screen = this.mapToScreen(x, y)
    const g = new Graphics()
      .poly([0, -TILE_HEIGHT / 2, TILE_WIDTH / 2, 0, 0, TILE_HEIGHT / 2, -TILE_WIDTH / 2, 0])
      .stroke({ width: 2.5, color, alpha: 0.8 })
      .fill({ color, alpha: 0.15 })
    g.x = screen.x
    g.y = screen.y
    this.highlightLayer.addChild(g)
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
      
      // City buildings cluster
      // Render one large building and potentially some smaller ones around it
      const texture = TextureManager.getBuildingTexture('OFFICE')
      if (texture) {
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5, 0.95)
        sprite.scale.set(1.4)
        container.addChild(sprite)
      }

      // Add City Name Label
      const cityIdx = Position.cityId[entityId] - 1
      const cityData = CITIES[cityIdx]
      const cityName = cityData ? cityData.name : `City ${Position.cityId[entityId]}`
      
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
      label.anchor.set(0.5, 3.8) // Higher above the "main" building
      container.addChild(label)

      this.entityLayer.addChild(container)
      visual = { entityId, sprite: container, screenX: 0, screenY: 0, buildingCategory: 'CITY' }
      this.visuals.set(entityId, visual)
    }

    const mx = Position.x[entityId]
    const my = Position.y[entityId]
    const screen = this.mapToScreen(mx, my)
    visual.sprite.position.set(screen.x, screen.y)
    visual.sprite.zIndex = mx + my + 500 // Cities are visually prioritized
  }

  public update(_dt: number): number[] {
    if (!this.world) return []
    const entities = this.renderableQuery(this.world)
    const currentIds = new Set(entities)

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

    return Array.from(entities)
  }

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
      if (existing) existing.sprite.visible = false
      return
    }

    const mx = Position.x[entityId]
    const my = Position.y[entityId]
    const category = this.resolveBuildingCategory(entityId)

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
      sprite.anchor.set(0.5, 0.92) // Ideal for our isometric perspective

      container.addChild(sprite)
      this.entityLayer.addChild(container)

      const alpha = Renderable.alpha[entityId] || 1.0
      container.alpha = alpha

      visual = { 
        entityId, 
        sprite: container, 
        screenX: 0, 
        screenY: 0, 
        buildingCategory: category 
      }
      this.visuals.set(entityId, visual)
    }

    // Update spatial properties
    const screen = this.mapToScreen(mx, my)
    visual.sprite.visible = true
    visual.sprite.position.set(screen.x, screen.y)
    
    // Z-Ordering for isometric depth
    // Map coords +Y and +X both increase depth. 10 is offset above terrain.
    visual.sprite.zIndex = mx + my + 10

    // Visual feedback for operational status
    if (hasComponent(this.world, BuildingComponent, entityId)) {
        const isOperational = BuildingComponent.isOperational[entityId] === 1
        // Access the sprite inside the container (assuming 1st child is the sprite)
        const renderSprite = visual.sprite.children[0] as Sprite
        if (renderSprite) {
           renderSprite.tint = isOperational ? 0xFFFFFF : 0x555555
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


  private removeEntityVisual(entityId: number) {
    const visual = this.visuals.get(entityId)
    if (visual?.sprite) {
      visual.sprite.destroy()
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
          const screen = this.mapToScreen(x, y)
          this.overlayGraphics
            .poly([screen.x, screen.y - halfH, screen.x + halfW, screen.y, screen.x, screen.y + halfH, screen.x - halfW, screen.y])
            .fill({ color, alpha: value * 0.5 })
        }
      }
    }
  }

  // ━━━━ UTILITY ━━━━

  public reorderByDepth() { /* handled by sortableChildren */ }

  public getTileType(x: number, y: number): TileType | null {
    if (x < 0 || x >= this.mapW || y < 0 || y >= this.mapH) return null
    return this.tileTypes[x]?.[y] ?? null
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

  public destroy() {
    this.visuals.forEach(v => v.sprite.destroy())
    this.visuals.clear()
    this.tileLayer.removeChildren()
    this.treeLayer.removeChildren()
    this.highlightLayer.removeChildren()
    this.overlayContainer.removeChildren()
    this.entityLayer.removeChildren()
    this.mapContainer.removeChildren()
  }
}
