"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Users, Phone, Mail, MapPin, Calendar, Merge, Trash2, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface EntityData {
  entity_id: number;
  name: string;
  computed_phones?: string;
  computed_emails?: string;
  address?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

interface DuplicateGroup {
  groupKey: string;
  entities: EntityData[];
  totalCount: number;
}

export default function DuplicateDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const entityName = decodeURIComponent(params.name as string);
  const [entityType, setEntityType] = useState('1');
  
  const [duplicateGroup, setDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(new Set());
  const [primaryEntity, setPrimaryEntity] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  // Get entityType from URL on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setEntityType(urlParams.get('type') || '1');
    }
  }, []);

  // Fetch duplicate group data
  const fetchDuplicateGroup = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/duplicates/details?name=${encodeURIComponent(entityName)}&type=${entityType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch duplicate details');
      }
      const data = await response.json();
      setDuplicateGroup(data);
    } catch (error) {
      console.error('Error fetching duplicate group:', error);
      toast.error('Failed to load duplicate details');
    } finally {
      setLoading(false);
    }
  }, [entityName, entityType]);

    useEffect(() => {
    fetchDuplicateGroup();
  }, [fetchDuplicateGroup]);

  // Handle entity selection
  const handleEntitySelect = (entityId: number, checked: boolean) => {
    setSelectedEntities(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(entityId);
      } else {
        newSet.delete(entityId);
      }
      return newSet;
    });
  };

  // Handle primary entity selection
  const handlePrimarySelect = (entityId: number) => {
    setPrimaryEntity(entityId);
  };

  // Manual merge functionality
  const handleManualMerge = async () => {
    if (!primaryEntity || selectedEntities.size === 0) {
      toast.error('Please select a primary entity and at least one duplicate to merge');
      return;
    }

    const duplicateIds = Array.from(selectedEntities).filter(id => id !== primaryEntity);
    if (duplicateIds.length === 0) {
      toast.error('Please select at least one different entity to merge');
      return;
    }

    setMerging(true);
    try {
      const response = await fetch('/api/duplicates/merge-entity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryEntityId: primaryEntity.toString(),
          duplicateEntityIds: duplicateIds,
          entityType: entityType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to merge entities');
      }

      const result = await response.json();
      if (result.success) {
        toast.success(`Successfully merged ${duplicateIds.length} duplicates`);
        // Refresh the data
        await fetchDuplicateGroup();
        setSelectedEntities(new Set());
        setPrimaryEntity(null);
      } else {
        throw new Error(result.message || 'Merge failed');
      }
    } catch (error) {
      console.error('Manual merge error:', error);
      toast.error('Failed to merge entities');
            } finally {
      setMerging(false);
    }
  };

  // Delete selected entities
  const handleDeleteSelected = async () => {
    if (selectedEntities.size === 0) {
      toast.error('Please select entities to delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedEntities.size} entities?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setMerging(true);
    try {
      const response = await fetch('/api/duplicates/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityIds: Array.from(selectedEntities),
          entityType: entityType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete entities');
      }

      const result = await response.json();
      if (result.success) {
        toast.success(`Successfully deleted ${selectedEntities.size} entities`);
        await fetchDuplicateGroup();
        setSelectedEntities(new Set());
        setPrimaryEntity(null);
      } else {
        throw new Error(result.message || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete entities');
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
        return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    </div>
                </CardContent>
              </Card>
            ))}
                    </div>
                </div>
            </div>
    );
    }

  if (!duplicateGroup) {
        return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Duplicate Group Not Found</h1>
          <p className="text-muted-foreground mb-6">The requested duplicate group could not be found.</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
            </div>
    );
    }

        return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{entityName}</h1>
              <p className="text-muted-foreground">
                {duplicateGroup.totalCount} duplicate entities found
              </p>
                            </div>
                        </div>
          <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
              onClick={fetchDuplicateGroup}
              disabled={loading}
                        >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
                        </Button>
          </div>
        </div>

        {/* Action Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manual Merge & Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Primary Entity:</span>
                  <Badge variant={primaryEntity ? "default" : "secondary"}>
                    {primaryEntity ? `Entity #${primaryEntity}` : "Not Selected"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Selected:</span>
                  <Badge variant="secondary">
                    {selectedEntities.size} entities
                  </Badge>
                </div>
            </div>
              <div className="flex items-center gap-2">
                        <Button
                  onClick={handleManualMerge}
                  disabled={!primaryEntity || selectedEntities.size <= 1 || merging}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Merge className="h-4 w-4 mr-2" />
                  {merging ? "Merging..." : "Merge Selected"}
                        </Button>
                            <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={selectedEntities.size === 0 || merging}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                            </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardContent className="pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to use Manual Merge:</h3>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Select one entity as the <strong>Primary Entity</strong> (this will be kept)</li>
                <li>2. Select other entities as <strong>Duplicates</strong> (these will be merged into the primary)</li>
                <li>3. Click <strong>&quot;Merge Selected&quot;</strong> to combine all data and mark duplicates as deleted</li>
                <li>4. Or click <strong>&quot;Delete Selected&quot;</strong> to permanently mark entities as deleted</li>
              </ol>
                    </div>
          </CardContent>
        </Card>

        {/* Entity List */}
        <div className="grid gap-4">
          {duplicateGroup.entities && duplicateGroup.entities.length > 0 ? duplicateGroup.entities.map((entity, index) => (
            <Card key={entity.entity_id} className={`${entity.is_deleted ? 'opacity-50' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Selection Checkboxes */}
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`select-${entity.entity_id}`}
                        checked={selectedEntities.has(entity.entity_id)}
                        onCheckedChange={(checked) => handleEntitySelect(entity.entity_id, !!checked)}
                        disabled={entity.is_deleted}
                      />
                      <label htmlFor={`select-${entity.entity_id}`} className="text-sm font-medium">
                        Select
                      </label>
                    </div>
                    <Button
                      variant={primaryEntity === entity.entity_id ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePrimarySelect(entity.entity_id)}
                      disabled={entity.is_deleted}
                      className="text-xs"
                    >
                      {primaryEntity === entity.entity_id ? "Primary" : "Set Primary"}
                    </Button>
                  </div>

                  {/* Entity Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">
                        Entity #{entity.entity_id}
                        {entity.is_deleted && (
                          <Badge variant="destructive" className="ml-2">Deleted</Badge>
                        )}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          ID: {entity.entity_id}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Contact Information */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Contact Information
                        </h4>
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="font-medium">Name:</span> {entity.name}
                          </div>
                          {entity.computed_phones && (
                            <div>
                              <span className="font-medium">Phone:</span> {entity.computed_phones}
                            </div>
                          )}
                          {entity.computed_emails && (
                            <div>
                              <span className="font-medium">Email:</span> {entity.computed_emails}
                            </div>
                          )}
                          {entity.address && (
                            <div>
                              <span className="font-medium">Address:</span> {entity.address}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Metadata
                        </h4>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Created:</span> {new Date(entity.created_at).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Updated:</span> {new Date(entity.updated_at).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {entity.is_deleted ? "Deleted" : "Active"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No entities found for this duplicate group.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}