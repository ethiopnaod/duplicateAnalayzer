"use client";

import { useState, useMemo, useCallback, memo, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Users, Eye, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import Spinner from "@/components/ui/spinner";
import MergeDialog from "@/components/custom/mergeDialog";
import BulkDeleteDialog from "@/components/custom/BulkDeleteDialog";
import { type TransformedDuplicateEntity } from "@/lib/api/duplicates";
import { formatPhoneForDisplay, standardizePhoneNumber } from "@/lib/phoneUtils";

interface CompactDuplicatesTableProps {
  entityType: string;
  totalRows: number;
  pageSize?: number;
  pageRows: TransformedDuplicateEntity[];
  isProcessing: boolean;
  hasNextPage: boolean;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  autoMergeOne: (entityId: string, duplicateIds: number[]) => Promise<void>;
  onBulkMerge?: (entities: string[], mergeName: string) => Promise<void> | void;
  onBulkDelete?: (entities: string[]) => Promise<void> | void;
}

const CompactDuplicatesTable = memo(function CompactDuplicatesTable({
  entityType,
  totalRows,
  pageSize = 100,
  pageRows,
  isProcessing,
  hasNextPage,
  currentPage = 1,
  onPageChange,
  autoMergeOne,
  onBulkMerge,
  onBulkDelete,
}: CompactDuplicatesTableProps) {
  const router = useRouter();
  const tableId = useId();

  // Minimal logging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Table: ${pageRows.length} rows, page ${currentPage}`);
    }
  }, [pageRows.length, currentPage]);

  // State
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualMergeOpen, setManualMergeOpen] = useState(false);
  const [manualMergeEntities, setManualMergeEntities] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteEntities, setBulkDeleteEntities] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Filter out Entity_XXX records and invalid names, then sort alphabetically
  const filteredRows = useMemo(() => {
    return pageRows
      .filter(entity => 
        !entity.name.startsWith('Entity_') && 
        entity.name.trim() !== '' && 
        entity.name !== 'Unknown' &&
        entity.name !== 'No Name'
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pageRows]);

  // Update totalRows to reflect filtered count
  const filteredTotalRows = filteredRows.length;

  // Derived data
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTotalRows / pageSize)),
    [filteredTotalRows, pageSize]
  );
  const selectedNames = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );
  const isAllSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every((entity) => selected[entity.id.toString()]),
    [filteredRows, selected]
  );
  const isIndeterminate = useMemo(
    () => selectedNames.length > 0 && !isAllSelected,
    [selectedNames.length, isAllSelected]
  );

  // Handlers
  const handleRowSelect = useCallback(
    (entityId: string, checked: boolean) => {
      setSelected((prev) => ({ ...prev, [entityId]: checked }));
    },
    []
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const updated: Record<string, boolean> = {};
      pageRows.forEach((entity) => (updated[entity.id.toString()] = checked));
      setSelected(updated);
    },
    [pageRows]
  );

  const handleMergeSelected = useCallback(() => {
    // Get entity names from selected IDs
    const selectedEntities = filteredRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    setManualMergeEntities(entityNames);
    setManualMergeOpen(true);
  }, [selected, filteredRows]);

  const handleBulkDelete = useCallback(() => {
    // Get entity names from selected IDs
    const selectedEntities = filteredRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    setBulkDeleteEntities(entityNames);
    setBulkDeleteOpen(true);
  }, [selected, filteredRows]);

  const handleBulkMergeConfirm = useCallback(async (mergeName: string) => {
    if (!onBulkMerge) return;
    
    // Get entity names from selected IDs
    const selectedEntities = filteredRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    
    setIsBulkProcessing(true);
    try {
      await onBulkMerge(entityNames, mergeName);
      toast.success(`Successfully merged ${entityNames.length} duplicates into "${mergeName}"`);
      setSelected({});
    } catch (error) {
      toast.error("Failed to merge duplicates. Please try again.");
      console.error("Bulk merge error:", error);
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selected, filteredRows, onBulkMerge]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!onBulkDelete) return;
    
    // Get entity names from selected IDs
    const selectedEntities = filteredRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    
    setIsBulkProcessing(true);
    try {
      await onBulkDelete(entityNames);
      toast.success(`Successfully deleted ${entityNames.length} duplicates`);
      setSelected({});
    } catch (error) {
      toast.error("Failed to delete duplicates. Please try again.");
      console.error("Bulk delete error:", error);
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selected, filteredRows, onBulkDelete]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages || isBulkProcessing || !onPageChange) return;
      onPageChange(newPage);
    },
    [totalPages, isBulkProcessing, onPageChange]
  );


  return (
    <div className="border rounded-lg bg-background h-[700px] flex flex-col">
      {/* Minimal Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/10">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm text-foreground">
            {entityType === "1" ? "Organizations" : "People"}
          </h3>
          <Badge variant="secondary" className="text-xs px-2 py-1">
            {totalRows.toLocaleString()}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedNames.length > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleMergeSelected}
                className="h-7 px-3 text-xs"
                disabled={isBulkProcessing}
              >
                <Users className="h-3 w-3 mr-1" />
                Merge ({selectedNames.length})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-7 px-3 text-xs"
                disabled={isBulkProcessing}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete ({selectedNames.length})
              </Button>
            </>
          )}
          {(isProcessing || isBulkProcessing) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="sm" />
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Fixed Height Table - No Scroll */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          <table className="w-full text-xs">
          <thead className="bg-muted/20 sticky top-0">
            <tr className="h-8">
              <th className="w-8 px-2 text-center">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  ref={(el) => {
                    if (el && 'indeterminate' in el) {
                      (el as any).indeterminate = isIndeterminate;
                    }
                  }}
                  className="h-3 w-3"
                />
              </th>
              <th className="px-4 text-left font-medium text-foreground">Record</th>
              <th className="w-16 px-2 text-center font-medium text-foreground">Count</th>
              <th className="w-24 px-2 text-center font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 h-[600px] overflow-hidden">
            {filteredRows.map((entity, index) => (
              <tr key={`${tableId}-row-${currentPage}-${index}-${entity.id}`} className="hover:bg-accent/10 transition-colors h-6">
                <td className="px-2 text-center">
                  <Checkbox
                    checked={!!selected[entity.id.toString()]}
                    onCheckedChange={(checked) => handleRowSelect(entity.id.toString(), !!checked)}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-4">
                  <div className="font-medium text-foreground truncate" title={entity.name}>
                    {entity.name}
                  </div>
                  {(entity.phoneNumbers?.length > 0 || entity.emailAddresses?.length > 0) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {entity.phoneNumbers?.length > 0 && (
                        <span className="mr-3">📞 {formatPhoneForDisplay(entity.phoneNumbers[0])}</span>
                      )}
                      {entity.emailAddresses?.length > 0 && (
                        <span>✉️ {entity.emailAddresses[0]}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-2 text-center">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-semibold">
                    {entity.duplicateCount}
                  </Badge>
                </td>
                <td className="px-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/dashboard/duplicates/${encodeURIComponent(entity.name)}?type=${entityType}`
                        )
                      }
                      className="h-6 w-6 p-0 hover:bg-primary/10"
                      title="View Details"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => autoMergeOne(entity.id, entity.duplicateIds)}
                      className="h-6 w-6 p-0"
                      title="Auto Merge"
                    >
                      {isProcessing ? <Spinner size="sm" /> : <Zap className="h-3 w-3" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Compact Footer with Pagination */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredTotalRows)} of {filteredTotalRows.toLocaleString()}
        </span>
          {selectedNames.length > 0 && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {selectedNames.length} selected
              </Badge>
            </>
          )}
        </div>
        
        {/* Pagination Controls with Dropdown */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isBulkProcessing}
              className="h-7 w-7 p-0"
              title="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            {/* Page Dropdown */}
            <Select
              value={currentPage.toString()}
              onValueChange={(value) => handlePageChange(parseInt(value))}
              disabled={isBulkProcessing}
            >
              <SelectTrigger className="w-20 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <SelectItem key={pageNum} value={pageNum.toString()} className="text-xs">
                    {pageNum}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <span className="text-xs text-muted-foreground">
              of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isBulkProcessing}
              className="h-7 w-7 p-0"
              title="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MergeDialog
        open={manualMergeOpen}
        onOpenChange={setManualMergeOpen}
        entities={manualMergeEntities}
        isProcessing={isBulkProcessing}
        autoMerge={autoMergeOne}
        autoMergeOne={autoMergeOne}
        onConfirm={handleBulkMergeConfirm}
      />

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        entities={bulkDeleteEntities}
        isProcessing={isBulkProcessing}
        onConfirm={handleBulkDeleteConfirm}
      />
    </div>
  );
});

// Export the dynamically imported component to prevent SSR issues
export default dynamic(() => Promise.resolve(CompactDuplicatesTable), {
  ssr: false,
  loading: () => (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-8 bg-muted animate-pulse rounded" />
      ))}
    </div>
  )
});