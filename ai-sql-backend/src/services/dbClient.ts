import { createPool, Pool } from "mysql2/promise";
import { DMS_DB_URL, ENTITIES_DB_URL } from "../config/env";

type DbName = "entities" | "dms";

function createPoolFromUrl(url: string | undefined) {
  if (!url) throw new Error("Missing DB URL");
  return createPool(url);
}

const pools: Partial<Record<DbName, Pool>> = {};

function getPool(db: DbName): Pool {
  if (!pools[db]) {
    const url = db === "entities" ? ENTITIES_DB_URL : DMS_DB_URL;
    if (!url) {
      throw new Error(`Missing ${db.toUpperCase()}_DB_URL`);
    }
    pools[db] = createPoolFromUrl(url);
  }
  return pools[db] as Pool;
}

export async function queryRaw(db: DbName, sql: string): Promise<any[]> {
  const pool = getPool(db);
  const [rows] = await pool.query(sql);
  return rows as any[];
}

export async function healthCheck() {
  const res: Record<DbName, boolean> = { entities: false, dms: false };
  for (const key of ["entities", "dms"] as DbName[]) {
    try {
      const pool = getPool(key);
      await pool.query("SELECT 1 as ok");
      res[key] = true;
    } catch {
      res[key] = false;
    }
  }
  return res;
}


