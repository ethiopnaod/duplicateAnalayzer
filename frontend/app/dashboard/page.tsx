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
import { Users, Building2, RefreshCwIcon, Zap } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useEntityType, useSetEntityType } from "@/stores/entityType.store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/custom/PageHeader";
import CompactDuplicatesTable from "@/components/custom/CompactDuplicatesTable";
import ErrorBoundary from "@/components/custom/ErrorBoundary";
import { useDuplicates } from "@/hooks/useDuplicates";
import { testBackendConnection } from "@/lib/backend-test";

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

export default function Dashboard() {
  const entityType = useEntityType();
  const setEntityType = useSetEntityType();
  const [searchTerm, setSearchTerm] = useState("");
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

  // Use the optimized duplicates hook with real data
  const {
    entities,
    totalCount,
    currentPage,
    totalPages,
    hasNextPage,
    isLoading,
    isProcessing,
    refetch,
    setPage,
    setSearchTerm: setSearch,
    bulkMerge,
    bulkDelete,
    autoMerge,
  } = useDuplicates({
    entityType,
    pageSize: 25,
    searchTerm,
    onBackendStatusChange: (status, message) => {
      setBackendStatus({ status, message });
    },
  });

  // Derived states
  const typeLabel = entityType === "1" ? "Organizations" : "People";
  const Icon = entityType === "1" ? Building2 : Users;

  // Handle search change with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setSearch(value);
  }, [setSearch]);

  // Test backend connection on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const healthCheck = await testBackendConnection();
        setBackendStatus({
          status: healthCheck.status,
          message: healthCheck.message,
        });
      } catch (error) {
        setBackendStatus({
          status: 'unhealthy',
          message: 'Failed to connect to backend',
        });
      }
    };

    checkBackend();
  }, []);

  // Handle page change
  const handlePageChange = (page: number) => {
    setPage(page);
  };

  // Per-Entity AI Merge functionality
  const handleEntityAutoMerge = async (entityId: string, duplicateIds: number[]) => {
    setAiMergeStatus({ isRunning: true, progress: 0, message: `AI analyzing entity ${entityId}...` });
    
    try {
      const response = await fetch('http://localhost:3005/api/v1/duplicates/merge-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          primaryEntityId: entityId, 
          duplicateEntityIds: duplicateIds,
          entityType 
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAiMergeStatus({
          isRunning: false,
          progress: 100,
          message: `AI merge completed! Merged ${result.data.mergedCount} duplicates for entity ${entityId}.`,
          results: result.data
        });
        await refetch(); // Refresh the data
      } else {
        setAiMergeStatus({
          isRunning: false,
          progress: 0,
          message: `AI merge failed: ${result.error}`
        });
      }
    } catch (error) {
      setAiMergeStatus({
        isRunning: false,
        progress: 0,
        message: `AI merge error: ${error}`
      });
    }
  };

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-background">
        <PageHeader
          title="Duplicate Entries"
          description={`Detect and resolve duplicate ${typeLabel.toLowerCase()} with AI-powered matching`}
          searchValue={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder={`Search ${typeLabel.toLowerCase()}...`}
          actions={
            <div className="flex items-center gap-2">
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

        <div className="px-2 mx-auto py-2 h-[calc(100vh-120px)]">
          {/* Results Section - Full Height */}
          <Card className="rounded-md shadow-none h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg font-semibold text-foreground">
                  Duplicate {typeLabel}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {totalCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-2 py-1 font-medium">
                      {totalCount} duplicates
                    </Badge>
                  )}
                  <Badge 
                    variant={backendStatus.status === 'healthy' ? 'default' : backendStatus.status === 'unhealthy' ? 'destructive' : 'secondary'}
                    className="text-xs px-2 py-1 font-medium"
                    title={backendStatus.message}
                  >
                    {backendStatus.status === 'healthy' ? '🟢 Connected' : 
                     backendStatus.status === 'unhealthy' ? '🔴 Offline' : 
                     '🟡 Checking...'}
                  </Badge>
                </div>
              </div>
              
              {/* AI Merge Status */}
              {aiMergeStatus.isRunning && (
                <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <RefreshCwIcon className="h-4 w-4 animate-spin text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">{aiMergeStatus.message}</span>
                  </div>
                  <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${aiMergeStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {aiMergeStatus.results && !aiMergeStatus.isRunning && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">{aiMergeStatus.message}</span>
                  </div>
                  {aiMergeStatus.results.analysisResults && (
                    <div className="mt-1 text-xs text-green-700">
                      Processed {aiMergeStatus.results.processedGroups} groups with AI analysis
                    </div>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
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
                    pageSize={20}
                    pageRows={entities}
                    isProcessing={isProcessing}
                    hasNextPage={hasNextPage}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    autoMergeOne={handleEntityAutoMerge}
                    onBulkMerge={bulkMerge}
                    onBulkDelete={bulkDelete}
                  />
                </ErrorBoundary>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </ErrorBoundary>
  );
}