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
- Use ONLY tables that exist in the provided schema for the selected target. Do NOT mix tables across databases.
- If target is DMS, NEVER use Entities tables like entity, entity_property, people, address, bank, etc.
- If target is Entities, NEVER use DMS tables like leads_tickets, leads_transactions, users (CRM), global_organisations, email_history, etc.
`;
        const entitiesHints = `
# Entities-Specific Guidance (CRITICAL)
- Soft delete: prefer (entity.is_deleted = 0 OR entity.is_deleted IS NULL).
- Only add deleted_at IS NULL for tables that actually have a deleted_at column; do NOT add it on entity_property.
- Phones/emails:
  - Prefer entity.computed_phones and entity.computed_emails when listing contact info.
  - Otherwise use entity_property with property_id IN ('phone','mobile','phone_number','telephone','email','work_email','personal_email').
  - Join entity_property ON entity_property.entity_id = entity.entity_id. Do NOT join the phone table (it has no entity_id link).
  - For numeric matching, normalize by removing spaces/dashes using REPLACE before LIKE/REGEXP.
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
- Do NOT reference Entities tables (entity, entity_property, people, address, etc.) when target is DMS.
- Contact info in DMS:
  - Use global_entity_contacts (GEC) where contact_type IN ('phone','mobile','email').
  - Join GEC to the correct master by context:
    - Organisation contacts: join global_entity_contacts.contact_for = 'organisation' (or 'entity' in some datasets) and global_entity_contacts.entity_id = global_organisations.id.
    - Person/user contacts: join contact_for = 'people' or 'user' accordingly and entity_id to the appropriate table id (often users.id if referencing assigned users).
  - Apply soft delete on global_entity_contacts when present: (is_delete = 0 OR is_delete IS NULL) AND deleted_at IS NULL.
- Names in DMS:
  - Organisation name: global_organisations.organisation_name (and trade_name if relevant).
  - User/person name: users.first_name, users.last_name.
- Common joins:
  - leads_tickets t -> users u via t.assigned_to = u.id (for the current owner/assignee).
  - leads_tickets t -> leads_transactions lt via t.leads_transactions_id = lt.id (deal/summary metrics live on lt, not t).
  - leads_tickets t -> global_organisations go via t.global_organisation_id = go.id (ticket's organisation).
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
