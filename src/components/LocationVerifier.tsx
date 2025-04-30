
import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type Location = {
  address: string;
  propertyId?: string;
  tenant?: string;
  verified?: boolean;
  coordinates?: [number, number]; // [lat, lng]
};

interface LocationVerifierProps {
  costarOnlyAddresses: string[];
  costarPropertyIds: Record<string, string>;
  costarTenantNames?: Record<string, string>;
  onVerificationComplete: (verifiedAddresses: { address: string; propertyId?: string; tenant?: string; keep: boolean }[]) => void;
}

// CSS for custom marker with pulse effect
const mapStyles = `
  .search-marker-icon {
    width: 30px;
    height: 30px;
    position: relative;
  }
  
  .search-marker-icon .marker-pin {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #3b82f6;
    position: absolute;
    top: 5px;
    left: 5px;
    z-index: 1;
  }
  
  .search-marker-icon .marker-pulse {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #3b82f6;
    position: absolute;
    top: 0;
    left: 0;
    animation: pulse 1.5s infinite ease-out;
    opacity: 0.6;
  }
  
  @keyframes pulse {
    0% { transform: scale(0); opacity: 0.6; }
    50% { transform: scale(1); opacity: 0.3; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  .verified-marker .marker-pin {
    background-color: #10b981;
  }

  .rejected-marker .marker-pin {
    background-color: #ef4444;
  }

  .current-marker .marker-pin {
    background-color: #f97316;
  }
`;

// Function to geocode using Census Geocoder API
const geocodeWithCensus = async (address: string): Promise<[number, number] | null> => {
  try {
    // Format the address for the Census API
    const formattedAddress = encodeURIComponent(address);
    
    // Make request to Census Geocoder API (using onelineaddress format)
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${formattedAddress}&benchmark=Public_AR_Current&format=json`
    );
    
    const data = await response.json();
    
    // Check if we have valid matches
    if (data && 
        data.result && 
        data.result.addressMatches && 
        data.result.addressMatches.length > 0) {
      
      const match = data.result.addressMatches[0];
      const coordinates = match.coordinates;
      
      // Census API returns coordinates as [longitude, latitude]
      // But we need [latitude, longitude] for Leaflet
      return [coordinates.y, coordinates.x];
    }
    
    return null;
  } catch (error) {
    console.error("Error using Census geocoder:", error);
    return null;
  }
};

// Helper function to add delay between geocoding requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const LocationVerifier: React.FC<LocationVerifierProps> = ({
  costarOnlyAddresses,
  costarPropertyIds,
  costarTenantNames = {},
  onVerificationComplete,
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const currentMarkerRef = useRef<any>(null);
  const { toast } = useToast();
  
  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Add style element for custom markers
    const styleElement = document.createElement('style');
    styleElement.textContent = mapStyles;
    document.head.appendChild(styleElement);
    
    const loadLeaflet = async () => {
      try {
        // Dynamic imports
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        
        setLeaflet(L);
        setMapLoaded(true);
      } catch (error) {
        console.error("Error loading Leaflet:", error);
        toast({
          variant: "destructive",
          title: "Error loading map",
          description: "Please refresh the page and try again."
        });
      }
    };
    
    loadLeaflet();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      // Clean up style element
      document.head.removeChild(styleElement);
    };
  }, [toast]);
  
  // Initialize locations from props
  useEffect(() => {
    if (costarOnlyAddresses.length === 0) return;
    
    setLocations(costarOnlyAddresses.map(address => ({
      address,
      propertyId: costarPropertyIds[address] || undefined,
      tenant: costarTenantNames[address] || undefined,
      verified: undefined
    })));
  }, [costarOnlyAddresses, costarPropertyIds, costarTenantNames]);
  
  // Create custom marker icon with pulse effect
  const createCustomMarkerIcon = (L: any, isVerified: boolean = false, isRejected: boolean = false, isCurrent: boolean = false) => {
    // Create a custom HTML element for the marker
    const markerHtml = document.createElement('div');
    let className = 'search-marker-icon';
    if (isVerified) className += ' verified-marker';
    if (isRejected) className += ' rejected-marker';
    if (isCurrent) className += ' current-marker';
    markerHtml.className = className;
    
    const pulse = document.createElement('div');
    pulse.className = 'marker-pulse';
    markerHtml.appendChild(pulse);
    
    const pin = document.createElement('div');
    pin.className = 'marker-pin';
    markerHtml.appendChild(pin);
    
    return L.divIcon({
      html: markerHtml,
      className: 'custom-marker-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };
  
  // Initialize map when Leaflet is loaded
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapRef.current) return;
    
    if (!mapInstanceRef.current) {
      // Initialize map
      mapInstanceRef.current = leaflet.map(mapRef.current).setView([37.0902, -95.7129], 4);
      
      // Add Google Hybrid tile layer with HTTPS URL
      leaflet.tileLayer('https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps'
      }).addTo(mapInstanceRef.current);
    }
  }, [mapLoaded, leaflet]);
  
  // Update current location when index changes
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current) return;
    if (locations.length === 0 || currentIndex >= locations.length) return;
    
    // Update map for current location
    const currentLocation = locations[currentIndex];
    if (currentLocation) {
      updateMapForAddress(currentLocation, true);
    }
  }, [currentIndex, locations, mapLoaded, leaflet]);
  
  // Geocode and add markers for locations in batches to avoid rate limiting
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current || locations.length === 0) return;
    
    // Clear all existing markers first
    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current.clear();
    
    if (currentMarkerRef.current) {
      mapInstanceRef.current.removeLayer(currentMarkerRef.current);
      currentMarkerRef.current = null;
    }
    
    // Process locations in smaller batches to avoid overwhelming the geocoding service
    const batchSize = 5;
    const processBatch = async (startIndex: number) => {
      const batch = locations.slice(startIndex, startIndex + batchSize);
      
      // Skip this batch if it's empty
      if (batch.length === 0) return;
      
      const geocodingPromises = batch.map(async (location, index) => {
        // Skip if already has coordinates
        if (location.coordinates) return location;
        
        try {
          // Add delay between requests to avoid rate limiting
          await delay(index * 300);
          
          // Try Census Geocoder first
          const censusCoordinates = await geocodeWithCensus(location.address);
          if (censusCoordinates) {
            return {
              ...location,
              coordinates: censusCoordinates as [number, number]
            };
          }
          
          // If Census geocoder fails, try OpenStreetMap as fallback with longer delay
          await delay(500);
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.address)}`
            );
            const data = await response.json();
            
            if (data && data.length > 0) {
              const { lat, lon } = data[0];
              return {
                ...location,
                coordinates: [parseFloat(lat), parseFloat(lon)] as [number, number]
              };
            }
            
            return location;
          } catch (error) {
            console.error(`Error with OpenStreetMap geocoding for address ${location.address}:`, error);
            return location;
          }
        } catch (error) {
          console.error(`Error geocoding address ${location.address}:`, error);
          return location;
        }
      });
      
      try {
        // Process batch
        const updatedLocationsBatch = await Promise.all(geocodingPromises);
        
        // Update locations state with the geocoded batch
        setLocations(prevLocations => {
          const newLocations = [...prevLocations];
          updatedLocationsBatch.forEach((loc, idx) => {
            const originalIndex = startIndex + idx;
            if (originalIndex < newLocations.length) {
              newLocations[originalIndex] = loc;
            }
          });
          return newLocations;
        });
        
        // Add markers for this batch
        updateAllMarkers();
        
        // Process next batch if there are more locations
        if (startIndex + batchSize < locations.length) {
          setTimeout(() => processBatch(startIndex + batchSize), 2000);
        }
        
        // If we just processed the batch with the current location, update the map view
        if (currentIndex >= startIndex && currentIndex < startIndex + batchSize) {
          const currentLoc = updatedLocationsBatch[currentIndex - startIndex];
          if (currentLoc && currentLoc.coordinates) {
            updateMapForAddress(currentLoc, true);
          }
        }
      } catch (error) {
        console.error("Error processing geocoding batch:", error);
        // Continue with next batch despite errors
        if (startIndex + batchSize < locations.length) {
          setTimeout(() => processBatch(startIndex + batchSize), 2000);
        }
      }
    };
    
    // Start processing the first batch
    processBatch(0);
  }, [locations.length, mapLoaded, leaflet]);
  
  // Update markers when verification status changes
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current) return;
    
    // Update all markers to reflect current verification status
    updateAllMarkers();
    
  }, [locations.map(l => l.verified).join(','), mapLoaded, leaflet]);
  
  const updateAllMarkers = () => {
    if (!leaflet || !mapInstanceRef.current) return;
    
    // Remove all current markers except the current one
    markersRef.current.forEach((marker, address) => {
      if (locations[currentIndex] && address !== locations[currentIndex].address) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current.clear();
    
    // Add markers for all locations with coordinates
    locations.forEach((location, index) => {
      if (!location.coordinates || index === currentIndex) return;
      
      const icon = createCustomMarkerIcon(
        leaflet,
        location.verified === true,    // verified
        location.verified === false,   // rejected
        false                          // not current
      );
      
      const marker = leaflet.marker(location.coordinates, { icon })
        .addTo(mapInstanceRef.current);
      
      // Store the marker with the address as the key
      markersRef.current.set(location.address, marker);
      
      // Build popup content with available information
      let popupContent = `<b>${location.address}</b>`;
      
      if (location.propertyId) {
        popupContent += `<br>ID: ${location.propertyId}`;
      }
      
      if (location.tenant) {
        popupContent += `<br>Tenant: ${location.tenant}`;
      }
      
      if (location.verified !== undefined) {
        popupContent += `<br>Status: ${location.verified ? 'Keep' : 'Remove'}`;
      }
      
      // Bind popup but don't open it by default
      marker.bindPopup(popupContent);
      marker.closePopup();
    });
  };
  
  const updateMapForAddress = async (location: Location, isCurrent: boolean = false) => {
    if (!leaflet || !mapInstanceRef.current) return;
    
    try {
      // If we already have coordinates, use them
      if (location.coordinates) {
        // Update map view with animation
        mapInstanceRef.current.flyTo(location.coordinates, 16, {
          duration: 1.5,
          animate: true
        });
        
        // Update or create marker
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
          currentMarkerRef.current = null;
        }
        
        // Create marker with custom icon
        const icon = createCustomMarkerIcon(
          leaflet, 
          location.verified === true,
          location.verified === false,
          isCurrent
        );
        
        currentMarkerRef.current = leaflet.marker(location.coordinates, { icon })
          .addTo(mapInstanceRef.current);
        
        // Build popup content with available information
        let popupContent = `<b>${location.address}</b>`;
        
        if (location.propertyId) {
          popupContent += `<br>ID: ${location.propertyId}`;
        }
        
        if (location.tenant) {
          popupContent += `<br>Tenant: ${location.tenant}`;
        }
          
        // Bind popup but don't open it by default
        currentMarkerRef.current.bindPopup(popupContent);
        currentMarkerRef.current.closePopup();
        
        return;
      }
      
      // Try Census Geocoder first
      const censusCoordinates = await geocodeWithCensus(location.address);
      
      if (censusCoordinates) {
        // Update location with coordinates
        const updatedLocations = [...locations];
        const locationIndex = locations.findIndex(loc => loc.address === location.address);
        
        if (locationIndex !== -1) {
          updatedLocations[locationIndex] = {
            ...updatedLocations[locationIndex],
            coordinates: censusCoordinates as [number, number]
          };
          setLocations(updatedLocations);
        }
        
        // Update map view
        mapInstanceRef.current.flyTo(censusCoordinates, 16, {
          duration: 1.5,
          animate: true
        });
        
        // Update or create marker
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        }
        
        // Create marker with custom icon
        const icon = createCustomMarkerIcon(
          leaflet, 
          location.verified === true,
          location.verified === false,
          isCurrent
        );
        
        currentMarkerRef.current = leaflet.marker(censusCoordinates, { icon })
          .addTo(mapInstanceRef.current);
        
        // Build popup content with available information
        let popupContent = `<b>${location.address}</b>`;
        
        if (location.propertyId) {
          popupContent += `<br>ID: ${location.propertyId}`;
        }
        
        if (location.tenant) {
          popupContent += `<br>Tenant: ${location.tenant}`;
        }
          
        // Bind popup but don't open it by default
        currentMarkerRef.current.bindPopup(popupContent);
        currentMarkerRef.current.closePopup();
        
        return;
      }
      
      // Fall back to OpenStreetMap if Census geocoder fails
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.address)}`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          const coordinates: [number, number] = [parseFloat(lat), parseFloat(lon)];
          
          // Update location with coordinates
          const updatedLocations = [...locations];
          const locationIndex = locations.findIndex(loc => loc.address === location.address);
          
          if (locationIndex !== -1) {
            updatedLocations[locationIndex] = {
              ...updatedLocations[locationIndex],
              coordinates
            };
            setLocations(updatedLocations);
          }
          
          // Update map view
          mapInstanceRef.current.flyTo(coordinates, 16, {
            duration: 1.5,
            animate: true
          });
          
          // Update or create marker
          if (currentMarkerRef.current) {
            mapInstanceRef.current.removeLayer(currentMarkerRef.current);
          }
          
          // Create marker with custom icon
          const icon = createCustomMarkerIcon(
            leaflet, 
            location.verified === true,
            location.verified === false,
            isCurrent
          );
          
          currentMarkerRef.current = leaflet.marker(coordinates, { icon })
            .addTo(mapInstanceRef.current);
          
          // Build popup content with available information
          let popupContent = `<b>${location.address}</b>`;
          
          if (location.propertyId) {
            popupContent += `<br>ID: ${location.propertyId}`;
          }
          
          if (location.tenant) {
            popupContent += `<br>Tenant: ${location.tenant}`;
          }
            
          // Bind popup but don't open it by default
          currentMarkerRef.current.bindPopup(popupContent);
          currentMarkerRef.current.closePopup();
        } else {
          throw new Error("Location not found");
        }
      } catch (error) {
        // If both geocoding services fail, show a message
        toast({
          variant: "default",
          title: "Location not found",
          description: `Could not find coordinates for "${location.address}"`
        });
        
        // Center map on US
        mapInstanceRef.current.setView([37.0902, -95.7129], 4);
        
        // Remove marker if exists
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
          currentMarkerRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
      toast({
        variant: "destructive",
        title: "Geocoding error",
        description: "Unable to locate this address on the map."
      });
    }
  };
  
  const handleKeepLocation = () => {
    if (currentIndex >= locations.length) return;
    
    // Create a new array to ensure React detects the change
    const updatedLocations = [...locations];
    updatedLocations[currentIndex] = {
      ...updatedLocations[currentIndex],
      verified: true
    };
    
    setLocations(updatedLocations);
    
    // Move to the next location immediately
    moveToNextLocation();
  };
  
  const handleRemoveLocation = () => {
    if (currentIndex >= locations.length) return;
    
    // Create a new array to ensure React detects the change
    const updatedLocations = [...locations];
    updatedLocations[currentIndex] = {
      ...updatedLocations[currentIndex],
      verified: false
    };
    
    setLocations(updatedLocations);
    
    // Move to the next location immediately
    moveToNextLocation();
  };
  
  const moveToNextLocation = () => {
    if (currentIndex < locations.length - 1) {
      // Use functional update to ensure we're using the latest state
      setCurrentIndex(prevIndex => prevIndex + 1);
    } else {
      // All locations verified
      finishVerification();
    }
  };
  
  const selectLocation = (index: number) => {
    if (index === currentIndex) return; // Don't do anything if clicking current location
    setCurrentIndex(index);
  };
  
  const finishVerification = () => {
    const verifiedResults = locations.map(loc => ({
      address: loc.address,
      propertyId: loc.propertyId,
      tenant: loc.tenant,
      keep: loc.verified === true // Only true values are kept, undefined or false are not kept
    }));
    
    onVerificationComplete(verifiedResults);
  };
  
  if (locations.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p>No additional CoStar locations to verify.</p>
      </Card>
    );
  }
  
  const progress = Math.round((currentIndex / locations.length) * 100);
  
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-1">Verify Additional CoStar Locations</h2>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-grow bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{currentIndex + 1} of {locations.length}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div 
            ref={mapRef} 
            className="w-full h-[400px] bg-gray-100 rounded-md border"
          >
            {!mapLoaded && (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading map...</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-grow">
              <h3 className="font-semibold">Current address:</h3>
              <p className="text-lg">{locations[currentIndex]?.address}</p>
              {locations[currentIndex]?.propertyId && (
                <p className="text-sm text-muted-foreground">
                  Property ID: {locations[currentIndex].propertyId}
                </p>
              )}
              {locations[currentIndex]?.tenant && (
                <p className="text-sm text-muted-foreground">
                  Tenant: {locations[currentIndex].tenant}
                </p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                size="lg"
                onClick={handleRemoveLocation}
                className="flex gap-2 items-center"
              >
                <X size={18} /> Remove
              </Button>
              <Button 
                variant="default" 
                size="lg"
                onClick={handleKeepLocation}
                className="flex gap-2 items-center"
              >
                <Check size={18} /> Keep
              </Button>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">All CoStar Locations</h3>
          <ScrollArea className="h-[400px] border rounded-md p-2">
            {locations.map((location, index) => (
              <div key={index}>
                <div 
                  className={`
                    p-2 rounded-md cursor-pointer 
                    ${index === currentIndex ? 'bg-primary/10 border border-primary/30' : 'hover:bg-gray-100'}
                    ${location.verified === true ? 'border-l-4 border-l-green-500' : 
                      location.verified === false ? 'border-l-4 border-l-red-500' : ''}
                  `}
                  onClick={() => selectLocation(index)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{location.address}</p>
                      {location.propertyId && (
                        <p className="text-xs text-muted-foreground">ID: {location.propertyId}</p>
                      )}
                      {location.tenant && (
                        <p className="text-xs text-muted-foreground">Tenant: {location.tenant}</p>
                      )}
                    </div>
                    {location.verified !== undefined && (
                      <div>
                        {location.verified ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check size={12} className="mr-1" /> Keep
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <X size={12} className="mr-1" /> Remove
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {index < locations.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </ScrollArea>
          
          <div className="mt-4">
            <Button 
              onClick={finishVerification} 
              className="w-full"
            >
              Complete Verification
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LocationVerifier;
