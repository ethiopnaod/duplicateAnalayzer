/**
 * API utilities for duplicate management operations
 * Client-side functions use fetch to call Next.js API routes
 */

export interface DuplicateEntity {
  id: string;
  name: string;
  entityType: 'organization' | 'person';
  confidence: number;
  createdAt: string;
  updatedAt: string;
  phone?: string;
  email?: string;
}

export interface TransformedDuplicateEntity {
  id: string;
  name: string;
  phone: string;
  email: string;
  entityType: number;
  createdAt: any;
  duplicateCount: number;
  duplicateIds: number[];
  matchType: 'phone' | 'email' | 'name' | 'fuzzy';
  confidence: number;
  phoneNumbers: string[];
  emailAddresses: string[];
  entities: any[];
}

export interface MergeRequest {
  entities: string[];
  mergeName: string;
  entityType: string;
}

export interface DeleteRequest {
  entities: string[];
  entityType: string;
}

export interface DuplicatesResponse {
  entities: TransformedDuplicateEntity[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  error?: string;
}

/**
 * Fetch duplicate entities with pagination from backend
 */
export async function fetchDuplicates(
  entityType: string,
  page: number = 1,
  pageSize: number = 25,
  searchTerm?: string
): Promise<DuplicatesResponse> {
  try {
    const params = {
      type: entityType,
      page,
      pageSize,
      ...(searchTerm && { search: searchTerm }),
    };

    // Remove undefined values
    Object.keys(params).forEach(key =>
      (params as any)[key] === undefined && delete (params as any)[key]
    );

    const queryParams = new URLSearchParams(params as any).toString();
    const response = await fetch(`/api/duplicates?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform backend response to match frontend expectations
    if (data.success && data.data) {
      const backendData = data.data;

      const transformedEntities = backendData.duplicates.map((duplicate: any) => ({
        id: duplicate.id,
        name: duplicate.name,
        phone: duplicate.phoneNumbers?.[0] || '',
        email: duplicate.emailAddresses?.[0] || '',
        entityType: duplicate.entityType,
        createdAt: duplicate.createdAt,
        duplicateCount: parseInt(duplicate.duplicateCount) || 0,
        duplicateIds: duplicate.duplicateIds || [],
        matchType: duplicate.matchType || 'name',
        confidence: duplicate.confidence || 0.5,
        phoneNumbers: duplicate.phoneNumbers || [],
        emailAddresses: duplicate.emailAddresses || [],
        entities: duplicate.entities || []
      }));

      const result = {
        entities: transformedEntities,
        totalCount: parseInt(backendData.pagination?.totalGroups) || 0,
        page: backendData.pagination?.page || 1,
        pageSize: backendData.pagination?.pageSize || 25,
        hasNextPage: backendData.pagination?.hasMore || false,
        success: true
      };

      return result;
    }
    
    return data;
  } catch (error) {
    throw new Error('Failed to fetch duplicates from backend');
  }
}

/**
 * Merge multiple duplicate entities into one via backend
 */
export async function mergeDuplicates(request: MergeRequest): Promise<{ success: boolean; mergedId: string }> {
  try {
    // Transform frontend request to backend format
    const backendRequest = {
      duplicateGroups: [{
        groupId: `merge_${Date.now()}`,
        entityIds: request.entities.map(id => parseInt(id)),
        keepEntityId: parseInt(request.entities[0]), // Keep first entity
      }]
    };
    
    const response = await fetch('/api/duplicates/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        mergedId: request.entities[0]
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error merging duplicates via backend:', error);
    throw new Error('Failed to merge duplicates via backend');
  }
}

/**
 * Delete multiple duplicate entities via backend
 */
export async function deleteDuplicates(request: DeleteRequest): Promise<{ success: boolean; deletedCount: number }> {
  try {
    // Transform frontend request to backend format
    const backendRequest = {
      duplicateGroups: [{
        groupId: `delete_${Date.now()}`,
        entityIds: request.entities.map(id => parseInt(id)),
        keepEntityId: parseInt(request.entities[0]), // Keep first entity
      }]
    };
    
    const response = await fetch('/api/duplicates/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendRequest)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        deletedCount: request.entities.length - 1 // All except the one we keep
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error deleting duplicates via backend:', error);
    throw new Error('Failed to delete duplicates via backend');
  }
}

/**
 * Auto-merge a single duplicate entity via backend
 */
export async function autoMergeDuplicate(
  primaryEntityId: string,
  duplicateEntityIds: number[],
  entityType: string
): Promise<{ success: boolean; mergedId: string }> {
  try {
    const response = await fetch('/api/duplicates/merge-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryEntityId: parseInt(primaryEntityId),
        duplicateEntityIds: duplicateEntityIds,
        entityType: entityType
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return {
        success: true,
        mergedId: primaryEntityId
      };
    }
    
    return data;
  } catch (error: any) {
    console.error('Error auto-merging duplicate via backend:', error);
    
    // Provide more specific error messages
    if (error.response?.status === 500) {
      throw new Error('Server error: Unable to process auto-merge. Please check if the backend is running properly.');
    } else if (error.response?.status === 400) {
      throw new Error('Invalid request: Please check the entity IDs and try again.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Connection failed: Unable to connect to the backend server. Please ensure the backend is running.');
    } else {
      throw new Error(`Auto-merge failed: ${error.message || 'Unknown error occurred'}`);
    }
  }
}

/**
 * Get duplicate count for entity type from backend
 */
export async function getDuplicateCount(entityType: string): Promise<{ count: number }> {
  try {
    const response = await fetch(`/api/duplicates/count?type=${entityType}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return {
        count: data.data.count
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error getting duplicate count from backend:', error);
    throw new Error('Failed to get duplicate count from backend');
  }
}
