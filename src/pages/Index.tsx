
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUploader from '@/components/FileUploader';
import ColumnSelector from '@/components/ColumnSelector';
import ResultsTable from '@/components/ResultsTable';
import LocationVerifier from '@/components/LocationVerifier';
import { FileData, exportToCSV, exportToExcel } from '@/utils/fileUtils';
import { matchAddresses } from '@/utils/addressUtils';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

type ResultRow = {
  address1: string;
  address2: string;
  propertyId?: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'missing';
};

const Index = () => {
  const [source1Data, setSource1Data] = useState<FileData | null>(null);
  const [source2Data, setSource2Data] = useState<FileData | null>(null);
  const [source1Headers, setSource1Headers] = useState<string[]>([]);
  const [source2Headers, setSource2Headers] = useState<string[]>([]);
  const [source1AddressColumn, setSource1AddressColumn] = useState<string>('');
  const [source2AddressColumn, setSource2AddressColumn] = useState<string>('');
  const [source2PropertyIdColumn, setSource2PropertyIdColumn] = useState<string>('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [verificationStep, setVerificationStep] = useState(false);
  const [verifiedResults, setVerifiedResults] = useState<ResultRow[]>([]);
  const { toast } = useToast();
  
  const handleFileParsed = (data: FileData, headers: string[], fileType: 'source1' | 'source2') => {
    if (fileType === 'source1') {
      setSource1Data(data);
      setSource1Headers(headers);
      
      // Try to automatically select a column that looks like an address
      const addressColumn = headers.find(header => 
        header.toLowerCase().includes('address') || 
        header.toLowerCase().includes('location') ||
        header.toLowerCase().includes('street')
      );
      if (addressColumn) {
        setSource1AddressColumn(addressColumn);
      } else if (headers.length > 0) {
        setSource1AddressColumn(headers[0]);
      }
    } else {
      setSource2Data(data);
      setSource2Headers(headers);
      
      // Try to automatically select a column that looks like an address
      const addressColumn = headers.find(header => 
        header.toLowerCase().includes('address') || 
        header.toLowerCase().includes('location') ||
        header.toLowerCase().includes('street')
      );
      if (addressColumn) {
        setSource2AddressColumn(addressColumn);
      } else if (headers.length > 0) {
        setSource2AddressColumn(headers[0]);
      }
      
      // Try to automatically select a column that looks like a property ID
      const propertyIdColumn = headers.find(header => 
        header.toLowerCase().includes('id') || 
        header.toLowerCase().includes('property') ||
        header.toLowerCase().includes('identifier')
      );
      if (propertyIdColumn) {
        setSource2PropertyIdColumn(propertyIdColumn);
      }
    }
  };

  const handleCompare = () => {
    if (!source1Data || !source2Data || !source1AddressColumn || !source2AddressColumn) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please upload both files and select address columns",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Extract address lists from both sources
      const addresses1 = source1Data
        .map(row => row[source1AddressColumn])
        .filter(Boolean);
      
      const addresses2 = source2Data
        .map(row => row[source2AddressColumn])
        .filter(Boolean);
      
      // Create mapping of addresses to property IDs if column is selected
      const propertyIdMapping: Record<string, string> = {};
      if (source2PropertyIdColumn) {
        source2Data.forEach(row => {
          const address = row[source2AddressColumn];
          const propertyId = row[source2PropertyIdColumn];
          if (address && propertyId) {
            propertyIdMapping[address] = propertyId;
          }
        });
      }
      
      // Perform matching
      const matchResults = matchAddresses(addresses1, addresses2);
      
      // Add property IDs to results
      const resultsWithPropertyIds = matchResults.map(result => ({
        ...result,
        propertyId: result.address2 ? propertyIdMapping[result.address2] : undefined
      }));
      
      setResults(resultsWithPropertyIds);
      
      // Check if there are any CoStar-only locations that need verification
      const costarOnly = resultsWithPropertyIds.filter(r => !r.address1 && r.address2);
      
      if (costarOnly.length > 0) {
        setVerificationStep(true);
      } else {
        setShowResults(true);
      }
      
      toast({
        title: "Comparison complete",
        description: `Found ${resultsWithPropertyIds.filter(r => r.matchType === 'exact').length} exact matches, ${resultsWithPropertyIds.filter(r => r.matchType === 'fuzzy').length} fuzzy matches`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error processing data",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerificationComplete = (verifiedAddresses: { address: string; propertyId?: string; keep: boolean }[]) => {
    // Filter results based on verification
    const updatedResults = results.map(result => {
      // If it's a CoStar-only address that was verified
      if (!result.address1 && result.address2) {
        const verifiedAddress = verifiedAddresses.find(v => v.address === result.address2);
        if (verifiedAddress && !verifiedAddress.keep) {
          // If marked for removal, filter it out
          return null;
        }
      }
      return result;
    }).filter(Boolean) as ResultRow[];
    
    setVerifiedResults(updatedResults);
    setVerificationStep(false);
    setShowResults(true);
  };

  const handleExport = (fileType: 'csv' | 'xlsx') => {
    const dataToExport = verifiedResults.length > 0 ? verifiedResults : results;
    const filename = `tenant-locations-comparison-${new Date().toISOString().split('T')[0]}`;
    
    const exportData = dataToExport.map(({ address1, address2, propertyId, score, matchType }) => ({
      'Website Address': address1 || '',
      'CoStar Address': address2 || '',
      'Property ID': propertyId || '',
      'Match Score': score > 0 ? score.toFixed(2) : '',
      'Status': matchType === 'exact' ? 'Exact Match' : 
                matchType === 'fuzzy' ? 'Fuzzy Match' : 
                address1 && !address2 ? 'Missing in CoStar' : 'Extra in CoStar'
    }));
    
    if (fileType === 'csv') {
      exportToCSV(exportData, `${filename}.csv`);
    } else {
      exportToExcel(exportData, `${filename}.xlsx`);
    }
  };

  // Extract CoStar-only addresses and their property IDs for verification
  const costarOnlyAddresses = results
    .filter(r => !r.address1 && r.address2)
    .map(r => r.address2);
  
  const costarPropertyIds: Record<string, string> = {};
  results
    .filter(r => !r.address1 && r.address2 && r.propertyId)
    .forEach(r => {
      if (r.address2 && r.propertyId) {
        costarPropertyIds[r.address2] = r.propertyId;
      }
    });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Tenant Location Matcher
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Compare tenant locations from your official website list with CoStar data.
            Our tool standardizes addresses and performs fuzzy matching to identify missing locations.
          </p>
        </div>

        {!showResults && !verificationStep ? (
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Official Website Data</h2>
                <FileUploader 
                  onFileParsed={handleFileParsed} 
                  fileType="source1" 
                  label="Upload website location file (or paste data)"
                />
                {source1Headers.length > 0 && (
                  <div className="mt-4">
                    <ColumnSelector
                      headers={source1Headers}
                      selectedColumn={source1AddressColumn}
                      onChange={setSource1AddressColumn}
                      label="Select address column"
                      placeholder="Select address column"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-xl font-semibold mb-4">CoStar Data</h2>
                <FileUploader 
                  onFileParsed={handleFileParsed} 
                  fileType="source2" 
                  label="Upload CoStar location file (or paste data)"
                />
                {source2Headers.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <ColumnSelector
                      headers={source2Headers}
                      selectedColumn={source2AddressColumn}
                      onChange={setSource2AddressColumn}
                      label="Select address column"
                      placeholder="Select address column"
                    />
                    
                    <ColumnSelector
                      headers={source2Headers}
                      selectedColumn={source2PropertyIdColumn}
                      onChange={setSource2PropertyIdColumn}
                      label="Select property ID column (optional)"
                      placeholder="Select property ID column"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center">
              <Button 
                onClick={handleCompare} 
                disabled={!source1Data || !source2Data || !source1AddressColumn || !source2AddressColumn || isProcessing}
                className="px-8"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                    Processing...
                  </>
                ) : (
                  'Compare Locations'
                )}
              </Button>
            </div>
          </Card>
        ) : verificationStep ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Verify Additional Locations</h2>
              <Button 
                variant="outline" 
                onClick={() => {
                  setVerificationStep(false);
                  setShowResults(true);
                  setVerifiedResults(results);
                }}
              >
                Skip Verification
              </Button>
            </div>
            
            <LocationVerifier
              costarOnlyAddresses={costarOnlyAddresses}
              costarPropertyIds={costarPropertyIds}
              onVerificationComplete={handleVerificationComplete}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Comparison Results</h2>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowResults(false);
                  setVerificationStep(false);
                  setResults([]);
                  setVerifiedResults([]);
                }}
              >
                Back to Upload
              </Button>
            </div>
            
            <Card className="p-6">
              <div className="mb-4">
                <div className="text-md font-medium mb-2">Files Compared:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-sm font-semibold">Website Data:</span> 
                    <span className="text-sm ml-2">{source1Data?.length} locations</span>
                  </div>
                  <div>
                    <span className="text-sm font-semibold">CoStar Data:</span> 
                    <span className="text-sm ml-2">{source2Data?.length} locations</span>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <ResultsTable 
                results={verifiedResults.length > 0 ? verifiedResults : results} 
                onExport={handleExport}
                includePropertyId={!!source2PropertyIdColumn}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
