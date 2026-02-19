import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { Stock as StockComponent, Company, Finances } from '../../core/ecs/components';
import { GameWorld } from '../../core/ecs/world';
import './StockTrading.css';

/**
 * StockTrading — Full stock exchange UI driven by ECS data.
 *
 * Reads live prices from StockMarketSystem via Stock/Company/Finances components.
 * Player can buy/sell shares of any listed company, including competitors.
 * Trades deduct/credit world.cash and the player's Finances.cash.
 */

// Sector label lookup (mirrors StockMarketSystem.SECTOR_PE)
const SECTOR_LABELS: Record<number, string> = {
  0: 'Conglomerate',
  1: 'Technology',
  2: 'Consumer',
  3: 'Industrial',
  4: 'Finance',
  5: 'Energy',
};

interface StockData {
  entityId: number;
  symbol: string;
  name: string;
  price: number;       // In cents
  prevPrice: number;   // Previous month price (cents)
  change: number;      // Price delta (cents)
  changePercent: number;
  volume: number;
  sector: string;
  pe: number;
  eps: number;
  marketCap: number;
  sharesOutstanding: number;
  dividend: number;    // Basis points
  isPlayer: boolean;
}

interface PortfolioHolding {
  entityId: number;
  shares: number;
  avgCostBasis: number; // Cents per share at purchase
}

interface StockTradingProps {
  world: GameWorld;
  onClose: () => void;
}

export function StockTrading({ world, onClose }: StockTradingProps) {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<PortfolioHolding[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [tradeAmount, setTradeAmount] = useState(100);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio'>('market');

  // ═══════════════════════════════════════════════════════════════════════
  //  READ LIVE STOCK DATA FROM ECS
  // ═══════════════════════════════════════════════════════════════════════
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
        sector: SECTOR_LABELS[sectorId] || 'Conglomerate',
        pe: StockComponent.peRatio[id] || 0,
        eps: StockComponent.earningsPerShare[id] || 0,
        marketCap: Company.marketCap[id] || 0,
        sharesOutstanding: StockComponent.sharesOutstanding[id] || 0,
        dividend: StockComponent.dividend[id] || 0,
        isPlayer: id === world.playerEntityId,
      };
    });
    // Re-derive every tick (world.tick changes trigger re-render from parent)
  }, [world.tick, world.ecsWorld, world.playerEntityId, world.dataStore]);

  // Sort: player company first, then by market cap descending
  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      if (a.isPlayer && !b.isPlayer) return -1;
      if (!a.isPlayer && b.isPlayer) return 1;
      return b.marketCap - a.marketCap;
    });
  }, [stocks]);

  // ═══════════════════════════════════════════════════════════════════════
  //  TRADE EXECUTION
  // ═══════════════════════════════════════════════════════════════════════
  const handleTrade = () => {
    if (!selectedStock || tradeAmount <= 0) return;

    const totalCostCents = Math.floor(selectedStock.price * tradeAmount);

    if (tradeType === 'buy') {
      if (world.cash < totalCostCents) return; // Insufficient funds

      // Deduct from player
      world.cash -= totalCostCents;
      Finances.cash[world.playerEntityId] -= totalCostCents;

      // Update portfolio
      setPortfolio(prev => {
        const existing = prev.find(h => h.entityId === selectedStock.entityId);
        if (existing) {
          const newShares = existing.shares + tradeAmount;
          const newCostBasis = Math.floor(
            ((existing.shares * existing.avgCostBasis) + totalCostCents) / newShares
          );
          return prev.map(h =>
            h.entityId === selectedStock.entityId
              ? { ...h, shares: newShares, avgCostBasis: newCostBasis }
              : h
          );
        }
        return [...prev, {
          entityId: selectedStock.entityId,
          shares: tradeAmount,
          avgCostBasis: Math.floor(selectedStock.price),
        }];
      });
    } else {
      // Sell
      const holding = portfolio.find(h => h.entityId === selectedStock.entityId);
      if (!holding || holding.shares < tradeAmount) return;

      // Credit player
      world.cash += totalCostCents;
      Finances.cash[world.playerEntityId] += totalCostCents;

      setPortfolio(prev => {
        const newShares = holding.shares - tradeAmount;
        if (newShares === 0) {
          return prev.filter(h => h.entityId !== selectedStock.entityId);
        }
        return prev.map(h =>
          h.entityId === selectedStock.entityId
            ? { ...h, shares: newShares }
            : h
        );
      });
    }

    setSelectedStock(null);
    setTradeAmount(100);
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  PORTFOLIO CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════════
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

  // Format helpers
  const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatLargeNumber = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
    if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
    if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
    return `$${dollars.toFixed(0)}`;
  };

  // Current holding for selected stock
  const selectedHolding = selectedStock
    ? portfolio.find(h => h.entityId === selectedStock.entityId)
    : null;

  return (
    <div className="stock-trading-overlay">
      <div className="stock-trading">
        <div className="trading-header">
          <h2>📈 {t('stock.exchange_title') || 'Stock Exchange'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="label">{t('stock.portfolio_value') || 'Portfolio Value'}</span>
            <span className="value">{formatPrice(portfolioStats.totalValue)}</span>
          </div>
          <div className="summary-card">
            <span className="label">{t('stock.total_gain') || 'Total Gain/Loss'}</span>
            <span className={`value ${portfolioStats.gain >= 0 ? 'positive' : 'negative'}`}>
              {portfolioStats.gain >= 0 ? '+' : ''}{formatPrice(portfolioStats.gain)} ({portfolioStats.gainPercent.toFixed(2)}%)
            </span>
          </div>
          <div className="summary-card">
            <span className="label">{t('stock.available_cash') || 'Available Cash'}</span>
            <span className="value">{formatPrice(world.cash)}</span>
          </div>
        </div>

        <div className="trading-tabs">
          <button className={activeTab === 'market' ? 'active' : ''} onClick={() => setActiveTab('market')}>
            {t('stock.market_tab') || 'Market'}
          </button>
          <button className={activeTab === 'portfolio' ? 'active' : ''} onClick={() => setActiveTab('portfolio')}>
            {t('stock.portfolio_tab') || 'My Portfolio'}
          </button>
        </div>

        <div className="trading-content">
          {activeTab === 'market' && (
            <div className="market-tab">
              <div className="stock-list">
                {sortedStocks.length === 0 ? (
                  <div className="no-positions">{t('stock.no_listings') || 'No companies listed yet.'}</div>
                ) : sortedStocks.map(stock => (
                  <div
                    key={stock.entityId}
                    className={`stock-row ${selectedStock?.entityId === stock.entityId ? 'selected' : ''} ${stock.isPlayer ? 'player-stock' : ''}`}
                    onClick={() => setSelectedStock(stock)}
                  >
                    <div className="stock-info">
                      <span className="symbol">{stock.symbol} {stock.isPlayer && '⭐'}</span>
                      <span className="name">{stock.name}</span>
                      <span className="sector">{stock.sector}</span>
                    </div>
                    <div className="stock-price">
                      <span className="price">{formatPrice(stock.price)}</span>
                      <span className={`change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change >= 0 ? '+' : ''}{formatPrice(stock.change)} ({stock.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="stock-metrics">
                      <span className="volume">Vol: {stock.volume > 0 ? (stock.volume / 1_000_000).toFixed(1) + 'M' : '—'}</span>
                      <span className="pe">P/E: {stock.pe > 0 ? stock.pe.toFixed(1) : 'N/A'}</span>
                      <span className="mcap">MCap: {formatLargeNumber(stock.marketCap)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedStock && (
                <div className="trade-panel">
                  <h3>{t('stock.trade') || 'Trade'} {selectedStock.symbol}</h3>
                  <div className="stock-detail-row">
                    <span>{t('stock.eps') || 'EPS'}: {formatPrice(selectedStock.eps)}</span>
                    <span>{t('stock.dividend') || 'Div'}: {(selectedStock.dividend / 100).toFixed(2)}%</span>
                    <span>{t('stock.shares_out') || 'Shares'}: {selectedStock.sharesOutstanding.toLocaleString()}</span>
                  </div>
                  <div className="current-holding">
                    {selectedHolding ? (
                      <>
                        <span>{t('stock.current_position') || 'Position'}: {selectedHolding.shares.toLocaleString()} {t('stock.shares') || 'shares'}</span>
                        <span>{t('stock.avg_cost') || 'Avg Cost'}: {formatPrice(selectedHolding.avgCostBasis)}</span>
                      </>
                    ) : (
                      <span>{t('stock.no_position') || 'No position'}</span>
                    )}
                  </div>
                  <div className="trade-type">
                    <button
                      className={tradeType === 'buy' ? 'active' : ''}
                      onClick={() => setTradeType('buy')}
                    >
                      {t('stock.buy') || 'BUY'}
                    </button>
                    <button
                      className={tradeType === 'sell' ? 'active' : ''}
                      onClick={() => setTradeType('sell')}
                      disabled={!selectedHolding || selectedHolding.shares === 0}
                    >
                      {t('stock.sell') || 'SELL'}
                    </button>
                  </div>
                  <div className="trade-input">
                    <label>{t('stock.shares_label') || 'Shares'}:</label>
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                      min="1"
                    />
                  </div>
                  <div className="trade-summary">
                    <span>{t('stock.price_label') || 'Price'}: {formatPrice(selectedStock.price)}</span>
                    <span>{t('stock.total_label') || 'Total'}: {formatPrice(selectedStock.price * tradeAmount)}</span>
                  </div>
                  <button
                    className={`execute-trade ${tradeType}`}
                    onClick={handleTrade}
                    disabled={
                      (tradeType === 'buy' && world.cash < selectedStock.price * tradeAmount) ||
                      (tradeType === 'sell' && (!selectedHolding || selectedHolding.shares < tradeAmount))
                    }
                  >
                    {tradeType === 'buy' ? (t('stock.buy') || 'BUY') : (t('stock.sell') || 'SELL')} {tradeAmount.toLocaleString()} {t('stock.shares') || 'SHARES'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div className="portfolio-tab">
              {portfolio.length === 0 ? (
                <div className="no-positions">{t('stock.no_positions') || 'No stock positions. Start trading!'}</div>
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
                          <span className="symbol">{stock.symbol} {stock.isPlayer && '⭐'}</span>
                          <span className="shares">{holding.shares.toLocaleString()} {t('stock.shares') || 'shares'}</span>
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
        </div>
      </div>
    </div>
  );
}
