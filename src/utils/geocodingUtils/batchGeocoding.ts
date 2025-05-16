
import { toast } from "@/hooks/use-toast";
import { geocodeAddress } from './geocoding';

/**
 * Batch geocode addresses with proper provider rotation and rate limiting
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
