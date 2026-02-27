import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './IsometricMap.css';
import { useIsometricRenderer } from '../../rendering';
import { GameWorld } from '../../core/ecs/world';
import { BuildingData } from '../../core/data/types';
import { 
  Building as BuildingComp, 
  ProductionOutput, 
  Inventory as InventoryComp,
  EntityType as EntityTypeComp,
  EntityKind
} from '../../core/ecs/components';
import { hasComponent } from 'bitecs';

interface IsometricMapProps {
  width?: number;
  height?: number;
  world: GameWorld;
  mapWidth?: number;
  mapHeight?: number;
  selectedBuildingToBuild: BuildingData | null;
  activeOverlay: string | null;
  roadPlacementMode?: boolean;
  onPlaced?: () => void;
  onSelectEntity?: (entityId: number | null) => void;
}

export function IsometricMap({ 
  width, 
  height, 
  world,
  mapWidth = 60,
  mapHeight = 60,
  selectedBuildingToBuild,
  activeOverlay,
  roadPlacementMode = false,
  onPlaced,
  onSelectEntity
}: IsometricMapProps) {
  // Use viewport dimensions for full-screen map coverage
  const canvasWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
  const canvasHeight = height ?? (typeof window !== 'undefined' ? window.innerHeight : 800)
  const { t } = useTranslation();
  const {
    containerRef,
    isInitialized,
    renderingSystem,
    camera,
    hoveredEntity,
    mousePosition
  } = useIsometricRenderer({
    width: canvasWidth,
    height: canvasHeight,
    world,
    mapWidth,
    mapHeight,
    selectedBuildingToBuild,
    activeOverlay,
    roadPlacementMode,
    onPlaced,
    onSelectEntity,
  });

  // Tooltip Helper
  const renderTooltip = () => {
    if (!hoveredEntity || !world) return null;
    
    // Safety check for city entities (id 500+ usually, or check kind)
    const kind = hasComponent(world.ecsWorld, EntityTypeComp, hoveredEntity) ? EntityTypeComp.kind[hoveredEntity] : 0;
    if (kind === EntityKind.City) return null;

    const buildingTypeId = BuildingComp.buildingTypeId[hoveredEntity];
    const bData = world.dataStore.getBuilding(buildingTypeId);
    if (!bData) return null;

    const isOperational = BuildingComp.isOperational[hoveredEntity] === 1;
    const output = hasComponent(world.ecsWorld, ProductionOutput, hoveredEntity) ? ProductionOutput.actualOutput[hoveredEntity] : 0;
    const inventory = hasComponent(world.ecsWorld, InventoryComp, hoveredEntity) ? InventoryComp.currentAmount[hoveredEntity] : 0;
    const capacity = hasComponent(world.ecsWorld, InventoryComp, hoveredEntity) ? InventoryComp.capacity[hoveredEntity] : 0;

    return (
      <div 
        className="map-tooltip glass-card"
        style={{
          position: 'fixed',
          left: mousePosition.x + 20,
          top: mousePosition.y - 20,
          zIndex: 1000,
          pointerEvents: 'none',
          padding: '12px',
          minWidth: '180px',
          borderLeft: `4px solid ${isOperational ? '#00d9a5' : '#ff4757'}`
        }}
      >
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {bData.type}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0', color: 'white' }}>
          {bData.name}
        </div>
        
        <div className="tooltip-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
          <div className="stat">
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>DURUM</div>
            <div style={{ color: isOperational ? '#00d9a5' : '#ff4757', fontWeight: '600', fontSize: '13px' }}>
              {isOperational ? 'AKTİF' : 'DURDU'}
            </div>
          </div>
          {output > 0 && (
            <div className="stat">
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>ÜRETİM</div>
              <div style={{ color: '#fff', fontWeight: '600', fontSize: '13px' }}>
                {output.toFixed(1)}/ay
              </div>
            </div>
          )}
          {capacity > 0 && (
            <div className="stat" style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>STOK DOLULUK</div>
              <div className="demand-bar" style={{ height: '4px', marginTop: '4px' }}>
                <div 
                  className="demand-fill high" 
                  style={{ width: `${(inventory / capacity) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleCenterCamera = () => {
    if (camera && isInitialized && renderingSystem) {
      // Re-center logic sets camera position back to the mathematical center of the map bounds
      const centerTile = renderingSystem.mapToScreen(mapWidth / 2, mapHeight / 2)
      camera.setPosition(centerTile.x, centerTile.y)
      camera.setZoom(0.45)
    }
  }

  // Minimap: create a small canvas showing the full map overview
  const minimapRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!isInitialized || !renderingSystem || !minimapRef.current) return;
    const mmCtx = minimapRef.current.getContext('2d');
    if (!mmCtx) return;
    
    const mmW = 180, mmH = 120;
    minimapRef.current.width = mmW;
    minimapRef.current.height = mmH;
    
    const tileW = mmW / mapWidth;
    const tileH = mmH / mapHeight;
    
    // Draw minimap tiles
    for (let x = 0; x < mapWidth; x++) {
      for (let y = 0; y < mapHeight; y++) {
        const tileType = renderingSystem.getTileType(x, y);
        if (!tileType) continue;
        const colors: Record<string, string> = {
          grass: '#4CAF50', forest: '#2E7D32', water: '#1E88E5', 
          sand: '#FFD54F', dirt: '#8D6E63', concrete: '#9E9E9E', 
          plaza: '#CFD8DC', road: '#616161'
        };
        mmCtx.fillStyle = colors[tileType] || '#4CAF50';
        mmCtx.fillRect(x * tileW, y * tileH, tileW + 0.5, tileH + 0.5);
      }
    }
    
    // Mark cities
    mmCtx.fillStyle = '#FF5722';
    mmCtx.font = 'bold 7px sans-serif';
    mmCtx.textAlign = 'center';
    const CITIES_DATA = [
      { name: 'NY', x: 28, y: 35 }, { name: 'LN', x: 48, y: 27 },
      { name: 'TK', x: 82, y: 36 }, { name: 'SH', x: 78, y: 38 },
      { name: 'PR', x: 49, y: 30 }, { name: 'SY', x: 88, y: 75 },
      { name: 'SG', x: 74, y: 56 }, { name: 'DB', x: 58, y: 42 },
    ];
    for (const c of CITIES_DATA) {
      const cx = (c.x / 100) * mapWidth * tileW;
      const cy = (c.y / 100) * mapHeight * tileH;
      mmCtx.beginPath();
      mmCtx.arc(cx, cy, 3, 0, Math.PI * 2);
      mmCtx.fill();
      mmCtx.fillStyle = '#FFFFFF';
      mmCtx.fillText(c.name, cx, cy - 5);
      mmCtx.fillStyle = '#FF5722';
    }
  }, [isInitialized, renderingSystem, mapWidth, mapHeight]);

  // City jump handler
  const jumpToCity = (cityPercentX: number, cityPercentY: number) => {
    if (!camera || !renderingSystem) return;
    const mapX = Math.floor((cityPercentX / 100) * mapWidth);
    const mapY = Math.floor((cityPercentY / 100) * mapHeight);
    const screen = renderingSystem.mapToScreen(mapX, mapY);
    camera.setPosition(screen.x, screen.y);
    camera.setZoom(1.2);
  };

  return (
    <div className="isometric-map-container">
      <div ref={containerRef} className="pixi-container" />
      {renderTooltip()}
      {!isInitialized && (
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>{t('mainmenu.generating_world')}</p>
        </div>
      )}
      
      {/* ── MINIMAP (Capitalism Lab style, top-right corner) ── */}
      {isInitialized && (
        <div style={{
          position: 'absolute', top: '80px', right: '16px', zIndex: 9999,
          background: 'rgba(10,22,40,0.92)', border: '2px solid rgba(52,152,219,0.5)',
          borderRadius: '8px', padding: '6px', backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '9px', color: '#3498db', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', textAlign: 'center', fontWeight: 'bold' }}>
            Minimap
          </div>
          <canvas ref={minimapRef} style={{ display: 'block', width: '180px', height: '120px', borderRadius: '4px', cursor: 'pointer' }} 
            onClick={(e) => {
              if (!camera || !renderingSystem) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const px = (e.clientX - rect.left) / rect.width;
              const py = (e.clientY - rect.top) / rect.height;
              const mapX = px * mapWidth;
              const mapY = py * mapHeight;
              const screen = renderingSystem.mapToScreen(mapX, mapY);
              camera.setPosition(screen.x, screen.y);
            }}
          />
          {/* City quick-jump buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '6px', justifyContent: 'center' }}>
            {[
              { name: 'NY', x: 28, y: 35, color: '#e74c3c' },
              { name: 'LN', x: 48, y: 27, color: '#3498db' },
              { name: 'TK', x: 82, y: 36, color: '#e91e63' },
              { name: 'PR', x: 49, y: 30, color: '#9b59b6' },
              { name: 'SG', x: 74, y: 56, color: '#2ecc71' },
              { name: 'DB', x: 58, y: 42, color: '#f39c12' },
            ].map(c => (
              <button key={c.name} onClick={() => jumpToCity(c.x, c.y)} style={{
                fontSize: '8px', padding: '2px 5px', background: c.color + '33',
                color: c.color, border: `1px solid ${c.color}55`, borderRadius: '3px',
                cursor: 'pointer', fontWeight: 'bold', letterSpacing: '0.5px'
              }}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── COORDINATE DISPLAY ── */}
      {isInitialized && hoveredEntity === null && (
        <div style={{
          position: 'absolute', bottom: '140px', left: '16px', zIndex: 9999,
          background: 'rgba(10,22,40,0.8)', borderRadius: '6px', padding: '6px 12px',
          color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontFamily: 'monospace',
          border: '1px solid rgba(52,152,219,0.3)'
        }}>
          🗺️ Map: {mapWidth}×{mapHeight}
        </div>
      )}

      {/* ── CENTER MAP BUTTON ── */}
      {isInitialized && (
        <div style={{ position: 'absolute', bottom: '140px', right: '16px', zIndex: 9999 }}>
          <button 
            onClick={handleCenterCamera}
            style={{
              padding: '10px 16px', backgroundColor: '#1a2639', color: '#3498db',
              border: '2px solid #3498db', borderRadius: '10px', cursor: 'pointer',
              fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#3498db'; e.currentTarget.style.color = 'white'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#1a2639'; e.currentTarget.style.color = '#3498db'; }}
          >
            🎯 {t('actions.center_map', { defaultValue: 'MERKEZE ODAKLA' })}
          </button>
        </div>
      )}
    </div>
  );
}
