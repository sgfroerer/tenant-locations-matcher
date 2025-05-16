
import { GeocodingProvider } from './types';
import { 
  geocodeAddressWithNominatim, 
  checkNominatimQuota 
} from '../geocodingProviders/nominatimProvider';
import { 
  geocodeAddressWithGeoapify, 
  checkGeoapifyQuota 
} from '../geocodingProviders/geoapifyProvider';
import { 
  geocodeAddressWithMapTiler, 
  checkMapTilerQuota 
} from '../geocodingProviders/maptilerProvider';
import { 
  geocodeAddressWithGeocodio, 
  checkGeocodioQuota 
} from '../geocodingProviders/geocodioProvider';
import { 
  geocodeAddressWithRadar, 
  checkRadarQuota 
} from '../geocodingProviders/radarProvider';

// Track which provider was last used to ensure we rotate
let lastUsedProviderIndex = -1;

/**
 * Registry of all available geocoding providers
 */
export const providers: GeocodingProvider[] = [
  {
    name: 'Nominatim',
    geocodeFunction: geocodeAddressWithNominatim,
    checkQuota: checkNominatimQuota
  },
  {
    name: 'Geoapify',
    geocodeFunction: geocodeAddressWithGeoapify,
    checkQuota: checkGeoapifyQuota
  },
  {
    name: 'MapTiler',
    geocodeFunction: geocodeAddressWithMapTiler,
    checkQuota: checkMapTilerQuota
  },
  {
    name: 'Geocodio',
    geocodeFunction: geocodeAddressWithGeocodio,
    checkQuota: checkGeocodioQuota
  },
  {
    name: 'Radar',
    geocodeFunction: geocodeAddressWithRadar,
    checkQuota: checkRadarQuota
  }
];

/**
 * Get the next available provider with quota
 * @returns The selected provider and its index
 */
export const getNextAvailableProvider = (): { provider: GeocodingProvider, index: number } | null => {
  let startIndex = (lastUsedProviderIndex + 1) % providers.length;
  let currentIndex = startIndex;
  
  do {
    const provider = providers[currentIndex];
    
    if (provider.checkQuota()) {
      return { provider, index: currentIndex };
    }
    
    currentIndex = (currentIndex + 1) % providers.length;
  } while (currentIndex !== startIndex);
  
  // No providers with quota available
  return null;
};

/**
 * Update the last used provider index
 */
export const updateLastUsedProviderIndex = (index: number): void => {
  lastUsedProviderIndex = index;
};

/**
 * Get the last used provider index
 */
export const getLastUsedProviderIndex = (): number => {
  return lastUsedProviderIndex;
};
