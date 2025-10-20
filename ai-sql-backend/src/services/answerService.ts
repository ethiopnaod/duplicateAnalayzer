import { AzureOpenAI } from "openai";
import { AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, DISABLE_EMBEDDINGS } from "../config/env";
import { SchemaHints, buildSchemaSummary } from "./schemaLoader";
import { VectorService } from "./vectorService";

export type AnalysisPlan = {
  target: "entities" | "dms";
  tables?: string[];
  filters?: string[];
};

export type AnalysisResult = {
  db_name: "entities" | "dms";
  answer: string;
  rationale: string;
  plan: AnalysisPlan;
};

export class AnswerService {
  private openai: AzureOpenAI;
  private vectorService: VectorService;

  constructor(vectorService: VectorService) {
    this.openai = new AzureOpenAI({
      apiKey: AZURE_OPENAI_KEY,
      apiVersion: AZURE_OPENAI_API_VERSION,
      deployment: AZURE_OPENAI_DEPLOYMENT,
      endpoint: AZURE_OPENAI_ENDPOINT || "",
    });
    this.vectorService = vectorService;
  }

  async analyze(question: string, schemas: { entities: SchemaHints; dms: SchemaHints }): Promise<AnalysisResult> {
    // If embeddings disabled, use summary-based decision (pre-vector search behavior)
    if (DISABLE_EMBEDDINGS) {
      const entitiesSummary = buildSchemaSummary(schemas.entities);
      const dmsSummary = buildSchemaSummary(schemas.dms);
      const systemPrompt = `You are an expert data analyst. You will read two database schema summaries (ENTITIES and DMS) and decide which database best contains the information to answer the user's question. Then provide a concise natural language answer outline and a short rationale, plus a minimal plan indicating the target database and likely tables/filters. Respond ONLY in JSON with fields db_name ("entities"|"dms"), answer, rationale, and plan { target, tables, filters }.`;
      const userContent = `# Question\n${question}\n\n# ENTITIES SCHEMA (truncated)\n${entitiesSummary}\n\n# DMS SCHEMA (truncated)\n${dmsSummary}`;
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
      let parsed: any; try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }
      const db_name = parsed.db_name === "dms" ? "dms" : "entities";
      const answer = String(parsed.answer || "");
      const rationale = String(parsed.rationale || "");
      const plan: AnalysisPlan = { target: db_name, tables: Array.isArray(parsed.plan?.tables) ? parsed.plan.tables : [], filters: Array.isArray(parsed.plan?.filters) ? parsed.plan.filters : [], };
      return { db_name, answer, rationale, plan };
    }

    // Embeddings + vector search path
    const top = await this.vectorService.search(question, 5);
    const dbGuess = top.filter(t => t.db === 'entities').length >= top.filter(t => t.db === 'dms').length ? 'entities' : 'dms';
    const context = top.map((t, i) => `# CHUNK ${i+1} [${t.db.toUpperCase()}]\n${t.text}`).join("\n\n");

    const systemPrompt = `You are an expert data analyst. Based ONLY on the provided schema CHUNKs, decide which database (ENTITIES or DMS) best answers the question. Provide a concise natural-language answer outline and rationale, plus a minimal plan indicating target tables/filters. Respond ONLY in JSON with fields db_name ("entities"|"dms"), answer, rationale, and plan { target, tables, filters }.`;

    const userContent = `# Question\n${question}\n\n# SCHEMA CHUNKS (top-5)\n${context}`;

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

    let parsed: any;
    try { parsed = JSON.parse(content); } catch { throw new Error("AI returned invalid JSON"); }

    const db_name = parsed.db_name === "dms" ? "dms" : "entities";
    const answer = String(parsed.answer || "");
    const rationale = String(parsed.rationale || "");
    const plan: AnalysisPlan = {
      target: db_name,
      tables: Array.isArray(parsed.plan?.tables) ? parsed.plan.tables : [],
      filters: Array.isArray(parsed.plan?.filters) ? parsed.plan.filters : [],
    };

    return { db_name, answer, rationale, plan };
  }
}


