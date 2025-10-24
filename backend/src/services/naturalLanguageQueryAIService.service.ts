// services/NaturalLanguageQueryAIService.ts
import { AzureOpenAI } from "openai";
import {
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_KEY,
} from "../config/env";
import { ChatCompletionMessageParam } from "openai/resources/index";

// === Types ===
export type QueryPlan = {
  sql: string;
  explanation: string;
  allowsLimit: boolean;
  limit: number;
  successStatus: boolean;
  shouldRetry: boolean;
};

export type CorrectionFeedback = {
  sql: string;
  error: string;
};

/**
 * AI Service to interpret natural language questions and generate safe MySQL query plans
 * Now supports correction feedback from failed executions
 */
export class NaturalLanguageQueryAIService {
  private openai: AzureOpenAI;

  private readonly MAX_RETRIES = 3;
  private readonly MAX_TOKENS = 600;

  constructor() {
    this.openai = new AzureOpenAI({
      apiKey: AZURE_OPENAI_KEY,
      apiVersion: AZURE_OPENAI_API_VERSION,
      deployment: AZURE_OPENAI_DEPLOYMENT,
      endpoint: AZURE_OPENAI_ENDPOINT || "",
    });
  }

  /**
   * Analyze entities for merge compatibility using AI
   * @param prompt The analysis prompt
   */
  async analyzeEntitiesForMerge(prompt: string): Promise<string> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are an expert data analyst. Analyze the given entities and determine if they should be merged based on names, phone numbers, and email addresses. Return only valid JSON in this format: {"shouldMerge": boolean, "confidence": number (0-1), "reason": "explanation"}.`
        },
        {
          role: "user",
          content: prompt
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-35-turbo",
        messages,
        max_tokens: this.MAX_TOKENS,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("No response from AI service");
      }

      return content;
    } catch (error) {
      console.error("AI analysis failed:", error);
      throw error;
    }
  }

  /**
   * Generate a SQL query plan from natural language.
   * @param question The user's natural language question
   * @param corrections Optional: list of { sql, error } pairs from prior failed attempts
   */
  async generateQueryPlan(
    question: string,
    corrections: CorrectionFeedback[] = []
  ): Promise<QueryPlan> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(question, corrections);

    let conversation: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model: AZURE_OPENAI_DEPLOYMENT,
          messages: conversation,
          temperature: 0.2,
          max_tokens: this.MAX_TOKENS,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) {
          throw new Error("Empty response from AI");
        }

        console.log({ aiAttempt: attempt, rawResponse: content });

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          throw new Error("AI returned invalid JSON");
        }

        const result = this.validateAndSanitize(parsed);

        if (result.successStatus) {
          return result;
        }

        if (!result.shouldRetry) {
          return result; // User error — don't retry
        }

        // AI mistake → give feedback and retry
        const feedback = this.buildFeedback(parsed, result.explanation, corrections);
        conversation.push(
          { role: "assistant", content: content },
          { role: "user", content: feedback }
        );
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        console.warn(`Attempt ${attempt + 1} failed:`, errorMsg);

        if (attempt === this.MAX_RETRIES) {
          return this.buildFallbackQueryPlan(
            `Failed after ${this.MAX_RETRIES + 1} attempts: ${errorMsg}. Please rephrase your question.`,
            { shouldRetry: false }
          );
        }

        const feedbackMsg = `Your response was rejected: ${errorMsg}. Fix the JSON or query and respond only in valid JSON format.`;
        conversation.push({ role: "user", content: feedbackMsg });
      }
    }

    return this.buildFallbackQueryPlan("Internal error: No valid plan generated.", { shouldRetry: false });
  }

  private buildSystemPrompt(): string {
    return `
You are a senior data architect and MySQL expert for a comprehensive Entity Management System (EMS). Your job is to generate the **single best SQL query** from natural language — safe, efficient, accurate, and fully aware of the entity-centric domain.

## 🧩 Full Schema & Business Context

### Core Tables

#### \`entity\` (Central Entity Table)
- **Purpose**: Stores organizations (type=1), people (type=2), and other business entities.
- **Soft Delete**: Always use \`is_deleted = 0\` and/or \`deleted_at IS NULL\`.
- **Key Fields**: 
  - \`entity_id\`, \`name\`, \`trade_name\`, \`type\`, \`creator_ledger_id\`
- **Index**: \`name\`, \`type\`, \`entity_id\`, \`creator_ledger_id\`

#### \`people\`
- **Purpose**: Stores individuals linked to an entity (e.g., directors, contacts).
- **Soft Delete**: Use \`deleted_at IS NULL\`.
- **Key Fields**: 
  - \`first_name\`, \`last_name\`, \`date_of_birth\`, \`entity_id\`
- **Index**: \`entity_id\`

#### \`address\`
- **Purpose**: Physical addresses for entities.
- **Key Fields**: 
  - \`line_one\`, \`city\`, \`state\`, \`zipcode\`, \`country\`, \`country_code\`, \`address_type\`
- **Soft Delete**: \`deleted_at IS NULL\`
- **Index**: \`entity_id\`, \`city\`, \`country_code\`, \`zipcode\`

#### \`bank\`
- **Purpose**: Bank institutions (e.g., HSBC, Citi).
- **Key Fields**: 
  - \`bank_id\`, \`name\`, \`SWIFT_BIC\`, \`country_id\`, \`address_id\`
- **Relations**: One-to-many with \`bank_account\`
- **Index**: \`address_id\`

#### \`bank_account\`
- **Purpose**: Bank accounts linked to entities.
- **Key Fields**: 
  - \`IBAN\`, \`account\`, \`ccy\`, \`is_valid_iban\`, \`entity_id\`, \`bank_id\`
- **Soft Delete**: \`deleted_at IS NULL\`
- **Index**: \`entity_id\`, \`bank_id\`, \`IBAN\`, \`account\`

#### \`asset\`
- **Purpose**: Physical or financial assets owned by entities.
- **Key Fields**: 
  - \`asset_id\`, \`name\`, \`classification\`, \`quantity\`, \`unit_price\`, \`issued\`, \`entity_id\`
- **Soft Delete**: \`deleted_at IS NULL\`
- **Index**: \`entity_id\`, \`batch_parent\`

#### \`entity_property\`
- **Purpose**: Dynamic key-value attributes (email, phone, website, etc.) for entities.
- **Key Fields**: 
  - \`property_id\` (e.g., 'email', 'phone_number', 'website')
  - \`property_value\`, \`is_primary\`, \`entity_id\`
- **Relation**: Links to \`property\` table for metadata.
- **No Soft Delete**, but tied to \`entity.is_deleted\`

#### 📞 Phone and 📧 Email storage (CRITICAL)
- Phone numbers and emails are stored in \`entity_property\` as properties, not in a direct \`phone → entity\` link.
- Common property identifiers include variations like \`phone\`, \`mobile\`, \`phone_number\`, \`email\`.
- When searching for a person's phone/email by name:
  - Match the person via \`entity\` (and optionally \`people\` for first/last name), with \`LOWER(entity.name)\` or by composing \`people.first_name\`/\`people.last_name\`.
  - Join to \`entity_property\` on \`entity_id\` and filter by the appropriate \`property_id\` and/or by \`property_value\` pattern.
- Do NOT join the \`phone\` table by \`entity_id\` — that column does not exist in \`phone\`.

#### \`property\`
- **Purpose**: Metadata about property types (e.g., label, description, table).
- **Key Fields**: 
  - \`property_id\`, \`label\`, \`description\`, \`type\`, \`param_table\`

#### \`entity_role\`
- **Purpose**: Assigns roles (e.g., debtor, creditor, originator) to entities.
- **Key Fields**: 
  - \`entity_role_id\` (e.g., 'DEBTOR_123'), \`role_id\`, \`entity_id\`, \`related_role_id\`
- **Soft Delete**: Not directly, but respect business logic.
- **Index**: \`entity_id\`, \`role_id\`, \`entity_role_id\`

#### \`role\`
- **Purpose**: Role definitions (e.g., "Debtor", "Creditor", "Originator").
- **Key Fields**: 
  - \`role_id\`, \`name\`, \`type\`, \`recognition_priority\`
- **Index**: \`name\`

#### \`entity_mapping\`
- **Purpose**: Hierarchical relationships between entities (e.g., parent-child, ownership).
- **Key Fields**: 
  - \`parent_id\`, \`entity_id\`, \`is_primary\`, \`created_at\`
- **Soft Delete**: \`deleted_at IS NULL\`
- **Index**: \`parent_id\`, \`entity_id\`

#### \`entity_contact\`
- **Purpose**: Links two entities as contacts (e.g., person ↔ organization).
- **Key Fields**: 
  - \`parent_id\` (contact), \`entity_id\` (owner), \`title\`, \`is_primary\`
- **Composite PK**: \`(entity_id, parent_id)\`

#### \`entity_risk_and_rates\`
- **Purpose**: Stores risk profiles, credit ratings, limits, and contract terms.
- **Key Fields**: 
  - \`c_grade\`, \`c_max\`, \`limit\`, \`contract\`, \`rating\`, \`entity_id\`
- **Soft Delete**: \`deleted_at IS NULL\`

#### \`param_country\`
- **Purpose**: Country reference data (ISO codes, dial codes, timezones).
- **Key Fields**: 
  - \`country_id\` (3-letter), \`name\`, \`iso2\`, \`dial_code\`

#### \`param\`
- **Purpose**: Generic key-value configuration store.
- **Key Fields**: 
  - \`table\`, \`id\`, \`value\` — often used for dynamic settings.

#### \`buy\`
- **Purpose**: Purchase/acquisition records involving entities.
- **Key Fields**: 
  - \`creditor_id\`, \`debtor_id\`, \`originator_id\`, \`face_value\`, \`issued\`, \`status\`
- **Soft Delete**: \`deleted_at IS NULL\`

---

## 🛡️ Critical Rules (Enforced)

1. **Only SELECT queries** — no DML/DDL.
2. **Enforce soft deletes**:
   - For \`entity\`: \`is_deleted = 0\`
   - For other tables that have soft delete: use \`deleted_at IS NULL\`
3. **Use indexed joins** — prefer joining on indexed fields like \`entity_id\`, \`role_id\`, \`bank_id\`
4. **Use \`LOWER()\` for case-insensitive text matching**.
5. If user implies a limit ("top 5", "show 3"), use \`LIMIT ?\`.
6. Never assume data exists — handle NULLs gracefully.
7. Use explicit column names — avoid \`SELECT *\`.

---

## 🎯 Your Goal: Recommend the BEST Query

- If the request is ambiguous, **choose the most likely interpretation** and explain why.
- If multiple interpretations exist, **pick the one with the highest business value**.
- Prioritize **performance**: use indexed columns, avoid full scans.
- If data is missing or unsafe, return a **helpful fallback**, not an error.

---

## 📤 Output Format (JSON only)

{
  "sql": "SELECT ... FROM ... WHERE ... LIMIT ?",
  "explanation": "Clear, concise explanation of what the query does and why it's optimal.",
  "allowsLimit": true,
  "successStatus": true,
  "shouldRetry": false
}

---

## 🚫 On Invalid or Unsafe Requests

Return:
{
  "sql": "SELECT 'No valid query could be generated.' AS message",
  "explanation": "I cannot perform that action. Please ask about entities, people, or addresses.",
  "allowsLimit": false,
  "successStatus": false,
  "shouldRetry": false
}

---

## 💡 Example with Correction Feedback

User: "Show people with email in Germany"
Previous attempt failed:
- SQL: "SELECT p.first_name... WHERE a.country = 'germany'"
- Error: "Unknown column 'a.country', did you mean 'a.country_code'?"

→ Now AI knows to use \`param_country\` or compare via code/name lookup.

User: "please share the mobile number of Shubham rawat"
Previous attempt failed:
- SQL: "... JOIN phone p ON pe.entity_id = p.entity_id ... AND p.phone_type = 'mobile'"
- Error: "Unknown column 'p.entity_id' in 'on clause'"

→ Correct approach: match person in \`entity\`/\`people\`, then select from \`entity_property\` where \`property_id\` indicates phone/mobile and \`property_value\` is the number.

## 🚀 Begin
Generate only the JSON response. No extra text.
`.trim();
  }

  private buildUserPrompt(question: string, corrections: CorrectionFeedback[] = []): string {
    let prompt = `Interpret this natural language question:\n\n"${question}"\n\n`;

    if (corrections.length > 0) {
      prompt += `\nThe following attempts failed. Use this feedback to avoid repeating the same mistakes:\n`;
      corrections.forEach((corr, i) => {
        prompt += `\nFailed Query ${i + 1}: ${corr.sql}\nError: ${corr.error}\n`;
      });
      prompt += `\nNow generate the corrected query.\n`;
    }

    prompt += `
Return a JSON object with:
- "sql": the MySQL SELECT query
- "explanation": plain English
- "allowsLimit": boolean
- "successStatus": boolean
- "shouldRetry": boolean
`;
    return prompt;
  }

  private buildFeedback(
    invalidPlan: any,
    reason: string,
    corrections: CorrectionFeedback[]
  ): string {
    let feedback = `
Your previous response:
${JSON.stringify(invalidPlan, null, 2)}

Was rejected because: ${reason}

Previous execution errors:
`;

    if (corrections.length === 0) {
      feedback += "None (first attempt)\n";
    } else {
      corrections.forEach((corr, i) => {
        feedback += `Attempt ${i + 1}: "${corr.sql}" → Error: "${corr.error}"\n`;
      });
    }

    feedback += `
Please correct the issue and return a valid JSON object with:
{
  "sql": "...",
  "explanation": "...",
  "allowsLimit": boolean,
  "successStatus": boolean,
  "shouldRetry": boolean
}
Only respond with JSON. No extra text.
`;
    return feedback.trim();
  }

  private validateAndSanitize(plan: any): QueryPlan {
    try {
      if (
        !plan.sql ||
        typeof plan.explanation !== "string" ||
        typeof plan.allowsLimit !== "boolean" ||
        typeof plan.successStatus !== "boolean"
      ) {
        throw new Error("Missing or invalid fields: sql, explanation, allowsLimit, or successStatus");
      }

      if (plan.successStatus === false && plan.shouldRetry === false) {
        return {
          sql: plan.sql,
          explanation: plan.explanation,
          allowsLimit: false,
          limit: 0,
          successStatus: false,
          shouldRetry: false,
        };
      }

      let sql = plan.sql.trim();

      const forbidden = [
        "UPDATE",
        "DELETE",
        "INSERT",
        "DROP",
        "ALTER",
        "CREATE",
        "TRUNCATE",
        "RENAME",
        "GRANT",
        "REVOKE",
      ];
      for (const kw of forbidden) {
        if (new RegExp(`\\b${kw}\\b`, "i").test(sql)) {
          throw new Error(`Forbidden keyword detected: ${kw}`);
        }
      }

      if (!/^SELECT/i.test(sql)) {
        throw new Error("Only SELECT queries are allowed");
      }

      sql = sql
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--.*/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
      const limitValue = limitMatch ? Math.min(parseInt(limitMatch[1], 10), 100) : 0;
      if (limitValue > 100) {
        sql = sql.replace(/\bLIMIT\s+\d+/i, "LIMIT ?");
      }

      return {
        sql,
        explanation: plan.explanation.trim(),
        allowsLimit: Boolean(plan.allowsLimit),
        limit: limitValue,
        successStatus: true,
        shouldRetry: false,
      };
    } catch (error: any) {
      return this.buildFallbackQueryPlan(`Validation failed: ${error.message}`, { shouldRetry: true });
    }
  }

  private buildFallbackQueryPlan(reason: string, options?: { shouldRetry: boolean }): QueryPlan {
    return {
      sql: "SELECT 'No valid query could be generated.' AS message",
      explanation: `I cannot perform that action. ${reason} Please ask about entities, people, or addresses.`,
      allowsLimit: false,
      limit: 0,
      successStatus: false,
      shouldRetry: options?.shouldRetry ?? true,
    };
  }
}