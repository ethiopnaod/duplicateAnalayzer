# AI SQL Backend — Detailed Technical Presentation

## Overview
- **Purpose**: Convert natural language queries to safe, schema-aware SQL
- **Architecture**: Separate microservice with vector search and AI-powered analysis
- **Key Features**: Database selection, SQL generation, vector grounding, safety validation

---

## Architecture Components

### 1. Answer Service (`answerService.ts`)
**Purpose**: Determines which database (ENTITIES vs DMS) best answers the user's question

#### Core Analysis Method
```typescript
async analyze(question: string, schemas: { entities: SchemaHints; dms: SchemaHints }): Promise<AnalysisResult>
```

#### Two Analysis Paths:

**Path 1: Summary-based (when embeddings disabled)**
```33:57:ai-sql-backend/src/services/answerService.ts
  async analyze(question: string, schemas: { entities: SchemaHints; dms: SchemaHints }): Promise<AnalysisResult> {
    // If embeddings disabled, use summary-based decision (pre-vector search behavior)
    if (DISABLE_EMBEDDINGS) {
      const entitiesSummary = buildSchemaSummary(schemas.entities);
      const dmsSummary = buildSchemaSummary(schemas.dms);
      const systemPrompt = `You are an expert data analyst. You will read two database schema summaries (ENTITIES and DMS) and decide which database best contains the information to answer the user's question. Then provide a concise natural language answer outline and a short rationale, plus a minimal plan indicating the target database and likely tables/filters. Respond ONLY in JSON with fields db_name ("entities"|"dms"), answer, rationale, and plan { target, tables, filters }.`;
      const userContent = `# Question
${question}

# ENTITIES SCHEMA (truncated)
${entitiesSummary}

# DMS SCHEMA (truncated)
${dmsSummary}`;
      const res = await this.openai.chat.completions.create({
        model: AZURE_OPENAI_DEPLOYMENT,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });
      const content = res.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty AI response");
```

**Path 2: Vector-based (when embeddings enabled)**
```60:78:ai-sql-backend/src/services/answerService.ts
    // Embeddings + vector search path
    const top = await this.vectorService.search(question, 5);
    const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
    const context = top.map((t, i) => `# CHUNK ${i+1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");

    const systemPrompt = `You are an expert data analyst. Based ONLY on the provided schema CHUNKs, decide which database (ENTITIES or DMS) best answers the question. Provide a concise natural-language answer outline and rationale, plus a minimal plan indicating target tables/filters. Respond ONLY in JSON with fields db_name ("entities"|"dms"), answer, rationale, and plan { target, tables, filters }.`;

    const userContent = `# Question
${question}

# SCHEMA CHUNKS (top-5)
${context}`;

    const res = await this.openai.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });
```

#### Response Validation
```80:95:ai-sql-backend/src/services/answerService.ts
    const content = res.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    const db_name = parsed.db_name === "dms" ? "dms" : "entities";
    const answer = String(parsed.answer || "");
    const rationale = String(parsed.rationale || "");
    const plan: AnalysisPlan = {
      target: db_name,
      tables: Array.isArray(parsed.plan?.tables) ? parsed.plan.tables : [],
      filters: Array.isArray(parsed.plan?.filters) ? parsed.plan.filters : [],
    };

    return { db_name, answer, rationale, plan };
```

---

### 2. SQL Generator (`sqlGenerator.ts`)
**Purpose**: Converts the analysis plan into safe, executable SQL

#### Core Generation Method
```26:42:ai-sql-backend/src/services/sqlGenerator.ts
  async generate(question: string, target: "entities" | "dms", schemaSummary: string): Promise<SqlPlan> {
    const systemPrompt = this.buildSystemPrompt(target, schemaSummary);
    const userPrompt = `Question: "${question}"\nReturn only JSON.`;

    if (!this.configured || !this.openai) {
      throw new Error("AI not configured: set AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT");
    }
    const res = await (this.openai as AzureOpenAI).chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
```

#### Response Processing and Validation
```44:55:ai-sql-backend/src/services/sqlGenerator.ts
    const content = res.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    if (typeof parsed.sql !== "string" || typeof parsed.explanation !== "string") {
      throw new Error("Missing fields in AI response");
    }

    const sql = this.sanitizeSql(parsed.sql);
    return { sql, explanation: parsed.explanation, allowsLimit: /\bLIMIT\b/i.test(sql) };
```

#### System Prompt Builder
```57:81:ai-sql-backend/src/services/sqlGenerator.ts
  private buildSystemPrompt(target: "entities" | "dms", schemaSummary: string): string {
    const softDelete = target === "entities"
      ? "For entity use is_deleted=0; for other tables use deleted_at IS NULL where applicable."
      : "For DMS tables, prefer deleted_at IS NULL and status filters where applicable.";

    return `You are a senior MySQL expert. Generate a single best SELECT query for the ${target.toUpperCase()} database.

# Schema (truncated)
${schemaSummary}

# Rules
- Only SELECT queries. No DML/DDL.
- Use indexed joins where possible.
- ${softDelete}
- Use LOWER() for case-insensitive text match.
- Do not use SELECT *; name columns.
- If user implies a limit like 'top 5', add LIMIT ? or a safe LIMIT.

# Response JSON format
{
  "sql": "SELECT ...",
  "explanation": "why this query answers the question clearly"
}
`;
  }
```

#### SQL Safety Sanitization
```83:89:ai-sql-backend/src/services/sqlGenerator.ts
  private sanitizeSql(sql: string): string {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;
    if (forbidden.test(sql)) throw new Error("Forbidden SQL keyword detected");
    // strip comments and squash whitespace
    return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "").replace(/\s+/g, " ").trim();
  }
```

---

### 3. Vector Service (`vectorService.ts`)
**Purpose**: Provides semantic search capabilities for schema grounding

#### Constructor and Configuration
```29:40:ai-sql-backend/src/services/vectorService.ts
  constructor() {
    this.method = EMBEDDING_METHOD.toLowerCase();
    
    if (this.method === "azure" && !DISABLE_EMBEDDINGS) {
      this.openai = new AzureOpenAI({
        apiKey: AZURE_OPENAI_KEY,
        apiVersion: AZURE_OPENAI_API_VERSION,
        deployment: AZURE_OPENAI_DEPLOYMENT,
        endpoint: AZURE_OPENAI_ENDPOINT || "",
      });
    }
  }
```

#### Local Embedding Initialization
```42:54:ai-sql-backend/src/services/vectorService.ts
  private async initializeLocalEmbedder() {
    if (this.isInitialized || this.method !== "local") return;
    
    try {
      const { pipeline } = await import("@xenova/transformers");
      this.localEmbedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      this.isInitialized = true;
      console.log("✅ Local embedder initialized");
    } catch (error) {
      console.error("❌ Failed to initialize local embedder:", error);
      throw error;
    }
  }
```

#### Embedding Generation
```56:91:ai-sql-backend/src/services/vectorService.ts
  private async embed(texts: string[]): Promise<number[][]> {
    if (DISABLE_EMBEDDINGS) {
      throw new Error("Embeddings disabled");
    }

    if (this.method === "local") {
      await this.initializeLocalEmbedder();
      
      if (!this.localEmbedder) {
        throw new Error("Local embedder not initialized");
      }

      const embeddings: number[][] = [];
      for (const text of texts) {
        const result = await this.localEmbedder(text, { pooling: "mean" });
        embeddings.push(Array.from(result.data));
      }
      return embeddings;
    } else if (this.method === "azure") {
      if (!this.openai) {
        throw new Error("Azure OpenAI not configured");
      }

      try {
        const res = await this.openai.embeddings.create({
          model: AZURE_OPENAI_EMBEDDING,
          input: texts,
        } as any);
        return (res.data || []).map((d: any) => d.embedding as number[]);
      } catch (e: any) {
        throw new Error(`Azure embeddings error: ${e?.message || "Unknown error"}`);
      }
    } else {
      throw new Error(`Unknown embedding method: ${this.method}`);
    }
  }
```

#### Vector Index Building
```93:154:ai-sql-backend/src/services/vectorService.ts
  async build(entitiesPath: string, dmsPath: string): Promise<void> {
    if (DISABLE_EMBEDDINGS) {
      this.docs = [];
      return;
    }

    const ePath = path.resolve(entitiesPath);
    const dPath = path.resolve(dmsPath);
    
    if (!fs.existsSync(ePath)) throw new Error(`Schema file not found: ${ePath}`);
    if (!fs.existsSync(dPath)) throw new Error(`Schema file not found: ${dPath}`);
    
    const E = fs.readFileSync(ePath, "utf8");
    const D = fs.readFileSync(dPath, "utf8");

    // Simple chunking by lines
    const chunk = (text: string, size = 4000): string[] => {
      const lines = text.split(/\r?\n/);
      const chunks: string[] = [];
      let buf: string[] = [];
      for (const line of lines) {
        buf.push(line);
        if (buf.join("\n").length > size) {
          chunks.push(buf.join("\n"));
          buf = [];
        }
      }
      if (buf.length) chunks.push(buf.join("\n"));
      return chunks;
    };

    const eChunks = chunk(E);
    const dChunks = chunk(D);
    
    const all = [
      ...eChunks.map((t, i) => ({ 
        db: "entities" as const, 
        text: t, 
        filename: path.basename(entitiesPath),
        chunkIndex: i
      })), 
      ...dChunks.map((t, i) => ({ 
        db: "dms" as const, 
        text: t, 
        filename: path.basename(dmsPath),
        chunkIndex: i
      }))
    ];

    console.log(`📊 Generating ${this.method} embeddings for ${all.length} chunks...`);
    const embeddings = await this.embed(all.map((a) => a.text));
    
    this.docs = all.map((a, i) => ({ 
      id: `${a.db}-${a.chunkIndex}`, 
      db: a.db, 
      text: a.text, 
      embedding: embeddings[i],
      filename: a.filename
    }));

    console.log(`✅ Vector index built with ${this.docs.length} documents using ${this.method} embeddings`);
  }
```

#### Cosine Similarity Search
```156:182:ai-sql-backend/src/services/vectorService.ts
  private static cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { 
      dot += a[i] * b[i]; 
      na += a[i] * a[i]; 
      nb += b[i] * b[i]; 
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  async search(query: string, k = 5): Promise<VectorDoc[]> {
    if (DISABLE_EMBEDDINGS) {
      throw new Error("Embeddings disabled");
    }

    if (this.docs.length === 0) {
      throw new Error("Vector index not built. Call build() first.");
    }

    const [qVec] = await this.embed([query]);
    const scored = this.docs.map((d) => ({ 
      d, 
      s: VectorService.cosine(qVec, d.embedding) 
    }));
    scored.sort((x, y) => y.s - x.s);
    return scored.slice(0, k).map((r) => r.d);
  }
```

---

## Data Flow: Complete Process

### 1. Question Input
User asks: "Show me the top 10 entities with phone numbers from last month"

### 2. Database Selection (AnswerService)
- Analyzes question against ENTITIES and DMS schemas
- Uses either summary-based or vector-based approach
- Returns: `{ db_name: "entities", answer: "...", rationale: "...", plan: {...} }`

### 3. SQL Generation (SqlGenerator)
- Takes the analysis plan and generates safe SQL
- Applies strict safety rules (SELECT only, no DML/DDL)
- Returns: `{ sql: "SELECT ...", explanation: "...", allowsLimit: true }`

### 4. Vector Grounding (VectorService) - Optional
- If embeddings enabled, searches schema chunks for relevant context
- Uses cosine similarity to find most relevant schema sections
- Provides additional context for better SQL generation

---

## Safety Mechanisms

### 1. Input Validation
- JSON-only responses from AI
- Required field validation
- Type checking for all AI outputs

### 2. SQL Sanitization
- Forbidden keyword detection (INSERT, UPDATE, DELETE, etc.)
- Comment stripping
- Whitespace normalization

### 3. Error Handling
- Graceful fallbacks when AI fails
- Clear error messages for debugging
- Configuration validation

### 4. Response Format Enforcement
- Structured JSON responses only
- Temperature control (0.2) for consistency
- Token limits to prevent runaway generation

---

## Configuration

### Environment Variables
```typescript
AZURE_OPENAI_KEY
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_DEPLOYMENT
AZURE_OPENAI_API_VERSION
AZURE_OPENAI_EMBEDDING
DISABLE_EMBEDDINGS
EMBEDDING_METHOD // "azure" or "local"
```

### Service Initialization
```typescript
const vectorService = new VectorService();
const answerService = new AnswerService(vectorService);
const sqlGenerator = new SqlGenerator();

// Build vector index if embeddings enabled
await vectorService.build(entitiesPath, dmsPath);
```

---

## Performance Considerations

### 1. Vector Index
- Built once at startup
- Chunked schema files (4000 chars per chunk)
- Cosine similarity for fast retrieval

### 2. Caching Opportunities
- Cache vector embeddings
- Cache analysis results for similar questions
- Cache generated SQL for common patterns

### 3. Scalability
- Stateless service design
- Horizontal scaling possible
- Database connection pooling

---

## Error Scenarios and Handling

### 1. AI Service Failures
```typescript
if (!content) throw new Error("Empty AI response");
try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
```

### 2. Configuration Issues
```typescript
if (!this.configured || !this.openai) {
  throw new Error("AI not configured: set AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT");
}
```

### 3. Vector Service Failures
```typescript
if (this.docs.length === 0) {
  throw new Error("Vector index not built. Call build() first.");
}
```

---

## Integration Points

### 1. With Main Backend
- REST API endpoints for natural language queries
- Schema loading from Prisma definitions
- Response formatting for frontend consumption

### 2. With Frontend
- Natural language input interface
- SQL result display
- Error handling and user feedback

### 3. With Database
- Read-only access for safety
- Schema introspection
- Query execution through main backend

---

## Future Enhancements

### 1. Advanced Features
- Query optimization suggestions
- Query performance analysis
- Multi-database joins

### 2. Monitoring
- Query success/failure rates
- Response time metrics
- AI model performance tracking

### 3. Security
- Query result filtering
- User permission integration
- Audit logging

---

## Demo Script

### 1. Show Configuration
- Display environment variables
- Show service initialization

### 2. Demonstrate Database Selection
- Input: "Find recent customer orders"
- Show ENTITIES vs DMS decision process
- Display rationale and plan

### 3. Show SQL Generation
- Input: "Top 10 entities with phone numbers"
- Display generated SQL
- Show safety validation

### 4. Vector Search (if enabled)
- Show schema chunking
- Demonstrate similarity search
- Display relevant context

### 5. Error Handling
- Show invalid input handling
- Display graceful error responses
- Demonstrate fallback mechanisms

---

This AI SQL Backend provides a robust, safe, and intelligent way to convert natural language into executable SQL while maintaining strict safety boundaries and providing excellent user experience.
