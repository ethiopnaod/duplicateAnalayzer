import fs from "fs";
import path from "path";
import { AzureOpenAI } from "openai";
import { 
  AZURE_OPENAI_API_VERSION, 
  AZURE_OPENAI_DEPLOYMENT, 
  AZURE_OPENAI_EMBEDDING, 
  AZURE_OPENAI_ENDPOINT, 
  AZURE_OPENAI_KEY, 
  DISABLE_EMBEDDINGS,
  EMBEDDING_METHOD
} from "../config/env";

export type VectorDoc = {
  id: string;
  db: "entities" | "dms";
  text: string;
  embedding: number[];
  filename: string;
};

export class VectorService {
  private openai?: AzureOpenAI;
  private localEmbedder: any = null;
  private docs: VectorDoc[] = [];
  private isInitialized = false;
  private method: string;

  constructor() {
    this.method = EMBEDDING_METHOD.toLowerCase();
    
    if (this.method === "azure" && !DISABLE_EMBEDDINGS) {
      this.openai = new AzureOpenAI({
        apiKey: AZURE_OPENAI_KEY,
        apiVersion: AZURE_OPENAI_API_VERSION,
        deployment: AZURE_OPENAI_DEPLOYMENT,
        endpoint: AZURE_OPENAI_ENDPOINT || "",
      });
    }
  }

  private async initializeLocalEmbedder() {
    if (this.isInitialized || this.method !== "local") return;
    
    try {
      const { pipeline } = await import("@xenova/transformers");
      this.localEmbedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      this.isInitialized = true;
      console.log("✅ Local embedder initialized");
    } catch (error) {
      console.error("❌ Failed to initialize local embedder:", error);
      throw error;
    }
  }

  private async embed(texts: string[]): Promise<number[][]> {
    if (DISABLE_EMBEDDINGS) {
      throw new Error("Embeddings disabled");
    }

    if (this.method === "local") {
      await this.initializeLocalEmbedder();
      
      if (!this.localEmbedder) {
        throw new Error("Local embedder not initialized");
      }

      const embeddings: number[][] = [];
      for (const text of texts) {
        const result = await this.localEmbedder(text, { pooling: "mean" });
        embeddings.push(Array.from(result.data));
      }
      return embeddings;
    } else if (this.method === "azure") {
      if (!this.openai) {
        throw new Error("Azure OpenAI not configured");
      }

      try {
        const res = await this.openai.embeddings.create({
          model: AZURE_OPENAI_EMBEDDING,
          input: texts,
        } as any);
        return (res.data || []).map((d: any) => d.embedding as number[]);
      } catch (e: any) {
        throw new Error(`Azure embeddings error: ${e?.message || "Unknown error"}`);
      }
    } else {
      throw new Error(`Unknown embedding method: ${this.method}`);
    }
  }

  async build(entitiesPath: string, dmsPath: string): Promise<void> {
    if (DISABLE_EMBEDDINGS) {
      this.docs = [];
      return;
    }

    const ePath = path.resolve(entitiesPath);
    const dPath = path.resolve(dmsPath);
    
    if (!fs.existsSync(ePath)) throw new Error(`Schema file not found: ${ePath}`);
    if (!fs.existsSync(dPath)) throw new Error(`Schema file not found: ${dPath}`);
    
    const E = fs.readFileSync(ePath, "utf8");
    const D = fs.readFileSync(dPath, "utf8");

    // Simple chunking by lines
    const chunk = (text: string, size = 4000): string[] => {
      const lines = text.split(/\r?\n/);
      const chunks: string[] = [];
      let buf: string[] = [];
      for (const line of lines) {
        buf.push(line);
        if (buf.join("\n").length > size) {
          chunks.push(buf.join("\n"));
          buf = [];
        }
      }
      if (buf.length) chunks.push(buf.join("\n"));
      return chunks;
    };

    const eChunks = chunk(E);
    const dChunks = chunk(D);
    
    const all = [
      ...eChunks.map((t, i) => ({ 
        db: "entities" as const, 
        text: t, 
        filename: path.basename(entitiesPath),
        chunkIndex: i
      })), 
      ...dChunks.map((t, i) => ({ 
        db: "dms" as const, 
        text: t, 
        filename: path.basename(dmsPath),
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

  private static cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { 
      dot += a[i] * b[i]; 
      na += a[i] * a[i]; 
      nb += b[i] * b[i]; 
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
  }

  async search(query: string, k = 5): Promise<VectorDoc[]> {
    if (DISABLE_EMBEDDINGS) {
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
      embeddings_disabled: DISABLE_EMBEDDINGS,
      method: this.method
    };
  }
}
