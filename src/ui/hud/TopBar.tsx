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
  onOpenMarket?: () => void;
  onOpenFinance?: () => void;
  onOpenStocks?: () => void;
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
  onOpenMarket,
  onOpenFinance,
  onOpenStocks,
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
              <span className="year">,{gameDate.year}</span>
            </div>
            <div className="date-subtitle">
              {currentCity.toUpperCase()} • <span style={{ color: cycleColor, fontWeight: 'bold' }}>{cycleLabel}</span>
            </div>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="top-section notification-section">
          <button className="notification-btn" title={t('menu.notifications') || 'Notifications'}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            <span className="notification-badge">3</span>
          </button>
        </div>

        {/* Right Section - Speed Controls */}
        <div className="top-section controls-section">
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

          <button className="market-btn" onClick={() => onOpenMarket?.()} disabled={!onOpenMarket} title="Market Intelligence">
             <span>📊 MARKET</span>
           </button>

          <button className="finance-btn" onClick={() => onOpenFinance?.()} disabled={!onOpenFinance} title="Financial Center">
             <span>💰 FINANCE</span>
           </button>

          <button className="stocks-btn" onClick={() => onOpenStocks?.()} disabled={!onOpenStocks} title="Stock Exchange">
             <span>📈 STOCKS</span>
           </button>


          <button className="system-btn" onClick={() => window.dispatchEvent(new CustomEvent('toggleSystemMenu'))}>
             <span>SYSTEM</span>
           </button>
         </div>
      </div>
      
      {/* Decorative Line */}
      <div className="top-bar-accent"></div>
    </header>
  );
}
