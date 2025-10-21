"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const schemaLoader_1 = require("./schemaLoader");
const dbClassifier_1 = require("./dbClassifier");
const sqlGenerator_1 = require("./sqlGenerator");
const dbClient_1 = require("./dbClient");
const answerService_1 = require("./answerService");
const vectorService_1 = require("./vectorService");
const env_1 = require("../config/env");
exports.router = (0, express_1.Router)();
const schemas = (0, schemaLoader_1.loadSchemas)();
const entitiesSummary = (0, schemaLoader_1.buildSchemaSummary)(schemas.entities);
const dmsSummary = (0, schemaLoader_1.buildSchemaSummary)(schemas.dms);
const sqlGen = new sqlGenerator_1.SqlGenerator();
const vectorService = new vectorService_1.VectorService();
const answerService = new answerService_1.AnswerService(vectorService);
exports.router.post("/classify", (req, res) => {
    const question = String(req.body?.question || "").trim();
    if (!question)
        return res.status(400).json({ error: "question required" });
    const cls = (0, dbClassifier_1.classifyQuestion)(question, schemas);
    res.json({ question, ...cls });
});
exports.router.post("/ai/answer", async (req, res) => {
    try {
        const question = String(req.body?.question || "").trim();
        if (!question)
            return res.status(400).json({ error: "question required" });
        const analysis = await answerService.analyze(question, schemas);
        return res.json(analysis);
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "failed" });
    }
});
// Embeddings-based SQL: embed → retrieve top chunks → LLM SQL
exports.router.post("/sql-embed", async (req, res) => {
    try {
        const question = String(req.body?.question || "").trim();
        if (!question)
            return res.status(400).json({ error: "question required" });
        if (env_1.DISABLE_EMBEDDINGS) {
            // Fallback to non-embedding flow using schema summaries
            const cls = (0, dbClassifier_1.classifyQuestion)(question, schemas);
            const target = cls.target === "unknown" ? "entities" : cls.target;
            const summary = target === "entities" ? entitiesSummary : dmsSummary;
            const plan = await sqlGen.generate(question, target, summary);
            return res.json({ question, db_name: target, sql: plan.sql, params: [], notes: plan.explanation });
        }
        await vectorService.build("entities_prod_definition.txt", "dms_prod_definition.txt");
        const top = await vectorService.search(question, 5);
        const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
        const context = top.map((t, i) => `# CHUNK ${i + 1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");
        const prompt = `You are a senior SQL engineer. Using ONLY the schema context below, generate a parameterized SELECT statement that answers the user's question. Use $1,$2 style parameters. Never invent tables/columns not present.\n\nUSER QUESTION:\n${question}\n\nSCHEMA CONTEXT:\n${context}`;
        const plan = await sqlGen.generate(prompt, dbGuess, dbGuess === 'entities' ? entitiesSummary : dmsSummary);
        if (!plan?.sql) {
            return res.status(404).json({ error: "No SQL produced from context", question });
        }
        return res.json({ question, db_name: dbGuess, sql: plan.sql, params: [], notes: plan.explanation });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "failed" });
    }
});
// Main SQL endpoint - same as sql-embed
exports.router.post("/sql", async (req, res) => {
    try {
        const question = String(req.body?.question || "").trim();
        if (!question)
            return res.status(400).json({ error: "question required" });
        if (env_1.DISABLE_EMBEDDINGS) {
            // Fallback to non-embedding flow using schema summaries
            const cls = (0, dbClassifier_1.classifyQuestion)(question, schemas);
            const target = cls.target === "unknown" ? "entities" : cls.target;
            const summary = target === "entities" ? entitiesSummary : dmsSummary;
            const plan = await sqlGen.generate(question, target, summary);
            return res.json({ question, db_name: target, sql: plan.sql, params: [], notes: plan.explanation });
        }
        await vectorService.build("entities_prod_definition.txt", "dms_prod_definition.txt");
        const top = await vectorService.search(question, 5);
        const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
        const context = top.map((t, i) => `# CHUNK ${i + 1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");
        const prompt = `You are a senior SQL engineer. Using ONLY the schema context below, generate a parameterized SELECT statement that answers the user's question. Use $1,$2 style parameters. Never invent tables/columns not present.\n\nUSER QUESTION:\n${question}\n\nSCHEMA CONTEXT:\n${context}`;
        const plan = await sqlGen.generate(prompt, dbGuess, dbGuess === 'entities' ? entitiesSummary : dmsSummary);
        if (!plan?.sql) {
            return res.status(404).json({ error: "No SQL produced from context", question });
        }
        return res.json({ question, db_name: dbGuess, sql: plan.sql, params: [], notes: plan.explanation });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "failed" });
    }
});
// Generate and execute SQL with basic result diagnostics
exports.router.post("/sql/run", async (req, res) => {
    try {
        const question = String(req.body?.question || "").trim();
        if (!question)
            return res.status(400).json({ error: "question required" });
        const cls = (0, dbClassifier_1.classifyQuestion)(question, schemas);
        const target = cls.target === "unknown" ? "entities" : cls.target;
        const summary = target === "entities" ? entitiesSummary : dmsSummary;
        const plan = await sqlGen.generate(question, target, summary);
        // Execute the generated SQL
        const rows = await (0, dbClient_1.queryRaw)(target, plan.sql);
        // Diagnostics for suspicious zeros / nulls on aggregates
        const diagnostics = {};
        if (Array.isArray(rows) && rows.length > 0) {
            const first = rows[0];
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
            sql: plan.sql,
            notes: plan.explanation,
            row_count: Array.isArray(rows) ? rows.length : 0,
            diagnostics,
            rows
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "failed" });
    }
});
// Local vector search endpoint (integrated)
exports.router.get("/vector/query", async (req, res) => {
    try {
        const query = String(req.query.text || "").trim();
        if (!query)
            return res.status(400).json({ error: "Missing query parameter" });
        if (env_1.DISABLE_EMBEDDINGS) {
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
    }
    catch (err) {
        console.error("❌ Local vector search error:", err);
        res.status(500).json({ error: err.message || "Vector search failed" });
    }
});
// Health check for vector service
exports.router.get("/vector-health", async (req, res) => {
    try {
        const stats = vectorService.getStats();
        return res.json({
            status: "healthy",
            vector_service: "integrated",
            ...stats
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message || "failed" });
    }
});
