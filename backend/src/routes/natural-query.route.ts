import { Router } from "express";
import { naturalLanguageQueryController } from "../controllers/naturalLanguageQuery.controller";
import { entitiesPrisma } from "../config/db";

const router = Router()

router.post("/", naturalLanguageQueryController)

// Run raw SQL using entitiesPrisma.$queryRawUnsafe exactly like the provided snippet
router.post("/raw/entities", async (req, res) => {
  try {
    const sql = String((req as any).body?.sql || "");
    if (!sql) return res.status(400).json({ error: "sql is required" });
    const result = await entitiesPrisma.$queryRawUnsafe(sql);
    return res.json({ rows: result });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "failed" });
  }
});

// Fixed test endpoint matching the aggregate example on buy
router.get("/raw/entities/buy-aggregates", async (_req, res) => {
  try {
    const result = await entitiesPrisma.$queryRawUnsafe(
      `SELECT COUNT(acquisition_id) AS total_deals, SUM(face_value) AS total_amount FROM buy\nWHERE deleted_at IS NULL`
    );
    return res.json({ rows: result });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "failed" });
  }
});

export default router