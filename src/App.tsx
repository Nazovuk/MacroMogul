import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  createGameWorld, 
  initializeGameWorld, 
  GameWorld, 
  runSystems, 
  createCity, 
  createBuilding,
  createAICompany,
  createCompany,
  hireRandomExecutive,
} from './core/ecs/world';
import { Finances } from './core/ecs/components';
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
import { IntelligenceDashboard } from './ui/components/IntelligenceDashboard';
import { SettingsModal } from './ui/components/SettingsModal';
import { NotificationToast } from './ui/components/NotificationToast';
import { LogisticsDashboard } from './ui/components/LogisticsDashboard';
import { HQDashboard } from './ui/components/HQDashboard';
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
  const [showIntelligenceDashboard, setShowIntelligenceDashboard] = useState(false);
  const [showLogisticsDashboard, setShowLogisticsDashboard] = useState(false);
  const [showHQDashboard, setShowHQDashboard] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedBuildingToBuild, setSelectedBuildingToBuild] = useState<BuildingData | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [roadPlacementMode, setRoadPlacementMode] = useState(false);

  const startNewGame = () => {
    setGameState('scenario');
  };

  const startScenario = async (scenarioId: string) => {
    setGameState('loading');
    setError(null);
    
    console.log(`[App] Attempting to start scenario: ${scenarioId}`);
    const scenario = scenarios.find(s => s.id === scenarioId);
    
    if (!scenario) {
      const errorMsg = `Scenario not found: ${scenarioId}`;
      console.error(`[App] ${errorMsg}`);
      setError(errorMsg);
      setGameState('menu');
      return;
    }

    const startCash = scenario.startCash;

    try {
      // Simulate loading for better UX and state synchronization
      await new Promise(r => setTimeout(r, 800));

      console.log(`[App] Creating world for ${scenario.title} (Seed: 12345)`);
      const newWorld = createGameWorld(12345);
      newWorld.cash = startCash * 100; // Convert dollars to cents
      
      console.log(`[App] Initializing game world data stores...`);
      const success = await initializeGameWorld(newWorld);
      
      if (!success) {
        const errorMsg = 'Failed to initialize game world data. Missing files in public/data?';
        console.error(`[App] ${errorMsg}`);
        setError(errorMsg);
        // Do not force menu immediately; error screen will show the message
        return;
      }
      
      console.log(`[App] Populating Cities (${CITIES.length})...`);
      const MAP_W = 60; // Must match IsometricMap mapWidth prop
      const MAP_H = 60; // Must match IsometricMap mapHeight prop
      CITIES.forEach((city, index) => {
        const popValue = parseFloat(city.population);
        const population = city.population.includes('M') ? Math.floor(popValue * 1000000) : Math.floor(popValue);
        // Convert percentage-based coordinates (0-100) to map grid coordinates (0-19)
        const mapX = Math.floor((city.x / 100) * MAP_W);
        const mapY = Math.floor((city.y / 100) * MAP_H);
        console.log(`[App] City ${city.name}: percentage (${city.x},${city.y}) → map tile (${mapX},${mapY})`);
        createCity(newWorld, mapX, mapY, index + 1, population);
      });

      console.log(`[App] Creating Player Company...`);
      const playerEntity = createCompany(newWorld, newWorld.cash);
      newWorld.playerEntityId = playerEntity;

      console.log(`[App] Creating AI Rivals...`);
      createAICompany(newWorld, "Global Corp", 500000000); // 5M USD in cents
      createAICompany(newWorld, "Rival Inc", 500000000); 

      // ── DEBUG: Place test buildings to verify rendering pipeline ──
      // Building type 1 = Wheat Farm, 7 = Flour Mill, 20 = Convenience Store
      const testBuildings = [
        { x: 18, y: 22, typeId: 1, label: 'Wheat Farm' },
        { x: 20, y: 22, typeId: 7, label: 'Flour Mill' },
        { x: 22, y: 22, typeId: 20, label: 'Convenience Store' },
      ];
      for (const tb of testBuildings) {
        const eid = createBuilding(newWorld, tb.x, tb.y, tb.typeId, 0, playerEntity);
        console.log(`[App] TEST BUILDING: ${tb.label} at (${tb.x},${tb.y}) → entity ${eid}`);
      }

      console.log(`[App] Entering PLAYING state.`);
      setWorld(newWorld);
      setGameState('playing');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during game start';
      console.error(`[App] CRITICAL Error starting scenario:`, err);
      setError(errorMsg);
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

  // Banking Events (Loans)
  useEffect(() => {
    const handleRequestLoan = (e: any) => {
      if (!world || world.playerEntityId <= 0) return;
      const pid = world.playerEntityId;
      const amount = e.detail.amount;
      
      const available = Finances.creditLimit[pid] - Finances.debt[pid];
      if (amount <= available) {
        Finances.cash[pid] += amount;
        Finances.debt[pid] += amount;
        world.cash += amount;
        setWorld({ ...world });
        
        window.dispatchEvent(new CustomEvent('notification', { 
            detail: { message: `Approved: ${amount/100}$ loan credited to your account.`, type: 'info' } 
        }));
      } else {
        window.dispatchEvent(new CustomEvent('notification', { 
            detail: { message: `Loan Denied: Credit limit reached.`, type: 'warning' } 
        }));
      }
    };

    const handleRepayLoan = (e: any) => {
      if (!world || world.playerEntityId <= 0) return;
      const pid = world.playerEntityId;
      const amount = e.detail.amount;
      const currentDebt = Finances.debt[pid];
      const actualRepay = Math.min(amount, currentDebt, Finances.cash[pid]);

      if (actualRepay > 0) {
        Finances.cash[pid] -= actualRepay;
        Finances.debt[pid] -= actualRepay;
        world.cash -= actualRepay;
        setWorld({ ...world });
      }
    };

    window.addEventListener('request-loan', handleRequestLoan);
    window.addEventListener('repay-loan', handleRepayLoan);
    
    const handleRecruitExecutive = () => {
      if (!world || world.playerEntityId <= 0) return;
      
      const recruitmentFee = 10000000; // $100k recruitment fee
      if (world.cash >= recruitmentFee) {
        const hire = hireRandomExecutive(world, world.playerEntityId);
        if (hire) {
          world.cash -= recruitmentFee;
          Finances.cash[world.playerEntityId] -= recruitmentFee;
          setWorld({ ...world });
          
          window.dispatchEvent(new CustomEvent('notification', { 
            detail: { message: `Executive recruited! Welcome to the team.`, type: 'success' } 
          }));
        } else {
          window.dispatchEvent(new CustomEvent('notification', { 
            detail: { message: `Executive board is full.`, type: 'warning' } 
          }));
        }
      } else {
        window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: `Insufficient funds for recruitment ($100,000 required).`, type: 'danger' } 
        }));
      }
    };
    
    window.addEventListener('recruit-executive', handleRecruitExecutive);

    return () => {
      window.removeEventListener('request-loan', handleRequestLoan);
      window.removeEventListener('repay-loan', handleRepayLoan);
      window.removeEventListener('recruit-executive', handleRecruitExecutive);
    };
  }, [world]);
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
        onLoadGame={handleLoadGame}
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
        <h2>{isTraveling ? t('mainmenu.traveling_to', { city: currentCityId.replace('city_', 'Region ') }) : t('mainmenu.loading_world')}</h2>
        <p>{isTraveling ? t('mainmenu.establishing_hq') : t('mainmenu.initializing_ecs')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h1>{t('mainmenu.error')}</h1>
        <p>{error}</p>
        <button onClick={() => setGameState('menu')}>{t('mainmenu.back_to_menu')}</button>
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
        onOpenIntelligence={() => {
          setShowIntelligenceDashboard(true);
          setSelectedEntityId(null);
        }}
        onOpenLogistics={() => {
          setShowLogisticsDashboard(true);
          setSelectedEntityId(null);
        }}
        onOpenHQ={() => {
          setShowHQDashboard(true);
          setSelectedEntityId(null);
        }}
      />

      {gameState === 'playing' && world && <StockTicker world={world} />}

      <main className="game-area">
        <div className="map-layer">
          {world && (
            <IsometricMap 
              world={world} 
              selectedBuildingToBuild={selectedBuildingToBuild}
              activeOverlay={activeOverlay}
              roadPlacementMode={roadPlacementMode}
              onPlaced={() => { setSelectedBuildingToBuild(null); setRoadPlacementMode(false); }}
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
              <span className="preview-label">{t('mainmenu.placing')}</span>
              <span className="preview-value">{t(`buildings.${selectedBuildingToBuild.name}`, { defaultValue: selectedBuildingToBuild.name }).toUpperCase()}</span>
            </div>
            <button className="cancel-build-btn" onClick={() => setSelectedBuildingToBuild(null)}>
              {t('mainmenu.cancel_esc')}
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
        onRoadMode={() => {
          setRoadPlacementMode(prev => !prev);
          setSelectedBuildingToBuild(null);
        }}
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
             onUpdate={() => setWorld({ ...world })}
          />
      )}

      {showStockTrading && world && (
          <StockTrading
             world={world}
             onClose={() => setShowStockTrading(false)}
          />
      )}

      {showIntelligenceDashboard && world && (
          <IntelligenceDashboard
             world={world}
             onClose={() => setShowIntelligenceDashboard(false)}
          />
      )}

      {showLogisticsDashboard && world && (
          <LogisticsDashboard
             world={world}
             onClose={() => setShowLogisticsDashboard(false)}
          />
      )}

      {showHQDashboard && world && (
          <HQDashboard
             world={world}
             onClose={() => setShowHQDashboard(false)}
             onUpdate={() => setWorld({ ...world })}
          />
      )}

      {showSettingsModal && (
          <SettingsModal
             isOpen={showSettingsModal}
             onClose={() => setShowSettingsModal(false)}
          />
      )}
    </div>
  );
}

export default App;
