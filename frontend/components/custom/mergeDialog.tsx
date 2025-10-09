"use client";

import React, { useState, useEffect, memo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, CheckCircle } from "lucide-react";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: string[];
  isProcessing?: boolean;
  onConfirm: (mergeName: string) => Promise<void> | void;
  autoMerge: (entityName: string) => Promise<void>;
  autoMergeOne: (entityName: string) => Promise<void>;
  }

const MergeDialog = memo(function MergeDialog({
  open,
  onOpenChange,
  entities,
  isProcessing = false,
  autoMergeOne,     
  onConfirm,
}: MergeDialogProps) {
  const [mergeName, setMergeName] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Auto-suggest merge name when entities change
  useEffect(() => {
    if (entities.length > 0 && !mergeName) {
      // Use the first entity as default, or find the most common pattern
      const firstEntity = entities[0];
      setMergeName(firstEntity);
    }
  }, [entities, mergeName]);

  const handleMerge = useCallback(async () => {
    try {
      await onConfirm(mergeName || entities[0]);
      onOpenChange(false);
      setMergeName("");
      setConfirmText("");
    } catch (error) {
      console.error("Error merging entities:", error);
    }
  }, [mergeName, entities, onConfirm, onOpenChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMergeName(e.target.value);
    },
    []
  );

  const handleConfirmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmText(e.target.value);
    },
    []
  );

  const isConfirmValid = confirmText === "MERGE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Merge Selected Duplicates
          </DialogTitle>
          <DialogDescription>
            Merge {entities.length} duplicate entries into a single master
            record. The merged record will contain the most complete
            information.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-blue-200 bg-blue-50">
          <CheckCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Merging will combine all selected duplicates into one record while
            preserving the most complete data.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {entities.length} duplicates to merge
            </Badge>
          </div>

          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Duplicates to be merged:</h4>
            </div>
            <ScrollArea className="h-32">
              <div className="p-3 space-y-1">
                {entities.map((entity, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    <span className="truncate">{entity}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Master record name:</label>
            <Input
              placeholder="Enter the name for the merged record..."
              value={mergeName}
              onChange={handleInputChange}
              disabled={isProcessing}
            />
            <p className="text-xs text-muted-foreground">
              This will be the name of the final merged record
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <span className="font-mono text-primary">MERGE</span> to
              confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={handleConfirmChange}
              placeholder="Type MERGE to confirm"
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isProcessing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!entities.length || !isConfirmValid || isProcessing}
          >
            {isProcessing
              ? "Merging..."
              : `Merge ${entities.length} duplicates`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default MergeDialog;
