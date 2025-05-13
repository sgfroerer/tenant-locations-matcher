
/**
 * MapTiler geocoding provider
 */

const MAPTILER_API_KEY = "TbsQ5qLxJHC20Jv4Th7E";

// Track usage (MapTiler has limits but they're not explicitly stated for the free tier)
let requestCount = 0;
let lastResetDay = new Date().getDate();
const ESTIMATED_DAILY_LIMIT = 1000; // Conservative estimate

/**
 * Reset request counter if it's a new day
 */
const checkAndResetDailyCounter = () => {
  const today = new Date().getDate();
  if (today !== lastResetDay) {
    requestCount = 0;
    lastResetDay = today;
  }
};

/**
 * Geocode an address using MapTiler API
 */
export const geocodeAddressWithMapTiler = async (
  address: string,
  businessHint?: string
): Promise<[number, number] | null> => {
  try {
    // Check and reset daily counter if needed
    checkAndResetDailyCounter();
    
    // Check if we're approaching an estimated limit
    if (requestCount >= ESTIMATED_DAILY_LIMIT) {
      console.log("MapTiler estimated daily limit approaching, skipping this provider");
      return null;
    }
    
    // Increment counter
    requestCount++;
    
    // Prepare search text with business hint if available
    const searchText = businessHint 
      ? `${businessHint} ${address}`
      : address;
    
    const encodedQuery = encodeURIComponent(searchText);
    
    const url = `https://api.maptiler.com/geocoding/${encodedQuery}.json?key=${MAPTILER_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`MapTiler API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.features && data.features.length > 0) {
      const coordinates = data.features[0].center;
      // MapTiler returns [longitude, latitude], so we need to swap them
      return [coordinates[1], coordinates[0]];
    }
    
    return null;
  } catch (error) {
    console.error("MapTiler geocoding error:", error);
    return null;
  }
};

export const checkMapTilerQuota = (): boolean => {
  checkAndResetDailyCounter();
  // Return true if we haven't reached the estimated daily limit
  return requestCount < ESTIMATED_DAILY_LIMIT;
};
