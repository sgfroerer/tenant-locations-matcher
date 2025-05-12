import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MapPin, Locate } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { enhancedGeocode } from '@/utils/geocodingUtils';

type Location = {
  address: string;
  propertyId?: string;
  tenant?: string;
  verified?: boolean;
  coordinates?: [number, number]; // [lat, lng]
  manuallyPlaced?: boolean;
  isGeocoding?: boolean;
};

interface LocationVerifierProps {
  costarOnlyAddresses: string[];
  costarPropertyIds: Record<string, string>;
  costarTenantNames?: Record<string, string>;
  predefinedCoordinates?: Record<string, [number, number]>;
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
  
  .manual-placement-hint {
    background-color: rgba(0,0,0,0.7);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .geocoding-badge {
    background-color: rgba(59, 130, 246, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }

  .geocoding-badge.success {
    background-color: rgba(16, 185, 129, 0.8);
  }

  .geocoding-badge.error {
    background-color: rgba(239, 68, 68, 0.8);
  }
`;

// US center fallback
const defaultUSCoordinates: [number, number] = [39.8283, -98.5795];

const LocationVerifier: React.FC<LocationVerifierProps> = ({
  costarOnlyAddresses,
  costarPropertyIds,
  costarTenantNames = {},
  predefinedCoordinates = {},
  onVerificationComplete,
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [isManualPlacementMode, setIsManualPlacementMode] = useState(false);
  const [manualPlacementHintVisible, setManualPlacementHintVisible] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'geocoding' | 'success' | 'error'>('idle');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const currentMarkerRef = useRef<any>(null);
  const manualMarkerRef = useRef<any>(null);
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
    
    // Create locations from addresses
    const initialLocations = costarOnlyAddresses.map(address => {
      // Check if we have predefined coordinates
      let coordinates: [number, number] | undefined = predefinedCoordinates[address];
      let manuallyPlaced = !!coordinates;
      
      return {
        address,
        propertyId: costarPropertyIds[address] || undefined,
        tenant: costarTenantNames[address] || undefined,
        verified: undefined,
        coordinates,
        manuallyPlaced,
        isGeocoding: false
      };
    });
    
    setLocations(initialLocations);
    
    // Start geocoding the first location if it doesn't have coordinates
    const firstLocation = initialLocations[0];
    if (firstLocation && !firstLocation.coordinates) {
      geocodeCurrentLocation(0, initialLocations);
    }
  }, [costarOnlyAddresses, costarPropertyIds, costarTenantNames, predefinedCoordinates]);
  
  // Geocode the current location
  const geocodeCurrentLocation = async (index: number, locationsList?: Location[]) => {
    const locationsToUse = locationsList || locations;
    if (index >= locationsToUse.length) return;
    
    const location = locationsToUse[index];
    
    // Skip if already has coordinates or is currently geocoding
    if (location.coordinates || location.isGeocoding) return;
    
    // Update geocoding status
    setGeocodingStatus('geocoding');
    
    // Mark location as geocoding
    const updatedLocations = [...locationsToUse];
    updatedLocations[index] = { ...updatedLocations[index], isGeocoding: true };
    setLocations(updatedLocations);
    
    try {
      // Use enhanced geocoding with tenant name as hint
      const coords = await enhancedGeocode(location.address, location.tenant);
      
      if (coords) {
        // Update with geocoded coordinates
        const newLocations = [...updatedLocations];
        newLocations[index] = { 
          ...newLocations[index], 
          coordinates: coords,
          isGeocoding: false,
          manuallyPlaced: false // Not manually placed as we got it from geocoding
        };
        setLocations(newLocations);
        setGeocodingStatus('success');
        
        // Update map view
        if (index === currentIndex && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 16, {
            animate: true,
            duration: 1
          });
        }
      } else {
        // Geocoding failed, set default coordinates
        const newLocations = [...updatedLocations];
        newLocations[index] = { 
          ...newLocations[index], 
          coordinates: defaultUSCoordinates,
          isGeocoding: false
        };
        setLocations(newLocations);
        setGeocodingStatus('error');
        
        toast({
          variant: "warning",
          title: "Geocoding failed",
          description: "Please place this location manually for accuracy.",
          duration: 5000
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      
      // Update status on error
      const newLocations = [...updatedLocations];
      newLocations[index] = { 
        ...newLocations[index], 
        isGeocoding: false
      };
      setLocations(newLocations);
      setGeocodingStatus('error');
      
      toast({
        variant: "destructive",
        title: "Geocoding error",
        description: "Failed to find coordinates. Please place manually.",
        duration: 5000
      });
    }
  };
  
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
      try {
        // Initialize map
        mapInstanceRef.current = leaflet.map(mapRef.current).setView(defaultUSCoordinates, 4);
        
        // Add tile layers with better error handling and fallbacks
        const addTileLayer = (url: string, options: any) => {
          try {
            return leaflet.tileLayer(url, options).addTo(mapInstanceRef.current);
          } catch (error) {
            console.error(`Error adding tile layer from ${url}:`, error);
            return null;
          }
        };
        
        // Try Google Maps tiles first
        let tileLayer = addTileLayer(
          'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          {
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            maxZoom: 20
          }
        );
        
        // If Google Maps fails, try OpenStreetMap
        if (!tileLayer) {
          tileLayer = addTileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              maxZoom: 19
            }
          );
        }
        
        // If OpenStreetMap fails, try CartoDB as last resort
        if (!tileLayer) {
          addTileLayer(
            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            {
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              subdomains: 'abcd',
              maxZoom: 19
            }
          );
        }
        
        // Add click event for manual marker placement
        mapInstanceRef.current.on('click', (e: any) => {
          if (isManualPlacementMode && leaflet) {
            const { lat, lng } = e.latlng;
            
            // Remove existing manual marker if any
            if (manualMarkerRef.current) {
              try {
                mapInstanceRef.current.removeLayer(manualMarkerRef.current);
              } catch (err) {
                console.error("Error removing existing marker:", err);
              }
            }
            
            try {
              // Create new marker
              manualMarkerRef.current = leaflet.marker([lat, lng], {
                icon: createCustomMarkerIcon(leaflet, false, false, true),
                draggable: true
              }).addTo(mapInstanceRef.current);
              
              // Add drag end event to update coordinates
              manualMarkerRef.current.on('dragend', (event: any) => {
                const marker = event.target;
                const position = marker.getLatLng();
                
                // Update the current location's coordinates
                if (currentIndex < locations.length) {
                  const updatedLocations = [...locations];
                  updatedLocations[currentIndex] = {
                    ...updatedLocations[currentIndex],
                    coordinates: [position.lat, position.lng],
                    manuallyPlaced: true
                  };
                  setLocations(updatedLocations);
                }
              });
            } catch (err) {
              console.error("Error creating marker:", err);
            }
            
            // Update the current location's coordinates
            if (currentIndex < locations.length) {
              const updatedLocations = [...locations];
              updatedLocations[currentIndex] = {
                ...updatedLocations[currentIndex],
                coordinates: [lat, lng],
                manuallyPlaced: true
              };
              setLocations(updatedLocations);
            }
            
            // Exit manual placement mode
            setIsManualPlacementMode(false);
            setManualPlacementHintVisible(false);
            
            toast({
              title: "Location placed",
              description: "You can now verify this location or continue placing it somewhere else.",
              duration: 3000
            });
          }
        });
      } catch (err) {
        console.error("Error initializing map:", err);
        toast({
          variant: "destructive",
          title: "Error initializing map",
          description: "Please refresh the page and try again."
        });
      }
    }
  }, [mapLoaded, leaflet, isManualPlacementMode, locations, currentIndex, toast]);
  
  // Update current location when index changes
  useEffect(() => {
    if (currentIndex < locations.length) {
      const location = locations[currentIndex];
      
      // If the current location doesn't have coordinates, try to geocode it
      if (!location.coordinates && !location.isGeocoding) {
        geocodeCurrentLocation(currentIndex);
      }
    }
  }, [currentIndex, locations]);
  
  // Update markers when verification status changes
  useEffect(() => {
    if (!mapLoaded || !leaflet || !mapInstanceRef.current) return;
    
    // Update markers to reflect current verification status
    updateAllMarkers();
    
  }, [locations.map(l => l.verified).join(','), mapLoaded, leaflet]);
  
  const updateAllMarkers = () => {
    if (!leaflet || !mapInstanceRef.current) return;
    
    // Only update markers that need to change
    locations.forEach((location, index) => {
      if (!location.coordinates || index === currentIndex) return;
      
      const existingMarker = markersRef.current.get(location.address);
      const needsUpdate = existingMarker && 
        ((location.verified === true && !existingMarker.options.icon.options.html.classList.contains('verified-marker')) ||
         (location.verified === false && !existingMarker.options.icon.options.html.classList.contains('rejected-marker')));
      
      if (needsUpdate) {
        // Update marker icon to reflect verification status
        try {
          mapInstanceRef.current.removeLayer(existingMarker);
          markersRef.current.delete(location.address);
          
          const icon = createCustomMarkerIcon(
            leaflet,
            location.verified === true,
            location.verified === false,
            false
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
        } catch (err) {
          console.error("Error updating marker on map:", err);
        }
      }
    });
    
    // Update current marker if needed
    if (currentMarkerRef.current && currentIndex < locations.length) {
      try {
        const currentLocation = locations[currentIndex];
        const icon = createCustomMarkerIcon(
          leaflet,
          currentLocation.verified === true,
          currentLocation.verified === false,
          true
        );
        
        mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        
        currentMarkerRef.current = leaflet.marker(currentLocation.coordinates, { icon })
          .addTo(mapInstanceRef.current);
        
        // Build popup content with available information
        let popupContent = `<b>${currentLocation.address}</b>`;
        
        if (currentLocation.propertyId) {
          popupContent += `<br>ID: ${currentLocation.propertyId}`;
        }
        
        if (currentLocation.tenant) {
          popupContent += `<br>Tenant: ${currentLocation.tenant}`;
        }
          
        // Bind popup but don't open it by default
        currentMarkerRef.current.bindPopup(popupContent);
      } catch (err) {
        console.error("Error updating current marker on map:", err);
      }
    }
  };
  
  const handleManualPlacement = () => {
    setIsManualPlacementMode(true);
    setManualPlacementHintVisible(true);
    
    toast({
      title: "Manual Placement Mode",
      description: "Click anywhere on the map to place the marker for this location.",
      duration: 5000,
    });
  };
  
  const handleGeocodeLocation = async () => {
    if (currentIndex >= locations.length) return;
    
    const currentLocation = locations[currentIndex];
    
    // Skip if already geocoding
    if (currentLocation.isGeocoding) return;
    
    await geocodeCurrentLocation(currentIndex);
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
      
      // Clear any manual marker
      if (manualMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(manualMarkerRef.current);
        manualMarkerRef.current = null;
      }
      
      // Reset manual placement mode
      setIsManualPlacementMode(false);
      setManualPlacementHintVisible(false);
    } else {
      // All locations verified
      finishVerification();
    }
  };
  
  const selectLocation = (index: number) => {
    if (index === currentIndex) return; // Don't do anything if clicking current location
    
    // Clear any manual marker
    if (manualMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(manualMarkerRef.current);
      manualMarkerRef.current = null;
    }
    
    // Reset manual placement mode
    setIsManualPlacementMode(false);
    setManualPlacementHintVisible(false);
    
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
  const currentLocation = locations[currentIndex];
  const isCurrentLocationGeocoding = currentLocation?.isGeocoding || false;
  
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
            className="w-full h-[400px] bg-gray-100 rounded-md border relative"
          >
            {!mapLoaded && (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2">Loading map...</span>
              </div>
            )}
            
            {manualPlacementHintVisible && (
              <div className="manual-placement-hint">
                Click anywhere on the map to place the location marker
              </div>
            )}
            
            {isCurrentLocationGeocoding && (
              <div className={`geocoding-badge ${geocodingStatus}`}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Geocoding address...</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-grow">
              <h3 className="font-semibold">Current address:</h3>
              <p className="text-lg">{currentLocation?.address}</p>
              {currentLocation?.propertyId && (
                <p className="text-sm text-muted-foreground">
                  Property ID: {currentLocation.propertyId}
                </p>
              )}
              {currentLocation?.tenant && (
                <p className="text-sm text-muted-foreground">
                  Tenant: {currentLocation.tenant}
                </p>
              )}
              
              {currentLocation?.manuallyPlaced ? (
                <p className="text-xs text-green-500 mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  Using manually placed marker
                </p>
              ) : currentLocation?.coordinates ? (
                <p className="text-xs text-blue-500 mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  Using geocoded coordinates
                </p>
              ) : (
                <p className="text-xs text-amber-500 mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  No location data - please geocode or place manually
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleGeocodeLocation}
                className="flex gap-2 items-center"
                disabled={isCurrentLocationGeocoding || isManualPlacementMode}
              >
                <Locate size={16} className={isCurrentLocationGeocoding ? "animate-pulse" : ""} />
                {isCurrentLocationGeocoding ? "Geocoding..." : "Geocode Address"}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleManualPlacement}
                className="flex gap-2 items-center"
                disabled={isManualPlacementMode || isCurrentLocationGeocoding}
              >
                <MapPin size={16} /> Place on Map
              </Button>
              
              <Button 
                variant="destructive" 
                size="lg"
                onClick={handleRemoveLocation}
                className="flex gap-2 items-center"
                disabled={isCurrentLocationGeocoding}
              >
                <X size={18} /> Remove
              </Button>
              <Button 
                variant="default" 
                size="lg"
                onClick={handleKeepLocation}
                className="flex gap-2 items-center"
                disabled={isCurrentLocationGeocoding}
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
                      {location.isGeocoding && (
                        <p className="text-xs text-blue-500 flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500 mr-1"></div>
                          Geocoding...
                        </p>
                      )}
                      {!location.isGeocoding && location.manuallyPlaced && (
                        <p className="text-xs text-green-500">Manually placed</p>
                      )}
                      {!location.isGeocoding && !location.manuallyPlaced && location.coordinates && (
                        <p className="text-xs text-blue-500">Geocoded</p>
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
