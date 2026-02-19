import { defineQuery } from 'bitecs'
import { TechAge, Building } from '../components'
import { GameWorld } from '../world'

/**
 * TechSystem handles R&D progress and product obsolescence.
 * 
 * Logic:
 * 1. Accumulate Innovation Points based on R&D centers.
 * 2. Update TechLevel of products.
 * 3. Calculate obsolescence impact on efficiency/quality.
 */
export const techSystem = (world: GameWorld) => {
  const techQuery = defineQuery([TechAge, Building])
  const entities = techQuery(world.ecsWorld)

  for (const id of entities) {
    if (Building.isOperational[id] === 0) continue

    // 1. Generate Innovation Points
    const pointsPerTick = 1 // Base
    TechAge.innovationPoints[id] += pointsPerTick

    // 2. Breakthrough logic
    // Every 1000 points, level up
    if (TechAge.innovationPoints[id] >= 1000) {
      if (TechAge.currentLevel[id] < TechAge.maxLevel[id]) {
        TechAge.currentLevel[id]++
        TechAge.innovationPoints[id] = 0
        console.log(`[TechSystem] Entity ${id} reached Tech Level ${TechAge.currentLevel[id]}`)
      }
    }

    // 3. Obsolescence (future integration)
    // As world tech moves forward, old buildings lose efficiency
  }

  return world
}
