export interface CityData {
  id: string;
  name: string;
  x: number; // Percentage on map (0-100)
  y: number; // Percentage on map (0-100)
  population: string;
  gdp: string; // GDP in Trillions preferably
  seed: number;
}

export const CITIES: CityData[] = [
  { id: 'city_01', name: 'New York', x: 28, y: 35, population: '8.4M', gdp: '$1.8T', seed: 785438037 },
  { id: 'city_02', name: 'London', x: 48, y: 27, population: '8.9M', gdp: '$1.2T', seed: 334928123 },
  { id: 'city_03', name: 'Tokyo', x: 82, y: 36, population: '13.9M', gdp: '$1.6T', seed: 992837412 },
  { id: 'city_04', name: 'Shanghai', x: 78, y: 38, population: '26.3M', gdp: '$1.1T', seed: 44829103 },
  { id: 'city_05', name: 'Paris', x: 49, y: 30, population: '2.1M', gdp: '$0.9T', seed: 123987456 },
  { id: 'city_06', name: 'Sydney', x: 88, y: 75, population: '5.3M', gdp: '$0.4T', seed: 567890123 },
  { id: 'city_07', name: 'Singapore', x: 74, y: 56, population: '5.6M', gdp: '$0.5T', seed: 890123456 },
  { id: 'city_08', name: 'Dubai', x: 58, y: 42, population: '3.3M', gdp: '$0.2T', seed: 345678901 },
];
