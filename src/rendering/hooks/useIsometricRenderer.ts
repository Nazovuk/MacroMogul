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
import { addComponent, addEntity } from 'bitecs'
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
  onPlaced?: () => void
  onSelectEntity?: (entityId: number | null) => void
}

interface UseIsometricRendererReturn {
  containerRef: React.RefObject<HTMLDivElement | null>
  isInitialized: boolean
  renderingSystem: RenderingSystem | null
  camera: CameraController | null
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
    onPlaced,
    onSelectEntity,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const renderingSystemRef = useRef<RenderingSystem | null>(null)
  const cameraRef = useRef<CameraController | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const blueprintEntityRef = useRef<number | null>(null)

  const [isInitialized, setIsInitialized] = useState(false)

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
    } else if (!selectedBuildingToBuild && blueprintEntityRef.current !== null) {
      Renderable.visible[blueprintEntityRef.current] = 0
      blueprintEntityRef.current = null
    } else if (selectedBuildingToBuild && blueprintEntityRef.current !== null) {
      Renderable.spriteId[blueprintEntityRef.current] = selectedBuildingToBuild.id
      Building.buildingTypeId[blueprintEntityRef.current] = selectedBuildingToBuild.id
    }
  }, [selectedBuildingToBuild, isInitialized, world])

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
        await TextureManager.initialize(app.renderer as Renderer, true)

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

        // 5. Camera Controller
        const camera = new CameraController(
          mapContainer,
          new Rectangle(0, 0, width, height),
          { minZoom: 0.4, maxZoom: 2.5, zoomSpeed: 0.1, panSpeed: 1, inertia: 0.92 },
        )
        cameraRef.current = camera

        // Center on map middle: tile (mapW/2, mapH/2)
        const centerTile = renderingSystem.mapToScreen(mapWidth / 2, mapHeight / 2)
        camera.setPosition(centerTile.x, centerTile.y)
        camera.setZoom(0.7)

        // 6. Keyboard interaction
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && onPlaced) onPlaced()
        }
        window.addEventListener('keydown', handleKeyDown)

        // 7. Mouse move → update blueprint position
        app.stage.on('mousemove', (e: FederatedPointerEvent) => {
          if (blueprintEntityRef.current === null) return
          const coords = renderingSystem.getMapCoordinatesAt(e.global.x, e.global.y)
          if (coords && coords.x >= 0 && coords.x < mapWidth && coords.y >= 0 && coords.y < mapHeight) {
            Position.x[blueprintEntityRef.current] = coords.x
            Position.y[blueprintEntityRef.current] = coords.y
            Renderable.visible[blueprintEntityRef.current] = 1

            // Show highlight
            const tileType = renderingSystem.getTileType(coords.x, coords.y)
            const canBuild = tileType !== null && tileType !== 'water'
            renderingSystem.highlightTile(coords.x, coords.y, canBuild ? 0x00ffcc : 0xff4444)
          } else {
            Renderable.visible[blueprintEntityRef.current] = 0
            renderingSystem.clearHighlight()
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
            if (onSelectEntity) onSelectEntity(null)
            return
          }

          if (blueprintEntityRef.current !== null) {
            // PLACEMENT MODE
            const tileType = renderingSystemRef.current.getTileType(coords.x, coords.y)
            if (tileType === 'water') {
              console.warn(`[Placement] Cannot build on water at (${coords.x}, ${coords.y})`)
              return
            }

            const currentTypeId = Renderable.spriteId[blueprintEntityRef.current]
            createBuildingAt(coords.x, coords.y, currentTypeId)
            if (onPlaced) onPlaced()
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
            
            if (onSelectEntity) onSelectEntity(foundId)
          }
        })

        // 9. Animation loop
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
  }
}

export default useIsometricRenderer
