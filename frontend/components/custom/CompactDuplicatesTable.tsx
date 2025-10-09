"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users, Eye, Zap, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import Spinner from "@/components/ui/spinner";
import MergeDialog from "@/components/custom/mergeDialog";
import BulkDeleteDialog from "@/components/custom/BulkDeleteDialog";
import { type TransformedDuplicateEntity } from "@/lib/api/duplicates";

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
  pageSize = 20,
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

  // State
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualMergeOpen, setManualMergeOpen] = useState(false);
  const [manualMergeEntities, setManualMergeEntities] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteEntities, setBulkDeleteEntities] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Derived data
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalRows / pageSize)),
    [totalRows, pageSize]
  );
  const selectedNames = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );
  const isAllSelected = useMemo(
    () => pageRows.length > 0 && pageRows.every((entity) => selected[entity.id.toString()]),
    [pageRows, selected]
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
    const selectedEntities = pageRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    setManualMergeEntities(entityNames);
    setManualMergeOpen(true);
  }, [selected, pageRows]);

  const handleBulkDelete = useCallback(() => {
    // Get entity names from selected IDs
    const selectedEntities = pageRows.filter(entity => selected[entity.id.toString()]);
    const entityNames = selectedEntities.map(entity => entity.name);
    setBulkDeleteEntities(entityNames);
    setBulkDeleteOpen(true);
  }, [selected, pageRows]);

  const handleBulkMergeConfirm = useCallback(async (mergeName: string) => {
    if (!onBulkMerge) return;
    
    // Get entity names from selected IDs
    const selectedEntities = pageRows.filter(entity => selected[entity.id.toString()]);
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
  }, [selected, pageRows, onBulkMerge]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!onBulkDelete) return;
    
    // Get entity names from selected IDs
    const selectedEntities = pageRows.filter(entity => selected[entity.id.toString()]);
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
  }, [selected, pageRows, onBulkDelete]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages || isBulkProcessing || !onPageChange) return;
      onPageChange(newPage);
    },
    [totalPages, isBulkProcessing, onPageChange]
  );


  return (
    <div className="border rounded-lg bg-background h-full flex flex-col">
      {/* Ultra Compact Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-xs text-foreground">
            {entityType === "1" ? "Organizations" : "People"}
          </h3>
          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
            {totalRows}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          {selectedNames.length > 0 && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleMergeSelected}
                className="h-6 px-2 text-xs"
                disabled={isBulkProcessing}
              >
                <Users className="h-3 w-3 mr-1" />
                Merge ({selectedNames.length})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                className="h-6 px-2 text-xs"
                disabled={isBulkProcessing}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Del ({selectedNames.length})
              </Button>
            </>
          )}
          {(isProcessing || isBulkProcessing) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Spinner size="sm" />
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Ultra Compact Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 sticky top-0">
            <tr className="h-7">
              <th className="w-8 px-2 py-1 text-left">
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
              <th className="px-2 py-1 text-left font-medium text-foreground">Group</th>
              <th className="w-16 px-2 py-1 text-left font-medium text-foreground">Type</th>
              <th className="w-20 px-2 py-1 text-left font-medium text-foreground">Confidence</th>
              <th className="w-12 px-2 py-1 text-center font-medium text-foreground">Count</th>
              <th className="w-16 px-2 py-1 text-center font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {pageRows.map((entity, index) => (
              <tr key={`${entity.id}-${index}`} className="hover:bg-accent/20 transition-colors h-8">
                <td className="px-2 py-1">
                  <Checkbox
                    checked={!!selected[entity.id.toString()]}
                    onCheckedChange={(checked) => handleRowSelect(entity.id.toString(), !!checked)}
                    className="h-3 w-3"
                  />
                </td>
                <td className="px-2 py-1">
                  <div className="font-medium text-foreground truncate max-w-[250px]" title={entity.name}>
                    {entity.name}
                  </div>
                  {(entity.phoneNumbers?.length > 0 || entity.emailAddresses?.length > 0) && (
                    <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                      {entity.phoneNumbers?.length > 0 && (
                        <span className="inline-block mr-2">📞 {entity.phoneNumbers[0]}</span>
                      )}
                      {entity.emailAddresses?.length > 0 && (
                        <span className="inline-block">✉️ {entity.emailAddresses[0]}</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1">
                  <Badge 
                    variant={
                      entity.matchType === 'phone' ? 'default' :
                      entity.matchType === 'email' ? 'secondary' :
                      entity.matchType === 'name' ? 'outline' : 'destructive'
                    } 
                    className="text-xs px-1.5 py-0.5"
                  >
                    {entity.matchType?.toUpperCase() || 'NAME'}
                  </Badge>
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <div className="w-12 bg-muted rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          entity.confidence > 0.8 ? 'bg-green-500' :
                          entity.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${(entity.confidence || 0.5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((entity.confidence || 0.5) * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1 text-center">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    {entity.duplicateCount}
                  </Badge>
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center justify-center gap-0.5">
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

      {/* Ultra Compact Footer with Pagination */}
      <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalRows)} of {totalRows}</span>
          {selectedNames.length > 0 && (
            <>
              <span>•</span>
              <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                {selectedNames.length} selected
              </Badge>
            </>
          )}
        </div>
        
        {/* Ultra Compact Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage <= 1 || isBulkProcessing}
              className="h-6 w-6 p-0"
              title="First page"
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isBulkProcessing}
              className="h-6 w-6 p-0"
              title="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            {/* Compact Page Numbers */}
            <div className="flex items-center gap-0.5 mx-1">
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 3) {
                  pageNum = i + 1;
                } else if (currentPage <= 2) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  pageNum = totalPages - 2 + i;
                } else {
                  pageNum = currentPage - 1 + i;
                }
                
                if (pageNum > totalPages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isBulkProcessing}
                    className="h-6 w-6 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isBulkProcessing}
              className="h-6 w-6 p-0"
              title="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage >= totalPages || isBulkProcessing}
              className="h-6 w-6 p-0"
              title="Last page"
            >
              <ChevronsRight className="h-3 w-3" />
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

export default CompactDuplicatesTable;