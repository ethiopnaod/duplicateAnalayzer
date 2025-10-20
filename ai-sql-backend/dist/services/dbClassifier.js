"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyQuestion = classifyQuestion;
const entitiesKeywords = [
    "entity", "entities", "people", "person", "user", "users", "address", "addresses", "organisation", "organization", "organisations", "organizations", "company", "companies", "bank", "iban", "swift", "bic", "role", "debtor", "creditor", "originator", "risk", "rating", "credit limit", "param_country", "country", "countries"
];
const dmsKeywords = [
    "ticket", "tickets", "tk", "note", "notes", "tag", "tags", "reminder", "reminders", "leads", "leads_transactions", "leads_notes", "leads_tickets", "assigned", "deadline", "status", "statuses", "report", "reports"
];
function classifyQuestion(question, schemas) {
    const q = question.toLowerCase();
    let entitiesScore = 0;
    for (const kw of entitiesKeywords) {
        if (q.includes(kw))
            entitiesScore += 1;
    }
    let dmsScore = 0;
    for (const kw of dmsKeywords) {
        if (q.includes(kw))
            dmsScore += 1;
    }
    // If no obvious keyword match, look for table/column token overlap
    if (entitiesScore === 0 && dmsScore === 0) {
        const tokens = new Set(q.split(/[^a-z0-9_]+/));
        const entitiesHit = schemas.entities.tables.some(t => tokens.has(t.toLowerCase()));
        const dmsHit = schemas.dms.tables.some(t => tokens.has(t.toLowerCase()));
        if (entitiesHit && !dmsHit) {
            const table = schemas.entities.tables.find(t => tokens.has(t.toLowerCase())) || "";
            return { target: "entities", confidence: 0.7, reason: table ? `Matched table ${table}` : "Matched entities token", candidateTables: table ? [table] : [] };
        }
        if (dmsHit && !entitiesHit) {
            const table = schemas.dms.tables.find(t => tokens.has(t.toLowerCase())) || "";
            return { target: "dms", confidence: 0.7, reason: table ? `Matched table ${table}` : "Matched dms token", candidateTables: table ? [table] : [] };
        }
        // Prefer entities on tie / none
        return { target: "entities", confidence: 0.6, reason: "Defaulted to Entities (no keyword/table hit)", candidateTables: [] };
    }
    if (entitiesScore >= dmsScore) {
        return { target: "entities", confidence: Math.min(1, 0.6 + entitiesScore * 0.1), reason: "Entities keywords matched", candidateTables: ["entity", "people", "address", "entity_property", "param_country"] };
    }
    else {
        return { target: "dms", confidence: Math.min(1, 0.6 + dmsScore * 0.1), reason: "DMS keywords matched", candidateTables: ["leads_tickets", "leads_notes", "users"] };
    }
}
