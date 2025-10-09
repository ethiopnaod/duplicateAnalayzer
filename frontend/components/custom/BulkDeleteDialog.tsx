"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle } from "lucide-react";

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: string[];
  isProcessing?: boolean;
  onConfirm: () => Promise<void> | void;
}

export default function BulkDeleteDialog({
  open,
  onOpenChange,
  entities,
  isProcessing = false,
  onConfirm,
}: BulkDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
      setConfirmText("");
    } catch (error) {
      console.error("Error deleting entities:", error);
    }
  };

  const isConfirmValid = confirmText === "DELETE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Selected Duplicates
          </DialogTitle>
          <DialogDescription>
            You are about to permanently delete {entities.length} duplicate entries. 
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-destructive/50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will permanently remove all selected duplicates from your database.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs">
              {entities.length} items selected
            </Badge>
          </div>

          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Items to be deleted:</h4>
            </div>
            <ScrollArea className="h-40">
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
            <label className="text-sm font-medium">
              Type <span className="font-mono text-destructive">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isProcessing}
          >
            {isProcessing ? "Deleting..." : `Delete ${entities.length} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
