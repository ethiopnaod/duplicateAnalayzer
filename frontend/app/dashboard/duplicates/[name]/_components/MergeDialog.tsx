"use client";

import React, { useState, useMemo, useCallback, memo } from "react";
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
import { Users, CheckCircle, Phone } from "lucide-react";
import { PhoneInput } from "@/components/forms";
import { Entity } from "@/types";
import { toast } from "sonner";

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  isProcessing?: boolean;
  onConfirm: (mergeName: string, phoneNumber?: string) => Promise<void> | void;
}

const MergeDialog = memo(function MergeDialog({
  open,
  onOpenChange,
  entities,
  isProcessing = false,
  onConfirm,
}: MergeDialogProps) {
  const [mergeName, setMergeName] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [e164Phone, setE164Phone] = useState<string | null>(null);

  // Auto-suggest merge name when entities change
  React.useEffect(() => {
    if (entities.length > 0 && !mergeName) {
      // Use the first entity as default, or find the most common pattern
      const firstEntity = entities[0];
      setMergeName(firstEntity.name);
    }
  }, [entities, mergeName]);

  const handleMerge = useCallback(async () => {
    try {
      await onConfirm(mergeName || entities[0].name, e164Phone || undefined);
      onOpenChange(false);
      setMergeName("");
      setConfirmText("");
      setPhoneNumber("");
      setE164Phone(null);
    } catch (error) {
      console.error("Error merging entities:", error);
    }
  }, [mergeName, entities, e164Phone, onConfirm, onOpenChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMergeName(e.target.value);
  }, []);

  const handleConfirmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmText(e.target.value);
  }, []);

  const isConfirmValid = confirmText === "MERGE";
  const canMerge = mergeName.trim() && isConfirmValid && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Merge Duplicate Entities
          </DialogTitle>
          <DialogDescription>
            Select which entities to merge and provide a name for the merged record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entities to Merge */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Entities to merge:</label>
            <ScrollArea className="h-32 w-full rounded-md border p-3">
            <div className="space-y-2">
                {entities.map((entity, index) => (
                  <div key={entity.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Badge variant="outline" className="text-xs">
                      #{entity.id}
                    </Badge>
                    <span className="text-sm font-medium">{entity.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {entity.entityType === 'organization' ? 'Organization' : 'Person'}
                    </Badge>
            </div>
                ))}
              </div>
            </ScrollArea>
            </div>

              <div className="space-y-2">
            <label className="text-sm font-medium">
              Master record name:
                  </label>
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
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number (Optional):
            </label>
            <PhoneInput
              value={phoneNumber}
              onChange={(value, e164Value) => {
                setPhoneNumber(value);
                setE164Phone(e164Value);
              }}
              placeholder="Enter phone number..."
              disabled={isProcessing}
              helperText="Phone number will be standardized to E.164 format"
            />
            </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Type <span className="font-mono text-primary">MERGE</span> to confirm:
            </label>
            <Input
              placeholder="Type MERGE to confirm"
              value={confirmText}
              onChange={handleConfirmChange}
              disabled={isProcessing}
                        />
                      </div>

          {!isConfirmValid && confirmText && (
            <Alert>
              <AlertDescription>
                Please type &quot;MERGE&quot; exactly to confirm the merge operation.
              </AlertDescription>
            </Alert>
          )}
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
            disabled={!canMerge}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Merging...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Merge Entities
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default MergeDialog;