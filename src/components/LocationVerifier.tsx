import React, { useEffect, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type Location = {
  address: string;
  propertyId?: string;
  tenant?: string;
  verified?: boolean;
  coordinates?: [number, number]; // [lat, lng]
  manuallyPlaced?: boolean;
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
`;

// Modified function to parse state abbreviation from address with improved matching
const getStateFromAddress = (address: string): string | null => {
  // More robust pattern for state + zip
  const stateZipPattern = /\b([A-Z]{2})\s*\d{5}(?:-\d{4})?\b/;
  const match = address.match(stateZipPattern);
  
  if (match) return match[1];
  
  // Fall back to checking common state abbreviations at the end of the address
  const stateAbbrs = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 
                      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
                      
  // Check for state abbreviations
  for (const stateAbbr of stateAbbrs) {
    if (address.includes(` ${stateAbbr} `) || address.endsWith(` ${stateAbbr}`)) {
      return stateAbbr;
    }
  }
  
  return null;
};

// Fallback coordinates by state to center map when geocoding fails
const fallbackCoordinatesByState: Record<string, [number, number]> = {
  'AL': [32.806671, -86.791130], // Alabama
  'AK': [61.370716, -152.404419], // Alaska
  'AZ': [33.729759, -111.431221], // Arizona
  'AR': [34.969704, -92.373123], // Arkansas
  'CA': [36.116203, -119.681564], // California
  'CO': [39.059811, -105.311104], // Colorado
  'CT': [41.597782, -72.755371], // Connecticut
  'DE': [39.318523, -75.507141], // Delaware
  'FL': [27.766279, -81.686783], // Florida
  'GA': [33.040619, -83.643074], // Georgia
  'HI': [21.094318, -157.498337], // Hawaii
  'ID': [44.240459, -114.478828], // Idaho
  'IL': [40.349457, -88.986137], // Illinois
  'IN': [39.849426, -86.258278], // Indiana
  'IA': [42.011539, -93.210526], // Iowa
  'KS': [38.526600, -96.726486], // Kansas
  'KY': [37.668140, -84.670067], // Kentucky
  'LA': [31.169546, -91.867805], // Louisiana
  'ME': [44.693947, -69.381927], // Maine
  'MD': [39.063946, -76.802101], // Maryland
  'MA': [42.230171, -71.530106], // Massachusetts
  'MI': [43.326618, -84.536095], // Michigan
  'MN': [45.694454, -93.900192], // Minnesota
  'MS': [32.741646, -89.678696], // Mississippi
  'MO': [38.456085, -92.288368], // Missouri
  'MT': [46.921925, -110.454353], // Montana
  'NE': [41.125370, -98.268082], // Nebraska
  'NV': [38.313515, -117.055374], // Nevada
  'NH': [43.452492, -71.563896], // New Hampshire
  'NJ': [40.298904, -74.521011], // New Jersey
  'NM': [34.840515, -106.248482], // New Mexico
  'NY': [42.165726, -74.948051], // New York
  'NC': [35.630066, -79.806419], // North Carolina
  'ND': [47.528912, -99.784012], // North Dakota
  'OH': [40.388783, -82.764915], // Ohio
  'OK': [35.565342, -96.928917], // Oklahoma
  'OR': [44.572021, -122.070938], // Oregon
  'PA': [40.590752, -77.209755], // Pennsylvania
  'RI': [41.680893, -71.511780], // Rhode Island
  'SC': [33.856892, -80.945007], // South Carolina
  'SD': [44.299782, -99.438828], // South Dakota
  'TN': [35.747845, -86.692345], // Tennessee
  'TX': [31.054487, -97.563461], // Texas
  'UT': [40.150032, -111.862434], // Utah
  'VT': [44.045876, -72.710686], // Vermont
  'VA': [37.769337, -78.169968], // Virginia
  'WA': [47.400902, -121.490494], // Washington
  'WV': [38.491226, -80.954453], // West Virginia
  'WI': [44.268543, -89.616508], // Wisconsin
  'WY': [42.755966, -107.302490], // Wyoming
  'DC': [38.897438, -77.026817]  // District of Columbia
};

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
    
    // Create locations with coordinates from predefined coordinates or state-based fallbacks
    const locationsWithCoordinates = costarOnlyAddresses.map(address => {
      // First check if we have predefined coordinates
      let coordinates: [number, number] | undefined = predefinedCoordinates[address];
      let manuallyPlaced = false;
      
      // If not, try state-based fallback with more precise location detection
      if (!coordinates) {
        const state = getStateFromAddress(address);
        
        if (state && fallbackCoordinatesByState[state]) {
          // Add minimal randomness to avoid markers stacking exactly on top of each other
          const randomOffset = () => (Math.random() - 0.5) * 0.1; // +/- 0.05 degrees
          coordinates = [
            fallbackCoordinatesByState[state][0] + randomOffset(),
            fallbackCoordinatesByState[state][1] + randomOffset()
          ];
        } else {
          // Default to US center with minimal randomness
          const randomOffset = () => (Math.random() - 0.5) * 1; // +/- 0.5 degrees
          coordinates = [
            defaultUSCoordinates[0] + randomOffset(),
            defaultUSCoordinates[1] + randomOffset()
          ];
        }
      } else {
        manuallyPlaced = true; // If we have predefined coordinates, consider it as manually placed
      }
      
      return {
        address,
        propertyId: costarPropertyIds[address] || undefined,
        tenant: costarTenantNames[address] || undefined,
        verified: undefined,
        coordinates,
        manuallyPlaced
      };
    });
    
    setLocations(locationsWithCoordinates);
  }, [costarOnlyAddresses, costarPropertyIds, costarTenantNames, predefinedCoordinates]);
  
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
        // Initialize map with better default view
        mapInstanceRef.current = leaflet.map(mapRef.current).setView(defaultUSCoordinates, 4);
        
        // Add tile layer with better error handling
        try {
          leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(mapInstanceRef.current);
        } catch (error) {
          console.error("Error adding tile layer:", error);
          // Fallback to another tile provider if Google fails
          try {
            leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
              attribution: '&copy; CartoDB',
              maxZoom: 19
            }).addTo(mapInstanceRef.current);
          } catch (err) {
            console.error("Error adding fallback tile layer:", err);
          }
        }
        
        // Add click event for manual marker placement with added error handling
        mapInstanceRef.current.on('click', (e: any) => {
          try {
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
          } catch (error) {
            console.error("Error in map click handler:", error);
            toast({
              variant: "destructive",
              title: "Error placing marker",
              description: "Please try again or refresh the page."
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
    if (!mapLoaded || !leaflet || !mapInstanceRef.current) return;
    if (locations.length === 0 || currentIndex >= locations.length) return;
    
    // Update map for current location
    const currentLocation = locations[currentIndex];
    
    // Clear any existing manual marker
    if (manualMarkerRef.current) {
      mapInstanceRef.current.removeLayer(manualMarkerRef.current);
      manualMarkerRef.current = null;
    }
    
    if (currentLocation && currentLocation.coordinates) {
      try {
        // Update map view with animation
        mapInstanceRef.current.flyTo(currentLocation.coordinates, 15, {
          duration: 1,
          animate: true
        });
      } catch (error) {
        console.error("Error updating map view:", error);
        // Fallback to setView without animation on error
        try {
          mapInstanceRef.current.setView(currentLocation.coordinates, 15, {
            animate: false
          });
        } catch (err) {
          console.error("Failed to set map view:", err);
        }
      }
      
      // Update or create marker for current location
      if (currentMarkerRef.current) {
        try {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        } catch (err) {
          console.error("Error removing existing marker:", err);
        }
      }
      
      try {
        // Create marker with custom icon
        const icon = createCustomMarkerIcon(
          leaflet, 
          currentLocation.verified === true,
          currentLocation.verified === false,
          true
        );
        
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
        
        if (currentLocation.manuallyPlaced) {
          popupContent += `<br><span style="color: green;">✓ Using provided coordinates</span>`;
        }
          
        // Bind popup but don't auto-open it
        currentMarkerRef.current.bindPopup(popupContent);
      } catch (err) {
        console.error("Error adding marker to map:", err);
      }
    }
  }, [currentIndex, locations, mapLoaded, leaflet]);
  
  useEffect(() => {
    if (isManualPlacementMode) {
      setManualPlacementHintVisible(true);
      
      // Hide the hint after 5 seconds
      const timer = setTimeout(() => {
        setManualPlacementHintVisible(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isManualPlacementMode]);
  
  // Setup locations on the map
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
    
    // Process all locations at once for marker display
    locations.forEach((location, index) => {
      if (!location.coordinates) return;
      
      if (index === currentIndex) {
        // Current location gets special treatment
        if (currentMarkerRef.current) {
          mapInstanceRef.current.removeLayer(currentMarkerRef.current);
        }
        
        const icon = createCustomMarkerIcon(
          leaflet,
          location.verified === true,
          location.verified === false,
          true
        );
        
        try {
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
          
          // Center map on current location
          try {
            mapInstanceRef.current.setView(location.coordinates, 15, {
              animate: false
            });
          } catch (err) {
            console.error("Failed to set map view:", err);
          }
        } catch (err) {
          console.error("Error adding marker to map:", err);
        }
      } else {
        // Other locations
        const icon = createCustomMarkerIcon(
          leaflet,
          location.verified === true,
          location.verified === false,
          false
        );
        
        try {
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
          console.error("Error adding marker to map:", err);
        }
      }
    });
    
    // Focus the map on the current location if it has coordinates
    const currentLoc = locations[currentIndex];
    if (currentLoc && currentLoc.coordinates) {
      try {
        mapInstanceRef.current.setView(currentLoc.coordinates, 15, {
          animate: false
        });
      } catch (err) {
        console.error("Failed to set map view:", err);
      }
    }
  }, [locations.length, mapLoaded, leaflet, currentIndex]);
  
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
    
    toast({
      title: "Manual Placement Mode",
      description: "Click anywhere on the map to place the marker for this location.",
      duration: 5000,
    });
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
                  Using provided coordinates
                </p>
              ) : (
                <p className="text-xs text-amber-500 mt-1 flex items-center">
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  Using approximate location - Please place manually for accuracy
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleManualPlacement}
                className="flex gap-2 items-center"
                disabled={isManualPlacementMode}
              >
                <MapPin size={16} /> Place on Map
              </Button>
              
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
                      {location.manuallyPlaced && (
                        <p className="text-xs text-green-500">Using provided coordinates</p>
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
