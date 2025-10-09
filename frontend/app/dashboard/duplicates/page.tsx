'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Trash2, 
  Merge, 
  RefreshCw,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface DuplicateEntity {
  entity_id: number;
  name: string;
  type: number;
  created_at: string;
  computed_phones?: string;
  computed_emails?: string;
}

interface DuplicateGroup {
  id: string;
  name: string;
  entities: DuplicateEntity[];
  count: number;
  matchType: 'name' | 'phone' | 'email';
}

export default function DuplicatesPage() {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch duplicates from backend
  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/duplicates');
      const data = await response.json();
      
      if (data.success) {
        setDuplicates(data.data.duplicates || []);
      } else {
        toast.error('Failed to fetch duplicates');
        setDuplicates([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data from backend');
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, []);

  // Auto-merge duplicates
  const handleAutoMerge = async (groupId: string) => {
    const group = duplicates.find(d => d.id === groupId);
    if (!group || group.entities.length < 2) return;

    try {
      const primaryEntity = group.entities[0];
      const duplicateIds = group.entities.slice(1).map(e => e.entity_id);

      const response = await fetch('/api/duplicates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryEntityId: primaryEntity.entity_id,
          duplicateEntityIds: duplicateIds,
          mergeStrategy: 'keep_primary'
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Merged ${result.data.mergedCount} duplicates`);
        fetchDuplicates(); // Refresh data
      } else {
        toast.error('Failed to merge duplicates');
      }
    } catch (error) {
      console.error('Error merging:', error);
      toast.error('Failed to merge duplicates');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedGroups.size === 0) {
      toast.error('Please select duplicates to delete');
      return;
    }

    if (!confirm(`Delete ${selectedGroups.size} duplicate groups?`)) return;

    try {
      const allEntityIds = duplicates
        .filter(d => selectedGroups.has(d.id))
        .flatMap(d => d.entities.map(e => e.entity_id));

      const response = await fetch('/api/duplicates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityIds: allEntityIds,
          confirm: true
        })
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Deleted ${result.data.deletedCount} entities`);
        setSelectedGroups(new Set());
        fetchDuplicates(); // Refresh data
      } else {
        toast.error('Failed to delete duplicates');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete duplicates');
    }
  };

  // Filter duplicates based on search
  const filteredDuplicates = duplicates.filter(dup =>
    dup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dup.entities.some(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading duplicates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Duplicate Management</h1>
          <p className="text-muted-foreground">
            Found {duplicates.length} duplicate groups
          </p>
        </div>
        <Button onClick={fetchDuplicates} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search duplicates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedGroups.size > 0 && (
          <Button onClick={handleBulkDelete} variant="destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedGroups.size})
          </Button>
        )}
      </div>

      {/* Duplicates List */}
      <div className="space-y-4">
        {filteredDuplicates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No duplicates found matching your search' : 'No duplicates found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredDuplicates.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Checkbox
                      checked={selectedGroups.has(group.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedGroups);
                        if (checked) {
                          newSelected.add(group.id);
                        } else {
                          newSelected.delete(group.id);
                        }
                        setSelectedGroups(newSelected);
                      }}
                    />
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{group.count} duplicates</Badge>
                        <Badge variant="secondary">{group.matchType}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleAutoMerge(group.id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Merge className="h-4 w-4 mr-2" />
                    Auto Merge
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.entities.map((entity) => (
                    <div key={entity.entity_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{entity.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>ID: {entity.entity_id}</span>
                          <span>Type: {entity.type === 1 ? 'Organization' : 'Person'}</span>
                          {entity.computed_phones && (
                            <span>Phone: {entity.computed_phones}</span>
                          )}
                          {entity.computed_emails && (
                            <span>Email: {entity.computed_emails}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}