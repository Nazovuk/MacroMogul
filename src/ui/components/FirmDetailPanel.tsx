import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import { 
  Building, 
  ProductionOutput, 
  Inventory, 
  LogisticSupply,
  ResearchCenter,
  Company,
  ProductBrand,
  Factory,
  RetailPlot,
  RetailExpertise,
  HumanResources,
  Maintenance,
  Strike,
  CompanyTechnology,
  MarketingOffice
} from '../../core/ecs/components';
import './FirmDetailPanel.css';
import { BuildingType } from '../../core/data/types';
import { findOptimalSupplier } from '../../core/ecs/systems/LogisticsSystem';

interface FirmDetailPanelProps {
  entityId: number;
  world: GameWorld;
  onClose: () => void;
  onUpdate?: () => void;
  onUpgrade?: (entityId: number) => void;
  onToggleOperational?: (entityId: number) => void;
}

const getMoraleColor = (val: number) => {
    if (val < 30) return '#ef4444'; // Red
    if (val < 60) return '#fbbf24'; // Yellow
    if (val < 80) return '#10b981'; // Green
    return '#3b82f6'; // Blue
};

export function FirmDetailPanel({ 
  entityId, 
  world, 
  onClose, 
  onUpdate,
  onUpgrade,
  onToggleOperational
}: FirmDetailPanelProps) {
  const { t } = useTranslation();
  const buildingTypeId = Building.buildingTypeId[entityId];
  const buildingData = world.dataStore.getBuilding(buildingTypeId);
  const level = Building.level[entityId];
  const isOperational = Building.isOperational[entityId] === 1;

  // Strike Status Data
  const hasStrike = Strike.severity[entityId] !== undefined && Strike.severity[entityId] > 0;
  const isCriticalStrike = Strike.severity[entityId] === 2;

  // Production data
  const capacity = ProductionOutput.capacity[entityId];
  const actualOutput = ProductionOutput.actualOutput[entityId];
  const utilization = ProductionOutput.utilization[entityId];

  // Inventory data
  const productId = Inventory.productId[entityId];
  const productData = productId !== 0 ? world.dataStore.getProduct(productId) : null;
  const currentStock = Inventory.currentAmount[entityId];
  const stockCapacity = Inventory.capacity[entityId];

  // Maintenance & Building Health data
  const maintenanceCost = Maintenance.monthlyCost[entityId] || 0;
  const lastMaintenanceTick = Maintenance.lastPaymentTick[entityId] || 0;
  const buildingAge = world.tick - lastMaintenanceTick;
  // Calculate building health based on utilization and maintenance
  const buildingHealth = Math.max(0, 100 - (buildingAge / 1000) * 10 - (utilization > 80 ? 10 : 0));
  const healthStatus = buildingHealth > 80 ? 'excellent' : buildingHealth > 60 ? 'good' : buildingHealth > 40 ? 'fair' : 'poor';

  // Logistics data
  // const sourceId = LogisticSupply.sourceEntityId[entityId]; // REMOVED
  
  // R&D data
  const isRD = buildingData?.id === 33 || buildingData?.name.includes('R&D');
  const researchingProductId = ResearchCenter.researchingProductId[entityId];
  const rdProgress = ResearchCenter.progress[entityId];
  const companyId = Company.companyId[entityId];
  const companyMetadata = world.dataStore.getCompany(companyId);

  // Factory Data
  const isFactory = buildingData?.type === BuildingType.FACTORY;
  const recipeId = isFactory ? Factory.recipeId[entityId] : 0;

  // Get current tech level for the researched product
  let currentTechLevel = 0;
  if (researchingProductId !== 0) {
     const techQuery = defineQuery([CompanyTechnology]);
     const techEntities = techQuery(world.ecsWorld);
     const techEntity = techEntities.find(id => 
        CompanyTechnology.companyId[id] === companyId && 
        CompanyTechnology.productId[id] === researchingProductId
     );
     if (techEntity) currentTechLevel = CompanyTechnology.techLevel[techEntity];
     else currentTechLevel = 40; // Default baseline
  }

  // Marketing data
  const isMarketing = buildingData?.name.includes('Marketing') || buildingData?.id === 34;
  const marketingProdId = MarketingOffice.productId[entityId];
  const spending = MarketingOffice.spending[entityId];
  
  let currentAwareness = 0;
  if (marketingProdId !== 0) {
      const brandQuery = defineQuery([ProductBrand]);
      const brands = brandQuery(world.ecsWorld);
      const brandEntity = brands.find(id => ProductBrand.companyId[id] === companyId && ProductBrand.productId[id] === marketingProdId);
      if (brandEntity) currentAwareness = ProductBrand.awareness[brandEntity];
  }

  // State for source selection
  const [selectingSourceSlot, setSelectingSourceSlot] = useState<number | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);

  if (!buildingData) return null;

  // Find valid suppliers for the current building
  const buildingQuery = defineQuery([Building, Inventory]);
  const allPotentialIds = buildingQuery(world.ecsWorld);
  
  // Logic to filter suppliers based on the target slot's requirement
  const getPotentialSuppliers = (targetSlot: number) => {
      let requiredProdId = 0;
      // If factory, look at recipe
      const recipeId = Factory.recipeId[entityId];
      if (recipeId) {
          const recipe = world.dataStore.getRecipe(recipeId);
          if (recipe && recipe.inputs[targetSlot - 1]) {
              requiredProdId = recipe.inputs[targetSlot - 1].productId;
          }
      }
      
      return allPotentialIds.filter(eid => {
          if (eid === entityId) return false;
          const kpId = Inventory.productId[eid];
          if (kpId === 0) return false;
          // If we have a specific requirement, filter by it. Otherwise show all.
          if (requiredProdId !== 0 && kpId !== requiredProdId) return false;
          return true;
      });
  };

  const handleLinkSource = (supplierId: number) => {
    if (selectingSourceSlot === null) return;
    
    // Assign to the specific slot
    if (selectingSourceSlot === 1) {
        LogisticSupply.source1Id[entityId] = supplierId;
        LogisticSupply.product1Id[entityId] = Inventory.productId[supplierId];
    } else if (selectingSourceSlot === 2) {
        LogisticSupply.source2Id[entityId] = supplierId;
        LogisticSupply.product2Id[entityId] = Inventory.productId[supplierId];
    } else if (selectingSourceSlot === 3) {
        LogisticSupply.source3Id[entityId] = supplierId;
        LogisticSupply.product3Id[entityId] = Inventory.productId[supplierId];
    }
    
    LogisticSupply.autoSupply[entityId] = 1;
    LogisticSupply.transportCost[entityId] = 50; 
    
    setSelectingSourceSlot(null);
    if (onUpdate) onUpdate();
  };

  const handleAutoLink = () => {
    let hasUpdates = false;
    
    // Determine requirements (only factories have strict recipe requirements)
    const reqs: { slot: number; prodId: number }[] = [];
    if (isFactory && recipeId) {
      const recipe = world.dataStore.getRecipe(recipeId);
      if (recipe) {
        recipe.inputs.forEach((input, idx) => {
          reqs.push({ slot: idx + 1, prodId: input.productId });
        });
      }
    }
    
    if (reqs.length > 0) {
      reqs.forEach(req => {
        // Find potential suppliers that produce this product
        const potentialIds = getPotentialSuppliers(req.slot);
        const result = findOptimalSupplier(req.prodId, entityId, Array.from(potentialIds));
        
        if (result && result.supplierId !== 0) {
          const supplierId = result.supplierId;
          if (req.slot === 1) {
            LogisticSupply.source1Id[entityId] = supplierId;
            LogisticSupply.product1Id[entityId] = req.prodId;
          } else if (req.slot === 2) {
            LogisticSupply.source2Id[entityId] = supplierId;
            LogisticSupply.product2Id[entityId] = req.prodId;
          } else if (req.slot === 3) {
            LogisticSupply.source3Id[entityId] = supplierId;
            LogisticSupply.product3Id[entityId] = req.prodId;
          }
          LogisticSupply.autoSupply[entityId] = 1;
          LogisticSupply.transportCost[entityId] = 50;
          hasUpdates = true;
        }
      });
    }

    if (hasUpdates && onUpdate) {
      onUpdate();
    }
  };

  // Retail check
  const isRetail = buildingData?.type === BuildingType.RETAIL || buildingData?.type === BuildingType.SUPERMARKET;

  // Helper to render a supply slot
  const renderSupplySlot = (slotIdx: number, label: string) => {
      let sId = 0;
      let pId = 0;
      let quality = 50;
      let amount = 0;

      if (isRetail) {
        // For retail, check Inventory, fallback to LogisticSupply if no stock yet but linked
        if (slotIdx === 1) { pId = Inventory.input1ProductId[entityId] || LogisticSupply.product1Id[entityId]; quality = Inventory.input1Quality[entityId]; amount = Inventory.input1Amount[entityId]; sId = LogisticSupply.source1Id[entityId]; }
        if (slotIdx === 2) { pId = Inventory.input2ProductId[entityId] || LogisticSupply.product2Id[entityId]; quality = Inventory.input2Quality[entityId]; amount = Inventory.input2Amount[entityId]; sId = LogisticSupply.source2Id[entityId]; }
        if (slotIdx === 3) { pId = Inventory.input3ProductId[entityId] || LogisticSupply.product3Id[entityId]; quality = Inventory.input3Quality[entityId]; amount = Inventory.input3Amount[entityId]; sId = LogisticSupply.source3Id[entityId]; }
      } else {
        // For production, get from logistic supply
        if (slotIdx === 1) { sId = LogisticSupply.source1Id[entityId]; pId = LogisticSupply.product1Id[entityId]; amount = Inventory.input1Amount[entityId]; quality = Inventory.input1Quality[entityId]; }
        if (slotIdx === 2) { sId = LogisticSupply.source2Id[entityId]; pId = LogisticSupply.product2Id[entityId]; amount = Inventory.input2Amount[entityId]; quality = Inventory.input2Quality[entityId]; }
        if (slotIdx === 3) { sId = LogisticSupply.source3Id[entityId]; pId = LogisticSupply.product3Id[entityId]; amount = Inventory.input3Amount[entityId]; quality = Inventory.input3Quality[entityId]; }
      }

      // Price handling for retail
      const getPrice = () => {
        if (slotIdx === 1) return RetailPlot.price1[entityId];
        if (slotIdx === 2) return RetailPlot.price2[entityId];
        return RetailPlot.price3[entityId];
      };
      const setPrice = (val: number) => {
        if (slotIdx === 1) RetailPlot.price1[entityId] = val;
        else if (slotIdx === 2) RetailPlot.price2[entityId] = val;
        else RetailPlot.price3[entityId] = val;
        if (onUpdate) onUpdate();
      };

      const price = getPrice();

      // Get quality color
      const getQualityColor = (q: number) => {
        if (q >= 80) return '#10b981'; // Green
        if (q >= 60) return '#fbbf24'; // Yellow
        if (q >= 40) return '#f97316'; // Orange
        return '#ef4444'; // Red
      };

      return (
        <div key={slotIdx} className="supply-slot-container">
           <div className="slot-header">
             <span className="slot-label">{label}</span>
              {isRetail && pId !== 0 && (
                <div className="price-control">
                  <label>{t('firm.price')}:</label>
                  <input
                     type="number"
                     value={price || 0}
                     onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                     className="price-input"
                   />
                </div>
              )}
           </div>
           {pId === 0 ? (
            <div className="supply-link empty" onClick={() => setSelectingSourceSlot(slotIdx)}>
              <span className="plus">+</span>
              <span className="link-text">{isRetail ? t('firm.add_product') : t('firm.link_supplier')}</span>
            </div>
          ) : (
            <div className="supply-link active" onClick={() => setSelectingSourceSlot(slotIdx)}>
              <span className="link-icon">🚚</span>
              <div className="link-details">
                <span className="source-name">{isRetail ? `${amount.toLocaleString()} units` : `Firm #${sId}`}</span>
                <span className="product-linked">{world.dataStore.getProduct(pId)?.name || 'Product'}</span>
                 {isRetail && (
                   <div className="quality-indicator">
                     <span className="quality-label">{t('firm.quality')}:</span>
                    <div className="quality-bar-mini">
                      <div
                        className="quality-fill"
                        style={{ width: `${quality}%`, background: getQualityColor(quality) }}
                      />
                    </div>
                    <span className="quality-value" style={{ color: getQualityColor(quality) }}>{quality}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
  };

  return (
    <>
      {/* Backdrop overlay - click to close */}
      <div 
        className="firm-detail-backdrop" 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 999
        }}
      />
      <div className="firm-detail-panel animate-slideRight">
        <div className="firm-header">
          <div className="firm-title">
            <span className="firm-icon">🏢</span>
            <div className="title-group">
              <div className="company-attribution">
                <span className="company-pill" style={{ backgroundColor: companyMetadata?.color }}>
                  {companyMetadata?.symbol || '???'}
                </span>
                <span className="company-name">{companyMetadata?.name || 'Independent'}</span>
              </div>
              <h2>{t(`buildings.${buildingData.name}`, { defaultValue: buildingData.name })}</h2>
              <span className="firm-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{t('firm.level')} {level} •</span>
                {hasStrike ? (
                    <span style={{ 
                        color: isCriticalStrike ? '#ef4444' : '#fbbf24', 
                        fontWeight: 'bold',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px' 
                    }}>
                        <span style={{ fontSize: '14px' }}>⚠️</span>
                        {isCriticalStrike ? 'CRITICAL STRIKE (HALTED)' : 'MINOR STRIKE (REDUCED EFFICIENCY)'}
                    </span>
                 ) : (
                    <span>{isOperational ? t('firm.operational') : t('firm.stopped')}</span>
                 )}
              </span>
            </div>
          </div>
          <button 
            className="premium-icon-btn" 
            onClick={onClose}
            style={{ 
              '--btn-color': '#ef4444',
              marginLeft: '10px',
              zIndex: 1001
            } as React.CSSProperties}
          >
            ✕
            <div className="btn-glow"></div>
          </button>
        </div>

      <div className="firm-content">
        <section className="firm-section">
          <h3>{t('firm.overview')}</h3>
          <div className="stat-grid">
            <div className="stat-item">
              <span className="label">{t('firm.capacity')}</span>
              <span className="value">{capacity.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="label">{t('firm.output')}</span>
              <span className="value">{actualOutput.toLocaleString()}</span>
            </div>
            <div className="stat-item">
                <span className="label">{t('firm.utilization')}</span>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${utilization}%` }}></div>
                </div>
            </div>
            {isFactory && (
             <div className="stat-item">
                <span className="label">{t('firm.efficiency')}</span>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(200, Factory.efficiency[entityId] || 100)}%`, background: '#10b981' }}></div>
                </div>
                <span className="mini-val" style={{top: '12px', right: '12px', color: '#10b981'}}>
                  {Factory.efficiency[entityId] || 100}%
                  {(Factory.efficiency[entityId] || 100) !== 100 && (
                    <span style={{ fontSize: '0.75em', marginLeft: '4px', color: (Factory.efficiency[entityId] || 100) > 100 ? '#10b981' : '#ef4444' }}>
                      ({((Factory.efficiency[entityId] || 100) - 100) / 2 > 0 ? '+' : ''}{Math.round(((Factory.efficiency[entityId] || 100) - 100) / 2)}% output)
                    </span>
                  )}
                </span>
             </div>
            )}
            {isRetail && (
             <div className="stat-item">
                <span className="label">{t('firm.retail_expertise')}</span>
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(200, RetailExpertise.general[entityId] || 50)}%`, background: '#8b5cf6' }}></div>
                </div>
                <span className="mini-val" style={{top: '12px', right: '12px', color: '#8b5cf6'}}>
                  {RetailExpertise.general[entityId] || 50}%
                  {(RetailExpertise.general[entityId] || 50) !== 100 && (
                    <span style={{ fontSize: '0.75em', marginLeft: '4px', color: (RetailExpertise.general[entityId] || 50) > 100 ? '#10b981' : '#ef4444' }}>
                      ({((RetailExpertise.general[entityId] || 50) - 100) / 2 > 0 ? '+' : ''}{Math.round(((RetailExpertise.general[entityId] || 50) - 100) / 2)}% sales)
                    </span>
                  )}
                </span>
             </div>
            )}
          </div>
        </section>

        {HumanResources.headcount[entityId] !== undefined && (
        <section className="firm-section">
          <h3>{t('firm.human_resources')}</h3>
          <div className="stat-grid hr-grid">
             <div className="stat-item full-width">
                <span className="label">{t('firm.headcount')}</span>
                <div className="capacity-bar-container">
                  <div className="capacity-bar">
                    <div 
                      className="capacity-fill" 
                      style={{ 
                        width: `${Math.min(100, (HumanResources.headcount[entityId] / (capacity * 0.1)) * 100)}%`,
                        background: HumanResources.headcount[entityId] > capacity * 0.1 ? '#ef4444' : '#3b82f6'
                      }}
                    />
                  </div>
                  <span className="capacity-text">
                    {HumanResources.headcount[entityId]} / {Math.floor(capacity * 0.1)} {t('firm.employees')}
                  </span>
                </div>
             </div>
             
             <div className="stat-item full-width">
                <span className="label">{t('firm.salary_monthly')}</span>
                <div className="slider-control">
                    <input 
                        type="range" 
                        min="100000" 
                        max="1000000" 
                        step="10000"
                        value={HumanResources.salary[entityId] || 300000}
                        onChange={(e) => {
                            HumanResources.salary[entityId] = parseInt(e.target.value);
                            if (onUpdate) onUpdate();
                        }}
                    />
                    <span className="value-display">${((HumanResources.salary[entityId] || 300000) / 100).toLocaleString()}</span>
                </div>
             </div>

             <div className="stat-item full-width">
                <span className="label">{t('firm.training_budget')}</span>
                <div className="slider-control">
                    <input 
                        type="range" 
                        min="0" 
                        max="500000" 
                        step="5000"
                        value={HumanResources.trainingBudget[entityId] || 0}
                        onChange={(e) => {
                            HumanResources.trainingBudget[entityId] = parseInt(e.target.value);
                            if (onUpdate) onUpdate();
                        }}
                    />
                    <span className="value-display">${((HumanResources.trainingBudget[entityId] || 0) / 100).toLocaleString()}</span>
                </div>
             </div>

             <div className="stat-item">
                <span className="label">
                  {t('firm.morale')}
                  {(HumanResources.morale[entityId] || 50) < 30 && (
                    <span title="Critical morale! Workers may quit or strike." style={{ marginLeft: '6px', color: '#ef4444', fontSize: '14px' }}>⚠️</span>
                  )}
                </span>
                <div className="progress-bar small">
                    <div
                        className="progress-fill"
                        style={{ width: `${Math.max(0, Math.min(100, HumanResources.morale[entityId] || 50))}%`, background: getMoraleColor(HumanResources.morale[entityId] || 50) }}
                    ></div>
                </div>
                <span className="mini-val">{HumanResources.morale[entityId] || 50}%</span>
             </div>

             {/* Turnover and Hiring Cost Estimate */}
             <div className="stat-item full-width turnover-metrics" style={{ marginTop: '10px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                     <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Est. Monthly Turnover</span>
                     <span style={{ fontSize: '0.85rem', fontWeight: 700, color: (HumanResources.morale[entityId] || 50) < 40 ? '#ef4444' : '#f8fafc' }}>
                         {(() => {
                            const morale = HumanResources.morale[entityId] || 50;
                            let rate = 0.02; // Base 2%
                            if (morale < 30) rate = 0.15;
                            else if (morale < 50) rate = 0.08;
                            else if (morale > 80) rate = 0.01;
                            return (rate * 100).toFixed(1) + '%';
                         })()}
                     </span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                     <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Replacement Cost</span>
                     <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>
                         {(() => {
                             const hc = HumanResources.headcount[entityId] || 0;
                             const tb = HumanResources.trainingBudget[entityId] || 0;
                             const costPerEmployee = 50000 + (tb / Math.max(1, hc) * 2); 
                             return '$' + (Math.floor(costPerEmployee/100)).toLocaleString();
                         })()}
                     </span>
                 </div>
             </div>

              <div className="stat-item">
                 <span className="label">{t('firm.training')}</span>
                 <div className="progress-bar small">
                     <div 
                         className="progress-fill" 
                         style={{ width: `${HumanResources.trainingLevel[entityId] || 10}%`, background: '#3b82f6' }}
                     ></div>
                 </div>
                 <span className="mini-val">{HumanResources.trainingLevel[entityId] || 10}%</span>
              </div>
           </div>
        </section>
        )}

        {/* Building Health & Maintenance Section */}
        <section className="firm-section health-section">
          <h3>🏗️ {t('firm.building_health')}</h3>
          <div className="health-overview">
            <div className="health-main">
              <div className={`health-status ${healthStatus}`}>
                <span className="health-icon">
                  {healthStatus === 'excellent' ? '✨' : healthStatus === 'good' ? '✓' : healthStatus === 'fair' ? '⚠' : '🔧'}
                </span>
                <span className="health-label">{healthStatus.toUpperCase()}</span>
              </div>
              <div className="health-bar-large">
                <div 
                  className="health-fill" 
                  style={{ 
                    width: `${buildingHealth}%`,
                    background: buildingHealth > 80 ? '#10b981' : buildingHealth > 60 ? '#3b82f6' : buildingHealth > 40 ? '#fbbf24' : '#ef4444'
                  }}
                />
              </div>
              <span className="health-percentage">{Math.round(buildingHealth)}%</span>
            </div>
            
            <div className="maintenance-details">
              <div className="maintenance-item">
                <span className="maintenance-label">{t('firm.monthly_maintenance')}</span>
                <span className="maintenance-value">${(maintenanceCost / 100).toLocaleString()}</span>
              </div>
              <div className="maintenance-item">
                <span className="maintenance-label">{t('firm.last_service')}</span>
                <span className="maintenance-value">{t('firm.ticks_ago', { count: buildingAge })}</span>
              </div>
              <div className="maintenance-item">
                <span className="maintenance-label">{t('firm.condition_impact')}</span>
                <span className={`maintenance-impact ${buildingHealth < 50 ? 'negative' : ''}`}>
                  {buildingHealth < 30 ? t('firm.efficiency_penalty', { pct: 15 }) : buildingHealth < 50 ? t('firm.efficiency_penalty', { pct: 10 }) : buildingHealth < 70 ? t('firm.efficiency_penalty', { pct: 5 }) : t('firm.optimal')}
                </span>
              </div>
            </div>
          </div>
          
          {buildingHealth < 60 && (
            <div className="health-alert">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">
                {buildingHealth < 40 
                  ? t('firm.health_alert_critical') 
                  : t('firm.health_alert_declining')}
              </span>
            </div>
          )}
        </section>

        <section className="firm-section">
          <h3>{t('firm.inventory_supply')}</h3>
          
          <div className="inventory-section">
            <h4>{t('firm.output_storage')}</h4>
             {productId === 0 ? (
                 <div className="no-data">{t('firm.empty')}</div>
             ) : (
                <div className="inventory-card">
                    <span className="product-name">{productData?.name}</span>
                    <span className="stock-counter">{currentStock} / {stockCapacity}</span>
                </div>
            )}
          </div>

          <div className="supply-chain-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0 }}>{isRetail ? t('firm.sales_units') : t('firm.input_supplies')}</h4>
              {isFactory && recipeId !== 0 && (
                <button 
                  className="change-btn" 
                  style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa' }}
                  onClick={handleAutoLink}
                >
                  {t('firm.auto_link', { defaultValue: '⚡ Auto-Link' })}
                </button>
              )}
            </div>
            {/* Render slots based on context */}
            {(() => {
                const recipeId = Factory.recipeId[entityId];
                if (recipeId) {
                    const recipe = world.dataStore.getRecipe(recipeId);
                    if (recipe) {
                        return recipe.inputs.map((input, i) => {
                            const pName = world.dataStore.getProduct(input.productId)?.name;
                            return renderSupplySlot(i + 1, `Input: ${pName}`);
                        });
                    }
                }
                
                if (isRetail) {
                  return [1, 2, 3].map(i => renderSupplySlot(i, `Sales Unit ${i}`));
                }

                // Default to 1 slot for Other
                return renderSupplySlot(1, "Supply Source");
            })()}
          </div>
        </section>

        {isFactory && (
          <section className="firm-section production-section">
            <h3>{t('firm.production')}</h3>
            {recipeId === 0 ? (
                <div className="rd-empty" onClick={() => setShowProductSelector(true)}>
                    <span className="plus">+</span>
                    <span>{t('firm.select_product_manufacture')}</span>
                </div>
            ) : (
                <div className="rd-active">
                     <div className="rd-info" onClick={() => setShowProductSelector(true)}>
                        <span className="rd-name">
                          🏭 {t('firm.producing')}: {world.dataStore.getProduct(Inventory.productId[entityId])?.name}
                        </span>
                    </div>
                     <button className="change-btn" onClick={() => setShowProductSelector(true)}>{t('firm.change_product')}</button>
                </div>
            )}
          </section>
        )}

        {isRD && (
          <section className="firm-section rd-section">
            <h3>{t('firm.research_development')}</h3>
            {researchingProductId === 0 ? (
                <div className="rd-empty" onClick={() => setShowProductSelector(true)}>
                    <span className="plus">+</span>
                    <span>{t('firm.select_product_research')}</span>
                </div>
            ) : (
                <div className="rd-active">
                    <div className="rd-info" onClick={() => setShowProductSelector(true)}>
                        <span className="rd-name">
                          🔬 {t('firm.researching')}: {world.dataStore.getProduct(researchingProductId)?.name}
                        </span>
                        <span className="rd-level">{t('firm.current_tech')}: {currentTechLevel}</span>
                    </div>
                    <div className="rd-progress">
                        <div className="rd-bar">
                            <div className="rd-fill" style={{ width: `${rdProgress}%` }}></div>
                        </div>
                        <span className="rd-pct">{rdProgress}%</span>
                    </div>
                    <button className="change-btn" onClick={() => setShowProductSelector(true)}>{t('firm.change_project')}</button>
                </div>
            )}
          </section>
        )}

        {isMarketing && (
          <section className="firm-section marketing-section">
            <h3>{t('firm.marketing_advertising')}</h3>
            {marketingProdId === 0 ? (
                <div className="rd-empty" onClick={() => setShowProductSelector(true)}>
                    <span className="plus">+</span>
                    <span>{t('firm.select_product_advertise')}</span>
                </div>
            ) : (
                <div className="rd-active">
                    <div className="rd-info" onClick={() => setShowProductSelector(true)}>
                        <span className="rd-name">
                          📢 {t('firm.advertising')}: {world.dataStore.getProduct(marketingProdId)?.name}
                        </span>
                        <div className="budget-control">
                            <span className="label">{t('firm.monthly_budget')}:</span>
                            <input 
                                type="range" 
                                min="0" 
                                max="100000" 
                                step="1000"
                                value={spending / 100} 
                                onChange={(e) => {
                                    MarketingOffice.spending[entityId] = parseInt(e.target.value) * 100;
                                    if (onUpdate) onUpdate();
                                }} 
                            />
                            <span className="value">${(spending / 100).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="rd-progress">
                        <span className="label">{t('firm.brand_awareness')}</span>
                        <div className="rd-bar">
                            <div className="rd-fill awareness" style={{ width: `${currentAwareness}%` }}></div>
                        </div>
                        <span className="rd-pct">{Math.floor(currentAwareness)}%</span>
                    </div>
                    <button className="change-btn" onClick={() => setShowProductSelector(true)}>{t('firm.change_campaign')}</button>
                </div>
            )}
          </section>
        )}
      </div>

      {showProductSelector && (
        <div className="source-selector-overlay">
          <div className="selector-content">
            <div className="selector-header">
              <h4>{t('firm.select_project')}</h4>
              <button onClick={() => setShowProductSelector(false)}>×</button>
            </div>
            <div className="selector-list">
                {Array.from(world.dataStore.products.values())
                    .filter(p => {
                        if (isFactory) {
                            // Only show products with recipes
                            return world.dataStore.getRecipesForProduct(p.id).length > 0;
                        }
                        return true;
                    })
                    .map(p => (
                    <div key={p.id} className="supplier-item" onClick={() => {
                        if (isRD) {
                            ResearchCenter.researchingProductId[entityId] = p.id;
                            ResearchCenter.innovationPoints[entityId] = 0;
                        } else if (isMarketing) {
                            MarketingOffice.productId[entityId] = p.id;
                            MarketingOffice.spending[entityId] = 1000000; // $10k default
                        } else if (isFactory) {
                            const recipes = world.dataStore.getRecipesForProduct(p.id);
                            if (recipes.length > 0) {
                                Factory.recipeId[entityId] = recipes[0].id;
                                Inventory.productId[entityId] = p.id;
                                // Reset inputs
                                Inventory.input1ProductId[entityId] = 0;
                                Inventory.input1Amount[entityId] = 0;
                                Inventory.input2ProductId[entityId] = 0;
                                Inventory.input2Amount[entityId] = 0;
                                Inventory.input3ProductId[entityId] = 0;
                                Inventory.input3Amount[entityId] = 0;
                                // Reset Logistics
                                LogisticSupply.source1Id[entityId] = 0;
                                LogisticSupply.source2Id[entityId] = 0;
                                LogisticSupply.source3Id[entityId] = 0;
                            }
                        }
                        setShowProductSelector(false);
                        if (onUpdate) onUpdate();
                    }}>
                        <div className="supplier-meta">
                            <span className="supplier-name">{p.name}</span>
                            <span className="supplier-prod">{p.category}</span>
                        </div>
                        <button className="select-btn">{t('common.select') || 'SELECT'}</button>
                    </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectingSourceSlot !== null && (
        <div className="source-selector-overlay">
          <div className="selector-content">
            <div className="selector-header">
              <h4>{t('firm.select_source')} (Slot {selectingSourceSlot})</h4>
              <button onClick={() => setSelectingSourceSlot(null)}>×</button>
            </div>
            <div className="selector-list">
              {(() => {
                  const suppliers = getPotentialSuppliers(selectingSourceSlot);
                  if (suppliers.length === 0) {
                      return <div className="no-suppliers">{t('firm.no_suppliers_found')}</div>;
                  }
                  return suppliers.map(sid => {
                    const sTypeId = Building.buildingTypeId[sid];
                    const sData = world.dataStore.getBuilding(sTypeId);
                    const sProdId = Inventory.productId[sid];
                    const sProdData = world.dataStore.getProduct(sProdId);
                    
                     return (
                         <div key={sid} className="supplier-item" onClick={() => handleLinkSource(sid)}>
                         <div className="supplier-meta">
                             <span className="supplier-name">{sData?.name} (#{sid})</span>
                             <span className="supplier-prod">{t('firm.stocking')}: {sProdData?.name}</span>
                         </div>
                         <button className="select-btn">{t('common.link') || 'LINK'}</button>
                         </div>
                     );
                  });
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="firm-footer">
        <button
          className={`firm-action-btn secondary ${!isOperational ? 'stopped' : ''}`}
          onClick={() => onToggleOperational?.(entityId)}
        >
          {isOperational ? t('firm.stop_operations') : t('firm.start_operations')}
        </button>
        {(() => {
            const upgradeCost = Math.floor(buildingData.baseCost * Math.pow(1.2, level - 1));
            const canAfford = world.cash >= upgradeCost;

            return (
              <button
                className={`firm-action-btn primary ${!canAfford ? 'disabled' : ''}`}
                onClick={() => canAfford && onUpgrade?.(entityId)}
                disabled={!canAfford}
                title={!canAfford ? t('firm.insufficient_funds') : t('firm.upgrade_capacity')}
              >
                <div className="btn-content-col">
                  <span>{t('firm.upgrade_firm')}</span>
                  <span className="btn-cost" style={{ fontSize: '0.8em', opacity: 0.8 }}>
                    ${upgradeCost.toLocaleString()}
                  </span>
                </div>
              </button>
            );
        })()}
      </div>
    </div>
    </>
  );
}
