
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

// Remove common non-address parts
export const removeSecondaryUnits = (address: string): string => {
  return address.replace(/(STE|SUITE|UNIT|APT|#|APARTMENT|ROOM|RM|BUILDING|BLDG|FLOOR|FL)\s*[#]?[\w\d-]+,?/i, '').trim();
};

// Standardize address format
export const standardizeAddress = (address: string): string => {
  if (!address) return '';
  
  // Convert to uppercase and remove trailing period
  let standardized = address.toUpperCase().replace(/\.$/, '');
  
  // Remove zip code (match 5 digits or 5+4 digits pattern)
  standardized = standardized.replace(/\b\d{5}(-\d{4})?\b/, '');
  
  // Remove trailing commas
  standardized = standardized.replace(/,+$/, '');
  
  // Replace multiple spaces with a single space
  standardized = standardized.replace(/\s+/g, ' ');
  
  // Remove suite, unit, apt numbers
  standardized = removeSecondaryUnits(standardized);
  
  // Replace address suffixes with abbreviations
  Object.entries(addressSuffixes).forEach(([full, abbr]) => {
    // Replace full word with abbreviation (ensure word boundary)
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    standardized = standardized.replace(regex, abbr);
  });
  
  // Replace directions with abbreviations
  Object.entries(directions).forEach(([full, abbr]) => {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    standardized = standardized.replace(regex, abbr);
  });
  
  // Remove common punctuation
  standardized = standardized.replace(/[,.#]/g, ' ').trim();
  
  // Replace multiple spaces with a single space
  standardized = standardized.replace(/\s+/g, ' ').trim();
  
  return standardized;
};

// Calculate similarity score between two addresses
export const calculateAddressSimilarity = (
  address1: string,
  address2: string
): number => {
  const standardized1 = standardizeAddress(address1);
  const standardized2 = standardizeAddress(address2);
  return stringSimilarity.compareTwoStrings(standardized1, standardized2);
};

// Match addresses based on similarity threshold
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
          const score = stringSimilarity.compareTwoStrings(standardized1[i], standardized2[j]);
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
