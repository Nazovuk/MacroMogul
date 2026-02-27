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
        minX: -5000,
        maxX: 5000,
        minY: -5000,
        maxY: 5000,
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
      const deltaX = (currentPos.x - this.lastPointerPosition.x)
      const deltaY = (currentPos.y - this.lastPointerPosition.y)

      // Natural Panning: We move the CAMERA in the OPPOSITE direction of the drag to make the WORLD follow the mouse.
      const worldDeltaX = deltaX / this.zoom
      const worldDeltaY = deltaY / this.zoom

      this.velocity.set(deltaX, deltaY)
      this.targetPosition.x -= worldDeltaX
      this.targetPosition.y -= worldDeltaY

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
      
      const zoomDelta = e.deltaY > 0 ? -this.options.zoomSpeed * this.targetZoom : this.options.zoomSpeed * this.targetZoom
      const newZoom = Math.max(
        this.options.minZoom,
        Math.min(this.options.maxZoom, this.targetZoom + zoomDelta)
      )

      // Zoom towards mouse pointer
      if (newZoom !== this.targetZoom) {
        // Find world coordinates of mouse before zoom
        const mouseWorldBefore = this.screenToWorld(e.clientX, e.clientY)
        
        this.targetZoom = newZoom

        // Find where that world point is after zoom logic (roughly)
        // To keep the world point at the same screen point:
        // ScreenPos = (WorldPos + CamPos) * Zoom + ViewHalf
        // So CamPos = (ScreenPos - ViewHalf) / Zoom - WorldPos
        
        const nextCamX = (e.clientX - this.viewport.width / 2) / newZoom - mouseWorldBefore.x
        const nextCamY = (e.clientY - this.viewport.height / 2) / newZoom - mouseWorldBefore.y
        
        this.targetPosition.x = nextCamX
        this.targetPosition.y = nextCamY
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
    
    // Bounds clamping: targetPosition is the center of the camera in world coordinates
    return new Point(
      Math.max(bounds.minX, Math.min(bounds.maxX, pos.x)),
      Math.max(bounds.minY, Math.min(bounds.maxY, pos.y))
    )
  }

  /**
   * Update camera with smooth interpolation
   */
  update(deltaTime: number = 1/60) {
    // Apply inertia when not dragging
    if (!this.isDragging) {
      this.targetPosition.x -= (this.velocity.x / this.zoom) * 0.1
      this.targetPosition.y -= (this.velocity.y / this.zoom) * 0.1
      
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
