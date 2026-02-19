export const TILE_WIDTH = 64
export const TILE_HEIGHT = 32
export const TILE_DEPTH = 8

export type TileType = 'grass' | 'water' | 'concrete' | 'dirt' | 'sand' | 'forest' | 'road' | 'plaza'

export function hash(x: number, y: number, seed: number = 0): number {
  let h = seed + x * 374761393 + y * 668265263
  h = (h << 13) ^ h;
  return (h >>> 0) / 4294967296; 
}

// Simple fractal noise approximation
export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    value += hash(Math.floor(x * frequency), Math.floor(y * frequency), seed) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

export function getTileFromNoise(elevation: number, moisture: number, dist: number, urban: number): TileType {
  // Center is city
  if (urban > 0.6 + dist * 0.2) return 'concrete';
  
  // Coastline
  if (dist > 1.2 + hash(Math.floor(elevation*10), 0, 0)*0.1) return 'water';
  
  // Biomes
  if (elevation < 0.2) return 'water'; // Lowlands/Swamp
  if (elevation > 0.8) return 'dirt'; // Mountains
  
  if (moisture > 0.6) return 'forest';
  if (moisture < 0.3) return 'sand';
  
  return 'grass';
}
