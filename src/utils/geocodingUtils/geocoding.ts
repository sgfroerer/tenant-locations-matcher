
import { getBusinessTypeHints } from './businessTypes';
import { getNextAvailableProvider, updateLastUsedProviderIndex } from './providerRegistry';

/**
 * Alternate between geocoding providers and handle failover
 */
export const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  const providerInfo = getNextAvailableProvider();
  
  if (!providerInfo) {
    console.error("All geocoding providers failed or exceeded quota");
    return null;
  }
  
  const { provider, index } = providerInfo;
  
  try {
    console.log(`Trying geocoding with ${provider.name}`);
    const result = await provider.geocodeFunction(address);
    
    if (result) {
      // Update last used provider index
      updateLastUsedProviderIndex(index);
      console.log(`Successfully geocoded with ${provider.name}`);
      return result;
    }
  } catch (error) {
    console.error(`Error with ${provider.name} provider:`, error);
  }
  
  // If this provider failed, try the next one
  return geocodeAddress(address);
};

/**
 * Enhanced geocoding with business type hints for better accuracy
 * Uses business name to determine likely business type for better geocoding
 * Also rotates through multiple providers
 */
export const enhancedGeocode = async (
  address: string, 
  businessName?: string
): Promise<[number, number] | null> => {
  try {
    // First try with the address as is
    const result = await geocodeAddress(address);
    if (result) return result;
    
    // If that fails and we have a business name, try with business type hints
    if (businessName) {
      const businessTypes = getBusinessTypeHints(businessName);
      
      // Try with business type hints if any matched
      if (businessTypes.length > 0) {
        for (const type of businessTypes) {
          const enhancedAddress = `${type} ${address}`;
          const result = await geocodeAddress(enhancedAddress);
          if (result) return result;
        }
      }
      
      // As a last resort, try with just the business name and address
      if (businessName) {
        const namedAddress = `${businessName} ${address}`;
        return await geocodeAddress(namedAddress);
      }
    }
    
    return null;
  } catch (error) {
    console.error("Enhanced geocoding error:", error);
    return null;
  }
};
