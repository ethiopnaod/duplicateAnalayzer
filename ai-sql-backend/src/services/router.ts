import { Router, Request, Response } from "express";
import { loadSchemas, buildSchemaSummary } from "./schemaLoader";
import { classifyQuestion } from "./dbClassifier";
import { SqlGenerator } from "./sqlGenerator";
import { queryRaw } from "./dbClient";
import { AnswerService } from "./answerService";
import { VectorService } from "./vectorService";
import { DISABLE_EMBEDDINGS, EXECUTE_SQL_AUTOMATICALLY } from "../config/env";
import { ValidatorService } from "./validatorService";

export const router = Router();

const schemas = loadSchemas();
const entitiesSummary = buildSchemaSummary(schemas.entities);
const dmsSummary = buildSchemaSummary(schemas.dms);
const sqlGen = new SqlGenerator();
const vectorService = new VectorService();
const answerService = new AnswerService(vectorService);
const validator = new ValidatorService();

function stripInvalidEntityPropertyDeletedAt(sql: string): string {
  try {
    const m = sql.match(/\bentity_property\s+([A-Za-z_][A-Za-z0-9_]*)/i);
    if (!m) return sql;
    const alias = m[1];
    const pattern = new RegExp(`\\b${alias}\\.deleted_at\\s+IS\\s+NULL`, 'gi');
    let s = sql.replace(pattern, '1=1');
    s = s.replace(/WHERE\s+1=1\s+AND\s+/gi, 'WHERE ');
    s = s.replace(/\s+AND\s+1=1(\s|$)/gi, ' ');
    s = s.replace(/WHERE\s+1=1(\s|$)/gi, 'WHERE ');
    return s;
  } catch { return sql; }
}

router.post("/classify", (req: Request, res: Response) => {
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "question required" });
  const cls = classifyQuestion(question, schemas);
  res.json({ question, ...cls });
});

router.post("/ai/answer", async (req: Request, res: Response) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "question required" });
    const analysis = await answerService.analyze(question, schemas);
    return res.json(analysis);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "failed" });
  }
});

// Main SQL endpoint - same as sql-embed
router.post("/sql", async (req: Request, res: Response) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "question required" });

    if (DISABLE_EMBEDDINGS) {
      const cls = classifyQuestion(question, schemas);
      const target = cls.target === "unknown" ? "entities" : cls.target;
      const summary = target === "entities" ? entitiesSummary : dmsSummary;
      const plan = await sqlGen.generate(question, target, summary);
      const fixedSql = stripInvalidEntityPropertyDeletedAt(plan.sql);
      return res.json({ question, db_name: target, sql: fixedSql, params: [], notes: plan.explanation });
    }

    await vectorService.build("entities_prod_definition.txt", "dms_prod_definition.txt");
    const top = await vectorService.search(question, 5);
    const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
    const context = top.map((t, i) => `# CHUNK ${i+1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");

    const prompt = `You are a senior SQL engineer. Using ONLY the schema context below, generate a parameterized SELECT statement that answers the user's question. Use $1,$2 style parameters. Never invent tables/columns not present.\n\nUSER QUESTION:\n${question}\n\nSCHEMA CONTEXT:\n${context}`;

    const plan = await sqlGen.generate(prompt, dbGuess as any, dbGuess === 'entities' ? entitiesSummary : dmsSummary);
    if (!plan?.sql) {
      return res.status(404).json({ error: "No SQL produced from context", question });
    }
    const fixedSql = stripInvalidEntityPropertyDeletedAt(plan.sql);
    return res.json({ question, db_name: dbGuess, sql: fixedSql, params: [], notes: plan.explanation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "failed" });
  }
});


// Generate and execute SQL with basic result diagnostics
router.post("/sql/run", async (req: Request, res: Response) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "question required" });

    const cls = classifyQuestion(question, schemas);
    const target = cls.target === "unknown" ? "entities" : cls.target;
    const summary = target === "entities" ? entitiesSummary : dmsSummary;
    const plan = await sqlGen.generate(question, target, summary);

    // Execute the generated SQL
    const sqlFixed = stripInvalidEntityPropertyDeletedAt(plan.sql);
    const rows = await queryRaw(target as any, sqlFixed);

    // Diagnostics for suspicious zeros / nulls on aggregates
    const diagnostics: any = {};
    if (Array.isArray(rows) && rows.length > 0) {
      const first = rows[0] as Record<string, any>;
      const aggregateLikeKeys = Object.keys(first).filter(k => /^(sum|avg|count|max|min|total)/i.test(k));
      for (const key of aggregateLikeKeys) {
        const val = first[key];
        if (val === 0 || val === "0" || val === null) {
          diagnostics[key] = {
            value: val,
            note: "Aggregate returned zero/null. Check filters (deleted_at/is_deleted) and joins."
          };
        }
      }
    }

    return res.json({
      question,
      db_name: target,
      sql: sqlFixed,
      notes: plan.explanation,
      row_count: Array.isArray(rows) ? rows.length : 0,
      diagnostics,
      rows
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "failed" });
  }
});

// Cursor-style unified endpoint: accepts { query, schema_chunks }
router.post("/cursor/generate_sql", async (req: Request, res: Response) => {
  try {
    const question = String(req.body?.query || "").trim();
    const schemaChunks = Array.isArray(req.body?.schema_chunks) ? req.body.schema_chunks : [];
    if (!question) return res.status(400).json({ error: "Missing query" });

    // Choose target DB by simple majority from chunk filenames (fallback to entities)
    const entitiesCount = schemaChunks.filter((c: any) => /entities|entity/i.test(String(c.filename))).length;
    const dmsCount = schemaChunks.filter((c: any) => /dms|deal|buy|sell/i.test(String(c.filename))).length;
    const target: "entities" | "dms" = dmsCount > entitiesCount ? "dms" : "entities";
    const summary = target === "entities" ? entitiesSummary : dmsSummary;

    // Generate SQL
    const plan = await sqlGen.generate(question, target, summary);
    const generated = { db_name: target, sql: plan.sql, params: [], notes: plan.explanation, confidence: 0.7 };

    // Validate
    const validation = await validator.validate(question, schemaChunks.map((s: any) => ({ filename: s.filename, content: s.content })), { sql: generated.sql, params: generated.params });

    const finalSql = validation.is_valid ? generated.sql : (validation.corrected_sql || generated.sql);
    const finalParams = validation.is_valid ? (generated.params || []) : (validation.corrected_params || generated.params || []);

    let executed: any = null;
    if (EXECUTE_SQL_AUTOMATICALLY) {
      try {
        const rows = await queryRaw(target, finalSql);
        executed = { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
      } catch (e: any) {
        executed = { error: e?.message || "execution failed" };
      }
    }

    return res.json({ generated, validation, executed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "failed" });
  }
});

// Local vector search endpoint (integrated)
router.get("/vector/query", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.text || "").trim();
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    if (DISABLE_EMBEDDINGS) {
      return res.json([]);
    }

    await vectorService.build("entities_prod_definition.txt", "dms_prod_definition.txt");
    const results = await vectorService.search(query, 5);
    
    const formattedResults = results.map((doc, index) => ({
      score: 0.9 - (index * 0.1), // Simple scoring based on rank
      filename: doc.filename,
      content: doc.text.slice(0, 500) + "...",
      db: doc.db
    }));

    res.json(formattedResults);
  } catch (err: any) {
    console.error("❌ Local vector search error:", err);
    res.status(500).json({ error: err.message || "Vector search failed" });
  }
});

// Health check for vector service
router.get("/vector-health", async (_req: Request, res: Response) => {
  try {
    const stats = vectorService.getStats();
    return res.json({ 
      status: "healthy",
      vector_service: "integrated",
      ...stats
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "failed" });
  }
});
