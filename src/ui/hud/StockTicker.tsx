import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { Stock, Company, Finances } from '../../core/ecs/components';
import { GameWorld } from '../../core/ecs/world';
import './StockTicker.css';

interface StockTickerProps {
  world: GameWorld;
}

interface StockDisplayData {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  history: number[];
  color: string;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return <div style={{width: 40}} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 40;
  const h = 16;
  const points = data.map((v, i) => 
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
  ).join(' ');
  
  return (
    <svg className="mini-sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#00d9a5' : '#ff4757'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StockTicker({ world }: StockTickerProps) {
  const { t } = useTranslation();
  const [stocks, setStocks] = useState<StockDisplayData[]>([]);
  const lastMonth = useRef(world.month);

  useEffect(() => {
    const companyQuery = defineQuery([Stock, Company, Finances]);
    const entities = companyQuery(world.ecsWorld);
    
    setStocks(prev => {
      return entities.map(id => {
        const metadata = world.dataStore.getCompany(id);
        const currentPrice = Stock.sharePrice[id];
        
        const existing = prev.find(s => s.id === id);
        
        // Use ECS prevSharePrice for monthly change (set by StockMarketSystem)
        const ecsChange = currentPrice - (Stock.prevSharePrice[id] || currentPrice);
        const ecsChangePercent = (Stock.prevSharePrice[id] || currentPrice) > 0
          ? (ecsChange / (Stock.prevSharePrice[id] || currentPrice)) * 100
          : 0;
        
        // Maintain sparkline history locally
        let history = existing?.history ?? [currentPrice];
        if (world.month !== lastMonth.current) {
          history = [...history.slice(-19), currentPrice];
        }

        return {
          id,
          symbol: metadata?.symbol ?? `C${id}`,
          name: metadata?.name ?? `Corp ${id}`,
          price: currentPrice,
          change: ecsChange,
          changePercent: ecsChangePercent,
          volume: Stock.volume[id] || 0,
          history,
          color: metadata?.color ?? '#ffffff'
        };
      });
    });

    lastMonth.current = world.month;
  }, [world.tick, world.month]);

  return (
    <div className="stock-ticker">
      <div className="ticker-label">
        <span className="ticker-live-dot"></span>
        <span className="ticker-icon">📈</span>
        <span>{t('stats.market').toUpperCase()}</span>
      </div>
      <div className="ticker-scroll">
        <div className="ticker-content">
          {(stocks.length > 0 ? [...stocks, ...stocks] : []).map((stock, index) => (
            <div key={`${stock.id}-${index}`} className="ticker-item">
              <span className="stock-symbol" style={{ color: stock.color }}>{stock.symbol}</span>
              <span className="stock-name">{stock.name}</span>
              <MiniSparkline data={stock.history} positive={stock.change >= 0} />
              <span className="stock-price">${(stock.price / 100).toFixed(2)}</span>
              <span className={`stock-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

