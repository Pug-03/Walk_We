import { bangkok } from './cities/bangkok.ts';
import type { CityConfig } from './types.ts';

export * from './types.ts';
export { bangkok };

export const cities: Record<string, CityConfig> = { bangkok };

/** The single active city for the MVP. Multi-city: pick by id from env/user choice. */
export const activeCity: CityConfig = bangkok;
