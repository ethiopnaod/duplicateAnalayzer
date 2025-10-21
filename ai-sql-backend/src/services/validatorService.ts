import { AzureOpenAI } from "openai";
import { AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY } from "../config/env";

export type ValidationResult = {
  is_valid: boolean;
  reason?: string;
  corrected_sql?: string;
  corrected_params?: any[];
  notes?: string;
};

export class ValidatorService {
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

  async validate(question: string, schemaChunks: Array<{ filename: string; content: string }>, generated: { sql: string; params?: any[] }): Promise<ValidationResult> {
    if (!this.configured || !this.openai) {
      // If not configured, assume valid
      return { is_valid: true, notes: "Validator not configured; skipping validation." };
    }

    const context = schemaChunks.slice(0, 5).map(s => `FILE: ${s.filename}\n${s.content}`).join("\n\n");
    const prompt = `You are an SQL validation agent.\nUser question:\n"${question}"\n\nSchema snippets:\n${context}\n\nGenerated SQL JSON:\n${JSON.stringify(generated, null, 2)}\n\nTasks:\n- Confirm whether the SQL answers the question.\n- If there is a semantic or logical issue that could return wrong results (like wrong column, missed join, wrong date usage, missing soft-delete filter), provide a corrected SQL and params.\nAnswer only as JSON in the format:\n{ "is_valid": true|false, "reason": "...", "corrected_sql": "...", "corrected_params": [...], "notes": "..." }`;

    const res = await this.openai.chat.completions.create({
      model: AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = res.choices[0]?.message?.content?.trim();
    if (!content) return { is_valid: true, notes: "Empty validator response; assuming valid." };
    try {
      return JSON.parse(content);
    } catch {
      return { is_valid: true, notes: "Validator returned non-JSON; assuming valid." };
    }
  }
}


