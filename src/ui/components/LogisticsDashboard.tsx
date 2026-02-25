import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameWorld } from '../../core/ecs/world';
import { defineQuery } from 'bitecs';
import {
  Building,
  Company,
  Factory,
  Inventory,
  RetailPlot,
  Warehouse,
  ProductionOutput,
  HumanResources
} from '../../core/ecs/components';
import { BuildingType } from '../../core/data/types';
import './LogisticsDashboard.css';

interface LogisticsDashboardProps {
  world: GameWorld;
  onClose: () => void;
}

interface LogisticsNode {
  id: number;
  type: BuildingType;
  name: string;
  outputProduct: string | null;
  outputQuality: number;
  outputStock: number;
  capacity?: number;
  efficiency?: number;
  inputs?: {
    productId: string | null;
    amount: number;
    quality: number;
  }[];
  salesRate?: number;
  distributionRadius?: number;
  morale?: number;
}

export function LogisticsDashboard({ world, onClose }: LogisticsDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'raw' | 'factories' | 'warehouses' | 'retail'>('overview');
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  const logisticsData = useMemo(() => {
    const nodes: LogisticsNode[] = [];
    const playerCompanyId = Company.companyId[world.playerEntityId];

    if (!playerCompanyId) return { raw: [], factories: [], retail: [], warehouses: [], totalOutput: 0, avgEfficiency: 0 };

    // Query all buildings owned by player
    const bQuery = defineQuery([Building, Company]);
    const bEntities = bQuery(world.ecsWorld);

    let totalEfficiency = 0;
    let factoryCount = 0;
    let totalOutputAmount = 0;

    bEntities.forEach(id => {
      if (Company.companyId[id] !== playerCompanyId) return;

      const typeId = Building.buildingTypeId[id];
      const template = world.dataStore.getBuilding(typeId);
      if (!template) return;

      const outputProductIdRaw = Inventory.productId[id];
      const outputProduct = outputProductIdRaw ? (world.dataStore.getProduct(outputProductIdRaw)?.name || null) : null;
      
      const node: LogisticsNode = {
        id,
        type: template.type,
        name: template.name,
        outputProduct,
        outputQuality: Inventory.quality[id] || 0,
        outputStock: Inventory.currentAmount[id] || 0,
        morale: HumanResources.morale[id] !== undefined ? HumanResources.morale[id] : 0,
      };

      if (template.type === BuildingType.FACTORY) {
        node.efficiency = Factory.efficiency[id] || 0;
        node.capacity = ProductionOutput.capacity[id] || 0;
        totalEfficiency += node.efficiency;
        factoryCount++;
        totalOutputAmount += ProductionOutput.actualOutput[id] || 0;

        // Factory inputs
        node.inputs = [];
        if (Inventory.input1ProductId[id]) {
           node.inputs.push({
             productId: world.dataStore.getProduct(Inventory.input1ProductId[id])?.name || null,
             amount: Inventory.input1Amount[id],
             quality: Inventory.input1Quality[id]
           });
        }
        if (Inventory.input2ProductId[id]) {
           node.inputs.push({
             productId: world.dataStore.getProduct(Inventory.input2ProductId[id])?.name || null,
             amount: Inventory.input2Amount[id],
             quality: Inventory.input2Quality[id]
           });
        }
      }

      if (template.type === BuildingType.RETAIL || template.type === BuildingType.SUPERMARKET) {
        // Retail plots use trafficIndex instead of salesRate
        node.salesRate = RetailPlot.trafficIndex ? RetailPlot.trafficIndex[id] : 0;
        node.inputs = [];
        if (Inventory.input1ProductId[id]) {
           node.inputs.push({
             productId: world.dataStore.getProduct(Inventory.input1ProductId[id])?.name || null,
             amount: Inventory.input1Amount[id],
             quality: Inventory.input1Quality[id]
           });
        }
        // Assuming up to 3 slots for retail
        if (Inventory.input2ProductId[id]) {
           node.inputs.push({
             productId: world.dataStore.getProduct(Inventory.input2ProductId[id])?.name || null,
             amount: Inventory.input2Amount[id],
             quality: Inventory.input2Quality[id]
           });
        }
        if (Inventory.input3ProductId[id]) {
           node.inputs.push({
             productId: world.dataStore.getProduct(Inventory.input3ProductId[id])?.name || null,
             amount: Inventory.input3Amount[id],
             quality: Inventory.input3Quality[id]
           });
        }
      }

      if (template.type === BuildingType.WAREHOUSE) {
        node.distributionRadius = Warehouse.distributionRadius[id];
      }

      nodes.push(node);
    });

    return {
      raw: nodes.filter(n => n.type === BuildingType.FARM || n.type === BuildingType.MINE),
      factories: nodes.filter(n => n.type === BuildingType.FACTORY),
      retail: nodes.filter(n => n.type === BuildingType.RETAIL || n.type === BuildingType.SUPERMARKET),
      warehouses: nodes.filter(n => n.type === BuildingType.WAREHOUSE),
      totalOutput: totalOutputAmount,
      avgEfficiency: factoryCount > 0 ? (totalEfficiency / factoryCount) : 0,
    };
  }, [world, world.tick]);

  const renderRawNode = (node: LogisticsNode) => (
    <div key={node.id} className={`logistics-node raw-node ${selectedNode === node.id ? 'selected' : ''}`} onClick={() => setSelectedNode(node.id)}>
      <div className="node-header">
        <span className="node-icon">{node.type === BuildingType.FARM ? '🚜' : '⛏️'}</span>
        <h4>{t(`buildings.${node.name}`, { defaultValue: node.name })}</h4>
      </div>
      <div className="node-stats">
        <div className="stat">
          <span className="label">Output</span>
          <span className="value">{node.outputProduct ? t(`products.${node.outputProduct}`, {defaultValue: node.outputProduct}) : 'Idle'}</span>
        </div>
        <div className="stat">
          <span className="label">Stock</span>
          <span className="value">{Math.floor(node.outputStock).toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">Quality</span>
          <span className={`value ${node.outputQuality! < 50 ? 'danger' : 'success'}`}>{node.outputQuality}%</span>
        </div>
      </div>
    </div>
  );

  const renderFactoryNode = (node: LogisticsNode) => (
    <div key={node.id} className={`logistics-node factory-node ${selectedNode === node.id ? 'selected' : ''}`} onClick={() => setSelectedNode(node.id)}>
      <div className="node-header">
        <span className="node-icon">🏭</span>
        <h4>{t(`buildings.${node.name}`, { defaultValue: node.name })}</h4>
      </div>
      <div className="node-stats">
        <div className="stat">
          <span className="label">Output</span>
          <span className="value">{node.outputProduct ? t(`products.${node.outputProduct}`, {defaultValue: node.outputProduct}) : 'Idle'}</span>
        </div>
        <div className="stat">
          <span className="label">Stock</span>
          <span className="value">{Math.floor(node.outputStock).toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">Efficiency</span>
          <span className={`value ${node.efficiency! < 50 ? 'danger' : 'success'}`}>{node.efficiency}%</span>
        </div>
      </div>
      {node.inputs && node.inputs.length > 0 && (
        <div className="node-inputs">
          <div className="inputs-title">Raw Materials / Components:</div>
          {node.inputs.map((inp, idx) => (
            <div key={idx} className="input-item">
              <span>{t(`products.${inp.productId}`, {defaultValue: inp.productId || 'Unknown'})}</span>
              <div className="input-bar">
                 <div className="fill" style={{ width: `${Math.min((inp.amount / 1000) * 100, 100)}%` }}></div>
              </div>
              <span className="stock">{Math.floor(inp.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRetailNode = (node: LogisticsNode) => (
    <div key={node.id} className={`logistics-node retail-node ${selectedNode === node.id ? 'selected' : ''}`} onClick={() => setSelectedNode(node.id)}>
      <div className="node-header">
        <span className="node-icon">🛒</span>
        <h4>{t(`buildings.${node.name}`, { defaultValue: node.name })}</h4>
      </div>
      <div className="node-stats">
        <div className="stat">
          <span className="label">Morale</span>
          <span className={`value ${node.morale! < 40 ? 'danger' : 'success'}`}>{node.morale}%</span>
        </div>
      </div>
      {node.inputs && node.inputs.length > 0 && (
        <div className="node-inputs">
          <div className="inputs-title">Store Inventory Slots:</div>
          {node.inputs.map((inp, idx) => (
            <div key={idx} className="input-item">
              <span>{t(`products.${inp.productId}`, {defaultValue: inp.productId || 'Unknown'})}</span>
              <div className="input-bar retail-bar">
                 <div className="fill" style={{ width: `${Math.min((inp.amount / 500) * 100, 100)}%` }}></div>
              </div>
              <span className="stock">{Math.floor(inp.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWarehouseNode = (node: LogisticsNode) => (
    <div key={node.id} className={`logistics-node warehouse-node ${selectedNode === node.id ? 'selected' : ''}`} onClick={() => setSelectedNode(node.id)}>
      <div className="node-header">
        <span className="node-icon">📦</span>
        <h4>{t(`buildings.${node.name}`, { defaultValue: node.name })}</h4>
      </div>
      <div className="node-stats">
        <div className="stat">
          <span className="label">Stock</span>
          <span className="value">{Math.floor(node.outputStock).toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">Radius</span>
          <span className="value">{node.distributionRadius || 0}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="logistics-dashboard-overlay">
      <div className="logistics-dashboard glass-panel">
        
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-left">
            <span className="premium-icon">⚙️</span>
            <h2>SUPPLY CHAIN & PRODUCTION</h2>
          </div>
          <button className="premium-icon-btn close-btn" onClick={onClose} style={{ '--btn-color': '#ef4444' } as React.CSSProperties}>
            ✕<div className="btn-glow"></div>
          </button>
        </div>

        {/* Global KPIs */}
        <div className="logistics-kpi-bar">
          <div className="kpi-card">
            <span className="kpi-label">TOTAL FACTORIES</span>
            <span className="kpi-value">{logisticsData.factories.length}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">RETAIL OUTLETS</span>
            <span className="kpi-value">{logisticsData.retail.length}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">AVG EFFICIENCY</span>
            <span className={`kpi-value ${logisticsData.avgEfficiency < 50 ? 'danger' : 'success'}`}>
              {Math.round(logisticsData.avgEfficiency)}%
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">MONTHLY OUTPUT</span>
            <span className="kpi-value highlight">{Math.floor(logisticsData.totalOutput).toLocaleString()} units</span>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="dashboard-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            Network Overview
          </button>
          <button className={activeTab === 'raw' ? 'active' : ''} onClick={() => setActiveTab('raw')}>
            Raw Materials ({logisticsData.raw.length})
          </button>
          <button className={activeTab === 'factories' ? 'active' : ''} onClick={() => setActiveTab('factories')}>
            Production ({logisticsData.factories.length})
          </button>
          <button className={activeTab === 'warehouses' ? 'active' : ''} onClick={() => setActiveTab('warehouses')}>
            Warehouses ({logisticsData.warehouses.length})
          </button>
          <button className={activeTab === 'retail' ? 'active' : ''} onClick={() => setActiveTab('retail')}>
            Distribution ({logisticsData.retail.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="network-overview">
               <div className="network-flow expanded-flow">
                 <div className="network-column">
                   <h3>RAW MATERIALS</h3>
                   <div className="node-list">
                     {logisticsData.raw.length > 0 ? logisticsData.raw.map(renderRawNode) : <div className="empty-state">No Raw Material Producers</div>}
                   </div>
                 </div>
                 
                 <div className="flow-arrows">
                   <svg viewBox="0 0 100 400" preserveAspectRatio="none">
                     <path d="M 0 200 L 100 200" stroke="rgba(0,217,165,0.4)" strokeWidth="2" strokeDasharray="5 5" className="flow-line"/>
                     <polygon points="90,195 100,200 90,205" fill="rgba(0,217,165,0.8)" />
                   </svg>
                 </div>

                 <div className="network-column">
                   <h3>MANUFACTURING</h3>
                   <div className="node-list">
                     {logisticsData.factories.length > 0 ? logisticsData.factories.map(renderFactoryNode) : <div className="empty-state">No Factories</div>}
                   </div>
                 </div>
                 
                 <div className="flow-arrows">
                   <svg viewBox="0 0 100 400" preserveAspectRatio="none">
                     <path d="M 0 200 L 100 200" stroke="rgba(0,217,165,0.4)" strokeWidth="2" strokeDasharray="5 5" className="flow-line"/>
                     <polygon points="90,195 100,200 90,205" fill="rgba(0,217,165,0.8)" />
                   </svg>
                 </div>

                 <div className="network-column">
                   <h3>DISTRIBUTION</h3>
                   <div className="node-list">
                     {logisticsData.warehouses.length > 0 && logisticsData.warehouses.map(renderWarehouseNode)}
                     {logisticsData.retail.length > 0 && logisticsData.retail.map(renderRetailNode)}
                     {logisticsData.warehouses.length === 0 && logisticsData.retail.length === 0 && <div className="empty-state">No Retail Operations</div>}
                   </div>
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="tab-pane">
              <div className="node-grid">
                {logisticsData.raw.map(renderRawNode)}
              </div>
            </div>
          )}

          {activeTab === 'factories' && (
            <div className="tab-pane">
              <div className="node-grid">
                {logisticsData.factories.map(renderFactoryNode)}
              </div>
            </div>
          )}

          {activeTab === 'warehouses' && (
            <div className="tab-pane">
              <div className="node-grid">
                {logisticsData.warehouses.map(renderWarehouseNode)}
              </div>
            </div>
          )}

          {activeTab === 'retail' && (
            <div className="tab-pane">
              <div className="node-grid">
                {logisticsData.retail.map(renderRetailNode)}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
