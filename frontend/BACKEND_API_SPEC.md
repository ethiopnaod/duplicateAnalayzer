# Backend API Specification

This document outlines the API endpoints that the frontend expects from your backend server.

## Base URL
```
http://localhost:3005/api/v1
```

## Authentication
The frontend uses Basic Authentication with the following credentials:
- Username: `admin#5515`
- Password: `password#5515`

## Endpoints

### 1. Health Check
```
GET /health
```
**Purpose**: Check if backend is running
**Response**: Any 2xx status code indicates healthy

### 2. Get Duplicates
```
GET /duplicates?type={entityType}&page={page}&pageSize={pageSize}&search={searchTerm}
```
**Parameters**:
- `type`: "1" for organizations, "2" for people
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 25)
- `search`: Optional search term

**Response**:
```json
{
  "entities": [
    {
      "id": "string",
      "name": "string",
      "entityType": "organization" | "person",
      "confidence": 0.95,
      "createdAt": "2024-01-01",
      "updatedAt": "2024-01-01",
      "phone": "string (optional)",
      "email": "string (optional)"
    }
  ],
  "totalCount": 100,
  "page": 1,
  "pageSize": 25,
  "hasNextPage": true
}
```

### 3. Get Duplicate Count
```
GET /duplicates/count?type={entityType}
```
**Parameters**:
- `type`: "1" for organizations, "2" for people

**Response**:
```json
{
  "count": 100
}
```

### 4. Merge Duplicates
```
POST /duplicates/merge
```
**Request Body**:
```json
{
  "entities": ["id1", "id2", "id3"],
  "mergeName": "Merged Entity Name",
  "entityType": "1",
  "phoneNumber": "+1234567890 (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "mergedId": "new_entity_id"
}
```

### 5. Delete Duplicates
```
DELETE /duplicates/delete
```
**Request Body**:
```json
{
  "entities": ["id1", "id2", "id3"],
  "entityType": "1"
}
```

**Response**:
```json
{
  "success": true,
  "deletedCount": 3
}
```

### 6. Auto-Merge Single Duplicate
```
POST /duplicates/auto-merge
```
**Request Body**:
```json
{
  "entityName": "Entity Name",
  "entityType": "1"
}
```

**Response**:
```json
{
  "success": true,
  "mergedId": "new_entity_id"
}
```

## Error Handling

All endpoints should return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

Error responses should include a message:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Database Schema Expectations

The backend should have access to entities with the following structure:
- `id`: Unique identifier
- `name`: Entity name
- `entity_type`: "organization" or "person"
- `confidence`: Duplicate confidence score (0-1)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `phone`: Phone number (optional)
- `email`: Email address (optional)

## Testing

You can test the connection using the frontend's built-in health check, which will show:
- 🟢 Backend Connected: All systems working
- 🔴 Backend Offline: Connection failed
- 🟡 Checking...: Health check in progress

The frontend will automatically fall back to mock data if the backend is unavailable.
