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
const validatorService_1 = require("./validatorService");
exports.router = (0, express_1.Router)();
const schemas = (0, schemaLoader_1.loadSchemas)();
const entitiesSummary = (0, schemaLoader_1.buildSchemaSummary)(schemas.entities);
const dmsSummary = (0, schemaLoader_1.buildSchemaSummary)(schemas.dms);
const sqlGen = new sqlGenerator_1.SqlGenerator();
const vectorService = new vectorService_1.VectorService();
const answerService = new answerService_1.AnswerService(vectorService);
const validator = new validatorService_1.ValidatorService();
function stripInvalidEntityPropertyDeletedAt(sql) {
    try {
        const m = sql.match(/\bentity_property\s+([A-Za-z_][A-Za-z0-9_]*)/i);
        if (!m)
            return sql;
        const alias = m[1];
        const pattern = new RegExp(`\\b${alias}\\.deleted_at\\s+IS\\s+NULL`, 'gi');
        let s = sql.replace(pattern, '1=1');
        s = s.replace(/WHERE\s+1=1\s+AND\s+/gi, 'WHERE ');
        s = s.replace(/\s+AND\s+1=1(\s|$)/gi, ' ');
        s = s.replace(/WHERE\s+1=1(\s|$)/gi, 'WHERE ');
        return s;
    }
    catch {
        return sql;
    }
}
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
// Main SQL endpoint - same as sql-embed
exports.router.post("/sql", async (req, res) => {
    try {
        const question = String(req.body?.question || "").trim();
        if (!question)
            return res.status(400).json({ error: "question required" });
        if (env_1.DISABLE_EMBEDDINGS) {
            const cls = (0, dbClassifier_1.classifyQuestion)(question, schemas);
            const target = cls.target === "unknown" ? "entities" : cls.target;
            const summary = target === "entities" ? entitiesSummary : dmsSummary;
            const plan = await sqlGen.generate(question, target, summary);
            const fixedSql = stripInvalidEntityPropertyDeletedAt(plan.sql);
            return res.json({ question, db_name: target, sql: fixedSql, params: [], notes: plan.explanation });
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
        const fixedSql = stripInvalidEntityPropertyDeletedAt(plan.sql);
        return res.json({ question, db_name: dbGuess, sql: fixedSql, params: [], notes: plan.explanation });
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
        const sqlFixed = stripInvalidEntityPropertyDeletedAt(plan.sql);
        const rows = await (0, dbClient_1.queryRaw)(target, sqlFixed);
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
            sql: sqlFixed,
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
// Cursor-style unified endpoint: accepts { query, schema_chunks }
exports.router.post("/cursor/generate_sql", async (req, res) => {
    try {
        const question = String(req.body?.query || "").trim();
        const schemaChunks = Array.isArray(req.body?.schema_chunks) ? req.body.schema_chunks : [];
        if (!question)
            return res.status(400).json({ error: "Missing query" });
        // Choose target DB by simple majority from chunk filenames (fallback to entities)
        const entitiesCount = schemaChunks.filter((c) => /entities|entity/i.test(String(c.filename))).length;
        const dmsCount = schemaChunks.filter((c) => /dms|deal|buy|sell/i.test(String(c.filename))).length;
        const target = dmsCount > entitiesCount ? "dms" : "entities";
        const summary = target === "entities" ? entitiesSummary : dmsSummary;
        // Generate SQL
        const plan = await sqlGen.generate(question, target, summary);
        const generated = { db_name: target, sql: plan.sql, params: [], notes: plan.explanation, confidence: 0.7 };
        // Validate
        const validation = await validator.validate(question, schemaChunks.map((s) => ({ filename: s.filename, content: s.content })), { sql: generated.sql, params: generated.params });
        const finalSql = validation.is_valid ? generated.sql : (validation.corrected_sql || generated.sql);
        const finalParams = validation.is_valid ? (generated.params || []) : (validation.corrected_params || generated.params || []);
        let executed = null;
        if (env_1.EXECUTE_SQL_AUTOMATICALLY) {
            try {
                const rows = await (0, dbClient_1.queryRaw)(target, finalSql);
                executed = { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
            }
            catch (e) {
                executed = { error: e?.message || "execution failed" };
            }
        }
        return res.json({ generated, validation, executed });
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
exports.router.get("/vector-health", async (_req, res) => {
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
