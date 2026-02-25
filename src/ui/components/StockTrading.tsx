import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { Stock as StockComponent, Company, Finances } from '../../core/ecs/components';
import { GameWorld } from '../../core/ecs/world';
import { getTechGapInfo, getRecentEvents, issueShares, buybackShares, setDividend } from '../../core/ecs/systems';
import './StockTrading.css';

interface StockData {
  entityId: number;
  symbol: string;
  name: string;
  price: number;
  prevPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  sector: string;
  pe: number;
  eps: number;
  marketCap: number;
  sharesOutstanding: number;
  dividend: number;
  isPlayer: boolean;
  techGap: number;
  hasTechAlert: boolean;
}


interface StockTradingProps {
  world: GameWorld;
  onClose: () => void;
}

export function StockTrading({ world, onClose }: StockTradingProps) {
  const { t } = useTranslation();
  // Using world.portfolio to sync across open/close of this UI component
  const portfolio = world.portfolio;
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [tradeAmount, setTradeAmount] = useState(100);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'corporate'>('market');
  
  const [corporateActionAmount, setCorporateActionAmount] = useState(10000);
  const [dividendBps, setDividendBps] = useState(0);

  const getSectorLabel = (id: number) => {
    switch(id) {
      case 1: return t('sector.technology');
      case 2: return t('sector.consumer');
      case 3: return t('sector.industrial');
      case 4: return t('sector.finance');
      case 5: return t('sector.energy');
      default: return t('sector.conglomerate');
    }
  };

  const stocks: StockData[] = useMemo(() => {
    const companyQuery = defineQuery([StockComponent, Company, Finances]);
    const entities = companyQuery(world.ecsWorld);

    return entities.map(id => {
      const metadata = world.dataStore.getCompany(id);
      const price = StockComponent.sharePrice[id] || 0;
      const prevPrice = StockComponent.prevSharePrice[id] || price;
      const change = price - prevPrice;
      const changePercent = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
      const sectorId = StockComponent.sector[id] || 0;

      return {
        entityId: id,
        symbol: metadata?.symbol ?? `C${id}`,
        name: metadata?.name ?? `Corporation ${id}`,
        price,
        prevPrice,
        change,
        changePercent,
        volume: StockComponent.volume[id] || 0,
        sector: getSectorLabel(sectorId),
        pe: StockComponent.peRatio[id] || 0,
        eps: StockComponent.earningsPerShare[id] || 0,
        marketCap: Company.marketCap[id] || 0,
        sharesOutstanding: StockComponent.sharesOutstanding[id] || 0,
        dividend: StockComponent.dividend[id] || 0,
        isPlayer: id === world.playerEntityId,
        techGap: getTechGapInfo(world, id, 1).gap, // 1 as default ref
        hasTechAlert: (world.techAlerts.get(id)?.size ?? 0) > 0,
      };
    });
  }, [world.tick, world.ecsWorld, world.playerEntityId, t]);

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      if (a.isPlayer && !b.isPlayer) return -1;
      if (!a.isPlayer && b.isPlayer) return 1;
      return b.marketCap - a.marketCap;
    });
  }, [stocks]);

  const handleTrade = () => {
    if (!selectedStock || tradeAmount <= 0) return;
    const totalCost = Math.floor(selectedStock.price * tradeAmount);

    if (tradeType === 'buy') {
      if (world.cash < totalCost) return;
      world.cash -= totalCost;
      Finances.cash[world.playerEntityId] -= totalCost;

      const existingIndex = world.portfolio.findIndex(h => h.entityId === selectedStock.entityId);
      if (existingIndex > -1) {
        const existing = world.portfolio[existingIndex];
        const newShares = existing.shares + tradeAmount;
        const newCostBasis = Math.floor(((existing.shares * existing.avgCostBasis) + totalCost) / newShares);
        world.portfolio[existingIndex] = { ...existing, shares: newShares, avgCostBasis: newCostBasis };
      } else {
        world.portfolio.push({ entityId: selectedStock.entityId, shares: tradeAmount, avgCostBasis: Math.floor(selectedStock.price) });
      }
    } else {
      const existingIndex = world.portfolio.findIndex(h => h.entityId === selectedStock.entityId);
      if (existingIndex === -1) return;
      
      const holding = world.portfolio[existingIndex];
      if (holding.shares < tradeAmount) return;
      
      world.cash += totalCost;
      Finances.cash[world.playerEntityId] += totalCost;

      const newShares = holding.shares - tradeAmount;
      if (newShares <= 0) {
        world.portfolio.splice(existingIndex, 1);
      } else {
        world.portfolio[existingIndex] = { ...holding, shares: newShares };
      }
    }

    setSelectedStock(null);
    setTradeAmount(100);
  };

  const portfolioStats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;

    for (const holding of portfolio) {
      const stock = stocks.find(s => s.entityId === holding.entityId);
      if (!stock) continue;
      totalValue += stock.price * holding.shares;
      totalCost += holding.avgCostBasis * holding.shares;
    }

    const gain = totalValue - totalCost;
    const gainPercent = totalCost > 0 ? (gain / totalCost) * 100 : 0;

    return { totalValue, totalCost, gain, gainPercent };
  }, [portfolio, stocks]);

  const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatLargeNumber = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
    return `$${dollars.toFixed(0)}`;
  };

  const selectedHolding = selectedStock ? portfolio.find(h => h.entityId === selectedStock.entityId) : null;
  const playerStock = stocks.find(s => s.isPlayer);

  const handleIssueShares = () => {
    if (!playerStock || corporateActionAmount <= 0) return;
    issueShares(world, playerStock.entityId, corporateActionAmount);
    setCorporateActionAmount(10000);
    window.dispatchEvent(new CustomEvent('notification', { 
        detail: { message: `Issued ${corporateActionAmount.toLocaleString()} new shares to the public.`, type: 'info' } 
    }));
  };

  const handleBuybackShares = () => {
    if (!playerStock || corporateActionAmount <= 0) return;
    const success = buybackShares(world, playerStock.entityId, corporateActionAmount);
    if (!success) {
      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: `Insufficient corporate cash for buyback.`, type: 'error' } 
      }));
    } else {
      setCorporateActionAmount(10000);
      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: `Bought back ${corporateActionAmount.toLocaleString()} shares from the public.`, type: 'success' } 
      }));
    }
  };

  const handleSetDividend = () => {
    if (!playerStock) return;
    setDividend(playerStock.entityId, dividendBps);
    window.dispatchEvent(new CustomEvent('notification', { 
        detail: { message: `Dividend yield set to ${(dividendBps / 100).toFixed(2)}%.`, type: 'info' } 
    }));
  };

  return (
    <div className="stock-exchange-overlay">
      <div className="stock-exchange-container">
        {/* Header */}
        <div className="exchange-header">
          <div className="header-title">
            <div className="exchange-icon">📈</div>
            <div>
              <h2>{t('stock.exchange_title')}</h2>
              <span className="exchange-subtitle">{t('world_map.global_economy')}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="summary-label">{t('stock.portfolio_value')}</span>
            <span className="summary-value">{formatPrice(portfolioStats.totalValue)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">{t('stock.total_gain')}</span>
            <span className={`summary-value ${portfolioStats.gain >= 0 ? 'positive' : 'negative'}`}>
              {portfolioStats.gain >= 0 ? '+' : ''}{formatPrice(portfolioStats.gain)} ({portfolioStats.gainPercent.toFixed(2)}%)
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">{t('stock.available_cash')}</span>
            <span className="summary-value cash">{formatPrice(world.cash)}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="exchange-tabs">
          <button 
            className={activeTab === 'market' ? 'active' : ''} 
            onClick={() => setActiveTab('market')}
          >
            {t('stock.market_tab')}
          </button>
          <button 
            className={activeTab === 'portfolio' ? 'active' : ''} 
            onClick={() => setActiveTab('portfolio')}
          >
            {t('stock.portfolio_tab')}
          </button>
          <button 
            className={activeTab === 'corporate' ? 'active' : ''} 
            onClick={() => setActiveTab('corporate')}
          >
            Corporate
          </button>
        </div>

        {/* Content */}
        <div className="exchange-content">
          {activeTab === 'market' && (
            <div className="market-view">
              <div className="stocks-table">
                <div className="table-header">
                  <span>{t('stock.symbol')}</span>
                  <span>{t('stock.price')}</span>
                  <span>{t('stock.change')}</span>
                  <span>{t('stock.tech')}</span>
                  <span>{t('stock.market_cap')}</span>
                </div>
                {sortedStocks.map(stock => (
                  <div
                    key={stock.entityId}
                    className={`stock-row ${selectedStock?.entityId === stock.entityId ? 'selected' : ''} ${stock.isPlayer ? 'player' : ''}`}
                    onClick={() => setSelectedStock(stock)}
                  >
                    <div className="stock-symbol">
                      <span className="symbol">{stock.symbol}</span>
                      {stock.isPlayer && <span className="player-badge">★</span>}
                      <span className="sector">{stock.sector}</span>
                    </div>
                    <span className="price">{formatPrice(stock.price)}</span>
                    <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                      {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                    </span>
                    <span className={`tech-status ${stock.techGap <= -15 ? 'obsolete' : (stock.techGap >= 0 ? 'leader' : 'stable')}`}>
                      {stock.techGap >= 0 ? `+${stock.techGap}` : stock.techGap}
                      {stock.hasTechAlert && <span className="tech-alert-dot" title={t('mainmenu.tech_alert_title')}>!</span>}
                    </span>
                    <span className="market-cap">{formatLargeNumber(stock.marketCap)}</span>
                  </div>
                ))}
              </div>

              {selectedStock && (
                <div className="trade-panel">
                  <div className="panel-header">
                    <h3>{selectedStock.symbol} - {selectedStock.name}</h3>
                    <span className={`price ${selectedStock.change >= 0 ? 'positive' : 'negative'}`}>
                      {formatPrice(selectedStock.price)}
                      <span className="change">({selectedStock.change >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%)</span>
                    </span>
                  </div>
                  
                  <div className="stock-details">
                    <div className="detail">
                      <span className="label">{t('stock.eps')}</span>
                      <span className="value">{formatPrice(selectedStock.eps)}</span>
                    </div>
                    <div className="detail">
                      <span className="label">{t('stock.dividend')}</span>
                      <span className="value">{(selectedStock.dividend / 100).toFixed(2)}%</span>
                    </div>
                    <div className="detail">
                      <span className="label">{t('stock.shares_out')}</span>
                      <span className="value">{(selectedStock.sharesOutstanding / 1_000_000).toFixed(1)}M</span>
                    </div>
                  </div>

                  {selectedHolding && (
                    <div className="holding-info">
                      <span>{t('stock.current_position')}: {selectedHolding.shares.toLocaleString()} {t('stock.shares')}</span>
                      <span>{t('stock.avg_cost')}: {formatPrice(selectedHolding.avgCostBasis)}</span>
                    </div>
                  )}

                  <div className="trade-controls">
                    <div className="trade-type">
                      <button className={tradeType === 'buy' ? 'active' : ''} onClick={() => setTradeType('buy')}>
                        {t('stock.buy')}
                      </button>
                      <button 
                        className={tradeType === 'sell' ? 'active' : ''} 
                        onClick={() => setTradeType('sell')}
                        disabled={!selectedHolding || selectedHolding.shares === 0}
                      >
                        {t('stock.sell')}
                      </button>
                    </div>

                    <div className="trade-input">
                      <label>{t('stock.shares_label')}</label>
                      <input
                        type="number"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                        min="1"
                      />
                    </div>

                    <div className="trade-summary">
                      <div>
                        <span className="label">{t('stock.price_label')}</span>
                        <span className="value">{formatPrice(selectedStock.price)}</span>
                      </div>
                      <div>
                        <span className="label">{t('stock.total_label')}</span>
                        <span className="value">{formatPrice(selectedStock.price * tradeAmount)}</span>
                      </div>
                    </div>

                    <button
                      className={`execute-trade ${tradeType}`}
                      onClick={handleTrade}
                      disabled={
                        (tradeType === 'buy' && world.cash < selectedStock.price * tradeAmount) ||
                        (tradeType === 'sell' && (!selectedHolding || selectedHolding.shares < tradeAmount))
                      }
                    >
                      {tradeType === 'buy' ? t('stock.buy') : t('stock.sell')} {tradeAmount.toLocaleString()} {t('stock.shares').toUpperCase()}
                    </button>
                  </div>

                  {/* Tech News Feed for Selected Stock */}
                  <div className="stock-news-feed">
                    <h4>{t('stock.recent_news')}</h4>
                    <div className="news-scroller">
                      {getRecentEvents().filter(ev => ev.companyId === selectedStock.entityId || !ev.companyId).slice(0, 3).map(ev => (
                        <div key={ev.id} className={`news-item news-type-${ev.type}`}>
                          <span className="news-time">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="news-msg">{ev.message}</span>
                        </div>
                      ))}
                      {getRecentEvents().filter(ev => ev.companyId === selectedStock.entityId || !ev.companyId).length === 0 && (
                        <div className="no-news">{t('stock.no_recent_news')}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="portfolio-view">
              {portfolio.length === 0 ? (
                <div className="empty-portfolio">
                  <span className="empty-icon">📭</span>
                  <span>{t('stock.no_positions')}</span>
                </div>
              ) : (
                <div className="portfolio-list">
                  {portfolio.map(holding => {
                    const stock = stocks.find(s => s.entityId === holding.entityId);
                    if (!stock) return null;
                    const currentValue = stock.price * holding.shares;
                    const costBasis = holding.avgCostBasis * holding.shares;
                    const gain = currentValue - costBasis;
                    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

                    return (
                      <div key={holding.entityId} className="portfolio-item">
                        <div className="item-info">
                          <span className="symbol">{stock.symbol} {stock.isPlayer && '★'}</span>
                          <span className="shares">{holding.shares.toLocaleString()} {t('stock.shares')}</span>
                          <span className="sector">{stock.sector}</span>
                        </div>
                        <div className="item-values">
                          <span className="current">{formatPrice(currentValue)}</span>
                          <span className={`gain ${gain >= 0 ? 'positive' : 'negative'}`}>
                            {gain >= 0 ? '+' : ''}{formatPrice(gain)} ({gainPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'corporate' && playerStock && (
            <div className="corporate-view">
              <div className="corporate-header">
                <h3>{playerStock.symbol} - {playerStock.name} Corporate Finance</h3>
                <div className="company-health-stats">
                  <div className="stat"><span>Market Cap:</span> <span>{formatLargeNumber(playerStock.marketCap)}</span></div>
                  <div className="stat"><span>Shares Out:</span> <span>{playerStock.sharesOutstanding.toLocaleString()}</span></div>
                  <div className="stat"><span>Current Price:</span> <span>{formatPrice(playerStock.price)}</span></div>
                </div>
              </div>

              <div className="corporate-grid">
                <div className="corporate-card">
                  <h4>Equity Market Actions</h4>
                  <p className="corp-desc">Issue new shares to raise capital rapidly, or buy back outstanding shares to increase EPS and reward loyal shareholders.</p>
                  
                  <div className="trade-input" style={{marginBottom: '16px'}}>
                    <label>Amount of Shares</label>
                    <input
                      type="number"
                      value={corporateActionAmount}
                      onChange={(e) => setCorporateActionAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      min="1"
                    />
                  </div>

                  <div className="corporate-action-row">
                    <button className="execute-trade sell" onClick={handleIssueShares}>
                      Issue Shares (+{formatPrice(corporateActionAmount * playerStock.price)})
                    </button>
                    <button className="execute-trade buy" onClick={handleBuybackShares}>
                      Buyback Shares (-{formatPrice(corporateActionAmount * playerStock.price)})
                    </button>
                  </div>
                </div>

                <div className="corporate-card">
                  <h4>Dividend Policy</h4>
                  <p className="corp-desc">Set the annual dividend yield (as a percentage of share price) paid to shareholders monthly. This reduces your cash but strongly supports the share price.</p>
                  
                  <div className="trade-input" style={{marginBottom: '16px'}}>
                    <label>Target Yield (BPS, 100 = 1%)</label>
                    <input
                      type="number"
                      value={dividendBps}
                      onChange={(e) => setDividendBps(Math.min(2000, Math.max(0, parseInt(e.target.value) || 0)))}
                      min="0"
                      max="2000"
                    />
                    <div style={{marginTop: '4px', fontSize: '0.85rem', color: '#94a3b8'}}>
                      Current setting: {(dividendBps / 100).toFixed(2)}%
                    </div>
                  </div>

                  <button className="execute-trade buy" onClick={handleSetDividend} style={{width: '100%'}}>
                    Update Dividend Policy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
