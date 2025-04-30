
import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type ResultRow = {
  address1: string;
  address2: string;
  propertyId?: string;
  tenant?: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'missing';
};

interface ResultsTableProps {
  results: ResultRow[];
  onExport: (fileType: 'csv' | 'xlsx') => void;
  includePropertyId?: boolean;
  includeTenant?: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ 
  results, 
  onExport, 
  includePropertyId = false,
  includeTenant = false
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const itemsPerPage = 10;
  
  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);
  
  // Filter results based on tab
  const filteredResults = results.filter(row => {
    if (activeTab === 'all') return true;
    if (activeTab === 'exact') return row.matchType === 'exact';
    if (activeTab === 'fuzzy') return row.matchType === 'fuzzy';
    if (activeTab === 'missing') return row.matchType === 'missing' && row.address1;
    if (activeTab === 'extraInCoStar') return !row.address1 && row.address2;
    return true;
  });

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const pageResults = filteredResults.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Count for summary
  const exactCount = results.filter(r => r.matchType === 'exact').length;
  const fuzzyCount = results.filter(r => r.matchType === 'fuzzy').length;
  const missingCount = results.filter(r => r.matchType === 'missing' && r.address1).length;
  const extraCount = results.filter(r => !r.address1 && r.address2).length;

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Results</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="px-3 py-1 rounded-full bg-match-exact/20 text-match-exact font-medium">
              {exactCount} Exact Matches
            </div>
            <div className="px-3 py-1 rounded-full bg-match-fuzzy/20 text-match-fuzzy font-medium">
              {fuzzyCount} Fuzzy Matches
            </div>
            <div className="px-3 py-1 rounded-full bg-match-missing/20 text-match-missing font-medium">
              {missingCount} Missing in CoStar
            </div>
            <div className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 font-medium">
              {extraCount} Extra in CoStar
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onExport('csv')}>
            Export CSV
          </Button>
          <Button onClick={() => onExport('xlsx')}>
            Export Excel
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({results.length})</TabsTrigger>
          <TabsTrigger value="exact">Exact Matches ({exactCount})</TabsTrigger>
          <TabsTrigger value="fuzzy">Fuzzy Matches ({fuzzyCount})</TabsTrigger>
          <TabsTrigger value="missing">Missing in CoStar ({missingCount})</TabsTrigger>
          {extraCount > 0 && (
            <TabsTrigger value="extraInCoStar">Extra in CoStar ({extraCount})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {includeTenant && (
                    <TableHead>Tenant Name</TableHead>
                  )}
                  <TableHead>Website Address</TableHead>
                  <TableHead>CoStar Address</TableHead>
                  {includePropertyId && (
                    <TableHead>Property ID</TableHead>
                  )}
                  <TableHead className="w-24">Match Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(includePropertyId ? 1 : 0) + (includeTenant ? 1 : 0) + 4} className="text-center py-8">
                      No results found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageResults.map((row, index) => (
                    <TableRow key={index}>
                      {includeTenant && (
                        <TableCell>{row.tenant || '-'}</TableCell>
                      )}
                      <TableCell className="font-medium">{row.address1 || '-'}</TableCell>
                      <TableCell>{row.address2 || '-'}</TableCell>
                      {includePropertyId && (
                        <TableCell>{row.propertyId || '-'}</TableCell>
                      )}
                      <TableCell>
                        {row.score > 0 ? row.score.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell>
                        {row.matchType === 'exact' && (
                          <span className="px-2 py-1 rounded-md bg-match-exact/20 text-match-exact font-medium text-xs">
                            Exact Match
                          </span>
                        )}
                        {row.matchType === 'fuzzy' && (
                          <span className="px-2 py-1 rounded-md bg-match-fuzzy/20 text-match-fuzzy font-medium text-xs">
                            Fuzzy Match
                          </span>
                        )}
                        {row.matchType === 'missing' && row.address1 && (
                          <span className="px-2 py-1 rounded-md bg-match-missing/20 text-match-missing font-medium text-xs">
                            Missing in CoStar
                          </span>
                        )}
                        {!row.address1 && row.address2 && (
                          <span className="px-2 py-1 rounded-md bg-gray-200 text-gray-700 font-medium text-xs">
                            Extra in CoStar
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  
                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationLink 
                      onClick={() => setCurrentPage(totalPages)}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
        
        <TabsContent value="exact" className="mt-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {includeTenant && (
                    <TableHead>Tenant Name</TableHead>
                  )}
                  <TableHead>Website Address</TableHead>
                  <TableHead>CoStar Address</TableHead>
                  {includePropertyId && (
                    <TableHead>Property ID</TableHead>
                  )}
                  <TableHead className="w-24">Match Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(includePropertyId ? 1 : 0) + (includeTenant ? 1 : 0) + 4} className="text-center py-8">
                      No exact matches found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageResults.map((row, index) => (
                    <TableRow key={index}>
                      {includeTenant && (
                        <TableCell>{row.tenant || '-'}</TableCell>
                      )}
                      <TableCell className="font-medium">{row.address1}</TableCell>
                      <TableCell>{row.address2}</TableCell>
                      {includePropertyId && (
                        <TableCell>{row.propertyId || '-'}</TableCell>
                      )}
                      <TableCell>
                        {row.score > 0 ? row.score.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-md bg-match-exact/20 text-match-exact font-medium text-xs">
                          Exact Match
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  
                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationLink 
                      onClick={() => setCurrentPage(totalPages)}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
        
        <TabsContent value="fuzzy" className="mt-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {includeTenant && (
                    <TableHead>Tenant Name</TableHead>
                  )}
                  <TableHead>Website Address</TableHead>
                  <TableHead>CoStar Address</TableHead>
                  {includePropertyId && (
                    <TableHead>Property ID</TableHead>
                  )}
                  <TableHead className="w-24">Match Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(includePropertyId ? 1 : 0) + (includeTenant ? 1 : 0) + 4} className="text-center py-8">
                      No fuzzy matches found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageResults.map((row, index) => (
                    <TableRow key={index}>
                      {includeTenant && (
                        <TableCell>{row.tenant || '-'}</TableCell>
                      )}
                      <TableCell className="font-medium">{row.address1}</TableCell>
                      <TableCell>{row.address2}</TableCell>
                      {includePropertyId && (
                        <TableCell>{row.propertyId || '-'}</TableCell>
                      )}
                      <TableCell>
                        {row.score > 0 ? row.score.toFixed(2) : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-md bg-match-fuzzy/20 text-match-fuzzy font-medium text-xs">
                          Fuzzy Match
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  
                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationLink 
                      onClick={() => setCurrentPage(totalPages)}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
        
        <TabsContent value="missing" className="mt-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {includeTenant && (
                    <TableHead>Tenant Name</TableHead>
                  )}
                  <TableHead>Website Address</TableHead>
                  <TableHead>CoStar Address</TableHead>
                  {includePropertyId && (
                    <TableHead>Property ID</TableHead>
                  )}
                  <TableHead className="w-24">Match Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(includePropertyId ? 1 : 0) + (includeTenant ? 1 : 0) + 4} className="text-center py-8">
                      No missing locations found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageResults.map((row, index) => (
                    <TableRow key={index}>
                      {includeTenant && (
                        <TableCell>{row.tenant || '-'}</TableCell>
                      )}
                      <TableCell className="font-medium">{row.address1}</TableCell>
                      <TableCell>-</TableCell>
                      {includePropertyId && (
                        <TableCell>-</TableCell>
                      )}
                      <TableCell>-</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-md bg-match-missing/20 text-match-missing font-medium text-xs">
                          Missing in CoStar
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  
                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationLink 
                      onClick={() => setCurrentPage(totalPages)}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
        
        <TabsContent value="extraInCoStar" className="mt-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {includeTenant && (
                    <TableHead>Tenant Name</TableHead>
                  )}
                  <TableHead>Website Address</TableHead>
                  <TableHead>CoStar Address</TableHead>
                  {includePropertyId && (
                    <TableHead>Property ID</TableHead>
                  )}
                  <TableHead className="w-24">Match Score</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(includePropertyId ? 1 : 0) + (includeTenant ? 1 : 0) + 4} className="text-center py-8">
                      No extra locations in CoStar found
                    </TableCell>
                  </TableRow>
                ) : (
                  pageResults.map((row, index) => (
                    <TableRow key={index}>
                      {includeTenant && (
                        <TableCell>{row.tenant || '-'}</TableCell>
                      )}
                      <TableCell className="font-medium">-</TableCell>
                      <TableCell>{row.address2}</TableCell>
                      {includePropertyId && (
                        <TableCell>{row.propertyId || '-'}</TableCell>
                      )}
                      <TableCell>-</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-md bg-gray-200 text-gray-700 font-medium text-xs">
                          Extra in CoStar
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  
                  if (totalPages > 5) {
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                  }
                  
                  return (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={currentPage === pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationLink 
                      onClick={() => setCurrentPage(totalPages)}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} cursor-pointer`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsTable;
