/**
 * Camera Controller
 * Handles smooth panning, zooming, and bounds for the isometric map
 */

import { Container, Point, Rectangle, FederatedPointerEvent } from 'pixi.js'

interface CameraBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface CameraOptions {
  minZoom?: number
  maxZoom?: number
  zoomSpeed?: number
  panSpeed?: number
  inertia?: number
  bounds?: CameraBounds
}

export class CameraController {
  private container: Container
  private viewport: Rectangle
  
  private position: Point = new Point(0, 0)
  private targetPosition: Point = new Point(0, 0)
  private zoom: number = 1
  private targetZoom: number = 1
  
  private isDragging: boolean = false
  private lastPointerPosition: Point = new Point(0, 0)
  private velocity: Point = new Point(0, 0)
  
  private options: Required<CameraOptions>

  constructor(
    container: Container,
    viewport: Rectangle,
    options: CameraOptions = {}
  ) {
    this.container = container
    this.viewport = viewport
    
    this.options = {
      minZoom: options.minZoom ?? 0.5,
      maxZoom: options.maxZoom ?? 3,
      zoomSpeed: options.zoomSpeed ?? 0.1,
      panSpeed: options.panSpeed ?? 1,
      inertia: options.inertia ?? 0.9,
      bounds: options.bounds ?? {
        minX: -2000,
        maxX: 2000,
        minY: -2000,
        maxY: 2000,
      },
    }

    this.setupInteraction()
  }

  private setupInteraction() {
    // Enable interaction
    this.container.eventMode = 'static'
    this.container.cursor = 'grab'

    // Pointer down - start drag
    this.container.on('pointerdown', (e: FederatedPointerEvent) => {
      this.isDragging = true
      this.container.cursor = 'grabbing'
      this.lastPointerPosition = new Point(e.global.x, e.global.y)
      this.velocity.set(0, 0)
    })

    // Pointer move - pan
    this.container.on('pointermove', (e: FederatedPointerEvent) => {
      if (!this.isDragging) return

      const currentPos = new Point(e.global.x, e.global.y)
      const deltaX = (currentPos.x - this.lastPointerPosition.x) * this.options.panSpeed
      const deltaY = (currentPos.y - this.lastPointerPosition.y) * this.options.panSpeed

      this.velocity.set(deltaX, deltaY)
      this.targetPosition.x += deltaX / this.zoom
      this.targetPosition.y += deltaY / this.zoom

      this.lastPointerPosition = currentPos
    })

    // Pointer up - end drag
    this.container.on('pointerup', () => {
      this.isDragging = false
      this.container.cursor = 'grab'
    })

    this.container.on('pointerupoutside', () => {
      this.isDragging = false
      this.container.cursor = 'grab'
    })

    // Wheel - zoom
    this.container.on('wheel', (e: WheelEvent) => {
      e.preventDefault()
      
      const zoomDelta = e.deltaY > 0 ? -this.options.zoomSpeed : this.options.zoomSpeed
      const newZoom = Math.max(
        this.options.minZoom,
        Math.min(this.options.maxZoom, this.targetZoom + zoomDelta)
      )

      // Zoom towards mouse pointer
      if (newZoom !== this.targetZoom) {
        const mouseX = e.offsetX - this.viewport.width / 2
        const mouseY = e.offsetY - this.viewport.height / 2

        // Adjust position to zoom towards mouse
        const zoomRatio = newZoom / this.targetZoom
        this.targetPosition.x += mouseX * (1 - 1 / zoomRatio) / newZoom
        this.targetPosition.y += mouseY * (1 - 1 / zoomRatio) / newZoom
        this.targetZoom = newZoom
      }
    })

    // Disable context menu
    this.container.on('rightdown', (e: FederatedPointerEvent) => {
      e.preventDefault()
    })
  }

  /**
   * Apply bounds to position
   */
  private clampPosition(pos: Point): Point {
    const { bounds } = this.options
    
    // Adjust bounds based on zoom level
    const adjustedMinX = bounds.minX / this.zoom
    const adjustedMaxX = bounds.maxX / this.zoom
    const adjustedMinY = bounds.minY / this.zoom
    const adjustedMaxY = bounds.maxY / this.zoom

    return new Point(
      Math.max(adjustedMinX, Math.min(adjustedMaxX, pos.x)),
      Math.max(adjustedMinY, Math.min(adjustedMaxY, pos.y))
    )
  }

  /**
   * Update camera with smooth interpolation
   */
  update(deltaTime: number = 1/60) {
    // Apply inertia when not dragging
    if (!this.isDragging) {
      this.targetPosition.x += this.velocity.x / this.zoom
      this.targetPosition.y += this.velocity.y / this.zoom
      
      this.velocity.x *= this.options.inertia
      this.velocity.y *= this.options.inertia

      // Stop when velocity is very small
      if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0
      if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0
    }

    // Clamp target position to bounds
    this.targetPosition = this.clampPosition(this.targetPosition)

    // Smooth interpolation (lerp)
    const lerpFactor = 0.15 * deltaTime * 60
    this.position.x += (this.targetPosition.x - this.position.x) * lerpFactor
    this.position.y += (this.targetPosition.y - this.position.y) * lerpFactor
    this.zoom += (this.targetZoom - this.zoom) * lerpFactor

    // Apply to container (Standard Camera: Move world opposite to camera)
    this.container.position.set(
      this.viewport.width / 2 - this.position.x * this.zoom,
      this.viewport.height / 2 - this.position.y * this.zoom
    )
    this.container.scale.set(this.zoom)
  }

  /**
   * Set camera position
   */
  setPosition(x: number, y: number) {
    this.targetPosition.set(x, y)
    this.position.set(x, y)
    this.velocity.set(0, 0)
  }

  /**
   * Set camera zoom
   */
  setZoom(zoom: number) {
    this.targetZoom = Math.max(
      this.options.minZoom,
      Math.min(this.options.maxZoom, zoom)
    )
  }

  /**
   * Focus on a specific world position
   */
  focusOn(worldX: number, worldY: number) {
    this.targetPosition.set(-worldX, -worldY)
  }

  /**
   * Get current camera position
   */
  getPosition(): Point {
    return this.position.clone()
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Point {
    const localX = (screenX - this.viewport.width / 2) / this.zoom - this.position.x
    const localY = (screenY - this.viewport.height / 2) / this.zoom - this.position.y
    return new Point(localX, localY)
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): Point {
    const screenX = (worldX + this.position.x) * this.zoom + this.viewport.width / 2
    const screenY = (worldY + this.position.y) * this.zoom + this.viewport.height / 2
    return new Point(screenX, screenY)
  }

  /**
   * Reset camera to default
   */
  reset() {
    this.targetPosition.set(0, 0)
    this.targetZoom = 1
    this.velocity.set(0, 0)
  }

  /**
   * Get current bounds
   */
  getVisibleBounds(): Rectangle {
    const halfWidth = this.viewport.width / 2 / this.zoom
    const halfHeight = this.viewport.height / 2 / this.zoom
    
    return new Rectangle(
      -this.position.x - halfWidth,
      -this.position.y - halfHeight,
      halfWidth * 2,
      halfHeight * 2
    )
  }
}

export default CameraController
