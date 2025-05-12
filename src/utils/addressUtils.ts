
import stringSimilarity from 'string-similarity';

// Standard address suffix replacements
const addressSuffixes: Record<string, string> = {
  "STREET": "ST",
  "AVENUE": "AVE",
  "BOULEVARD": "BLVD",
  "DRIVE": "DR",
  "ROAD": "RD",
  "LANE": "LN",
  "PLACE": "PL",
  "COURT": "CT",
  "CIRCLE": "CIR",
  "HIGHWAY": "HWY",
  "PARKWAY": "PKWY",
  "EXPRESSWAY": "EXPY",
  "FREEWAY": "FWY",
  "TURNPIKE": "TPKE",
  "SUITE": "STE",
  "APARTMENT": "APT",
  "BUILDING": "BLDG",
  "FLOOR": "FL",
  "UNIT": "UNIT",
  "ROOM": "RM"
};

// Direction abbreviations
const directions: Record<string, string> = {
  "NORTH": "N",
  "SOUTH": "S",
  "EAST": "E",
  "WEST": "W",
  "NORTHEAST": "NE",
  "NORTHWEST": "NW",
  "SOUTHEAST": "SE",
  "SOUTHWEST": "SW",
};

// Additional street type variations
const streetTypeVariations: Record<string, string[]> = {
  "ST": ["STREET", "STR", "ST."],
  "AVE": ["AVENUE", "AV", "AVE.", "AV."],
  "BLVD": ["BOULEVARD", "BLVD.", "BLV", "BL", "BLV."],
  "DR": ["DRIVE", "DR.", "DRV", "DRV."],
  "RD": ["ROAD", "RD.", "R.D."],
  "LN": ["LANE", "LN.", "LA", "LA."],
  "HWY": ["HIGHWAY", "HIWAY", "HIGHWY", "HWY.", "HY", "H.W.Y.", "US HIGHWAY", "US HWY", "U.S. HIGHWAY", "U.S. HWY", "U.S.HWY"],
  "PKWY": ["PARKWAY", "PKWY.", "PKY", "PARKWY", "PKWAY", "PKW", "PKW."]
};

// Normalize a street type to its standard abbreviation
const normalizeStreetType = (streetType: string): string => {
  const upperStreetType = streetType.toUpperCase();
  
  // Direct match in addressSuffixes
  if (addressSuffixes[upperStreetType]) {
    return addressSuffixes[upperStreetType];
  }
  
  // Look in variations
  for (const [abbr, variations] of Object.entries(streetTypeVariations)) {
    if (variations.includes(upperStreetType)) {
      return abbr;
    }
  }
  
  return streetType; // Return original if no match found
};

// Remove common non-address parts
export const removeSecondaryUnits = (address: string): string => {
  return address.replace(/(STE|SUITE|UNIT|APT|#|APARTMENT|ROOM|RM|BUILDING|BLDG|FLOOR|FL)\s*[#]?[\w\d-]+,?/i, '').trim();
};

// Extract secondary unit information
export const extractSecondaryUnit = (address: string): string | null => {
  const unitMatch = address.match(/(STE|SUITE|UNIT|APT|#|APARTMENT|ROOM|RM|BUILDING|BLDG|FLOOR|FL)\s*[#]?[\w\d-]+/i);
  return unitMatch ? unitMatch[0] : null;
};

// Handle special cases for highways
const processHighways = (address: string): string => {
  // US Highway patterns (with variations of spacing and punctuation)
  return address
    .replace(/\b(US|U\.S\.|U S|U\.S|US\.)\s*(HWY|HIGHWAY|HWY\.|HIGHWAY\.)\s*(\d+)\b/i, "US HWY $3")
    .replace(/\b(OLD)\s*(US|U\.S\.|U S|U\.S|US\.)\s*(HWY|HIGHWAY|HWY\.|HIGHWAY\.)\s*(\d+)\b/i, "OLD US HWY $4")
    // State highway patterns
    .replace(/\b(STATE|ST|ST\.|S\.)\s*(RTE|ROUTE|RT|RD|ROAD|HWY|HIGHWAY)\s*(\d+)\b/i, "STATE HWY $3");
};

// Standardize address format with enhanced processing
export const standardizeAddress = (address: string): string => {
  if (!address) return '';
  
  // Convert to uppercase and remove trailing period
  let standardized = address.toUpperCase().replace(/\.$/, '');
  
  // Process highways first (special case)
  standardized = processHighways(standardized);
  
  // Remove zip code (match 5 digits or 5+4 digits pattern)
  standardized = standardized.replace(/\b\d{5}(-\d{4})?\b/, '');
  
  // Remove trailing commas
  standardized = standardized.replace(/,+$/, '');
  
  // Replace multiple spaces with a single space
  standardized = standardized.replace(/\s+/g, ' ');
  
  // Extract and store secondary unit info before removal (but don't use it for now)
  const secondaryUnit = extractSecondaryUnit(standardized);
  
  // Remove suite, unit, apt numbers for matching primary address
  standardized = removeSecondaryUnits(standardized);
  
  // Process street types with improved handling
  const words = standardized.split(' ');
  for (let i = 0; i < words.length; i++) {
    // Check if this word is a street type
    const normalizedWord = normalizeStreetType(words[i]);
    if (normalizedWord !== words[i]) {
      words[i] = normalizedWord;
    }
    
    // Also normalize directions
    if (directions[words[i]]) {
      words[i] = directions[words[i]];
    }
  }
  standardized = words.join(' ');
  
  // Remove common punctuation
  standardized = standardized.replace(/[,.#]/g, ' ').trim();
  
  // Replace multiple spaces with a single space
  standardized = standardized.replace(/\s+/g, ' ').trim();
  
  return standardized;
};

// Enhanced address similarity with component weighting
export const calculateAddressSimilarity = (
  address1: string,
  address2: string
): number => {
  const standardized1 = standardizeAddress(address1);
  const standardized2 = standardizeAddress(address2);
  
  // Basic string similarity
  const basicSimilarity = stringSimilarity.compareTwoStrings(standardized1, standardized2);
  
  // Component-based matching for more accuracy
  const components1 = standardized1.split(' ');
  const components2 = standardized2.split(' ');
  
  // Count matching components
  const matches = components1.filter(comp => components2.includes(comp));
  const componentMatchRatio = matches.length / Math.max(components1.length, components2.length);
  
  // Weight the result (70% component match, 30% string similarity)
  return (componentMatchRatio * 0.7) + (basicSimilarity * 0.3);
};

// Weighted component matching
const extractAddressComponents = (address: string) => {
  const standardized = standardizeAddress(address);
  const parts = standardized.split(' ');
  
  // Very basic extraction - could be improved with regex patterns
  return {
    streetNumber: parts[0]?.match(/^\d+$/) ? parts[0] : '',
    streetName: parts.slice(1, -2).join(' '), // Simplified assumption
    city: parts[parts.length - 2] || '',
    state: parts[parts.length - 1] || '',
  };
};

// Match addresses based on similarity threshold with weighted components
export const matchAddresses = (
  addresses1: string[],
  addresses2: string[]
): Array<{
  address1: string;
  address2: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'missing';
}> => {
  const results: Array<{
    address1: string;
    address2: string;
    score: number;
    matchType: 'exact' | 'fuzzy' | 'missing';
  }> = [];

  // Standardize all addresses
  const standardized1 = addresses1.map(standardizeAddress);
  const standardized2 = addresses2.map(standardizeAddress);

  // Track which addresses from set 2 have been matched
  const matched2 = new Set<number>();

  // For each address in set 1, find best match in set 2
  for (let i = 0; i < addresses1.length; i++) {
    let bestMatchIndex = -1;
    let bestScore = 0;

    // Look for exact match first
    const exactMatchIndex = standardized2.findIndex(addr2 => addr2 === standardized1[i]);
    
    if (exactMatchIndex >= 0) {
      bestMatchIndex = exactMatchIndex;
      bestScore = 1.0;
    } else {
      // Find best fuzzy match if no exact match
      for (let j = 0; j < addresses2.length; j++) {
        if (!matched2.has(j)) {
          // Use enhanced similarity function
          const score = calculateAddressSimilarity(standardized1[i], standardized2[j]);
          if (score > bestScore) {
            bestScore = score;
            bestMatchIndex = j;
          }
        }
      }
    }

    // Determine match type
    let matchType: 'exact' | 'fuzzy' | 'missing' = 'missing';
    let matchedAddress = '';
    
    if (bestScore === 1.0) {
      matchType = 'exact';
      matchedAddress = addresses2[bestMatchIndex];
      matched2.add(bestMatchIndex);
    } else if (bestScore >= 0.7) {  // 0.7 threshold for fuzzy matches
      matchType = 'fuzzy';
      matchedAddress = addresses2[bestMatchIndex];
      matched2.add(bestMatchIndex);
    }

    results.push({
      address1: addresses1[i],
      address2: matchedAddress,
      score: bestScore,
      matchType
    });
  }

  // Add addresses from set 2 that weren't matched
  for (let j = 0; j < addresses2.length; j++) {
    if (!matched2.has(j)) {
      results.push({
        address1: '',
        address2: addresses2[j],
        score: 0,
        matchType: 'missing'
      });
    }
  }

  return results;
};
