import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildingData } from '../../core/data/types';
import './BuildMenu.css';

interface BuildMenuProps {
  buildings: BuildingData[];
  onSelectBuilding: (building: BuildingData) => void;
  onClose: () => void;
}

// Icon mapping for each building type
const TYPE_ICONS: Record<string, string> = {
  FARM: '🚜',
  MINE: '⛏️',
  FACTORY: '🏭',
  RETAIL: '🛒',
  WAREHOUSE: '📦',
  OFFICE: '🏙️',
  RESIDENTIAL: '🏠',
  SUPERMARKET: '🛍️',
  HOSPITAL: '🏥',
  GYM: '💪',
  CINEMA: '🎬',
  KINDERGARTEN: '👶',
  RESTAURANT: '🍽️',
  HOTEL: '🏨',
  BANK: '🏦',
}

// Category order + labels
const CATEGORIES: { id: string; label: string; icon: string }[] = [
  { id: 'all',           label: 'All',           icon: '📋' },
  { id: 'RESIDENTIAL',   label: 'Residential',   icon: '🏠' },
  { id: 'RETAIL',        label: 'Retail',        icon: '🛒' },
  { id: 'SUPERMARKET',   label: 'Supermarket',   icon: '🛍️' },
  { id: 'RESTAURANT',    label: 'Restaurant',    icon: '🍽️' },
  { id: 'FACTORY',       label: 'Factory',       icon: '🏭' },
  { id: 'FARM',          label: 'Farm',          icon: '🚜' },
  { id: 'MINE',          label: 'Mine',          icon: '⛏️' },
  { id: 'WAREHOUSE',     label: 'Warehouse',     icon: '📦' },
  { id: 'OFFICE',        label: 'Office',        icon: '🏙️' },
  { id: 'HOSPITAL',      label: 'Hospital',      icon: '🏥' },
  { id: 'GYM',           label: 'Gym',           icon: '💪' },
  { id: 'CINEMA',        label: 'Cinema',        icon: '🎬' },
  { id: 'KINDERGARTEN',  label: 'Kindergarten',  icon: '👶' },
  { id: 'HOTEL',         label: 'Hotel',         icon: '🏨' },
  { id: 'BANK',          label: 'Bank',          icon: '🏦' },
]

export function BuildMenu({ buildings, onSelectBuilding, onClose }: BuildMenuProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredBuildings = buildings.filter(b => {
    const matchesCategory = activeCategory === 'all' || b.type === activeCategory;
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Only show categories that actually have buildings (after search matches?)
  // Better to keep categories stable, but maybe grey out empty ones?
  // For now let's keep categories based on ALL buildings to rely on stability.
  const availableTypes = new Set(buildings.map(b => b.type as string))
  const visibleCategories = CATEGORIES.filter(c => c.id === 'all' || availableTypes.has(c.id))

  return (
    <div className="build-menu-overlay" onClick={onClose}>
      <div className="build-menu-container" onClick={e => e.stopPropagation()}>
        <div className="build-menu-header">
          <div className="header-title">
            <span className="header-icon">🏗️</span>
            <h2>{t('menu.build_desc') || 'CONSTRUCTION CENTER'}</h2>
          </div>

          <div className="header-search">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search buildings..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="build-menu-content">
          <aside className="category-sidebar">
            {visibleCategories.map(cat => (
              <button
                key={cat.id}
                className={`category-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
              </button>
            ))}
          </aside>

          <main className="building-grid-container">
            <div className="building-grid">
              {filteredBuildings.map(building => (
                <div 
                  key={building.id} 
                  className="building-card"
                  onClick={() => onSelectBuilding(building)}
                >
                  <div className="building-preview">
                    <div className="blueprint-bg"></div>
                    <span className="building-type-icon">
                      {TYPE_ICONS[building.type] || '🏢'}
                    </span>
                  </div>
                  <div className="building-info">
                    <h3 className="building-name">{t(`buildings.${building.name}`) || building.name}</h3>
                    <div className="building-stats">
                      <div className="stat-row">
                        <span>💰 {t('stats.cost')}</span>
                        <span className="stat-value">${(building.baseCost / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="stat-row">
                        <span>⏱️ {t('stats.build_time')}</span>
                        <span className="stat-value">{building.constructionTime}d</span>
                      </div>
                      <div className="stat-row">
                        <span>📏 {t('stats.size')}</span>
                        <span className="stat-value">{building.maxSize}x{building.maxSize}</span>
                      </div>
                    </div>
                  </div>
                  <div className="build-action">
                    <span>{t('actions.build') || 'BUILD'}</span>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
