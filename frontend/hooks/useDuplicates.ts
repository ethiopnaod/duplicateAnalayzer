import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { 
  fetchDuplicates, 
  mergeDuplicates, 
  deleteDuplicates, 
  autoMergeDuplicate,
  type DuplicatesResponse,
  type TransformedDuplicateEntity,
  type MergeRequest,
  type DeleteRequest
} from '@/lib/api/duplicates';

interface UseDuplicatesOptions {
  entityType: string;
  pageSize?: number;
  searchTerm?: string;
  onBackendStatusChange?: (status: 'healthy' | 'unhealthy' | 'checking', message: string) => void;
}

interface UseDuplicatesReturn {
  // Data
  entities: TransformedDuplicateEntity[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  
  // Loading states
  isLoading: boolean;
  isProcessing: boolean;
  
  // Actions
  refetch: () => Promise<void>;
  setPage: (page: number) => void;
  setSearchTerm: (term: string) => void;
  
  // Bulk operations
  bulkMerge: (entities: string[], mergeName: string) => Promise<void>;
  bulkDelete: (entities: string[]) => Promise<void>;
  autoMerge: (entityName: string) => Promise<void>;
}

export function useDuplicates({
  entityType,
  pageSize = 20,
  searchTerm = '',
  onBackendStatusChange,
}: UseDuplicatesOptions): UseDuplicatesReturn {
  // State
  const [data, setData] = useState<DuplicatesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState(searchTerm);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  // Refs for debouncing
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isInitialMount = useRef<boolean>(true);

  // Derived data
  const entities = useMemo(() => data?.entities || [], [data?.entities]);
  const totalCount = data?.totalCount || 0;
  const totalPages = useMemo(() => 
    Math.max(1, Math.ceil(totalCount / pageSize)), 
    [totalCount, pageSize]
  );
  const hasNextPage = data?.hasNextPage || false;

  // Fetch data with stable dependencies
  const fetchData = useCallback(async (page: number, searchQuery: string) => {
    if (!entityType) return;
    
    // Reset retry count on new search or page change
    if (searchQuery !== search || page !== currentPage) {
      setRetryCount(0);
    }
    
    // Don't retry if we've exceeded max retries
    if (retryCount >= maxRetries) {
      console.log('Max retries exceeded, stopping attempts');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetchDuplicates(entityType, page, pageSize, searchQuery);
      setData(response);
      setRetryCount(0); // Reset retry count on success
      
      // Check if we got an error response
      if (response.error) {
        toast.error('Backend error: ' + response.error);
        onBackendStatusChange?.('unhealthy', 'Backend error: ' + response.error);
        setData({
          entities: [],
          totalCount: 0,
          page: page,
          pageSize: pageSize,
          hasNextPage: false,
          error: response.error
        });
      } else {
        onBackendStatusChange?.('healthy', 'Backend connected successfully');
      }
    } catch (error) {
      console.error('Failed to fetch duplicates from backend:', error);
      
      // Increment retry count
      setRetryCount(prev => prev + 1);
      
      // Show appropriate error message
      if (error.message?.includes('Database temporarily unavailable') || 
          error.message?.includes('timeout') ||
          error.response?.status === 500) {
        toast.error('Backend temporarily unavailable');
        onBackendStatusChange?.('unhealthy', 'Backend temporarily unavailable');
      } else {
        toast.error('Failed to load duplicates from backend');
        onBackendStatusChange?.('unhealthy', 'Failed to connect to backend');
      }
      
      // Set empty data on error
      setData({
        entities: [],
        totalCount: 0,
        page: page,
        pageSize: pageSize,
        hasNextPage: false,
        error: 'Backend connection failed'
      });
    } finally {
      setIsLoading(false);
    }
  }, [entityType, pageSize, onBackendStatusChange, retryCount, search, currentPage]);

  // Refetch function
  const refetch = useCallback(async () => {
    await fetchData(currentPage, search);
  }, [fetchData, currentPage, search]);

  // Set page
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Debounced search term setter
  const setSearchTerm = useCallback((term: string) => {
    setSearch(term);
    setCurrentPage(1); // Reset to first page when searching
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search API calls
    searchTimeoutRef.current = setTimeout(() => {
      fetchData(1, term);
    }, 300);
  }, [fetchData]);

  // Bulk merge
  const bulkMerge = useCallback(async (entities: string[], mergeName: string) => {
    if (!entityType || entities.length === 0) return;
    
    setIsProcessing(true);
    try {
      const request: MergeRequest = {
        entities,
        mergeName,
        entityType,
      };
      
      await mergeDuplicates(request);
      toast.success(`Successfully merged ${entities.length} duplicates into "${mergeName}"`);
      await refetch(); // Refresh data
    } catch (error) {
      console.error('Bulk merge failed:', error);
      toast.error('Failed to merge duplicates');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [entityType, refetch]);

  // Bulk delete
  const bulkDelete = useCallback(async (entities: string[]) => {
    if (!entityType || entities.length === 0) return;
    
    setIsProcessing(true);
    try {
      const request: DeleteRequest = {
        entities,
        entityType,
      };
      
      const result = await deleteDuplicates(request);
      toast.success(`Successfully deleted ${result.deletedCount} duplicates`);
      await refetch(); // Refresh data
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error('Failed to delete duplicates');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [entityType, refetch]);

  // Auto merge single entity
  const autoMerge = useCallback(async (entityName: string) => {
    if (!entityType || !entityName) return;
    
    setIsProcessing(true);
    try {
      await autoMergeDuplicate(entityName, entityType);
      toast.success(`Successfully auto-merged "${entityName}"`);
      await refetch(); // Refresh data
    } catch (error) {
      console.error('Auto merge failed:', error);
      toast.error('Failed to auto-merge duplicate');
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [entityType, refetch]);

  // Initial fetch and page changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchData(1, searchTerm);
    } else {
      fetchData(currentPage, search);
    }
  }, [entityType, currentPage, fetchData, search, searchTerm]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    entities,
    totalCount,
    currentPage,
    totalPages,
    hasNextPage,
    isLoading,
    isProcessing,
    refetch,
    setPage,
    setSearchTerm,
    bulkMerge,
    bulkDelete,
    autoMerge,
  };
}
