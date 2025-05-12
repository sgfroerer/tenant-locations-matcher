
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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
    /^(loc[-_]?lat)/i                // Location prefixed
  ];
  
  const lngPatterns = [
    /^(lon|lng|longitude|long|x[-_]?coord)/i,  // Basic patterns
    /^(gps[-_]?lon|gps[-_]?lng)/i,             // GPS prefixed
    /^(x[-_]?coordinate)/i,                    // X coordinate
    /^(geolon|geolng)/i,                       // Geo prefixed
    /^(position[-_]?lon|position[-_]?lng)/i,   // Position prefixed
    /^(loc[-_]?lon|loc[-_]?lng)/i              // Location prefixed
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

// Function to extract coordinates from data with improved validation and fallback handling
export const extractCoordinates = (data: FileData, latCol?: string, lngCol?: string): Record<string, [number, number]> => {
  const coordinatesMap: Record<string, [number, number]> = {};
  
  if (!latCol || !lngCol) return coordinatesMap;
  
  data.forEach((row, index) => {
    // We need some kind of identifier for the location - use address or composite value
    const addressFields = Object.keys(row).filter(key => 
      key.toLowerCase().includes('address') || 
      key.toLowerCase().includes('location') || 
      key.toLowerCase().includes('street') ||
      key.toLowerCase().includes('place')
    );
    
    // Use first address field found or join key fields as fallback
    let addressKey = '';
    
    if (addressFields.length > 0) {
      addressKey = row[addressFields[0]]; 
    } else {
      // Try to create a composite key from typical address components
      const components = [];
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes('street') || 
            key.toLowerCase().includes('ave') ||
            key.toLowerCase().includes('city') ||
            key.toLowerCase().includes('state') ||
            key.toLowerCase().includes('zip')) {
          components.push(row[key]);
        }
      }
      addressKey = components.join(', ');
    }
    
    // If still no addressKey, use the row index as a fallback
    if (!addressKey) {
      addressKey = `Row ${index + 1}`;
    }
    
    // Extract and normalize coordinate values 
    const latValue = normalizeCoordinate(row[latCol]);
    const lngValue = normalizeCoordinate(row[lngCol]);
    
    if (latValue !== null && lngValue !== null) {
      // Ensure the key is unique by appending index if necessary
      let finalKey = addressKey;
      if (coordinatesMap[addressKey]) {
        finalKey = `${addressKey} (${index + 1})`;
      }
      
      coordinatesMap[finalKey] = [latValue, lngValue];
    }
  });
  
  return coordinatesMap;
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
