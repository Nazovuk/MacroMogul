import { useTranslation } from 'react-i18next';
import './IsometricMap.css';
import { useIsometricRenderer } from '../../rendering';
import { GameWorld } from '../../core/ecs/world';

import { BuildingData } from '../../core/data/types';

interface IsometricMapProps {
  width?: number;
  height?: number;
  world: GameWorld;
  mapWidth?: number;
  mapHeight?: number;
  selectedBuildingToBuild: BuildingData | null;
  activeOverlay: string | null;
  onPlaced?: () => void;
  onSelectEntity?: (entityId: number | null) => void;
}

export function IsometricMap({ 
  width = 800, 
  height = 600, 
  world,
  mapWidth = 20,
  mapHeight = 20,
  selectedBuildingToBuild,
  activeOverlay,
  onPlaced,
  onSelectEntity
}: IsometricMapProps) {
  const { t } = useTranslation();
  const {
    containerRef,
    isInitialized,
  } = useIsometricRenderer({
    width,
    height,
    world,
    mapWidth,
    mapHeight,
    selectedBuildingToBuild,
    activeOverlay,
    onPlaced,
    onSelectEntity,
  });

  return (
    <div className="isometric-map-container">
      <div ref={containerRef} className="pixi-container" />
      {!isInitialized && (
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>{t('mainmenu.generating_world')}</p>
        </div>
      )}
    </div>
  );
}
