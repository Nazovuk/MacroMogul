/**
 * useIsometricRenderer Hook
 * React hook that manages the full PixiJS lifecycle:
 * - App init, canvas mount
 * - RenderingSystem + CameraController wiring
 * - Building placement interaction
 * - Overlay toggling
 * - Animation loop
 * - Cleanup on unmount
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Application, Container, Rectangle, Renderer, FederatedPointerEvent } from 'pixi.js'
import { GameWorld, createBuilding } from '../../core/ecs/world'
import { RenderingSystem } from '../systems/RenderingSystem'
import { CameraController } from '../CameraController'
import { TextureManager } from '../TextureManager'
import { addComponent, addEntity, removeEntity } from 'bitecs'
import {
  Position,
  Renderable,
  Isometric,
  EntityType,
  EntityKind,
  Building,
  Inventory,
  Finances,
} from '../../core/ecs/components'
import { BuildingData } from '../../core/data/types'

// ━━━━ TYPES ━━━━

interface UseIsometricRendererOptions {
  width: number
  height: number
  world: GameWorld
  mapWidth?: number
  mapHeight?: number
  selectedBuildingToBuild: BuildingData | null
  activeOverlay: string | null
  roadPlacementMode?: boolean
  onPlaced?: () => void
  onSelectEntity?: (entityId: number | null) => void
}

interface UseIsometricRendererReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  isInitialized: boolean
  renderingSystem: RenderingSystem | null
  camera: CameraController | null
  hoveredEntity: number | null
  mousePosition: { x: number, y: number }
}

// ━━━━ HOOK ━━━━

export function useIsometricRenderer(
  options: UseIsometricRendererOptions
): UseIsometricRendererReturn {
  const {
    width,
    height,
    world,
    mapWidth = 40,
    mapHeight = 40,
    selectedBuildingToBuild,
    activeOverlay,
    roadPlacementMode = false,
    onPlaced,
    onSelectEntity,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const renderingSystemRef = useRef<RenderingSystem | null>(null)
  const cameraRef = useRef<CameraController | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const blueprintEntityRef = useRef<number | null>(null)
  
  // Refs for callbacks to avoid stale closures in PixiJS event handlers
  const createBuildingAtRef = useRef<((x: number, y: number, typeId: number) => number | null) | null>(null)
  const onPlacedRef = useRef(onPlaced)
  const onSelectEntityRef = useRef(onSelectEntity)
  const roadPlacementModeRef = useRef(roadPlacementMode)
  const roadPaintingRef = useRef(false) // true when mouse is down in road mode

  const [isInitialized, setIsInitialized] = useState(false)
  const [hoveredEntity, setHoveredEntity] = useState<number | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // ━━━━ CREATE BUILDING AT MAP COORDS ━━━━
  const createBuildingAt = useCallback(
    (x: number, y: number, typeId: number): number | null => {
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return null

      const buildingData = world.dataStore.getBuilding(typeId)
      if (!buildingData) return null

      // Financial Check: Construction Cost in cents
      const constructionCost = buildingData.baseCost * 100
      const currentCash = Finances.cash[world.playerEntityId]

      if (currentCash < constructionCost) {
        console.warn(`[Construction] Insufficient funds: Need $${buildingData.baseCost}, have $${currentCash / 100}`)
        // Optional: Trigger UI alert?
        return null
      }

      // Use the shared robust createBuilding function
      // for player
      const entity = createBuilding(world, x, y, typeId, 0, world.playerEntityId)
      
      if (entity === undefined) return null

      // Deduct construction cost
      Finances.cash[world.playerEntityId] -= constructionCost
      world.cash -= constructionCost
      
      console.log(`[Construction] Building Type ${typeId} at (${x},${y}) → Entity ${entity}. Cost: $${buildingData.baseCost}`)

      // Auto-assign product for Raw production buildings if not already set
      if (Inventory.productId[entity] === 0) {
        if (buildingData.name.includes("Wheat")) Inventory.productId[entity] = 1
        else if (buildingData.name.includes("Corn")) Inventory.productId[entity] = 2
        else if (buildingData.name.includes("Cotton")) Inventory.productId[entity] = 3
        else if (buildingData.name.includes("Iron")) Inventory.productId[entity] = 4
        else if (buildingData.name.includes("Oil")) Inventory.productId[entity] = 5
        else if (buildingData.name.includes("Timber")) Inventory.productId[entity] = 6
      }

      return entity
    },
    [world, mapWidth, mapHeight],
  )

  // Keep refs up to date
  createBuildingAtRef.current = createBuildingAt
  onPlacedRef.current = onPlaced
  onSelectEntityRef.current = onSelectEntity

  // ━━━━ BLUEPRINT ENTITY LIFECYCLE ━━━━
  useEffect(() => {
    if (!isInitialized || !world) return

    if (selectedBuildingToBuild && blueprintEntityRef.current === null) {
      // Create ghost entity
      const entity = addEntity(world.ecsWorld)
      addComponent(world.ecsWorld, Position, entity)
      addComponent(world.ecsWorld, Renderable, entity)
      addComponent(world.ecsWorld, Isometric, entity)
      addComponent(world.ecsWorld, EntityType, entity)
      addComponent(world.ecsWorld, Building, entity)

      Renderable.spriteId[entity] = selectedBuildingToBuild.id
      Renderable.layer[entity] = 2
      Renderable.visible[entity] = 0
      Renderable.alpha[entity] = 0.5
      Building.buildingTypeId[entity] = selectedBuildingToBuild.id
      EntityType.kind[entity] = EntityKind.Building

      blueprintEntityRef.current = entity

      // Auto-center camera back to map when entering build mode so the user isn't lost in the void
      if (cameraRef.current && renderingSystemRef.current) {
         const centerTile = renderingSystemRef.current.mapToScreen(mapWidth / 2, mapHeight / 2)
         // Check if camera is too far away, and jump. We can just pan it there quickly
         cameraRef.current.setPosition(centerTile.x, centerTile.y)
      }
    } else if (!selectedBuildingToBuild && blueprintEntityRef.current !== null) {
      Renderable.visible[blueprintEntityRef.current] = 0
      blueprintEntityRef.current = null
    } else if (selectedBuildingToBuild && blueprintEntityRef.current !== null) {
      Renderable.spriteId[blueprintEntityRef.current] = selectedBuildingToBuild.id
      Building.buildingTypeId[blueprintEntityRef.current] = selectedBuildingToBuild.id
    }
  }, [selectedBuildingToBuild, isInitialized, world])

  // Sync road placement mode ref
  useEffect(() => {
    roadPlacementModeRef.current = roadPlacementMode
  }, [roadPlacementMode])

  // ━━━━ WORLD SYNC ━━━━
  useEffect(() => {
    if (isInitialized && renderingSystemRef.current && world) {
      renderingSystemRef.current.setWorld(world.ecsWorld, world.dataStore)
    }
  }, [world, isInitialized])

  // ━━━━ OVERLAY SYNC ━━━━
  useEffect(() => {
    renderingSystemRef.current?.setOverlay(activeOverlay)
  }, [activeOverlay, isInitialized])

  // ━━━━ PIXI INITIALIZATION ━━━━
  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    let destroyed = false

    const initPixi = async () => {
      try {
        // 1. Create PixiJS Application
        const app = new Application()
        await app.init({
          width,
          height,
          backgroundColor: 0x0a1628, // Deep dark blue
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          eventMode: 'static',
        })

        if (destroyed) { app.destroy(true); return }

        containerRef.current?.appendChild(app.canvas as HTMLCanvasElement)
        appRef.current = app

        // 2. Texture generation
        await TextureManager.initialize(app.renderer as Renderer, false)

        // 3. Map container (the world that camera moves)
        const mapContainer = new Container()
        app.stage.addChild(mapContainer)

        // Enable stage-level interaction for clicks
        app.stage.eventMode = 'static'
        app.stage.hitArea = app.screen

        // 4. Rendering System
        const renderingSystem = new RenderingSystem(app, world.ecsWorld, mapContainer, world.dataStore)
        renderingSystemRef.current = renderingSystem
        renderingSystem.initializeMap(mapWidth, mapHeight, undefined, world.seed)

        // 5. Camera Controller — expanded for 60×60 map
        const camera = new CameraController(
          mapContainer,
          new Rectangle(0, 0, width, height),
          { minZoom: 0.15, maxZoom: 3.0, zoomSpeed: 0.08, panSpeed: 1.2, inertia: 0.92 },
        )
        cameraRef.current = camera

        // Center on map middle: tile (mapW/2, mapH/2)
        const centerTile = renderingSystem.mapToScreen(mapWidth / 2, mapHeight / 2)
        camera.setPosition(centerTile.x, centerTile.y)
        camera.setZoom(0.45) // Start zoomed out to see the full map

        // 6. Keyboard interaction
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && onPlaced) onPlaced()
        }
        window.addEventListener('keydown', handleKeyDown)

        // 7. Mouse move → update blueprint position, hover state, or paint roads
        app.stage.on('pointermove', (e: FederatedPointerEvent) => {
          setMousePosition({ x: e.global.x, y: e.global.y })
          
          if (!renderingSystemRef.current) return

          const coords = renderingSystemRef.current.getMapCoordinatesAt(e.global.x, e.global.y)
          
          if (coords && coords.x >= 0 && coords.x < mapWidth && coords.y >= 0 && coords.y < mapHeight) {
            // Road painting mode: paint while dragging
            // Footprint Logic: Multi-tile shadowing before placement
            const getName = () => selectedBuildingToBuild?.name.toLowerCase() || ''
            const getFootprintSize = () => {
              if (getName().includes('farm')) return 3.0 // 3x3 tiles
              if (getName().includes('factory')) return 4.0 // 4x4 for factories
              if (getName().includes('mine')) return 3.0 // 3x3 for mines
              if (getName().includes('warehouse')) return 2.0 // 2x2
              return 1.2 // Small buildings
            }
            const size = getFootprintSize()

            if (roadPlacementModeRef.current) {
              renderingSystemRef.current.highlightTile(coords.x, coords.y, 0x888888)
              if (roadPaintingRef.current) {
                renderingSystemRef.current.setTileType(coords.x, coords.y, 'road' as any)
              }
              setHoveredEntity(null)
              return
            }
            
            // Check for hovered building
            const foundId = renderingSystemRef.current.getBuildingAt(coords.x, coords.y)
            setHoveredEntity(foundId)

            if (blueprintEntityRef.current !== null) {
              Position.x[blueprintEntityRef.current] = coords.x
              Position.y[blueprintEntityRef.current] = coords.y
              Renderable.visible[blueprintEntityRef.current] = 1

              // Show full-footprint highlight color based on validity
              const hitBounds = renderingSystemRef.current.canPlaceBuilding(coords.x, coords.y, size, blueprintEntityRef.current)
              renderingSystemRef.current.highlightTile(coords.x, coords.y, hitBounds ? 0x00ffcc : 0xff4444, size)
            }
          } else {
            setHoveredEntity(null)
            if (blueprintEntityRef.current !== null) {
              Renderable.visible[blueprintEntityRef.current] = 0
              renderingSystemRef.current.clearHighlight()
            }
          }
        })

        // 8. Click → place building or select entity
        app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
          if (!renderingSystemRef.current) return

          console.log(`[PointerDown] Global: ${e.global.x},${e.global.y}`);
          const coords = renderingSystemRef.current.getMapCoordinatesAt(e.global.x, e.global.y)
          console.log(`[PointerDown] Map Coords: ${coords.x},${coords.y}`);

          if (!coords || coords.x < 0 || coords.x >= mapWidth || coords.y < 0 || coords.y >= mapHeight) {
            console.log(`[PointerDown] Out of bounds`);
            if (onSelectEntityRef.current) onSelectEntityRef.current(null)
            return
          }

          // Road placement mode
          if (roadPlacementModeRef.current) {
            roadPaintingRef.current = true
            renderingSystemRef.current.setTileType(coords.x, coords.y, 'road' as any)
            return
          }

          if (blueprintEntityRef.current !== null) {
            // PLACEMENT MODE
            const getName = () => selectedBuildingToBuild?.name.toLowerCase() || ''
            const getFootprintSize = () => {
              if (getName().includes('farm')) return 3.0
              if (getName().includes('factory')) return 4.0
              if (getName().includes('mine')) return 3.0
              if (getName().includes('warehouse')) return 2.0
              return 1.2
            }
            
            if (!renderingSystemRef.current.canPlaceBuilding(coords.x, coords.y, getFootprintSize(), blueprintEntityRef.current)) {
              console.warn(`[Placement] Blocked placement at (${coords.x}, ${coords.y}). Terrain invalid or footprint blocked.`)
              return
            }

            const currentTypeId = Renderable.spriteId[blueprintEntityRef.current]
            
            // ⚠️ CRITICAL: Remove blueprint entity BEFORE creating the real building.
            // The blueprint sits at the same tile coordinates → createBuilding()'s
            // overlap check sees it and returns undefined, silently failing.
            const blueprintId = blueprintEntityRef.current
            renderingSystemRef.current.removeEntityVisual(blueprintId)
            removeEntity(world.ecsWorld, blueprintId)
            blueprintEntityRef.current = null
            
            const newEntity = createBuildingAtRef.current?.(coords.x, coords.y, currentTypeId)
            console.log(`[Placement] Created entity ${newEntity} at (${coords.x},${coords.y}) typeId=${currentTypeId}`)
            if (onPlacedRef.current) onPlacedRef.current()
          } else {
            // SELECTION MODE
            // Scan for an entity at these coordinates via the system's spatial index (or robust iteration)
            const foundId = renderingSystemRef.current.getBuildingAt(coords.x, coords.y);
            console.log(`[PointerDown] Found Entity ID: ${foundId}`);
            
            if (foundId !== null) {
              console.log(`[Selection] Hit building ${foundId} at (${coords.x},${coords.y})`)
            } else {
              console.log(`[Selection] No building found at (${coords.x},${coords.y})`);
            }
            
            if (onSelectEntityRef.current) onSelectEntityRef.current(foundId)
          }
        })

        // 9. Pointer Up → Stop road painting
        app.stage.on('pointerup', () => {
          roadPaintingRef.current = false
        })
        app.stage.on('pointerupoutside', () => {
          roadPaintingRef.current = false
        })

        // 10. Animation Loop
        let lastTime = performance.now()
        const animate = (currentTime: number) => {
          if (destroyed) return
          const dt = (currentTime - lastTime) / 1000
          lastTime = currentTime

          camera.update(dt)

          if (renderingSystemRef.current) {
            renderingSystemRef.current.update(dt)
          }

          animationFrameRef.current = requestAnimationFrame(animate)
        }
        animationFrameRef.current = requestAnimationFrame(animate)

        // 10. Resize handler
        const handleResize = () => {
          if (!containerRef.current) return
          const rect = containerRef.current.getBoundingClientRect()
          app.renderer.resize(rect.width, rect.height)
        }
        window.addEventListener('resize', handleResize)

        setIsInitialized(true)

        // Return cleanup function — stored for effect teardown
        return () => {
          destroyed = true
          window.removeEventListener('resize', handleResize)
          window.removeEventListener('keydown', handleKeyDown)
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
          renderingSystem.destroy()
          app.destroy(true)
          appRef.current = null
          renderingSystemRef.current = null
          setIsInitialized(false)
        }
      } catch (error) {
        console.error('[useIsometricRenderer] Init failed:', error)
      }
    }

    const cleanupPromise = initPixi()

    return () => {
      destroyed = true
      cleanupPromise.then(cleanup => cleanup?.())
    }
  }, []) // Single mount — stable deps via refs

  return {
    containerRef,
    isInitialized,
    renderingSystem: renderingSystemRef.current,
    camera: cameraRef.current,
    hoveredEntity,
    mousePosition,
  }
}

export default useIsometricRenderer
