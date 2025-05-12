
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { batchGeocodeAddresses, enhancedGeocode } from './geocodingUtils';

export type FileData = {
  [key: string]: string;
}[];

export const parseFile = async (file: File): Promise<{ data: FileData; headers: string[] }> => {
  return new Promise((resolve, reject) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const headers = result.meta.fields || [];
          resolve({ data: result.data as FileData, headers });
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    } else if (fileExt === 'tsv' || fileExt === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '\t',
        complete: (result) => {
          const headers = result.meta.fields || [];
          resolve({ data: result.data as FileData, headers });
        },
        error: (error) => {
          reject(new Error(`TSV parsing error: ${error.message}`));
        }
      });
    } else if (['xlsx', 'xls'].includes(fileExt)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (data) {
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as FileData;
            const headers = Object.keys(jsonData[0] || {});
            resolve({ data: jsonData, headers });
          } else {
            reject(new Error('Failed to read Excel file'));
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Unknown error parsing Excel file'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsBinaryString(file);
    } else {
      reject(new Error('Unsupported file format. Please upload CSV, TSV, or Excel file.'));
    }
  });
};

export const parseClipboardText = (text: string): { data: FileData; headers: string[] } => {
  // Try to detect the delimiter (tab or comma)
  const firstLine = text.trim().split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });
  
  const headers = result.meta.fields || [];
  return { data: result.data as FileData, headers };
};

// Enhanced helper function to detect coordinate columns with more comprehensive patterns
export const detectCoordinateColumns = (headers: string[]): {
  latitudeColumn?: string;
  longitudeColumn?: string;
} => {
  // More comprehensive regex patterns for detecting coordinate columns
  const latPatterns = [
    /^(lat|latitude|y[-_]?coord)/i,  // Basic patterns
    /^(gps[-_]?lat)/i,               // GPS prefixed
    /^(y[-_]?coordinate)/i,          // Y coordinate
    /^(geolat)/i,                    // Geo prefixed
    /^(position[-_]?lat)/i,          // Position prefixed
    /^(loc[-_]?lat)/i,               // Location prefixed
    /^(y)/i                          // Simple Y
  ];
  
  const lngPatterns = [
    /^(lon|lng|longitude|long|x[-_]?coord)/i,  // Basic patterns
    /^(gps[-_]?lon|gps[-_]?lng)/i,             // GPS prefixed
    /^(x[-_]?coordinate)/i,                    // X coordinate
    /^(geolon|geolng)/i,                       // Geo prefixed
    /^(position[-_]?lon|position[-_]?lng)/i,   // Position prefixed
    /^(loc[-_]?lon|loc[-_]?lng)/i,             // Location prefixed
    /^(x)/i                                    // Simple X
  ];
  
  // Check each header against all patterns
  const latitudeColumn = headers.find(header => 
    latPatterns.some(pattern => pattern.test(header))
  );
  
  const longitudeColumn = headers.find(header => 
    lngPatterns.some(pattern => pattern.test(header))
  );
  
  return { latitudeColumn, longitudeColumn };
};

// Enhanced function to normalize coordinate values with better validation
const normalizeCoordinate = (value: string | number): number | null => {
  if (value === undefined || value === null || value === '') return null;
  
  // If value is already a number, use it directly
  if (typeof value === 'number') {
    // Check if within valid range and not NaN
    if (isNaN(value) || value < -180 || value > 180) return null;
    return value;
  }
  
  // Handle string values
  const cleanedValue = value.toString()
    .replace(/[^\d.-]/g, '')  // Remove any non-numeric characters except decimal and minus
    .trim();
    
  // Try to parse the value as a float
  const parsed = parseFloat(cleanedValue);
  if (isNaN(parsed)) return null;
  
  // Check if the value is in a valid latitude/longitude range
  if (parsed < -180 || parsed > 180) return null;
  
  return parsed;
};

// Function to extract coordinates from data with improved validation and fallback to geocoding
export const extractCoordinates = async (
  data: FileData, 
  latCol?: string, 
  lngCol?: string
): Promise<Record<string, [number, number]>> => {
  const coordinatesMap: Record<string, [number, number]> = {};
  
  // First pass: extract explicit coordinates from the data if available
  if (latCol && lngCol) {
    data.forEach((row, index) => {
      // Get full address as key
      const addressKey = getAddressKey(row, index);
      
      // Extract and normalize coordinate values 
      const latValue = normalizeCoordinate(row[latCol]);
      const lngValue = normalizeCoordinate(row[lngCol]);
      
      if (latValue !== null && lngValue !== null) {
        coordinatesMap[addressKey] = [latValue, lngValue];
      }
    });
  }
  
  // Second pass: geocode addresses that don't have coordinates yet
  const addressesToGeocode: string[] = [];
  const addressIndexMap: Record<string, string> = {};
  
  data.forEach((row, index) => {
    const addressKey = getAddressKey(row, index);
    
    if (!coordinatesMap[addressKey]) {
      // Build a full address string for geocoding
      const addressForGeocoding = buildAddressString(row);
      addressesToGeocode.push(addressForGeocoding);
      addressIndexMap[addressForGeocoding] = addressKey;
    }
  });
  
  // If we have addresses to geocode, do it in batch
  if (addressesToGeocode.length > 0) {
    try {
      const geocodedResults = await batchGeocodeAddresses(addressesToGeocode);
      
      // Add geocoded results to our coordinates map
      for (const [geocodedAddress, coords] of Object.entries(geocodedResults)) {
        const originalAddressKey = addressIndexMap[geocodedAddress];
        if (originalAddressKey) {
          coordinatesMap[originalAddressKey] = coords;
        }
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    }
  }
  
  return coordinatesMap;
};

// Helper function to build a full address string from row data
const buildAddressString = (row: Record<string, string>): string => {
  // Try to identify address components
  const components = [];
  
  // Look for common address fields
  const streetFields = Object.keys(row).filter(key => 
    /street|address|addr|location|add?r?e?s?s?l?i?n?e?1?/i.test(key)
  );
  
  const cityFields = Object.keys(row).filter(key => 
    /city|town|municipality/i.test(key)
  );
  
  const stateFields = Object.keys(row).filter(key => 
    /state|province|region/i.test(key)
  );
  
  const zipFields = Object.keys(row).filter(key => 
    /zip|postal|code|postcode/i.test(key)
  );
  
  // Add the components in order
  if (streetFields.length > 0) {
    components.push(row[streetFields[0]]);
  }
  
  if (cityFields.length > 0) {
    components.push(row[cityFields[0]]);
  }
  
  if (stateFields.length > 0) {
    components.push(row[stateFields[0]]);
  }
  
  if (zipFields.length > 0) {
    components.push(row[zipFields[0]]);
  }
  
  // If we couldn't find specific components, use any field that might be part of the address
  if (components.length === 0) {
    // Try to use any field that might contain address information
    for (const key of Object.keys(row)) {
      const value = row[key];
      if (
        typeof value === 'string' && 
        value.length > 5 && 
        /\d+/.test(value) && // Contains at least one number (likely part of address)
        !/^[\d.]+$/.test(value) // Not just a number or decimal
      ) {
        components.push(value);
      }
    }
  }
  
  return components.join(', ');
};

// Helper function to get a consistent address key
const getAddressKey = (row: Record<string, string>, index: number): string => {
  // Try to identify a full address or create one from components
  const addressString = buildAddressString(row);
  
  if (addressString) {
    return addressString;
  }
  
  // Fallback: use tenant/property info if available
  if (row.tenant || row.propertyId) {
    return `${row.tenant || ''} ${row.propertyId || ''} (Row ${index + 1})`.trim();
  }
  
  // Last resort: use row index
  return `Row ${index + 1}`;
};

export const exportToCSV = (data: any[], fileName: string): void => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName);
};

export const exportToExcel = (data: any[], fileName: string): void => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
  
  // Create a buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  
  // Convert to Blob
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Save file
  saveAs(blob, fileName);
};
