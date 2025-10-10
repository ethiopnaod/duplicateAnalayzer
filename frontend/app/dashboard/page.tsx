"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Building2, RefreshCwIcon, Zap, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useEntityType, useSetEntityType } from "@/stores/entityType.store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/custom/PageHeader";
import CompactDuplicatesTable from "@/components/custom/CompactDuplicatesTable";
import ErrorBoundary from "@/components/custom/ErrorBoundary";
import { useHydrationSafeDuplicates } from "@/hooks/useHydrationSafeDuplicates";
import { testBackendConnection } from "@/lib/backend-test";
import dynamic from "next/dynamic";

const OPTIONS = [
  {
    label: "Organizations",
    value: "1",
    icon: Building2,
  },
  {
    label: "People",
    value: "2",
    icon: Users,
  },
];

// Client-side only component to prevent SSR hydration issues
const DashboardClient = () => {
  const entityType = useEntityType();
  const setEntityType = useSetEntityType();
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSizeState] = useState(200);
  const [backendStatus, setBackendStatus] = useState<{
    status: 'checking' | 'healthy' | 'unhealthy';
    message: string;
  }>({ status: 'checking', message: 'Checking backend connection...' });
  const [aiMergeStatus, setAiMergeStatus] = useState<{
    isRunning: boolean;
    progress: number;
    message: string;
    results?: any;
  }>({ isRunning: false, progress: 0, message: '' });

  // Use the hydration-safe duplicates hook with real data
  const {
    entities,
    totalCount,
    currentPage,
    totalPages,
    hasNextPage,
    pageSize: hookPageSize,
    isLoading,
    isProcessing,
    refetch,
    setPage,
    setPageSize,
    setSearchTerm: setSearch,
    bulkMerge,
    bulkDelete,
    autoMerge,
  } = useHydrationSafeDuplicates({
    entityType,
    pageSize: 200,
    searchTerm,
    onBackendStatusChange: (status, message) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏥 Backend: ${status} - ${message}`);
      }
      setBackendStatus({ status, message });
    },
  });

  // Minimal logging for data changes (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Dashboard: ${entities.length}/${totalCount} entities, page ${currentPage}/${totalPages}`);
    }
  }, [entities.length, totalCount, currentPage, totalPages]);

  // Derived states
  const typeLabel = entityType === "1" ? "Organizations" : "People";
  const Icon = entityType === "1" ? Building2 : Users;

  // Handle search change with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setSearch(value);
  }, [setSearch]);

  // Test backend connection on mount (client-side only) with timeout handling
  useEffect(() => {
    const checkBackend = async () => {
      setBackendStatus({ status: 'checking', message: 'Checking backend connection...' });
      
      try {
        // Use a shorter timeout for the health check to avoid blocking the UI
        const healthCheck = await Promise.race([
          testBackendConnection(1), // Only 1 retry for faster response
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 15000)
          )
        ]);
        
        setBackendStatus({
          status: healthCheck.status,
          message: healthCheck.message,
        });
      } catch (error) {
        console.warn('Backend health check failed:', error);
        setBackendStatus({
          status: 'unhealthy',
          message: 'Backend connection timeout - data may load slowly',
        });
      }
    };

    // Delay the health check slightly to not block initial render
    const timeoutId = setTimeout(checkBackend, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Handle page change
  const handlePageChange = (page: number) => {
    setPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSizeState(newPageSize);
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  // Per-Entity AI Merge functionality
  const handleEntityAutoMerge = async (entityId: string, duplicateIds: number[]) => {
    console.log('Dashboard handleEntityAutoMerge called with:', {
      entityId,
      duplicateIds,
      entityType
    });
    
    setAiMergeStatus({ 
      isRunning: true, 
      progress: 10, 
      message: `🔄 Starting auto-merge for entity ${entityId}...` 
    });
    
    try {
      // Update progress
      setAiMergeStatus({ 
        isRunning: true, 
        progress: 30, 
        message: `🔄 Merging ${duplicateIds.length} duplicates into entity ${entityId}...` 
      });
      
      // Use the autoMerge function from the hook
      await autoMerge(entityId, duplicateIds);
      
      // Update progress to 80% before refresh
      setAiMergeStatus({ 
        isRunning: true, 
        progress: 80, 
        message: `🔄 Updating table data...` 
      });
      
      // Refresh the table data
      await refetch();
      
      setAiMergeStatus({ 
        isRunning: false, 
        progress: 100, 
        message: `✅ Successfully merged ${duplicateIds.length} duplicates into entity ${entityId}!` 
      });
      
      // Clear status after 5 seconds
      setTimeout(() => {
        setAiMergeStatus({ isRunning: false, progress: 0, message: '' });
      }, 5000);
    } catch (error) {
      console.error('Auto-merge error:', error);
      setAiMergeStatus({ 
        isRunning: false, 
        progress: 0, 
        message: `❌ Auto-merge failed for entity ${entityId}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      
      // Clear error status after 5 seconds
      setTimeout(() => {
        setAiMergeStatus({ isRunning: false, progress: 0, message: '' });
      }, 5000);
    }
  };

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-background">
        <PageHeader
          title="Duplicate Entries"
          description="Detect and resolve duplicate entries with AI-powered matching"
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search duplicates..."
          actions={
            <div className="flex items-center gap-4">
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="h-9 cursor-pointer bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                      <div className="flex items-center gap-3">
                        <option.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Pagination in Header */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Show:</span>
                <Select
                  value={hookPageSize.toString()}
                  onValueChange={(value) => {
                    const newPageSize = parseInt(value);
                    handlePageSizeChange(newPageSize);
                  }}
                  disabled={isLoading || isProcessing}
                >
                  <SelectTrigger className="w-20 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50" className="text-sm">50</SelectItem>
                    <SelectItem value="100" className="text-sm">100</SelectItem>
                    <SelectItem value="200" className="text-sm">200</SelectItem>
                    <SelectItem value="500" className="text-sm">500</SelectItem>
                    <SelectItem value="1000" className="text-sm">1000</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
              
              <Button
                size="icon"
                variant="default"
                disabled={isLoading}
                onClick={() => refetch()}
                aria-label="Refresh data"
              >
                <RefreshCwIcon className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          }
        />

        <div className="px-1 mx-auto py-1">
          {/* Auto-Merge Progress Bar */}
          {aiMergeStatus.isRunning && (
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <Zap className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{aiMergeStatus.message}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32">
                      <Progress value={aiMergeStatus.progress} className="h-2" />
                    </div>
                    <span className="text-sm text-blue-600">{aiMergeStatus.progress}%</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Success/Error Status */}
          {!aiMergeStatus.isRunning && aiMergeStatus.message && (
            <Alert className={`mb-4 ${aiMergeStatus.message.includes('✅') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              {aiMergeStatus.message.includes('✅') ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={aiMergeStatus.message.includes('✅') ? 'text-green-800' : 'text-red-800'}>
                {aiMergeStatus.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Results Section - Full Height */}
          <Card className="rounded-md shadow-none flex flex-col">
              {/* Removed CardHeader to save space */}

            <CardContent className="pt-0 flex flex-col">
              {/* Compact Loading State */}
              {isLoading && (
                <div className="space-y-1 flex-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              )}

              {/* Backend Error State - Show when backend is unhealthy OR when we have an error */}
              {!isLoading && totalCount === 0 && !searchTerm && (backendStatus.status === 'unhealthy' || backendStatus.status === 'checking') && (
                <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
                    <RefreshCwIcon className="h-8 w-8 text-destructive" />
                  </div>
                  <h3 className="text-base font-medium text-foreground mb-2">
                    {backendStatus.status === 'checking' ? 'Checking Backend Connection...' : 'Backend Connection Issue'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mb-4">
                    {backendStatus.status === 'checking' 
                      ? 'Please wait while we connect to the backend server...'
                      : 'Unable to connect to the backend server. The duplicates endpoint may be experiencing performance issues.'
                    }
                  </p>
                  {backendStatus.status === 'unhealthy' && (
                    <Button onClick={refetch} variant="outline" size="sm">
                      <RefreshCwIcon className="h-4 w-4 mr-2" />
                      Retry Connection
                    </Button>
                  )}
                </div>
              )}

              {/* No Search Results State */}
              {!isLoading && totalCount === 0 && searchTerm && backendStatus.status === 'healthy' && (
                <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium text-foreground mb-2">No results found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    No duplicates found matching &quot;{searchTerm}&quot;. Try a different search term.
                  </p>
                </div>
              )}

              {/* No Results State - Only show when backend is healthy */}
              {!isLoading && totalCount === 0 && !searchTerm && backendStatus.status === 'healthy' && (
                <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium text-foreground mb-2">No duplicates found</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Great! No duplicate {typeLabel.toLowerCase()} detected in your database.
                  </p>
                </div>
              )}

              {/* Results - Full Height Table */}
              {!isLoading && totalCount > 0 && (
                <ErrorBoundary>
                  <CompactDuplicatesTable
                    entityType={entityType}
                    totalRows={totalCount}
                    pageSize={hookPageSize}
                    pageRows={entities}
                    isProcessing={isProcessing}
                    hasNextPage={hasNextPage}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    autoMergeOne={handleEntityAutoMerge}
                    onBulkMerge={bulkMerge}
                    onBulkDelete={bulkDelete}
                    onRefresh={refetch}
                  />
                </ErrorBoundary>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </ErrorBoundary>
  );
};

// Export the dynamically imported component to prevent SSR issues
export default dynamic(() => Promise.resolve(DashboardClient), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-10 w-32 bg-muted animate-pulse rounded" />
          </div>
          
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          
          {/* Table skeleton */}
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
});