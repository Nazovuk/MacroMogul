import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './TopBar.css';
import { getEconomicCycle } from '../../core/ecs/systems/MacroUtils';

interface TopBarProps {
  gameDate: { day: number; month: number; year: number };
  tick: number;
  cash: number;
  companyName?: string;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  currentSpeed: number;
  isPaused: boolean;
  currentCity?: string;
  activePanel: 'none' | 'market' | 'finance' | 'stocks' | 'system' | 'settings';
  onTogglePanel: (panel: 'market' | 'finance' | 'stocks' | 'system' | 'settings') => void;
}

export function TopBar({
  gameDate,
  tick,
  cash,
  companyName = "MacroMogul Corp",
  onPause,
  onSpeedChange,
  currentSpeed,
  isPaused,
  currentCity = "New York",
  activePanel,
  onTogglePanel
}: TopBarProps) {
  const { t } = useTranslation();
  const [displayCash, setDisplayCash] = useState(cash);
  const [cashFlash, setCashFlash] = useState<'none' | 'green' | 'red'>('none');

  // Economic Cycle Status
  const { isRecession, isBoom } = getEconomicCycle(tick);
  let cycleLabel = 'NORMAL';
  let cycleColor = '#fbbf24'; // Yellow
  if (isBoom) { cycleLabel = 'BOOM'; cycleColor = '#10b981'; } // Green
  if (isRecession) { cycleLabel = 'RECESSION'; cycleColor = '#ef4444'; } // Red

  // Animate cash changes
  useEffect(() => {
    const diff = cash - displayCash;
    if (diff !== 0) {
      setCashFlash(diff > 0 ? 'green' : 'red');
      const timer = setTimeout(() => setCashFlash('none'), 500);
      
      // Smooth number animation
      const steps = 20;
      const stepValue = diff / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        setDisplayCash(prev => prev + stepValue);
        if (currentStep >= steps) {
          setDisplayCash(cash);
          clearInterval(interval);
        }
      }, 25);
      
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [cash]);

  const formatCash = (amount: number) => {
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const monthNames = [
    t('months.jan'), t('months.feb'), t('months.mar'), 
    t('months.apr'), t('months.may'), t('months.jun'), 
    t('months.jul'), t('months.aug'), t('months.sep'), 
    t('months.oct'), t('months.nov'), t('months.dec')
  ];

  return (
    <header className="top-bar">
      <div className="top-bar-glass">
        {/* Left Section - Company Info */}
        <div className="top-section company-section">
          <div className="company-logo">
            <div className="logo-pulse"></div>
            <span className="logo-text">MM</span>
          </div>
          <div className="company-info">
            <h1 className="company-name">{companyName}</h1>
            <div className={`cash-display ${cashFlash}`}>
              <span className="cash-label">{t('stats.cash').toUpperCase()}</span>
              <span className="cash-amount">{formatCash(displayCash / 100)}</span>
              {cashFlash === 'green' && <span className="cash-change positive">+</span>}
              {cashFlash === 'red' && <span className="cash-change negative">-</span>}
            </div>
          </div>
        </div>

        {/* Center Section - Date & Time */}
        <div className="top-section date-section">
          <div className="date-display">
            <div className="date-main">
              <span className="month">{monthNames[gameDate.month - 1]}</span>
              <span className="day">{gameDate.day}</span>
              <span className="year">, {gameDate.year}</span>
            </div>
            <div className="date-subtitle">
              {currentCity.toUpperCase()} • <span style={{ color: cycleColor, fontWeight: 'bold' }}>{cycleLabel}</span>
            </div>
          </div>
        </div>

        {/* Right Section - Controls & Panels */}
        <div className="top-section controls-section">
           {/* Panel Toggles */}
           <div className="panel-toggles">
              <button 
                  className={`nav-btn market ${activePanel === 'market' ? 'active' : ''}`} 
                  onClick={() => onTogglePanel('market')}
                  title="Market Intelligence"
              >
                 <span className="icon">📊</span>
                 <span className="label">MARKET</span>
              </button>
              
              <button 
                  className={`nav-btn finance ${activePanel === 'finance' ? 'active' : ''}`} 
                  onClick={() => onTogglePanel('finance')}
                  title="Financial Center"
              >
                 <span className="icon">💰</span>
                 <span className="label">FINANCE</span>
              </button>
              
              <button 
                  className={`nav-btn stocks ${activePanel === 'stocks' ? 'active' : ''}`} 
                  onClick={() => onTogglePanel('stocks')}
                  title="Stock Exchange"
              >
                 <span className="icon">📈</span>
                 <span className="label">STOCKS</span>
              </button>
           </div>
           
           <div className="divider"></div>

          {/* Speed Controls */}
          <div className="speed-controls">
            <button 
              className={`speed-btn ${isPaused ? 'resume' : ''}`}
              onClick={onPause}
              title={isPaused ? "Resume Game" : "Pause Game"}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isPaused ? (
                // PLAY ICON (Show when Paused)
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                // PAUSE ICON (Show when Playing)
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>
            
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                className={`speed-btn ${currentSpeed === speed ? 'active' : ''}`}
                onClick={() => onSpeedChange(speed)}
                title={`${speed}x ${t('actions.speed')}`}
              >
                <span>{speed}x</span>
              </button>
            ))}
          </div>

          <button 
              className={`system-btn ${activePanel === 'system' ? 'active' : ''}`} 
              onClick={() => onTogglePanel('system')}
          >
             <span>SYSTEM</span>
          </button>
         </div>
      </div>
      
      {/* Decorative Line */}
      <div className="top-bar-accent"></div>
    </header>
  );
}
