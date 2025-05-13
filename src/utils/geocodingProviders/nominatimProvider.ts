
/**
 * OpenStreetMap Nominatim geocoding provider
 * Free service with usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

import { toast } from "@/hooks/use-toast";

// Rate limiting parameters for Nominatim
const MIN_TIME_BETWEEN_REQUESTS = 1500; // 1.5 seconds between requests
let lastRequestTime = 0;

/**
 * Geocode an address using OpenStreetMap's Nominatim API
 */
export const geocodeAddressWithNominatim = async (
  address: string,
  businessHint?: string
): Promise<[number, number] | null> => {
  try {
    // Respect Nominatim usage policy with rate limiting
    const now = Date.now();
    const timeToWait = Math.max(0, MIN_TIME_BETWEEN_REQUESTS - (now - lastRequestTime));
    
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Update last request time
    lastRequestTime = Date.now();
    
    // Prepare the address for URL - add business hint if provided
    const searchQuery = businessHint 
      ? `${businessHint} ${address}`
      : address;
    const encodedAddress = encodeURIComponent(searchQuery);
    
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
      console.error(`Nominatim API error: ${response.status} ${response.statusText}`);
      return null;
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
    console.error("Nominatim geocoding error:", error);
    return null;
  }
};

export const checkNominatimQuota = (): boolean => {
  // Nominatim is free but rate-limited
  // This is a simple check to ensure we're not making requests too quickly
  const now = Date.now();
  return (now - lastRequestTime) >= MIN_TIME_BETWEEN_REQUESTS;
};
