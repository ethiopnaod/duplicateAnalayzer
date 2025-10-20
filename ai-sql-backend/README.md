# AI SQL Generator Backend

A powerful Node.js backend service that converts natural language queries into SQL statements using AI. Features intelligent vector search, dual database support, and flexible embedding options for production-ready SQL generation.

## 🚀 Features

- **Natural Language to SQL**: Convert plain English questions into parameterized SQL queries
- **Dual Database Support**: Automatically detects whether queries target Entities or DMS database
- **Flexible Embeddings**: Choose between local (Xenova) or Azure OpenAI embeddings
- **Vector Search**: Intelligent schema analysis using vector similarity search
- **Azure OpenAI Integration**: High-quality SQL generation using GPT models
- **Health Monitoring**: Built-in health checks and status monitoring
- **TypeScript**: Fully typed codebase for better development experience

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Azure OpenAI account (for production embeddings)

## 🛠️ Installation

1. **Clone and navigate to the backend directory:**
   ```bash
   cd ai-sql-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables (defaults shown):

```bash
# Embedding Method (local or azure)
EMBEDDING_METHOD=local

# Azure OpenAI Configuration (for production)
AZURE_OPENAI_KEY=your_azure_openai_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Disable embeddings (fallback to summary-based analysis)
# If true, vector search is bypassed but answers still work
DISABLE_EMBEDDINGS=true

# Server Configuration
PORT=5050
NODE_ENV=development

# Schema File Paths
ENTITIES_SCHEMA_PATH=entities_prod_definition.txt
DMS_SCHEMA_PATH=dms_prod_definition.txt
```

### Embedding Methods

#### 1. Local Embeddings (Default)
- **Model**: Xenova/all-MiniLM-L6-v2
- **Pros**: No API costs, works offline, fast for small datasets
- **Cons**: Lower quality than Azure, requires more memory
- **Configuration**: `EMBEDDING_METHOD=local`

#### 2. Azure OpenAI Embeddings (Production)
- **Model**: text-embedding-3-large (configurable)
- **Pros**: High quality, production-ready, scalable
- **Cons**: Requires API key, costs money, needs internet
- **Configuration**: `EMBEDDING_METHOD=azure` + Azure credentials

#### 3. Disabled Embeddings (Fallback)
- **Method**: Keyword-based matching
- **Use Case**: When embeddings fail or for simple use cases
- **Configuration**: `DISABLE_EMBEDDINGS=true`

## 🚀 Quick Start

### Development (Local Embeddings)
```bash
# Set environment
export DISABLE_EMBEDDINGS=false
export EMBEDDING_METHOD=local

# Start server
npm run dev
```

### Production (Azure Embeddings)
```bash
# Set environment
export DISABLE_EMBEDDINGS=false
export EMBEDDING_METHOD=azure
export AZURE_OPENAI_KEY=your_key
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# Start server
npm start
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sql` | Generate SQL from natural language |
| `POST` | `/api/ai/answer` | Get AI analysis and database selection |
| `GET` | `/api/vector/query` | Vector search for schema chunks |
| `GET` | `/api/vector-health` | Health check for vector service |
| `GET` | `/health` | Basic health check |

### Example Usage

#### Generate SQL
```bash
curl -X POST http://localhost:5050/api/sql \
  -H "Content-Type: application/json" \
  -d '{"question": "Top 10 organisations by revenue in 2024"}'
```

#### Get AI Analysis
```bash
curl -X POST http://localhost:5050/api/ai/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me all people in the marketing department"}'
```

#### Vector Search
```bash
curl "http://localhost:5050/api/vector/query?text=revenue organizations"
```

#### Health Check
```bash
curl http://localhost:5050/api/vector-health
```

## 📊 Response Format

### SQL Generation Response
```json
{
  "question": "Top 10 organisations by revenue in 2024",
  "db_name": "entities",
  "sql": "SELECT * FROM organisations ORDER BY revenue DESC LIMIT 10",
  "params": [],
  "notes": "Query targets the entities database and retrieves top organizations by revenue"
}
```

### AI Analysis Response
```json
{
  "db_name": "entities",
  "answer": "This query should target the entities database to find organization revenue data",
  "rationale": "The question asks about organizations and revenue, which are typically stored in the entities database",
  "plan": {
    "target": "entities",
    "tables": ["organisations"],
    "filters": ["revenue", "2024"]
  }
}
```

### Health Check Response
```json
{
  "status": "healthy",
  "vector_service": "integrated",
  "method": "local",
  "docs_loaded": 25,
  "embedder_ready": true,
  "embeddings_disabled": false
}
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   Backend API    │───▶│  Vector Service │
│   (Next.js)     │    │   (Express)      │    │  (Local/Azure)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Azure OpenAI    │
                       │  (SQL Generation)│
                       └──────────────────┘
```

### Key Components

- **VectorService**: Handles both local and Azure embeddings
- **AnswerService**: AI-powered database selection and analysis
- **SqlGenerator**: Converts natural language to SQL using Azure OpenAI
- **SchemaLoader**: Loads and parses database schema files
- **DbClassifier**: Fallback keyword-based database classification

## 🔧 Development

### Project Structure
```
src/
├── config/
│   └── env.ts              # Environment configuration
├── services/
│   ├── vectorService.ts    # Unified vector search service
│   ├── answerService.ts    # AI analysis service
│   ├── sqlGenerator.ts     # SQL generation service
│   ├── schemaLoader.ts     # Schema file loader
│   ├── dbClassifier.ts     # Database classifier
│   └── router.ts           # API routes
├── server.ts               # Express server
└── app.ts                  # Application entry point
```

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build TypeScript to JavaScript
npm start        # Start production server
npm run clean    # Clean build directory
```

### Adding New Features

1. **New API Endpoint**: Add to `src/services/router.ts`
2. **New Service**: Create in `src/services/` directory
3. **Configuration**: Add to `src/config/env.ts`
4. **Types**: Define in service files or create `types/` directory

## 🐛 Troubleshooting

### Common Issues

#### Local Embeddings Not Working
- Ensure `@xenova/transformers` is installed
- Check that schema files exist in the correct location
- Look for initialization errors in the console

#### Azure Embeddings Not Working
- Verify all Azure OpenAI environment variables are set
- Check that the API key has the correct permissions
- Ensure the embedding deployment name is correct

#### Service Won't Start
- Check that all required environment variables are set
- Verify that the port (5050) is not already in use
- Check the console for error messages
 - Ensure you are in the correct folder. Run commands from `ai-sql-backend/`.
   Running `npm start` from the project root will fail with ENOENT.

### Debug Mode

Enable debug logging:
```bash
export DEBUG=*
npm run dev
```

## 📈 Performance Tips

- **Local Embeddings**: Good for development and small datasets
- **Azure Embeddings**: Better for production and large datasets
- **Caching**: Consider caching embeddings for frequently accessed schemas
- **Chunking**: Adjust chunk size in `vectorService.ts` for optimal performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests if applicable
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the API documentation

---

**Made with ❤️ for intelligent database querying**
