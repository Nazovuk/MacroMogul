// WarehouseSystem handles distribution of buffered goods from warehouses to retail stores.
// It moves inventory from Warehouse.bufferLevel to Retail stores based on demand and distance.

import { defineQuery } from 'bitecs';
import { Warehouse, Building, Position, RetailPlot, Inventory } from '../components';
import { GameWorld } from '../world';

export const warehouseSystem = (world: GameWorld) => {
  // Query all operational warehouses
  const warehouseQuery = defineQuery([Warehouse, Building, Position]);
  const warehouses = warehouseQuery(world.ecsWorld);

  // Query all retail stores
  const retailQuery = defineQuery([RetailPlot, Building, Position, Inventory]);
  const retailStores = retailQuery(world.ecsWorld);

  // Simple distribution: each warehouse supplies up to its maxStores nearest retail stores.
  for (const wId of warehouses) {
    if (Building.isOperational[wId] === 0) continue;
    const maxStores = Warehouse.maxStores[wId] || 5;
    const buffer = Warehouse.bufferLevel[wId] || 0;
    if (buffer <= 0) continue;

    // Gather candidate retail stores sorted by distance (Manhattan)
    const candidates = retailStores
      .filter(rId => Building.isOperational[rId] === 1)
      .map(rId => ({
        id: rId,
        dist: Math.abs(Position.x[wId] - Position.x[rId]) + Math.abs(Position.y[wId] - Position.y[rId]),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, maxStores);

    // Distribute buffer equally among selected stores
    const share = Math.floor(buffer / candidates.length) || 0;
    if (share <= 0) continue;

    for (const { id: rId } of candidates) {
      // Increase retail store's inventory buffer (using Inventory component)
      Inventory.capacity[rId] += share; // treat capacity as available stock for simplicity
      // Decrease warehouse buffer
      Warehouse.bufferLevel[wId] -= share;
    }
  }

  return world;
};
