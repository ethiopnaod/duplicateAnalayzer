import express, { Request, Response } from "express";
import cors from "cors";
import { PORT } from "./config/env";
import { router } from "./services/router";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", router);

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`AI SQL Backend listening on :${PORT}`);
});
