
/**
 * Geocodio geocoding provider
 * Free tier: 2,500 lookups/day
 */

const GEOCODIO_API_KEY = "605367036ff5ce3d0f4e605cbde074cc66d704d";

// Track usage to stay within limits
let dailyRequestCount = 0;
let lastResetDay = new Date().getDate();

/**
 * Reset request counter if it's a new day
 */
const checkAndResetDailyCounter = () => {
  const today = new Date().getDate();
  if (today !== lastResetDay) {
    dailyRequestCount = 0;
    lastResetDay = today;
  }
};

/**
 * Geocode an address using Geocodio API
 */
export const geocodeAddressWithGeocodio = async (
  address: string,
  businessHint?: string
): Promise<[number, number] | null> => {
  try {
    // Check and reset daily counter if needed
    checkAndResetDailyCounter();
    
    // Check if we've reached the daily limit
    if (dailyRequestCount >= 2400) { // Leave some buffer
      console.log("Geocodio daily limit approaching, skipping this provider");
      return null;
    }
    
    // Increment counter
    dailyRequestCount++;
    
    // Prepare the address - we don't use businessHint directly with Geocodio
    // as it works better with standard addresses
    const encodedAddress = encodeURIComponent(address);
    
    const url = `https://api.geocod.io/v1.7/geocode?q=${encodedAddress}&api_key=${GEOCODIO_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geocodio API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.results && data.results.length > 0) {
      const result = data.results[0].location;
      return [result.lat, result.lng];
    }
    
    return null;
  } catch (error) {
    console.error("Geocodio geocoding error:", error);
    return null;
  }
};

export const checkGeocodioQuota = (): boolean => {
  checkAndResetDailyCounter();
  // Return true if we haven't reached the daily limit
  return dailyRequestCount < 2400; // Leave some buffer
};
