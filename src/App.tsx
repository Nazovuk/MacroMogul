import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  createGameWorld, 
  initializeGameWorld, 
  GameWorld, 
  runSystems, 
  createCity, 
  createAICompany,
  createCompany,
} from './core/ecs/world';
import { TopBar } from './ui/hud/TopBar';
import { StockTicker } from './ui/hud/StockTicker';
import { BottomToolbar } from './ui/hud/BottomToolbar';
import { Dashboard } from './ui/panels/Dashboard';
import { BuildMenu } from './ui/components/BuildMenu';
import { BuildingData } from './core/data/types';
import { MainMenu } from './ui/components/MainMenu';
import { IsometricMap } from './ui/components/IsometricMap';
import { MapOverlayMenu } from './ui/components/MapOverlayMenu';
import { WorldMap } from './ui/components/WorldMap';
import { ScenarioSelect } from './ui/components/ScenarioSelect';
import { FirmDetailPanel } from './ui/components/FirmDetailPanel';
import { SystemMenu } from './ui/components/SystemMenu';
import { MarketDashboard } from './ui/components/MarketDashboard';
import { FinancialDashboard } from './ui/components/FinancialDashboard';
import { StockTrading } from './ui/components/StockTrading';
import { SettingsModal } from './ui/components/SettingsModal';
import { NotificationToast } from './ui/components/NotificationToast';
import { PersistenceService } from './core/services/PersistenceService';
import { CITIES } from './core/data/cities';
import { Building } from './core/ecs/components';
import scenarios from './core/data/scenarios.json';
import './App.css';
import './ui/styles.css';

function App() {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState<'menu' | 'scenario' | 'loading' | 'playing'>('menu');
  const [world, setWorld] = useState<GameWorld | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(1);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showBuildMenu, setShowBuildMenu] = useState(false);
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [currentCityId, setCurrentCityId] = useState<string>('city_01'); // Default start
  const [isTraveling, setIsTraveling] = useState(false);
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [showMarketDashboard, setShowMarketDashboard] = useState(false);
  const [showFinancialDashboard, setShowFinancialDashboard] = useState(false);
  const [showStockTrading, setShowStockTrading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedBuildingToBuild, setSelectedBuildingToBuild] = useState<BuildingData | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);

  const startNewGame = () => {
    setGameState('scenario');
  };

  const startScenario = async (scenarioId: string) => {
    setGameState('loading');
    
    const scenario = scenarios.find(s => s.id === scenarioId);
    const startCash = scenario ? scenario.startCash : 10000000;

    try {
      await new Promise(r => setTimeout(r, 800));

      const newWorld = createGameWorld(12345);
      newWorld.cash = startCash * 100; // Convert dollars to cents
      const success = await initializeGameWorld(newWorld);
      
      if (!success) {
        setError('Failed to initialize game world');
        setGameState('menu');
        return;
      }
      
      // Initialize Cities
      CITIES.forEach((city, index) => {
        const popValue = parseFloat(city.population);
        const population = city.population.includes('M') ? Math.floor(popValue * 1000000) : Math.floor(popValue);
        createCity(newWorld, city.x, city.y, index + 1, population);
      });

      // Initialize Player Company using unified helper
      const playerEntity = createCompany(newWorld, newWorld.cash);
      newWorld.playerEntityId = playerEntity;

      // Initialize AI Rivals
      createAICompany(newWorld, "Global Corp", 5000000);
      createAICompany(newWorld, "Rival Inc", 5000000);

      setWorld(newWorld);
      setGameState('playing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGameState('menu');
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleSpeedChange = (speed: number) => {
    setGameSpeed(speed);
    // Do not auto-resume; let the user explicitly toggle pause
  };

  const handleBuildMenu = () => {
    setShowDashboard(false);
    setShowBuildMenu(!showBuildMenu);
    setSelectedEntityId(null); // Close firm detail panel
  };

  const handleManagement = () => {
    setShowBuildMenu(false);
    setShowDashboard(!showDashboard);
    setSelectedEntityId(null); // Close firm detail panel
  };

  const handleMapOverlay = () => {
    setShowDashboard(false);
    setShowBuildMenu(false);
    setShowOverlayMenu(!showOverlayMenu);
    setSelectedEntityId(null); // Close firm detail panel
  };

  const handleWorldMap = () => {
    setShowDashboard(false);
    setShowBuildMenu(false);
    setShowOverlayMenu(false);
    setShowWorldMap(true);
    setSelectedEntityId(null); // Close firm detail panel
  };
  
  const handleUpgradeBuilding = (entityId: number) => {
    if (!world) return;
    
    const typeId = Building.buildingTypeId[entityId];
    const template = world.dataStore.getBuilding(typeId);
    const currentLevel = Building.level[entityId];
    
    if (!template) return;
    
    const upgradeCost = Math.floor(template.baseCost * Math.pow(1.2, currentLevel - 1));
    
    if (world.cash >= upgradeCost) {
      world.cash -= upgradeCost;
      Building.level[entityId] += 1;
      setWorld({ ...world });
    }
  };

  const handleToggleOperational = (entityId: number) => {
    if (!world) return;
    const current = Building.isOperational[entityId];
    Building.isOperational[entityId] = current === 1 ? 0 : 1;
    setWorld({ ...world });
  };

  const handleSaveGame = (slotName: string) => {
      if (world) {
          PersistenceService.saveGame(world, slotName);
          setShowSystemMenu(false);
          setIsPaused(false);
      }
  };

  const handleLoadGame = async (slotName: string) => {
      setGameState('loading');
      setShowSystemMenu(false);
      try {
          const loadedWorld = await PersistenceService.loadGame(slotName);
          if (loadedWorld) {
              setWorld(loadedWorld);
              setGameState('playing');
              setIsPaused(true); // Pause on load
          } else {
              setError("Failed to load save file.");
          }
      } catch (e) {
          setError("Error loading game.");
      }
  };

  // System Menu Event Listener
  useEffect(() => {
      const handler = () => {
          setShowSystemMenu(true);
          setIsPaused(true);
          setShowDashboard(false);
          setShowBuildMenu(false);
          setShowOverlayMenu(false);
          setShowWorldMap(false);
          setSelectedEntityId(null);
      };
      window.addEventListener('toggleSystemMenu', handler);
      return () => window.removeEventListener('toggleSystemMenu', handler);
  }, []);
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || !world) return;

    const interval = setInterval(() => {
      setWorld(prev => {
        if (!prev) return null;
        const nextWorld = {
          ...prev,
          tick: prev.tick + gameSpeed,
          day: prev.day + gameSpeed > 30 ? 1 : prev.day + gameSpeed,
          month: prev.day + gameSpeed > 30 ? (prev.month + 1 > 12 ? 1 : prev.month + 1) : prev.month,
          year: prev.day + gameSpeed > 30 && prev.month + 1 > 12 ? prev.year + 1 : prev.year,
        };
        runSystems(nextWorld);
        return nextWorld;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, isPaused, gameSpeed, world]);

  if (gameState === 'menu') {
    return (
      <MainMenu
        onNewGame={startNewGame}
        onLoadGame={(slotName: string) => handleLoadGame(slotName)}
        onSettings={() => setShowSettingsModal(true)}
        onExit={() => window.close()}
      />
    );
  }

  if (gameState === 'scenario') {
    return (
      <ScenarioSelect 
        onStartScenario={startScenario}
        onBack={() => setGameState('menu')}
      />
    );
  }

  if (gameState === 'loading' || isTraveling) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <h2>{isTraveling ? `Traveling to ${currentCityId.replace('city_', 'Region ')}...` : 'Loading Game World...'}</h2>
        <p>{isTraveling ? 'Establishing local headquarters...' : 'Initializing ECS architecture'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => setGameState('menu')}>Back to Menu</button>
      </div>
    );
  }

  return (
    <div className="app">
      <NotificationToast />
      <TopBar
        gameDate={{
          day: world?.day || 1,
          month: world?.month || 1,
          year: world?.year || 2024,
        }}
        tick={world?.tick || 0}
        cash={world?.cash || 0}
        onPause={handlePause}
        onSpeedChange={handleSpeedChange}
        currentSpeed={gameSpeed}
        isPaused={isPaused}
        currentCity={CITIES.find(c => c.id === currentCityId)?.name || 'New York'}
        onOpenMarket={() => {
          setShowMarketDashboard(true);
          setSelectedEntityId(null);
        }}
        onOpenFinance={() => {
          setShowFinancialDashboard(true);
          setSelectedEntityId(null);
        }}
        onOpenStocks={() => {
          setShowStockTrading(true);
          setSelectedEntityId(null);
        }}
      />

      {gameState === 'playing' && world && <StockTicker world={world} />}

      <main className="game-area">
        <div className="map-layer">
          {world && (
            <IsometricMap 
              width={1200} 
              height={700} 
              world={world} 
              selectedBuildingToBuild={selectedBuildingToBuild}
              activeOverlay={activeOverlay}
              onPlaced={() => setSelectedBuildingToBuild(null)}
              onSelectEntity={(id) => {
                if (id !== null) {
                  setShowDashboard(false);
                  setShowBuildMenu(false);
                }
                setSelectedEntityId(id);
              }}
            />
          )}
        </div>

        {selectedBuildingToBuild && (
          <div className="build-preview-bar animate-fadeIn">
            <div className="preview-info">
              <span className="preview-label">PLACING:</span>
              <span className="preview-value">{(t(`buildings.${selectedBuildingToBuild.name}`) || selectedBuildingToBuild.name).toUpperCase()}</span>
            </div>
            <button className="cancel-build-btn" onClick={() => setSelectedBuildingToBuild(null)}>
              CANCEL (ESC)
            </button>
          </div>
        )}

        {showDashboard && world && (
          <div className="dashboard-overlay">
            <Dashboard
              products={Array.from(world.dataStore.products.values())}
              buildings={Array.from(world.dataStore.buildings.values())}
              cash={world.cash}
              gameTick={world.tick}
              world={world}
              onUpgradeBuilding={handleUpgradeBuilding}
              activeOverlay={activeOverlay}
              onSetOverlay={setActiveOverlay}
            />
          </div>
        )}

        {showBuildMenu && world && (
          <BuildMenu
            buildings={Array.from(world.dataStore.buildings.values())}
            playerCash={world.cash}
            onSelectBuilding={(building) => {
              setSelectedBuildingToBuild(building);
              setShowBuildMenu(false);
            }}
            onClose={() => setShowBuildMenu(false)}
          />
        )}

        {showOverlayMenu && (
          <MapOverlayMenu
            activeOverlay={activeOverlay}
            onSelectOverlay={setActiveOverlay}
            onClose={() => setShowOverlayMenu(false)}
          />
        )}

        {selectedEntityId !== null && world && (
          <FirmDetailPanel
            entityId={selectedEntityId}
            world={world}
            onClose={() => setSelectedEntityId(null)}
            onUpdate={() => setWorld({ ...world })}
            onUpgrade={handleUpgradeBuilding}
            onToggleOperational={handleToggleOperational}
          />
        )}

        {showWorldMap && world && (
          <WorldMap
             world={world}
             onClose={() => setShowWorldMap(false)}
             onSelectCity={async (cityId) => {
               if (cityId === currentCityId) {
                  setShowWorldMap(false);
                  return;
               }
               
               setIsTraveling(true);
               setShowWorldMap(false);
               
               await new Promise(r => setTimeout(r, 1500));
               
               const targetCityDescriptor = CITIES.find(c => c.id === cityId);
               const seed = targetCityDescriptor ? targetCityDescriptor.seed : 12345;
               
               const newWorld = createGameWorld(seed);
               await initializeGameWorld(newWorld);
               
               setWorld(newWorld);
               setCurrentCityId(cityId);
               setIsTraveling(false);
             }}
             currentCityId={currentCityId}
          />
        )}
      </main>

      <BottomToolbar
        onBuildMenu={handleBuildMenu}
        onManagement={handleManagement}
        onMapOverlay={handleMapOverlay}
        onWorldMap={handleWorldMap}
      />

      {showSystemMenu && (
          <SystemMenu
             onCheckSaveSlots={() => PersistenceService.getAvailableSaves()}
             onSave={handleSaveGame}
             onLoad={handleLoadGame}
             onResume={() => {
                 setShowSystemMenu(false);
                 setIsPaused(false);
             }}
             onExit={() => {
                 setGameState('menu');
                 setShowSystemMenu(false);
                 setWorld(null);
             }}
          />
      )}

      {showMarketDashboard && world && (
          <MarketDashboard
             world={world}
             onClose={() => setShowMarketDashboard(false)}
          />
      )}

      {showFinancialDashboard && world && (
          <FinancialDashboard
             world={world}
             onClose={() => setShowFinancialDashboard(false)}
          />
      )}

      {showStockTrading && world && (
          <StockTrading
             world={world}
             onClose={() => setShowStockTrading(false)}
          />
      )}

      {showSettingsModal && (
          <SettingsModal
             isOpen={showSettingsModal}
             onClose={() => setShowSettingsModal(false)}
             currentSpeed={gameSpeed}
             onSpeedChange={handleSpeedChange}
          />
      )}
    </div>
  );
}

export default App;
