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

// Get duplicate details
router.get("/details", async (req, res) => {
  try {
    const { name, type } = req.query;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: "Name parameter is required" 
      });
    }

    // For now, return mock data that matches the frontend expectations
    const mockData = {
      groupKey: name,
      entities: [
        {
          entity_id: 1,
          name: name,
          computed_phones: "+1-555-0123",
          computed_emails: "contact@example.com",
          address: "123 Main St, City, State",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        },
        {
          entity_id: 2,
          name: name,
          computed_phones: "+1-555-0124",
          computed_emails: "info@example.com",
          address: "456 Oak Ave, City, State",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        }
      ],
      totalCount: 2
    };

    res.json({
      success: true,
      data: mockData
    });
  } catch (error) {
    console.error('Error fetching duplicate details:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Bulk merge duplicates
router.post("/merge", bulkMergeDuplicatesController);

// Per-entity AI merge duplicates
router.post("/merge-entity", mergeEntityDuplicatesController);

// Bulk delete duplicates
router.post("/delete", bulkDeleteDuplicatesController);

export default router;
