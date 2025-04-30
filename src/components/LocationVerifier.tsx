
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
  verified?: boolean;
  coordinates?: [number, number]; // [lat, lng]
};

interface LocationVerifierProps {
  costarOnlyAddresses: string[];
  costarPropertyIds: Record<string, string>;
  onVerificationComplete: (verifiedAddresses: { address: string; propertyId?: string; keep: boolean }[]) => void;
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

  .current-marker .marker-pin {
    background-color: #f97316;
  }
`;

const LocationVerifier: React.FC<LocationVerifierProps> = ({
  costarOnlyAddresses,
  costarPropertyIds,
  onVerificationComplete,
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
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
    setLocations(costarOnlyAddresses.map(address => ({
      address,
      propertyId: costarPropertyIds[address] || undefined,
      verified: false
    })));
  }, [costarOnlyAddresses, costarPropertyIds]);
  
  // Create custom marker icon with pulse effect
  const createCustomMarkerIcon = (L: any, isVerified: boolean = false, isCurrent: boolean = false) => {
    // Create a custom HTML element for the marker
    const markerHtml = document.createElement('div');
    markerHtml.className = `search-marker-icon${isVerified ? ' verified-marker' : ''}${isCurrent ? ' current-marker' : ''}`;
    
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
      
      // Add Google Hybrid tile layer
      leaflet.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps'
      }).addTo(mapInstanceRef.current);
    }
    
    // Update map for current location
    if (locations[currentIndex]) {
      updateMapForAddress(locations[currentIndex], true);
    }
  }, [mapLoaded, leaflet, currentIndex, locations]);
  
  // Geocode all locations and add markers
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current || locations.length === 0) return;
    
    // Clear all existing markers
    markersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];
    
    // Geocode and add markers for all locations
    const geocodeAllLocations = async () => {
      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];
        
        // Skip if we already have coordinates
        if (location.coordinates) continue;
        
        try {
          // Throttle API requests to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.address)}`
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            const { lat, lon } = data[0];
            const coordinates: [number, number] = [parseFloat(lat), parseFloat(lon)];
            
            // Update location with coordinates
            const updatedLocations = [...locations];
            updatedLocations[i] = {
              ...updatedLocations[i],
              coordinates
            };
            setLocations(updatedLocations);
          }
        } catch (error) {
          console.error(`Error geocoding address ${location.address}:`, error);
        }
      }
      
      // Update the current location marker
      updateMapForAddress(locations[currentIndex], true);
    };
    
    geocodeAllLocations();
  }, [mapLoaded, leaflet, locations.length]); // Only run when locations array length changes
  
  // Update markers when locations are updated with coordinates
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current) return;
    
    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];
    
    // Add markers for all locations with coordinates
    locations.forEach((location, index) => {
      if (location.coordinates) {
        const isCurrentLocation = index === currentIndex;
        
        if (isCurrentLocation) {
          // Don't add duplicated marker for current location
          // It will be handled by updateMapForAddress
          return;
        }
        
        const icon = createCustomMarkerIcon(
          leaflet, 
          location.verified === true,
          false
        );
        
        const marker = leaflet.marker(location.coordinates, { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<b>${location.address}</b>` + 
            (location.propertyId ? `<br>ID: ${location.propertyId}` : '') + 
            (location.verified !== undefined ? 
              `<br>Status: ${location.verified ? 'Keep' : 'Remove'}` : 
              '')
          );
        
        markersRef.current.push(marker);
      }
    });
  }, [locations, currentIndex, mapLoaded, leaflet]);
  
  const updateMapForAddress = async (location: Location, isCurrent: boolean = false) => {
    if (!leaflet || !mapInstanceRef.current) return;
    
    try {
      // If we already have coordinates, use them
      if (location.coordinates) {
        // Update map view
        mapInstanceRef.current.setView(location.coordinates, 16);
        
        // Update or create marker
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        }
        
        // Create marker with custom icon
        const icon = createCustomMarkerIcon(
          leaflet, 
          location.verified === true,
          isCurrent
        );
        
        currentMarkerRef.current = leaflet.marker(location.coordinates, { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<b>${location.address}</b>` + 
            (location.propertyId ? `<br>ID: ${location.propertyId}` : '')
          )
          .openPopup();
        
        return;
      }
      
      // Geocode the address using Nominatim (OpenStreetMap)
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
        mapInstanceRef.current.setView(coordinates, 16);
        
        // Update or create marker
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        }
        
        // Create marker with custom icon
        const icon = createCustomMarkerIcon(
          leaflet, 
          location.verified === true,
          isCurrent
        );
        
        currentMarkerRef.current = leaflet.marker(coordinates, { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(
            `<b>${location.address}</b>` + 
            (location.propertyId ? `<br>ID: ${location.propertyId}` : '')
          )
          .openPopup();
          
      } else {
        // Changed from "warning" to "default" since "warning" is not a valid variant
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
    const updatedLocations = [...locations];
    updatedLocations[currentIndex] = {
      ...updatedLocations[currentIndex],
      verified: true
    };
    setLocations(updatedLocations);
    moveToNextLocation();
  };
  
  const handleRemoveLocation = () => {
    const updatedLocations = [...locations];
    updatedLocations[currentIndex] = {
      ...updatedLocations[currentIndex],
      verified: false
    };
    setLocations(updatedLocations);
    moveToNextLocation();
  };
  
  const moveToNextLocation = () => {
    if (currentIndex < locations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // All locations verified
      finishVerification();
    }
  };
  
  const selectLocation = (index: number) => {
    setCurrentIndex(index);
  };
  
  const finishVerification = () => {
    const verifiedResults = locations.map(loc => ({
      address: loc.address,
      propertyId: loc.propertyId,
      keep: !!loc.verified
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
          <span className="text-sm font-medium">{currentIndex} of {locations.length}</span>
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
