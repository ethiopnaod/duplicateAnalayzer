# Embedding Configuration

This backend supports both local and Azure OpenAI embeddings. You can choose which method to use via environment variables.

## Configuration Options

### Environment Variables

Create a `.env` file in the `ai-sql-backend` directory with the following variables:

```bash
# Embedding Method Configuration
EMBEDDING_METHOD=local  # or "azure"
# Alternative: USE_LOCAL_EMBEDDINGS=true

# Azure OpenAI Configuration (required for Azure method)
AZURE_OPENAI_KEY=your_azure_openai_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Disable embeddings entirely (fallback to summary-based analysis)
# When true, vector search is bypassed and the system still responds
# using schema summaries (the previously working behavior)
DISABLE_EMBEDDINGS=false

# Server Configuration
PORT=5050
NODE_ENV=development
```

## Embedding Methods

### 1. Local Embeddings (Default)
- **Model**: Xenova/all-MiniLM-L6-v2
- **Pros**: No API costs, works offline, fast for small datasets
- **Cons**: Lower quality than Azure, requires more memory
- **Use Case**: Development, testing, small-scale applications

**Configuration**:
```bash
EMBEDDING_METHOD=local
# or
USE_LOCAL_EMBEDDINGS=true
```

Notes:
- On first run, the Xenova model will download to the cache; this may take a minute.
- Ensure the server has internet access for model download (first run only).

### 2. Azure OpenAI Embeddings
- **Model**: text-embedding-3-large (configurable)
- **Pros**: High quality, production-ready, scalable
- **Cons**: Requires API key, costs money, needs internet
- **Use Case**: Production applications, large-scale deployments

**Configuration**:
```bash
EMBEDDING_METHOD=azure
# Make sure to set all Azure OpenAI variables
AZURE_OPENAI_KEY=your_key
AZURE_OPENAI_ENDPOINT=your_endpoint
# etc...
```

Notes:
- `AZURE_OPENAI_EMBEDDING` should match your embedding deployment name.
- `AZURE_OPENAI_DEPLOYMENT` is the chat/completions deployment used for reasoning.

### 3. Disabled Embeddings
- **Method**: Keyword-based matching
- **Use Case**: Fallback when embeddings fail or for simple use cases

**Configuration**:
```bash
DISABLE_EMBEDDINGS=true
```

Notes:
- This restores the pre-vector-search behavior and is useful for quick demos
  or when Azure/local embeddings are not yet configured.

## Switching Methods

### For Development (Local)
```bash
# In .env file
EMBEDDING_METHOD=local
# Optionally ensure vectors are enabled
DISABLE_EMBEDDINGS=false
```

### For Production (Azure)
```bash
# In .env file
EMBEDDING_METHOD=azure
AZURE_OPENAI_KEY=your_production_key
AZURE_OPENAI_ENDPOINT=https://your-prod-resource.openai.azure.com/
# Optionally ensure vectors are enabled
DISABLE_EMBEDDINGS=false
```

## Schema Files

By default, schema files are expected in the `ai-sql-backend` root:

```
entities_prod_definition.txt
dms_prod_definition.txt
```

You can override locations via environment variables:

```
ENTITIES_SCHEMA_PATH=./path/to/entities.txt
DMS_SCHEMA_PATH=./path/to/dms.txt
```

## Health Check

The system provides a health check endpoint that shows the current embedding method:

```bash
curl http://localhost:5050/api/vector-health
```

Response:
```json
{
  "status": "healthy",
  "vector_service": "integrated",
  "embedding_method": "local",
  "docs_loaded": 25,
  "embedder_ready": true,
  "embeddings_disabled": false
}
```

## Troubleshooting

### Local Embeddings Not Working
- Ensure `@xenova/transformers` is installed: `npm install @xenova/transformers`
- Check that schema files exist in the correct location
- Look for initialization errors in the console
  (first run may download the model; be patient)

### Azure Embeddings Not Working
- Verify all Azure OpenAI environment variables are set
- Check that the API key has the correct permissions
- Ensure the embedding deployment name is correct
- Verify the endpoint URL is correct

### Port Already In Use (5050)
- Stop any running Node processes: `taskkill /f /im node.exe` (Windows)
- Or change the backend port via `.env`: `PORT=5051`

### Frontend Shows "Vector Unavailable"
- Confirm the backend `/api/vector-health` returns 200
- Ensure `DISABLE_EMBEDDINGS=false` to enable vector search

### Performance Tips
- Local embeddings: Good for development and small datasets
- Azure embeddings: Better for production and large datasets
- Consider caching embeddings for frequently accessed schemas
