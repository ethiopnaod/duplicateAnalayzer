"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = require("openai");
const env_1 = require("../config/env");
class VectorService {
    constructor() {
        this.localEmbedder = null;
        this.docs = [];
        this.isInitialized = false;
        this.method = env_1.EMBEDDING_METHOD.toLowerCase();
        if (this.method === "azure" && !env_1.DISABLE_EMBEDDINGS) {
            this.openai = new openai_1.AzureOpenAI({
                apiKey: env_1.AZURE_OPENAI_KEY,
                apiVersion: env_1.AZURE_OPENAI_API_VERSION,
                deployment: env_1.AZURE_OPENAI_DEPLOYMENT,
                endpoint: env_1.AZURE_OPENAI_ENDPOINT || "",
            });
        }
    }
    async initializeLocalEmbedder() {
        if (this.isInitialized || this.method !== "local")
            return;
        try {
            const { pipeline } = await Promise.resolve().then(() => __importStar(require("@xenova/transformers")));
            this.localEmbedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
            this.isInitialized = true;
            console.log("✅ Local embedder initialized");
        }
        catch (error) {
            console.error("❌ Failed to initialize local embedder:", error);
            throw error;
        }
    }
    async embed(texts) {
        if (env_1.DISABLE_EMBEDDINGS) {
            throw new Error("Embeddings disabled");
        }
        if (this.method === "local") {
            await this.initializeLocalEmbedder();
            if (!this.localEmbedder) {
                throw new Error("Local embedder not initialized");
            }
            const embeddings = [];
            for (const text of texts) {
                const result = await this.localEmbedder(text, { pooling: "mean" });
                embeddings.push(Array.from(result.data));
            }
            return embeddings;
        }
        else if (this.method === "azure") {
            if (!this.openai) {
                throw new Error("Azure OpenAI not configured");
            }
            try {
                const res = await this.openai.embeddings.create({
                    model: env_1.AZURE_OPENAI_EMBEDDING,
                    input: texts,
                });
                return (res.data || []).map((d) => d.embedding);
            }
            catch (e) {
                throw new Error(`Azure embeddings error: ${e?.message || "Unknown error"}`);
            }
        }
        else {
            throw new Error(`Unknown embedding method: ${this.method}`);
        }
    }
    async build(entitiesPath, dmsPath) {
        if (env_1.DISABLE_EMBEDDINGS) {
            this.docs = [];
            return;
        }
        const ePath = path_1.default.resolve(entitiesPath);
        const dPath = path_1.default.resolve(dmsPath);
        if (!fs_1.default.existsSync(ePath))
            throw new Error(`Schema file not found: ${ePath}`);
        if (!fs_1.default.existsSync(dPath))
            throw new Error(`Schema file not found: ${dPath}`);
        const E = fs_1.default.readFileSync(ePath, "utf8");
        const D = fs_1.default.readFileSync(dPath, "utf8");
        // Simple chunking by lines
        const chunk = (text, size = 4000) => {
            const lines = text.split(/\r?\n/);
            const chunks = [];
            let buf = [];
            for (const line of lines) {
                buf.push(line);
                if (buf.join("\n").length > size) {
                    chunks.push(buf.join("\n"));
                    buf = [];
                }
            }
            if (buf.length)
                chunks.push(buf.join("\n"));
            return chunks;
        };
        const eChunks = chunk(E);
        const dChunks = chunk(D);
        const all = [
            ...eChunks.map((t, i) => ({
                db: "entities",
                text: t,
                filename: path_1.default.basename(entitiesPath),
                chunkIndex: i
            })),
            ...dChunks.map((t, i) => ({
                db: "dms",
                text: t,
                filename: path_1.default.basename(dmsPath),
                chunkIndex: i
            }))
        ];
        console.log(`📊 Generating ${this.method} embeddings for ${all.length} chunks...`);
        const embeddings = await this.embed(all.map((a) => a.text));
        this.docs = all.map((a, i) => ({
            id: `${a.db}-${a.chunkIndex}`,
            db: a.db,
            text: a.text,
            embedding: embeddings[i],
            filename: a.filename
        }));
        console.log(`✅ Vector index built with ${this.docs.length} documents using ${this.method} embeddings`);
    }
    static cosine(a, b) {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
    }
    async search(query, k = 5) {
        if (env_1.DISABLE_EMBEDDINGS) {
            throw new Error("Embeddings disabled");
        }
        if (this.docs.length === 0) {
            throw new Error("Vector index not built. Call build() first.");
        }
        const [qVec] = await this.embed([query]);
        const scored = this.docs.map((d) => ({
            d,
            s: VectorService.cosine(qVec, d.embedding)
        }));
        scored.sort((x, y) => y.s - x.s);
        return scored.slice(0, k).map((r) => r.d);
    }
    getStats() {
        return {
            docs_loaded: this.docs.length,
            embedder_ready: this.isInitialized || this.method === "azure",
            embeddings_disabled: env_1.DISABLE_EMBEDDINGS,
            method: this.method
        };
    }
}
exports.VectorService = VectorService;
