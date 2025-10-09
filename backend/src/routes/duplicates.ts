import { Router } from "express";
import { 
  getDuplicatesListController, 
  getDuplicatesCountController,
  bulkMergeDuplicatesController,
  bulkDeleteDuplicatesController
} from "../controllers/duplicatesController";
import { mergeEntityDuplicatesController } from "../controllers/mergeEntity.controller";

const router = Router();

// Get duplicates list
router.get("/", getDuplicatesListController);

// Get duplicates count
router.get("/count", getDuplicatesCountController);

// Bulk merge duplicates
router.post("/merge", bulkMergeDuplicatesController);

// Per-entity AI merge duplicates
router.post("/merge-entity", mergeEntityDuplicatesController);

// Bulk delete duplicates
router.post("/delete", bulkDeleteDuplicatesController);

export default router;
