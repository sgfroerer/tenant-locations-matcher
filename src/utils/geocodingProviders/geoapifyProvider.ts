
/**
 * Geoapify geocoding provider
 * Free tier: 3,000 requests/day
 */

const GEOAPIFY_API_KEY = "dd77408ff8ef4cca8895a022ad5e9b34";

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
 * Geocode an address using Geoapify API
 */
export const geocodeAddressWithGeoapify = async (
  address: string,
  businessHint?: string
): Promise<[number, number] | null> => {
  try {
    // Check and reset daily counter if needed
    checkAndResetDailyCounter();
    
    // Check if we've reached the daily limit
    if (dailyRequestCount >= 2900) { // Leave some buffer
      console.log("Geoapify daily limit approaching, skipping this provider");
      return null;
    }
    
    // Increment counter
    dailyRequestCount++;
    
    // Prepare search text with business hint if available
    const searchText = businessHint 
      ? `${businessHint} ${address}`
      : address;
    
    const encodedAddress = encodeURIComponent(searchText);
    
    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodedAddress}&format=json&apiKey=${GEOAPIFY_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Geoapify API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.results && data.results.length > 0) {
      const result = data.results[0];
      return [result.lat, result.lon];
    }
    
    return null;
  } catch (error) {
    console.error("Geoapify geocoding error:", error);
    return null;
  }
};

export const checkGeoapifyQuota = (): boolean => {
  checkAndResetDailyCounter();
  // Return true if we haven't reached the daily limit
  return dailyRequestCount < 2900; // Leave some buffer
};
