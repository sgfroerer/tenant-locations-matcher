
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

// Helper function to detect coordinate columns in data with improved pattern matching
export const detectCoordinateColumns = (headers: string[]): {
  latitudeColumn?: string;
  longitudeColumn?: string;
} => {
  // More comprehensive regex patterns for detecting coordinate columns
  const latPatterns = [
    /^(lat|latitude|y[-_]?coord)/i,
    /^(gps[-_]?lat)/i,
    /^(y[-_]?coordinate)/i
  ];
  
  const lngPatterns = [
    /^(lon|lng|longitude|long|x[-_]?coord)/i,
    /^(gps[-_]?lon|gps[-_]?lng)/i,
    /^(x[-_]?coordinate)/i
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

// Function to normalize coordinate values
const normalizeCoordinate = (value: string): number | null => {
  if (!value) return null;
  
  // Try to parse the value as a float
  const parsed = parseFloat(value);
  if (isNaN(parsed)) return null;
  
  // Check if the value is in a valid latitude/longitude range
  if (parsed < -180 || parsed > 180) return null;
  
  return parsed;
};

// Function to extract coordinates from data with improved validation
export const extractCoordinates = (data: FileData, latCol?: string, lngCol?: string): Record<string, [number, number]> => {
  const coordinatesMap: Record<string, [number, number]> = {};
  
  if (!latCol || !lngCol) return coordinatesMap;
  
  data.forEach(row => {
    // We need some kind of identifier for the location - use address or composite value
    const addressFields = Object.keys(row).filter(key => 
      key.toLowerCase().includes('address') || 
      key.toLowerCase().includes('location') ||
      key.toLowerCase().includes('street')
    );
    
    // Use first address field found or join all values as fallback
    const addressKey = addressFields.length > 0 ? 
      row[addressFields[0]] : 
      Object.values(row).join(' ').trim();
    
    if (!addressKey) return;
    
    const latValue = normalizeCoordinate(row[latCol]);
    const lngValue = normalizeCoordinate(row[lngCol]);
    
    if (latValue !== null && lngValue !== null) {
      coordinatesMap[addressKey] = [latValue, lngValue];
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
