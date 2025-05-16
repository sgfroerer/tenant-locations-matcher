
/**
 * Common types used across geocoding utilities
 */

export interface GeocodingProvider {
  name: string;
  geocodeFunction: (address: string, businessHint?: string) => Promise<[number, number] | null>;
  checkQuota: () => boolean;
}

export type BusinessTypeHints = Record<string, string[]>;
