
import { BusinessTypeHints } from './types';

/**
 * Comprehensive business types for various businesses
 * Used for enhanced geocoding accuracy
 */
export const BUSINESS_TYPES: BusinessTypeHints = {
  // Retail stores
  'petsmart': ['pet store', 'pet shop', 'pet supply'],
  'petco': ['pet store', 'pet shop', 'pet supply'],
  'walmart': ['supermarket', 'department store', 'walmart'],
  'target': ['department store', 'target', 'retail'],
  'costco': ['wholesale', 'supermarket', 'costco'],
  'home depot': ['hardware store', 'home improvement'],
  'lowes': ['hardware store', 'home improvement'],
  'best buy': ['electronics store', 'technology'],
  'apple store': ['electronics store', 'technology'],
  'ikea': ['furniture store', 'home furnishings'],
  
  // Food & restaurants
  'mcdonalds': ['restaurant', 'fast food', 'burger'],
  'burger king': ['restaurant', 'fast food', 'burger'],
  'wendys': ['restaurant', 'fast food', 'burger'],
  'taco bell': ['restaurant', 'fast food', 'mexican'],
  'chipotle': ['restaurant', 'mexican', 'fast casual'],
  'starbucks': ['cafe', 'coffee shop', 'coffeehouse'],
  'subway': ['restaurant', 'sandwich shop', 'fast food'],
  
  // Gas stations
  'shell': ['gas station', 'fuel', 'service station'],
  'bp': ['gas station', 'fuel', 'service station'],
  'exxon': ['gas station', 'fuel', 'service station'],
  
  // Hotels
  'marriott': ['hotel', 'lodging', 'accommodation'],
  'hilton': ['hotel', 'lodging', 'accommodation'],
  'holiday inn': ['hotel', 'lodging', 'accommodation'],
  
  // Banks
  'bank of america': ['bank', 'financial institution'],
  'chase': ['bank', 'financial institution'],
  'wells fargo': ['bank', 'financial institution'],
  
  // Default case - generic business types by category
  'store': ['store', 'retail', 'shop'],
  'restaurant': ['restaurant', 'eatery', 'dining'],
  'hotel': ['hotel', 'motel', 'lodging'],
  'bank': ['bank', 'financial institution'],
  'gas': ['gas station', 'fuel', 'service station'],
  'pharmacy': ['pharmacy', 'drug store'],
  'grocery': ['grocery store', 'supermarket'],
};

/**
 * Get business type hints based on business name
 */
export const getBusinessTypeHints = (businessName?: string): string[] => {
  if (!businessName) return [];
  
  const lowerBusinessName = businessName.toLowerCase();
  
  // Find matching business types
  // Try to find an exact match first
  for (const [key, types] of Object.entries(BUSINESS_TYPES)) {
    if (lowerBusinessName.includes(key)) {
      return types;
    }
  }
  
  // If no exact match, try to categorize based on common terms
  if (/restaurant|diner|cafe|grill|bar|pub/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['restaurant'];
  } else if (/store|shop|mart|retail/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['store'];
  } else if (/hotel|inn|suites|lodging/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['hotel'];
  } else if (/bank|credit union|financial/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['bank'];
  } else if (/gas|petrol|fuel|station/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['gas'];
  } else if (/pharmacy|drug|rx/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['pharmacy'];
  } else if (/grocery|food|market/i.test(lowerBusinessName)) {
    return BUSINESS_TYPES['grocery'];
  }
  
  return [];
};
