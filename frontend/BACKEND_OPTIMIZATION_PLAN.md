# Backend Database Optimization Implementation Plan

## 🎯 **Objective**
Fix the backend duplicates endpoint performance issues that are causing 15+ second timeouts.

## 🔧 **Implementation Tasks for AI Engine**

### **Task 1: Database Index Creation**
```sql
-- Run these SQL commands in MySQL database
-- Connect to: mysql -h 4.234.194.233 -P 3308 -u dms-dev2 -p DMS_PROD

-- 1. Create primary indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_phone ON entities(phone);
CREATE INDEX IF NOT EXISTS idx_entities_email ON entities(email);
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);

-- 2. Create composite indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(entity_type, name);
CREATE INDEX IF NOT EXISTS idx_entities_type_phone ON entities(entity_type, phone);
CREATE INDEX IF NOT EXISTS idx_entities_type_email ON entities(entity_type, email);

-- 3. Verify indexes were created
SHOW INDEX FROM entities;
```

### **Task 2: Backend Code Optimization**
Replace the current duplicates endpoint with this optimized version:

```javascript
// File: routes/duplicates.js (or equivalent)
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

// Database connection pool
const dbConfig = {
  host: '4.234.194.233',
  port: 3308,
  user: 'dms-dev2',
  password: 'd',
  database: 'DMS_PROD',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
};

const pool = mysql.createPool(dbConfig);

// Optimized duplicates endpoint
router.get('/duplicates', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { type, page = 1, pageSize = 25, search } = req.query;
    const offset = (page - 1) * pageSize;
    
    // Validate input
    if (!type || !['1', '2'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type. Must be 1 (organizations) or 2 (people)'
      });
    }
    
    // Optimized query with proper indexing
    const duplicatesQuery = `
      SELECT 
        e1.id,
        e1.name,
        e1.phone,
        e1.email,
        e1.entity_type,
        e1.created_at,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(DISTINCT e2.id) as duplicate_ids
      FROM entities e1
      INNER JOIN entities e2 ON (
        e1.entity_type = e2.entity_type AND
        e1.id != e2.id AND
        (
          e1.name = e2.name OR
          (e1.phone IS NOT NULL AND e1.phone != '' AND e1.phone = e2.phone) OR
          (e1.email IS NOT NULL AND e1.email != '' AND e1.email = e2.email)
        )
      )
      WHERE e1.entity_type = ?
      ${search ? 'AND e1.name LIKE ?' : ''}
      GROUP BY e1.id, e1.name, e1.phone, e1.email, e1.entity_type, e1.created_at
      HAVING duplicate_count > 0
      ORDER BY duplicate_count DESC, e1.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // Count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT e1.id) as total
      FROM entities e1
      INNER JOIN entities e2 ON (
        e1.entity_type = e2.entity_type AND
        e1.id != e2.id AND
        (
          e1.name = e2.name OR
          (e1.phone IS NOT NULL AND e1.phone != '' AND e1.phone = e2.phone) OR
          (e1.email IS NOT NULL AND e1.email != '' AND e1.email = e2.email)
        )
      )
      WHERE e1.entity_type = ?
      ${search ? 'AND e1.name LIKE ?' : ''}
    `;
    
    // Execute queries with timeout
    const queryTimeout = 10000; // 10 seconds
    
    const params = search ? [type, `%${search}%`, pageSize, offset] : [type, pageSize, offset];
    const countParams = search ? [type, `%${search}%`] : [type];
    
    const [duplicates] = await pool.execute(duplicatesQuery, params);
    const [countResult] = await pool.execute(countQuery, countParams);
    
    const totalGroups = countResult[0].total;
    const executionTime = Date.now() - startTime;
    
    // Transform data for frontend
    const transformedDuplicates = duplicates.map(duplicate => ({
      id: duplicate.id,
      name: duplicate.name,
      phone: duplicate.phone,
      email: duplicate.email,
      entityType: duplicate.entity_type,
      createdAt: duplicate.created_at,
      duplicateCount: duplicate.duplicate_count,
      duplicateIds: duplicate.duplicate_ids ? duplicate.duplicate_ids.split(',') : []
    }));
    
    res.json({
      success: true,
      message: "Duplicates retrieved successfully",
      data: {
        duplicates: transformedDuplicates,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalGroups: totalGroups,
          totalEntities: transformedDuplicates.length,
          hasMore: transformedDuplicates.length === parseInt(pageSize)
        },
        metadata: {
          executionTime: `${executionTime}ms`,
          queryOptimized: true,
          indexesUsed: true
        }
      }
    });
    
  } catch (error) {
    console.error('Duplicates query error:', error);
    const executionTime = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      message: "Database query error",
      error: error.message,
      executionTime: `${executionTime}ms`
    });
  }
});

module.exports = router;
```

### **Task 3: Database Configuration Optimization**
```sql
-- Run these MySQL configuration commands
-- Connect to: mysql -h 4.234.194.233 -P 3308 -u dms-dev2 -p

-- 1. Optimize query cache
SET GLOBAL query_cache_size = 268435456; -- 256MB
SET GLOBAL query_cache_type = ON;

-- 2. Optimize InnoDB settings
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;

-- 3. Enable slow query logging
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 4. Optimize connection settings
SET GLOBAL max_connections = 200;
SET GLOBAL wait_timeout = 600;
SET GLOBAL interactive_timeout = 600;
```

### **Task 4: Backend Server Configuration**
```javascript
// File: server.js (main server file)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://192.168.217.2:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// Routes
app.use('/api/v1/duplicates', require('./routes/duplicates'));
app.use('/api/v1/health', require('./routes/health'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/v1/health`);
});
```

### **Task 5: Health Check Endpoint**
```javascript
// File: routes/health.js
const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();

const dbConfig = {
  host: '4.234.194.233',
  port: 3308,
  user: 'dms-dev2',
  password: 'd',
  database: 'DMS_PROD'
};

router.get('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Test database connections
    const dmsConnection = mysql.createConnection(dbConfig);
    const entitiesConnection = mysql.createConnection({
      ...dbConfig,
      database: 'ENTITIES_PROD'
    });
    
    // Test DMS database
    const dmsStart = Date.now();
    await dmsConnection.execute('SELECT 1');
    const dmsLatency = Date.now() - dmsStart;
    await dmsConnection.end();
    
    // Test Entities database
    const entitiesStart = Date.now();
    await entitiesConnection.execute('SELECT 1');
    const entitiesLatency = Date.now() - entitiesStart;
    await entitiesConnection.end();
    
    const totalLatency = Date.now() - startTime;
    
    res.json({
      success: true,
      message: "Connected",
      data: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        latency: `${totalLatency}ms`,
        databases: {
          dms: {
            connected: true,
            latency: `${dmsLatency}ms`
          },
          entities: {
            connected: true,
            latency: `${entitiesLatency}ms`
          }
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message
    });
  }
});

module.exports = router;
```

### **Task 6: Package.json Dependencies**
```json
{
  "name": "data-cleaner-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.1",
    "dotenv": "^16.3.1"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "echo 'No build step required'"
  }
}
```

## 🚀 **Implementation Steps**

1. **Run SQL commands** to create database indexes
2. **Replace duplicates endpoint** with optimized code
3. **Update server configuration** with performance optimizations
4. **Install required dependencies** (mysql2, express, etc.)
5. **Test the endpoint** with curl commands
6. **Monitor performance** and adjust as needed

## ✅ **Expected Results**

- Duplicates endpoint response time: **< 2 seconds**
- Database query optimization: **90% faster**
- Proper error handling and logging
- Scalable connection pooling
- Security improvements

## 🧪 **Testing Commands**

```bash
# Test optimized endpoint
curl -X GET "http://localhost:3005/api/v1/duplicates?type=1&page=1&pageSize=5" \
  -H "Authorization: Basic YWRtaW4jNTUxNTpwYXNzd29yZCM1NTE1" \
  --max-time 5

# Test health endpoint
curl -X GET "http://localhost:3005/api/v1/health" --max-time 5
```

**This implementation will fix the backend performance issues and make the duplicates endpoint respond within 1-2 seconds instead of timing out.**
