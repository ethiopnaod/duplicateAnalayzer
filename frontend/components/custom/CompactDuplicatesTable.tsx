"use client";

import { useState, useMemo, useCallback, memo, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Users, Eye, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown } from "lucide-react";
// Removed virtual scrolling for 500 entities without scroll

// Types
interface DuplicateRecord {
  id: string;
  name: string;
  properties?: Record<string, any>;
  phoneNumbers?: string[];
  emailAddresses?: string[];
}

interface DuplicateGroup {
  groupKey: string;
  records: DuplicateRecord[];
  count: number;
}

interface CompactDuplicatesTableProps {
  entityType: string;
  totalRows: number;
  pageSize: number;
  pageRows: any[];
  isProcessing: boolean;
  hasNextPage: boolean;
  currentPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  autoMergeOne: (entityId: string, duplicateIds: number[]) => Promise<void>;
  onBulkMerge: (entities: string[], mergeName: string) => Promise<void>;
  onBulkDelete: (entities: string[]) => Promise<void>;
  onRefresh?: () => void;
}

// Inline Spinner Component
const InlineSpinner = ({ size = "sm" }: { size?: "sm" | "md" }) => (
  <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${size === "sm" ? "h-2 w-2" : "h-3 w-3"}`} />
);

// Modern row component with hover tooltips
const VirtualRow = memo(({ 
  group, 
  style, 
  isSelected, 
  onSelect, 
  onAutoMerge, 
  onViewDetails,
  bulkProcessing,
  isAutoMergeLoading,
  entityType,
  index
}: {
  group: DuplicateGroup;
  style: React.CSSProperties;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onAutoMerge: () => void;
  onViewDetails: () => void;
  bulkProcessing: boolean;
  isAutoMergeLoading: boolean;
  entityType: string;
  index: number;
}) => (
  <div
    style={style}
    className="flex items-center hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200 h-8 border-b border-border/20 px-4 group"
    role="row"
  >
    <div className="w-8 px-2 text-center" role="cell">
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        className="h-4 w-4"
        aria-label={`Select group ${group.groupKey}`}
      />
    </div>
    <div className="flex-1 px-3" role="cell">
      <div className="text-foreground truncate text-sm font-medium leading-tight" title={group.groupKey}>
        {group.groupKey}
      </div>
      {group.records && group.records.length > 0 && (() => {
        const firstRecord = group.records[0];
        return (
          <div className="text-xs text-muted-foreground truncate mt-1">
            {firstRecord?.phoneNumbers && firstRecord.phoneNumbers.length > 0 && (
              <span className="mr-3 text-xs font-mono">📞 {firstRecord.phoneNumbers[0]}</span>
            )}
            {firstRecord?.emailAddresses && firstRecord.emailAddresses.length > 0 && (
              <span className="text-xs font-mono">✉️ {firstRecord.emailAddresses[0]}</span>
            )}
          </div>
        );
      })()}
    </div>
    <div className="w-20 px-2 text-center" role="cell">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewDetails}
          className="h-7 w-7 p-0 hover:bg-primary/10 hover:scale-110 transition-all duration-200 group/btn"
          title={`View detailed information for ${group.groupKey}`}
          aria-label={`View details for group ${group.groupKey}`}
        >
          <Eye className="h-3.5 w-3.5 group-hover/btn:text-primary transition-colors" />
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={bulkProcessing || isAutoMergeLoading || (group.records?.length || 0) < 2}
          onClick={() => {
            onAutoMerge();
          }}
          className="h-7 w-7 p-0 hover:scale-110 transition-all duration-200 group/btn"
          title={`Auto-merge ${group.records?.length || 0} duplicates for ${group.groupKey}`}
          aria-label={`Auto-merge group ${group.groupKey}`}
        >
          {isAutoMergeLoading ? <InlineSpinner size="sm" /> : <Zap className="h-3.5 w-3.5 group-hover/btn:text-yellow-500 transition-colors" />}
        </Button>
      </div>
    </div>
  </div>
));

VirtualRow.displayName = "VirtualRow";

const CompactDuplicatesTable = memo(function CompactDuplicatesTable({
  entityType,
  totalRows,
  pageSize,
  pageRows,
  isProcessing,
  hasNextPage,
  currentPage,
  onPageChange,
  onPageSizeChange,
  autoMergeOne,
  onBulkMerge,
  onBulkDelete,
  onRefresh,
}: CompactDuplicatesTableProps) {
  const router = useRouter();
  const tableId = useId();
  // State
  const [sortField, setSortField] = useState<"groupKey" | "count">("groupKey");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [autoMergeLoading, setAutoMergeLoading] = useState<Record<string, boolean>>({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Transform pageRows to duplicates format - filter out entities without names
  const duplicates = useMemo(() => {
    return pageRows
      .filter((entity: any) => {
        // Filter out entities without names or with empty names
        const cleanName = entity.name ? entity.name.replace(/^Name:\s*/, '').trim() : '';
        return cleanName && cleanName !== '';
      })
      .map((entity: any) => {
        // Remove "Name:" prefix if present
        const cleanName = entity.name.replace(/^Name:\s*/, '').trim();
        
        // Create records from duplicateIds array
        let records = [];
        
        // Always create records based on duplicateCount if it's > 1
        const recordCount = entity.duplicateCount || 1;
        
        if (entity.duplicateIds && entity.duplicateIds.length > 0) {
          // Use the duplicateIds array to create records
          records = entity.duplicateIds.map((id: number, index: number) => {
            const entityData = entity.entities?.[index];
            return {
              id: id.toString(),
              name: entityData?.name?.replace(/^Name:\s*/, '').trim() || cleanName,
              phoneNumbers: entityData?.computed_phones ? [entityData.computed_phones] : (entity.phoneNumbers || []),
              emailAddresses: entityData?.computed_emails ? [entityData.computed_emails] : (entity.emailAddresses || []),
              properties: entity.properties || {}
            };
          });
        } else if (entity.entities && entity.entities.length > 0) {
          // Use entities array if duplicateIds is not available
          records = entity.entities.map((entityData: any, index: number) => ({
            id: entityData.entity_id?.toString() || `entity_${index}`,
            name: entityData.name?.replace(/^Name:\s*/, '').trim() || cleanName,
            phoneNumbers: entityData.computed_phones ? [entityData.computed_phones] : [],
            emailAddresses: entityData.computed_emails ? [entityData.computed_emails] : [],
            properties: entity.properties || {}
          }));
        }
        
        // If we still don't have enough records but duplicateCount > 1, create them
        if (records.length < recordCount && recordCount > 1) {
          const additionalRecords = Array.from({ length: recordCount - records.length }, (_, index) => ({
            id: `${entity.id}_${records.length + index}`,
            name: cleanName,
            phoneNumbers: entity.phoneNumbers || [],
            emailAddresses: entity.emailAddresses || [],
            properties: entity.properties || {}
          }));
          records = [...records, ...additionalRecords];
        }
        
        // Final fallback: if no records at all, create at least one
        if (records.length === 0) {
          records = [{
            id: entity.id,
            name: cleanName,
            phoneNumbers: entity.phoneNumbers || [],
            emailAddresses: entity.emailAddresses || [],
            properties: entity.properties || {}
          }];
        }
        
        return {
          groupKey: cleanName,
          records: records,
          count: Math.max(entity.duplicateCount || 0, records.length)
        };
      });
  }, [pageRows]);

  // Page change handler
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || bulkProcessing) return;
    onPageChange(newPage);
  }, [onPageChange, bulkProcessing]);

  // Sort change
  const handleSortChange = useCallback((field: "groupKey" | "count") => {
    const newOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc";
    setSortField(field);
    setSortOrder(newOrder);
    // Note: Sorting would need to be handled by parent component
  }, [sortField, sortOrder]);

  // Selection handlers with shift-click range selection
  const handleRowSelect = useCallback((groupId: string, checked: boolean, index: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedIndex !== null) {
      // Select range from lastSelectedIndex to current index
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeKeys = duplicates.slice(start, end + 1).map(d => d.groupKey);
      setSelected(prev => {
        const updated = { ...prev };
        rangeKeys.forEach(key => updated[key] = true);
        return updated;
      });
    } else {
      // Single selection
    setSelected(prev => ({ ...prev, [groupId]: checked }));
      setLastSelectedIndex(index);
    }
  }, [lastSelectedIndex, duplicates]);

  const handleSelectAll = useCallback((checked: boolean) => {
    const updated: Record<string, boolean> = {};
    duplicates.forEach(group => {
      updated[group.groupKey] = checked;
    });
    setSelected(updated);
  }, [duplicates]);

  // Derived state
  const selectedGroups = useMemo(() => 
    Object.keys(selected).filter(key => selected[key]),
    [selected]
  );

  const isAllSelected = useMemo(() => 
    duplicates.length > 0 && duplicates.every(group => selected[group.groupKey]),
    [duplicates, selected]
  );

  const isIndeterminate = useMemo(() => 
    selectedGroups.length > 0 && !isAllSelected,
    [selectedGroups.length, isAllSelected]
  );

  // Keyboard shortcut for select all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll(!isAllSelected);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAll, isAllSelected]);

  // Bulk actions with confirmation
  const handleBulkMerge = useCallback(async () => {
    if (selectedGroups.length === 0) return;

    setBulkProcessing(true);
    try {
      await onBulkMerge(selectedGroups, "Merged Group");
      setSelected({});
    } catch (error) {
      console.error("Bulk merge error:", error);
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedGroups, onBulkMerge]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedGroups.length === 0) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedGroups.length} duplicate groups?\n\n` +
      `This will mark the following entities as deleted:\n` +
      `${selectedGroups.slice(0, 5).join(', ')}` +
      `${selectedGroups.length > 5 ? `\n...and ${selectedGroups.length - 5} more` : ''}`
    );

    if (!confirmed) return;

    setBulkProcessing(true);
    try {
      await onBulkDelete(selectedGroups);
      setSelected({});
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Failed to delete entities. Please try again.");
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedGroups, onBulkDelete]);

  const handleAutoMerge = useCallback(async (groupId: string, records: DuplicateRecord[]) => {
    if (!records || records.length < 2) {
      return;
    }

    // Set loading state for this specific group
    setAutoMergeLoading(prev => ({ ...prev, [groupId]: true }));
    try {
      // For duplicate groups, we need to merge all records except the first one
      // The first record becomes the primary entity
      const primaryEntityId = records[0].id;
      const duplicateIds = records.slice(1).map(r => parseInt(r.id));
      
      await autoMergeOne(primaryEntityId, duplicateIds);
      
    } catch (error) {
      console.error("Auto-merge error:", error);
    } finally {
      // Clear loading state for this specific group
      setAutoMergeLoading(prev => ({ ...prev, [groupId]: false }));
    }
  }, [autoMergeOne]);

  const handleRefresh = useCallback(() => {
    setSelected({});
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div className="border rounded-lg bg-background h-[calc(100vh-80px)] flex flex-col">
      {/* Table Header with Duplicate Count */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gradient-to-r from-muted/10 to-muted/5 flex-shrink-0 h-8">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-foreground">
            Duplicate Entities
          </h3>
          <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
            {totalRows.toLocaleString()} duplicates found
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                {selectedGroups.length} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkMerge}
                disabled={bulkProcessing}
                className="h-8 px-3 text-sm font-medium"
              >
                {bulkProcessing ? <InlineSpinner size="sm" /> : "Merge Selected"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkProcessing}
                className="h-8 px-3 text-sm font-medium"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          )}
        </div>
      </div>

        {/* Selection Header */}
        <div className="flex items-center justify-between px-4 py-1 border-b bg-muted/5 flex-shrink-0 h-6">
        <div className="flex items-center gap-3">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(el) => {
                    if (el && 'indeterminate' in el) {
                      (el as any).indeterminate = isIndeterminate;
                    }
                  }}
            className="h-4 w-4"
            aria-label="Select all duplicates"
          />
          <span className="text-sm font-medium text-foreground">Select All</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Use Shift+Click for range selection</span>
        </div>
      </div>

        {/* Modern Table Headers */}
        <div className="flex items-center px-4 py-1 bg-gradient-to-r from-muted/10 to-muted/5 border-b flex-shrink-0 h-6">
        <div className="w-8 px-2"></div>
        <div 
          className="flex-1 px-3 text-left text-foreground cursor-pointer hover:bg-muted/30 transition-colors text-sm font-semibold group"
                    onClick={() => handleSortChange("groupKey")}
        >
          <div className="flex items-center gap-2">
            Entity Name
            <ArrowUpDown className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                    </div>
        <div className="w-20 px-2 text-center text-foreground text-sm font-semibold">
                    Actions
        </div>
                  </div>

      {/* Table Body - Scrollable with optimized font */}
      <div className="flex-1 overflow-auto">
        {duplicates.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">No duplicates found</p>
                    </div>
                  </div>
        ) : (
          <div className="space-y-0">
            {duplicates.map((group, index) => (
              <VirtualRow
                key={`${tableId}-row-${currentPage}-${index}-${group.groupKey}`}
                group={group}
                style={{}}
                isSelected={!!selected[group.groupKey]}
                onSelect={(checked) => handleRowSelect(group.groupKey, checked, index)}
                onAutoMerge={() => handleAutoMerge(group.groupKey, group.records)}
                onViewDetails={() => router.push(`/dashboard/duplicates/${encodeURIComponent(group.groupKey)}?type=${entityType}`)}
                bulkProcessing={bulkProcessing}
                isAutoMergeLoading={!!autoMergeLoading[group.groupKey]}
                entityType={entityType}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

        {/* Simple Footer */}
        <div className="flex items-center justify-between px-4 py-1 border-t bg-muted/5 flex-shrink-0 h-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium">
            Showing {duplicates.length} of {totalRows.toLocaleString()} entities
          </span>
          {selectedGroups.length > 0 && (
            <>
              <div className="w-px h-4 bg-border"></div>
              <Badge variant="outline" className="text-sm px-2 py-1 font-semibold">
                {selectedGroups.length} selected
              </Badge>
            </>
          )}
        </div>
        
          <div className="flex items-center gap-2">
          {/* Simple Pagination Controls */}
          {hasNextPage && (
            <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || bulkProcessing}
                className="h-6 w-6 p-0 hover:bg-primary/10 transition-colors"
              title="Previous page"
                aria-label="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            <span className="text-xs text-muted-foreground px-2">
                Page {currentPage}
            </span>
            
            <Button
              variant="outline"
              size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasNextPage || bulkProcessing}
                className="h-6 w-6 p-0 hover:bg-primary/10 transition-colors"
              title="Next page"
                aria-label="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
});

export default CompactDuplicatesTable;