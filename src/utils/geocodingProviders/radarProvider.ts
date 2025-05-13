
/**
 * Radar geocoding provider
 * Free tier: 100,000 Monthly core API calls, 1,000 Monthly premium API calls
 */

// We'll use the client-side publishable key since this is client-side geocoding
const RADAR_API_KEY = "prj_live_pk_34806634a9fc9c74bfc04d0a6de1f9e229071feb";

// Track usage to stay within limits
let monthlyRequestCount = 0;
const MONTHLY_LIMIT = 95000; // Conservative buffer below the 100k limit

/**
 * Geocode an address using Radar API
 */
export const geocodeAddressWithRadar = async (
  address: string,
  businessHint?: string
): Promise<[number, number] | null> => {
  try {
    // Check if we've reached the monthly limit
    if (monthlyRequestCount >= MONTHLY_LIMIT) {
      console.log("Radar monthly limit approaching, skipping this provider");
      return null;
    }
    
    // Increment counter
    monthlyRequestCount++;
    
    // Prepare search query with business hint if available
    const query = businessHint 
      ? `${businessHint} ${address}`
      : address;
    
    const encodedQuery = encodeURIComponent(query);
    
    const url = `https://api.radar.io/v1/geocode/forward?query=${encodedQuery}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': RADAR_API_KEY
      }
    });
    
    if (!response.ok) {
      console.error(`Radar API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.addresses && data.addresses.length > 0) {
      const address = data.addresses[0];
      return [address.latitude, address.longitude];
    }
    
    return null;
  } catch (error) {
    console.error("Radar geocoding error:", error);
    return null;
  }
};

export const checkRadarQuota = (): boolean => {
  // Return true if we haven't reached the monthly limit
  return monthlyRequestCount < MONTHLY_LIMIT;
};

// Reset counter function that could be called at the beginning of each month
// This would need to be modified with proper storage in a real app
export const resetMonthlyCounter = () => {
  monthlyRequestCount = 0;
};
