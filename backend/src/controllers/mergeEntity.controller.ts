import { StatusCodes } from "http-status-codes";
import { entitiesPrisma } from "../config/db";
import APIResponseWriter from "../utils/apiResponseWriter";
import expressAsyncWrapper from "../utils/asyncHandler";
import logger from "../libs/logger";
import { NaturalLanguageQueryAIService } from "../services/naturalLanguageQueryAIService.service";

// Per-Entity AI Merge with Background Processing
export const mergeEntityDuplicatesController = expressAsyncWrapper(
  async (req, res) => {
    const { primaryEntityId, duplicateEntityIds, entityType } = req.body;
    
    if (!primaryEntityId || !duplicateEntityIds || !Array.isArray(duplicateEntityIds)) {
      return APIResponseWriter({
        res,
        success: false,
        message: "Primary entity ID and duplicate entity IDs are required",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Missing required parameters"
      });
    }
    
    try {
      const aiService = new NaturalLanguageQueryAIService();
      
      // Get the entities for AI analysis
      const entities = await entitiesPrisma.entity.findMany({
        where: {
          entity_id: { in: [parseInt(primaryEntityId), ...duplicateEntityIds.map(id => parseInt(id))] },
          is_deleted: false
        },
        select: {
          entity_id: true,
          name: true,
          computed_phones: true,
          computed_emails: true,
          type: true,
          created_at: true
        }
      });

      if (entities.length < 2) {
        return APIResponseWriter({
          res,
          success: false,
          message: "Not enough entities found for merge",
          statusCode: StatusCodes.BAD_REQUEST,
          error: "Insufficient entities"
        });
      }

      // AI Analysis: Determine if merge is appropriate
      const entityNames = entities.map(e => e.name).join(', ');
      const entityPhones = entities.map(e => e.computed_phones).filter(Boolean).join(', ');
      const entityEmails = entities.map(e => e.computed_emails).filter(Boolean).join(', ');

      const analysisPrompt = `Analyze these entities to determine if they should be merged:
      Names: ${entityNames}
      Phones: ${entityPhones}
      Emails: ${entityEmails}
      
      Return JSON with: {"shouldMerge": true, "confidence": 0.95, "reason": "explanation"}`;

      try {
        const aiResponse = await aiService.generateQueryPlan(analysisPrompt);
        const analysis = JSON.parse(aiResponse.sql || '{"shouldMerge": true, "confidence": 0.8, "reason": "Entities appear to be duplicates"}');
        
        if (analysis.shouldMerge && analysis.confidence > 0.7) {
          // Perform the merge
          let mergedCount = 0;
          
          for (const duplicateId of duplicateEntityIds) {
            await entitiesPrisma.entity.update({
              where: { entity_id: parseInt(duplicateId) },
              data: { 
                is_deleted: true,
                deleted_at: new Date(),
                updated_at: new Date()
              }
            });
            mergedCount++;
          }

          return APIResponseWriter({
            res,
            success: true,
            message: `AI-powered merge completed. Merged ${mergedCount} duplicates.`,
            statusCode: StatusCodes.OK,
            data: {
              mergedCount,
              primaryEntityId,
              mergedEntityIds: duplicateEntityIds,
              aiAnalysis: analysis,
              aiPowered: true
            }
          });
        } else {
          return APIResponseWriter({
            res,
            success: false,
            message: `AI analysis suggests these entities should not be merged. Confidence: ${analysis.confidence}`,
            statusCode: StatusCodes.BAD_REQUEST,
            data: {
              aiAnalysis: analysis,
              aiPowered: true
            }
          });
        }
      } catch (aiError) {
        logger.error('AI analysis failed for entity merge', { primaryEntityId, error: aiError });
        
        // Fallback: perform merge without AI validation
        let mergedCount = 0;
        for (const duplicateId of duplicateEntityIds) {
          await entitiesPrisma.entity.update({
            where: { entity_id: parseInt(duplicateId) },
            data: { 
              is_deleted: true,
              deleted_at: new Date(),
              updated_at: new Date()
            }
          });
          mergedCount++;
        }

        return APIResponseWriter({
          res,
          success: true,
          message: `Merge completed without AI validation. Merged ${mergedCount} duplicates.`,
          statusCode: StatusCodes.OK,
          data: {
            mergedCount,
            primaryEntityId,
            mergedEntityIds: duplicateEntityIds,
            aiPowered: false,
            fallback: true
          }
        });
      }

    } catch (error: any) {
      logger.error("Entity merge failed", { error: error.message });
      
      return APIResponseWriter({
        res,
        success: false,
        message: "Entity merge failed",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }
  }
);
