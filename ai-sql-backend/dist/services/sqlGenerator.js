"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlGenerator = void 0;
const openai_1 = require("openai");
const env_1 = require("../config/env");
class SqlGenerator {
    constructor() {
        this.openai = null;
        this.configured = Boolean(env_1.AZURE_OPENAI_KEY && env_1.AZURE_OPENAI_ENDPOINT && env_1.AZURE_OPENAI_DEPLOYMENT);
        if (this.configured) {
            this.openai = new openai_1.AzureOpenAI({
                apiKey: env_1.AZURE_OPENAI_KEY,
                apiVersion: env_1.AZURE_OPENAI_API_VERSION,
                deployment: env_1.AZURE_OPENAI_DEPLOYMENT,
                endpoint: env_1.AZURE_OPENAI_ENDPOINT || "",
            });
        }
    }
    async generate(question, target, schemaSummary) {
        const systemPrompt = this.buildSystemPrompt(target, schemaSummary);
        const userPrompt = `Question: "${question}"\nReturn only JSON.`;
        if (!this.configured || !this.openai) {
            throw new Error("AI not configured: set AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT");
        }
        const res = await this.openai.chat.completions.create({
            model: env_1.AZURE_OPENAI_DEPLOYMENT,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
            max_tokens: 700,
            response_format: { type: "json_object" },
        });
        const content = res.choices[0]?.message?.content?.trim();
        if (!content)
            throw new Error("Empty AI response");
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch {
            throw new Error("AI returned invalid JSON");
        }
        if (typeof parsed.sql !== "string" || typeof parsed.explanation !== "string") {
            throw new Error("Missing fields in AI response");
        }
        const sql = this.sanitizeSql(parsed.sql);
        return { sql, explanation: parsed.explanation, allowsLimit: /\bLIMIT\b/i.test(sql) };
    }
    buildSystemPrompt(target, schemaSummary) {
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
    sanitizeSql(sql) {
        const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;
        if (forbidden.test(sql))
            throw new Error("Forbidden SQL keyword detected");
        // strip comments and squash whitespace
        return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "").replace(/\s+/g, " ").trim();
    }
}
exports.SqlGenerator = SqlGenerator;
