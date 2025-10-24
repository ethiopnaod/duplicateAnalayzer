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
        const common = `
You are a senior MySQL expert. Generate a single best SELECT query for the ${target.toUpperCase()} database.

# Schema (truncated)
${schemaSummary}

# Universal Rules
- Only SELECT queries. No DML/DDL.
- Use indexed joins where possible.
- Use LOWER() for case-insensitive text match where needed.
- Do not use SELECT *; specify columns.
- If user implies a limit like 'top 5', add LIMIT ? or a safe LIMIT.
`;
        const entitiesHints = `
# Entities-Specific Guidance (CRITICAL)
- Soft delete: prefer (entity.is_deleted = 0 OR entity.is_deleted IS NULL).
- Only add deleted_at IS NULL for tables that actually have a deleted_at column; do NOT add it on entity_property.
- Phone numbers and emails live in entity_property (property_id like 'phone', 'mobile', 'phone_number', 'email').
  - Join entity_property ON entity_id; do NOT join phone by entity_id (that column does not exist in phone).
- People: if matching by person name, use entity.name or people.first_name/last_name joined to entity.
- Buy table: typical numeric fields include face_value, purchased; dates like issued. Use date ranges for performance.
`;
        const dmsHints = `
# DMS-Specific Guidance (CRITICAL)
- Soft delete on tickets: (t.is_delete = 0 OR t.is_delete IS NULL) AND t.deleted_at IS NULL.
- Master tickets: master_ticket_crm_id IS NULL.
- Ticket code parsing: 'TK188089' => master_ticket_prefix = 'TK' AND ticket_number = '188089'.
- Leads notes: there is NO leads_tickets_id; link via leads_transactions_id between leads_tickets and leads_notes.
- Email history uses mail_content (not content), often filtered by leads_transactions_id and ordered by sent_date DESC.
`;
        const softDeleteReminder = target === "entities"
            ? "Soft delete: (entity.is_deleted = 0 OR entity.is_deleted IS NULL); add deleted_at IS NULL where present."
            : "Soft delete: (t.is_delete = 0 OR t.is_delete IS NULL) AND t.deleted_at IS NULL; master tickets: master_ticket_crm_id IS NULL.";
        return `${common}
${target === "entities" ? entitiesHints : dmsHints}

# Reminders
- ${softDeleteReminder}

# Response JSON format
{
  "sql": "SELECT ...",
  "explanation": "why this query answers the question clearly"
}`;
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
