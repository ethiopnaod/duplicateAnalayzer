import { Router, Request, Response } from "express";
import { loadSchemas, buildSchemaSummary } from "./schemaLoader";
import { classifyQuestion } from "./dbClassifier";
import { SqlGenerator } from "./sqlGenerator";
import { AnswerService } from "./answerService";
import { VectorService } from "./vectorService";
import { DISABLE_EMBEDDINGS } from "../config/env";

export const router = Router();

const schemas = loadSchemas();
const entitiesSummary = buildSchemaSummary(schemas.entities);
const dmsSummary = buildSchemaSummary(schemas.dms);
const sqlGen = new SqlGenerator();
const vectorService = new VectorService();
const answerService = new AnswerService(vectorService);

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

// Embeddings-based SQL: embed → retrieve top chunks → LLM SQL
router.post("/sql-embed", async (req: Request, res: Response) => {
  try {
    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "question required" });

    if (DISABLE_EMBEDDINGS) {
      // Fallback to non-embedding flow using schema summaries
      const cls = classifyQuestion(question, schemas);
      const target = cls.target === "unknown" ? "entities" : cls.target;
      const summary = target === "entities" ? entitiesSummary : dmsSummary;
      const plan = await sqlGen.generate(question, target, summary);
      return res.json({ question, db_name: target, sql: plan.sql, params: [], notes: plan.explanation });
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
    return res.json({ question, db_name: dbGuess, sql: plan.sql, params: [], notes: plan.explanation });
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
      // Fallback to non-embedding flow using schema summaries
      const cls = classifyQuestion(question, schemas);
      const target = cls.target === "unknown" ? "entities" : cls.target;
      const summary = target === "entities" ? entitiesSummary : dmsSummary;
      const plan = await sqlGen.generate(question, target, summary);
      return res.json({ question, db_name: target, sql: plan.sql, params: [], notes: plan.explanation });
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
    return res.json({ question, db_name: dbGuess, sql: plan.sql, params: [], notes: plan.explanation });
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
router.get("/vector-health", async (req: Request, res: Response) => {
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
