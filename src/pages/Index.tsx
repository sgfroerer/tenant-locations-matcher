
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import FileUploader from '@/components/FileUploader';
import ColumnSelector from '@/components/ColumnSelector';
import ResultsTable from '@/components/ResultsTable';
import { FileData, exportToCSV, exportToExcel } from '@/utils/fileUtils';
import { matchAddresses } from '@/utils/addressUtils';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

type ResultRow = {
  address1: string;
  address2: string;
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
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);
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
      
      // Perform matching
      const matchResults = matchAddresses(addresses1, addresses2);
      
      setResults(matchResults);
      setShowResults(true);
      
      toast({
        title: "Comparison complete",
        description: `Found ${matchResults.filter(r => r.matchType === 'exact').length} exact matches, ${matchResults.filter(r => r.matchType === 'fuzzy').length} fuzzy matches`,
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

  const handleExport = (fileType: 'csv' | 'xlsx') => {
    const filename = `tenant-locations-comparison-${new Date().toISOString().split('T')[0]}`;
    
    const exportData = results.map(({ address1, address2, score, matchType }) => ({
      'Website Address': address1,
      'CoStar Address': address2,
      'Match Score': score.toFixed(2),
      'Status': matchType === 'exact' ? 'Exact Match' : 
                matchType === 'fuzzy' ? 'Fuzzy Match' : 
                address1 ? 'Missing in CoStar' : 'Extra in CoStar'
    }));
    
    if (fileType === 'csv') {
      exportToCSV(exportData, `${filename}.csv`);
    } else {
      exportToExcel(exportData, `${filename}.xlsx`);
    }
  };

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

        {!showResults ? (
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-xl font-semibold mb-4">Official Website Data</h2>
                <FileUploader 
                  onFileParsed={handleFileParsed} 
                  fileType="source1" 
                  label="Upload website location file (CSV or Excel)"
                />
                {source1Headers.length > 0 && (
                  <div className="mt-4">
                    <ColumnSelector
                      headers={source1Headers}
                      selectedColumn={source1AddressColumn}
                      onChange={setSource1AddressColumn}
                      label="Select address column"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-xl font-semibold mb-4">CoStar Data</h2>
                <FileUploader 
                  onFileParsed={handleFileParsed} 
                  fileType="source2" 
                  label="Upload CoStar location file (CSV or Excel)"
                />
                {source2Headers.length > 0 && (
                  <div className="mt-4">
                    <ColumnSelector
                      headers={source2Headers}
                      selectedColumn={source2AddressColumn}
                      onChange={setSource2AddressColumn}
                      label="Select address column"
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
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Comparison Results</h2>
              <Button 
                variant="outline" 
                onClick={() => setShowResults(false)}
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
                results={results} 
                onExport={handleExport}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
