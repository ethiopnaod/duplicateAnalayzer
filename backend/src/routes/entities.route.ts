import { Router } from "express";
import { getAllEntitiesController, getEntityStatsController } from "../controllers/entitiesController";

const router = Router();

// Get all entities with pagination
router.get("/", getAllEntitiesController);

// Get entity statistics
router.get("/stats", getEntityStatsController);

export default router;
