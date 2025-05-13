
import { toast } from "@/hooks/use-toast";

// Rate limiting parameters for Nominatim
const MIN_TIME_BETWEEN_REQUESTS = 1500; // 1.5 seconds between requests
let lastRequestTime = 0;

/**
 * Geocode an address using OpenStreetMap's Nominatim API
 * Respects usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */
export const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
  try {
    // Respect Nominatim usage policy with rate limiting
    const now = Date.now();
    const timeToWait = Math.max(0, MIN_TIME_BETWEEN_REQUESTS - (now - lastRequestTime));
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Update last request time
    lastRequestTime = Date.now();
    
    // Prepare the address for URL
    const encodedAddress = encodeURIComponent(address);
    
    // Make the geocoding request
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'AddressVerificationTool/1.0',
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        return [lat, lon];
      }
    }
    
    // No results found
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};

/**
 * Batch geocode addresses with proper rate limiting
 * Returns a map of address to coordinates
 */
export const batchGeocodeAddresses = async (
  addresses: string[]
): Promise<Record<string, [number, number]>> => {
  const results: Record<string, [number, number]> = {};
  let successCount = 0;
  let failCount = 0;
  
  // Create a copy to avoid mutation issues
  const addressesToProcess = [...addresses];
  
  for (const address of addressesToProcess) {
    const coords = await geocodeAddress(address);
    
    if (coords) {
      results[address] = coords;
      successCount++;
    } else {
      failCount++;
    }
    
    // Show progress notification every 10 addresses
    if ((successCount + failCount) % 10 === 0 || successCount + failCount === addresses.length) {
      toast({
        title: "Geocoding progress",
        description: `Processed ${successCount + failCount} of ${addresses.length} addresses (${successCount} successful)`,
        duration: 2000,
      });
    }
  }
  
  return results;
};

// More comprehensive business types for various businesses
const BUSINESS_TYPES: Record<string, string[]> = {
  // Retail stores
  'petsmart': ['pet store', 'pet shop', 'pet supply'],
  'petco': ['pet store', 'pet shop', 'pet supply'],
  'walmart': ['supermarket', 'department store', 'walmart'],
  'target': ['department store', 'target', 'retail'],
  'costco': ['wholesale', 'supermarket', 'costco'],
  'home depot': ['hardware store', 'home improvement'],
  'lowes': ['hardware store', 'home improvement'],
  'best buy': ['electronics store', 'technology'],
  'apple store': ['electronics store', 'technology'],
  'ikea': ['furniture store', 'home furnishings'],
  
  // Food & restaurants
  'mcdonalds': ['restaurant', 'fast food', 'burger'],
  'burger king': ['restaurant', 'fast food', 'burger'],
  'wendys': ['restaurant', 'fast food', 'burger'],
  'taco bell': ['restaurant', 'fast food', 'mexican'],
  'chipotle': ['restaurant', 'mexican', 'fast casual'],
  'starbucks': ['cafe', 'coffee shop', 'coffeehouse'],
  'subway': ['restaurant', 'sandwich shop', 'fast food'],
  
  // Gas stations
  'shell': ['gas station', 'fuel', 'service station'],
  'bp': ['gas station', 'fuel', 'service station'],
  'exxon': ['gas station', 'fuel', 'service station'],
  
  // Hotels
  'marriott': ['hotel', 'lodging', 'accommodation'],
  'hilton': ['hotel', 'lodging', 'accommodation'],
  'holiday inn': ['hotel', 'lodging', 'accommodation'],
  
  // Banks
  'bank of america': ['bank', 'financial institution'],
  'chase': ['bank', 'financial institution'],
  'wells fargo': ['bank', 'financial institution'],
  
  // Default case - generic business types by category
  'store': ['store', 'retail', 'shop'],
  'restaurant': ['restaurant', 'eatery', 'dining'],
  'hotel': ['hotel', 'motel', 'lodging'],
  'bank': ['bank', 'financial institution'],
  'gas': ['gas station', 'fuel', 'service station'],
  'pharmacy': ['pharmacy', 'drug store'],
  'grocery': ['grocery store', 'supermarket'],
};

/**
 * Enhanced geocoding with business type hints for better accuracy
 * Uses business name to determine likely business type for better geocoding
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
      const lowerBusinessName = businessName.toLowerCase();
      
      // Find matching business types
      let businessTypes: string[] = [];
      
      // Try to find an exact match first
      for (const [key, types] of Object.entries(BUSINESS_TYPES)) {
        if (lowerBusinessName.includes(key)) {
          businessTypes = types;
          break;
        }
      }
      
      // If no exact match, try to categorize based on common terms
      if (businessTypes.length === 0) {
        // Check for generic business categories
        if (/restaurant|diner|cafe|grill|bar|pub/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['restaurant'];
        } else if (/store|shop|mart|retail/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['store'];
        } else if (/hotel|inn|suites|lodging/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['hotel'];
        } else if (/bank|credit union|financial/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['bank'];
        } else if (/gas|petrol|fuel|station/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['gas'];
        } else if (/pharmacy|drug|rx/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['pharmacy'];
        } else if (/grocery|food|market/i.test(lowerBusinessName)) {
          businessTypes = BUSINESS_TYPES['grocery'];
        }
      }
      
      // Try again with business type hints if any matched
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
