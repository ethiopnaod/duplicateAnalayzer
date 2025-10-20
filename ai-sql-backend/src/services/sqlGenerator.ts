import { AzureOpenAI } from "openai";
import { AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY } from "../config/env";

export type SqlPlan = {
  sql: string;
  explanation: string;
  allowsLimit: boolean;
};

export class SqlGenerator {
  private openai: AzureOpenAI | null = null;
  private configured: boolean;

  constructor() {
    this.configured = Boolean(AZURE_OPENAI_KEY && AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_DEPLOYMENT);
    if (this.configured) {
      this.openai = new AzureOpenAI({
        apiKey: AZURE_OPENAI_KEY,
        apiVersion: AZURE_OPENAI_API_VERSION,
        deployment: AZURE_OPENAI_DEPLOYMENT,
        endpoint: AZURE_OPENAI_ENDPOINT || "",
      });
    }
  }

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

    const content = res.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty AI response");
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    if (typeof parsed.sql !== "string" || typeof parsed.explanation !== "string") {
      throw new Error("Missing fields in AI response");
    }

    const sql = this.sanitizeSql(parsed.sql);
    return { sql, explanation: parsed.explanation, allowsLimit: /\bLIMIT\b/i.test(sql) };
  }

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

  private sanitizeSql(sql: string): string {
    const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|RENAME|GRANT|REVOKE)\b/i;
    if (forbidden.test(sql)) throw new Error("Forbidden SQL keyword detected");
    // strip comments and squash whitespace
    return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "").replace(/\s+/g, " ").trim();
  }
}
