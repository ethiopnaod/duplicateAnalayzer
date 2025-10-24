## Duplicate Analyzer — Modernized Backend, AI SQL, and Frontend

### Presenter
- Your role: Implemented and integrated `frontend`, `backend`, and `ai-sql-backend`
- Duration: 12–15 minutes (plus Q&A)

---

## Problem → Outcome
- Problem: Duplicate/inconsistent entities caused manual review, slow operations, and data quality risks.
- Outcome:
  - Automated duplicate grouping by phone/email/name with confidence scoring
  - AI-assisted merge decisions with strict safety and auditability
  - Optional natural-language to SQL querying, grounded on schema/vector search
  - Reliability: rate limiting, centralized error handling, structured logs

---

## High-Level Architecture
- Frontend (Next.js App Router) → Backend (Express + Prisma + Views) → MySQL
- AI SQL Backend (separate service): DB selection + SQL generation + vector search
- Repos: `frontend/`, `backend/`, `ai-sql-backend/`

Data path example (Duplicates): UI → `/api/duplicates` → backend route → controller (optimized raw SQL) → Prisma → response transform → UI render/actions (merge/delete)

---

## Backend: Duplicates Flow (Route → Controller → DB)

### Route wiring
```12:17:backend/src/routes/duplicates.ts
// Get duplicates list
router.get("/", getDuplicatesListController);

// Get duplicates count
router.get("/count", getDuplicatesCountController);
```

### Controller: optimized raw SQL and transform
- Groups probable duplicates using CASE-based keys and window counts; returns UI-ready groups with pagination and metadata.
```29:47:backend/src/controllers/duplicatesController.ts
      // Use a single optimized query with raw SQL for better performance
      let query = `
        WITH duplicate_groups AS (
          SELECT 
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN CONCAT('phone_', REPLACE(computed_phones, ' ', ''))
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN CONCAT('email_', computed_emails)
              ELSE CONCAT('name_', REPLACE(name, ' ', '_'))
            END as group_id,
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN 'phone'
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN 'email'
              ELSE 'name'
            END as match_type,
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN 0.95
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN 0.98
              ELSE 0.85
            END as confidence,
```

```86:106:backend/src/controllers/duplicatesController.ts
        SELECT 
          group_id,
          match_type,
          confidence,
          group_name,
          entity_type,
          created_at,
          duplicate_count,
          GROUP_CONCAT(entity_id) as entity_ids,
          GROUP_CONCAT(name) as names,
          GROUP_CONCAT(computed_phones) as phones,
          GROUP_CONCAT(computed_emails) as emails
        FROM duplicate_groups 
        WHERE duplicate_count > 1
```

```170:188:backend/src/controllers/duplicatesController.ts
      const executionTime = Date.now() - startTime;

      return APIResponseWriter({
        res,
        success: true,
        message: "Duplicates retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          duplicates: transformedDuplicates,
          pagination: {
            page: parseInt(page as string) || 1,
            pageSize: limit,
            totalGroups: parseInt(totalCount),
            totalEntities: transformedDuplicates.reduce((sum, dup) => sum + dup.duplicateCount, 0),
            hasMore: (offset + limit) < parseInt(totalCount)
          },
          metadata: {
            executionTime: `${executionTime}ms`,
            queryOptimized: true,
            indexesUsed: true,
```

---

## AI-Assisted Merge Decisions (Safety First)
- AI suggests which entity to keep; merges are deterministic with soft-deletes for duplicates.
- Strict JSON-only AI outputs with validation; no direct execution of AI-generated code.

```41:52:backend/src/services/entityMergeAI.service.ts
export class EntityMergeAIService {
  private openai: AzureOpenAI;
  private readonly MAX_TOKENS = 1000;
  private readonly TEMPERATURE = 0.1;

  constructor() {
    this.openai = new AzureOpenAI({
      apiKey: AZURE_OPENAI_KEY,
      apiVersion: AZURE_OPENAI_API_VERSION,
    //   endpoint: AZURE_OPENAI_ENDPOINT, // e.g., "https://your-resource.openai.azure.com"
    });
  }
}
```

```72:92:backend/src/services/entityMergeAI.service.ts
      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("Empty or undefined response from AI");
      }

      let parsed: EntityMergeOutput;
      try {
        parsed = JSON.parse(content);
      } catch (jsonError) {
        console.error("AI Response (Invalid JSON):", content);
        throw new Error("AI returned malformed JSON. Failed to parse.");
      }

      // Validate required fields
      if (typeof parsed.keep !== "string") {
        throw new Error("AI response missing 'keep' field or not a string");
      }
      if (!Array.isArray(parsed.remove)) {
        throw new Error("AI response missing 'remove' field or not an array");
      }
```

---

## AI SQL Backend: NL → SQL (Schema-aware and Safe)
- Selects the most relevant DB (ENTITIES vs DMS), explains rationale and plan.
- Generates a single safe SELECT; sanitizes against DML/DDL and strips comments.
- Optional vector grounding using embeddings for better context selection.

### Database selection and plan
```33:51:ai-sql-backend/src/services/answerService.ts
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

### Vector grounding (optional)
```60:69:ai-sql-backend/src/services/answerService.ts
    // Embeddings + vector search path
    const top = await this.vectorService.search(question, 5);
    const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
    const context = top.map((t, i) => `# CHUNK ${i+1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");

    const systemPrompt = `You are an expert data analyst. Based ONLY on the provided schema CHUNKs, decide which database (ENTITIES or DMS) best answers the question. Provide a concise natural-language answer outline and rationale, plus a minimal plan indicating target tables/filters. Respond ONLY in JSON with fields db_name ("entities"|"dms"), answer, rationale, and plan { target, tables, filters }.`;
```

### SQL generation and safety
```26:33:ai-sql-backend/src/services/sqlGenerator.ts
  async generate(question: string, target: "entities" | "dms", schemaSummary: string): Promise<SqlPlan> {
    const systemPrompt = this.buildSystemPrompt(target, schemaSummary);
    const userPrompt = `Question: "${question}"\nReturn only JSON.`;

    if (!this.configured or !this.openai) {
      throw new Error("AI not configured: set AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT");
    }
```

```44:55:ai-sql-backend/src/services/sqlGenerator.ts
    const content = res.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    if (typeof parsed.sql !== "string" or typeof parsed.explanation !== "string") {
      throw new Error("Missing fields in AI response");
    }

    const sql = this.sanitizeSql(parsed.sql);
    return { sql, explanation: parsed.explanation, allowsLimit: /\bLIMIT\b/i.test(sql) };
```

```83:89:ai-sql-backend/src/services/sqlGenerator.ts
  private sanitizeSql(sql: string): string {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;
    if (forbidden.test(sql)) throw new Error("Forbidden SQL keyword detected");
    // strip comments and squash whitespace
    return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "").replace(/\s+/g, " ").trim();
  }
```

### Vector index and search
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

```142:152:ai-sql-backend/src/services/vectorService.ts
    console.log(`📊 Generating ${this.method} embeddings for ${all.length} chunks...`);
    const embeddings = await this.embed(all.map((a) => a.text));
    
    this.docs = all.map((a, i) => ({ 
      id: `${a.db}-${a.chunkIndex}`, 
      db: a.db, 
      text: a.text, 
      embedding: embeddings[i],
      filename: a.filename
    }));
```

---

## Frontend: Duplicates UI (Next.js App Router)
- Client page fetches `/api/duplicates`, supports search, selection, auto-merge, bulk delete.
- Uses shared UI components and toasts for UX.

```40:49:frontend/app/dashboard/duplicates/page.tsx
  // Fetch duplicates from backend
  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/duplicates');
      const data = await response.json();
      
      if (data.success) {
        setDuplicates(data.data.duplicates || []);
      } else {
```

```66:83:frontend/app/dashboard/duplicates/page.tsx
  // Auto-merge duplicates
  const handleAutoMerge = async (groupId: string) => {
    const group = duplicates.find(d => d.id === groupId);
    if (!group or group.entities.length < 2) return;

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
```

```150:164:frontend/app/dashboard/duplicates/page.tsx
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
```

---

## Reliability and Safety (Backend)
- Central error middleware translates Prisma/app errors into standard API responses.
- Rate limiting protects endpoints; dev mode can skip.
- Structured logging: timestamped, errors captured with stacks, logs to files.

```7:18:backend/src/middlewares/expressRouteErrorHandler.ts
const expressRouteErrorHandlerMiddleware: ErrorRequestHandler = (
  err: any,
  _: Request,
  res: Response,
  __: NextFunction
) => {
  logger.error(err);

  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || "Something went wrong";
```

```49:56:backend/src/middlewares/expressRouteErrorHandler.ts
  APIResponseWriter({
    res,
    statusCode,
    success: false,
    message,
    data: null,
    error: err,
  });
};
```

```3:10:backend/src/middlewares/rateLimiter.ts
const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Much higher limit for development
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
```

```11:19:backend/src/libs/logger.ts
// Winston logger instance
const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // capture error stack trace
    logFormat
  ),
```

```20:36:backend/src/libs/logger.ts
  transports: [
    // Console with colors
    new transports.Console({
      format: combine(colorize(), logFormat),
    }),

    // Write all logs to combined.log
    new transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
    }),

    // Write only errors to error.log
    new transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
  ],
```

---

## Demo Script (3–5 min)
1) Health check: open backend `/health` or frontend `/api/health` → show 200 OK
2) Duplicates dashboard: list, search, select groups
3) Auto Merge: run one group; explain AI suggests primary, backend applies soft-deletes; refresh list
4) Optional natural query: “Top 10 entities by recent activity” → walk NL→DB selection→SQL generation→results
5) Show brief log output and an example error response

---

## Metrics and Observability (suggested)
- Request timings and correlation IDs in logs
- Merge success rate and manual overrides
- Embedding/vector latency and hit quality
- Error rates by route; add uptime dashboard later

---

## Risks and Mitigations
- AI hallucination: JSON-only outputs, schema-grounded prompts, validation/sanitization, human-in-the-loop
- Data safety: read-only AI SQL; merges are soft-deletes; auditability
- Performance spikes: rate limiting, pagination, vector caching; background jobs for heavy tasks

---

## Q&A Quick Hits
- Why separate AI SQL backend? Independent scaling, stricter safety, clean contracts, faster iteration.
- How do you ensure merge correctness? Deterministic rules; AI assists; soft-deletes; validations and logs.
- Prevent SSR hydration bugs (frontend)? Hydration-safe hooks and client-only state; clear typing.
- DB issues? Central error handler paths, graceful responses, logs, health checks.

---

## Appendix: Notable Guardrails
- `ai-sql-backend/src/services/answerService.ts` throws on empty AI content:
```50:52:ai-sql-backend/src/services/answerService.ts
      const content = res.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty AI response");
      let parsed: any; try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
```

Use this deck as your script. Walk one path deeply (duplicates), reference NL→SQL briefly, and close with reliability and safety.


