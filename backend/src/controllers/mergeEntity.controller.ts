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
    
    logger.info('Merge request received', { primaryEntityId, duplicateEntityIds, entityType });
    
    if (!primaryEntityId || !duplicateEntityIds || !Array.isArray(duplicateEntityIds)) {
      logger.error('Invalid merge request parameters', { primaryEntityId, duplicateEntityIds, entityType });
      return APIResponseWriter({
        res,
        success: false,
        message: "Primary entity ID and duplicate entity IDs are required",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Missing required parameters"
      });
    }

    if (duplicateEntityIds.length === 0) {
      logger.error('No duplicate entities provided', { primaryEntityId, duplicateEntityIds });
      return APIResponseWriter({
        res,
        success: false,
        message: "At least one duplicate entity ID is required",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "No duplicate entities provided"
      });
    }

    // Validate that primaryEntityId is not in duplicateEntityIds
    if (duplicateEntityIds.includes(parseInt(primaryEntityId))) {
      logger.error('Primary entity cannot be in duplicate list', { primaryEntityId, duplicateEntityIds });
      return APIResponseWriter({
        res,
        success: false,
        message: "Primary entity cannot be in the duplicate entities list",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Invalid entity selection"
      });
    }
    
    try {
      logger.info('Starting merge process', { primaryEntityId, duplicateEntityIds });
      
      // Enhanced merge with data combination
      try {
        logger.info('Starting merge operation', { primaryEntityId, duplicateEntityIds });
        
        // Get primary entity
        const primaryEntity = await entitiesPrisma.entity.findUnique({
          where: { entity_id: parseInt(primaryEntityId) }
        });

        if (!primaryEntity) {
          logger.error('Primary entity not found', { primaryEntityId });
          throw new Error(`Primary entity with ID ${primaryEntityId} not found`);
        }

        logger.info('Primary entity found', { 
          entityId: primaryEntity.entity_id, 
          name: primaryEntity.name,
          phones: primaryEntity.computed_phones,
          emails: primaryEntity.computed_emails
        });

        // Get duplicate entities
        const duplicateEntities = await entitiesPrisma.entity.findMany({
          where: { 
            entity_id: { in: duplicateEntityIds.map(id => parseInt(id)) },
            is_deleted: false
          }
        });

        logger.info('Duplicate entities found', { 
          count: duplicateEntities.length,
          entityIds: duplicateEntities.map(e => e.entity_id)
        });

        if (duplicateEntities.length === 0) {
          throw new Error("No valid duplicate entities found to merge");
        }

        // Collect all phone numbers and emails from duplicates
        const allPhones = new Set([
          primaryEntity.computed_phones,
          ...duplicateEntities.map(e => e.computed_phones)
        ].filter(Boolean).join(',').split(',').map(p => p.trim()).filter(p => p));

        const allEmails = new Set([
          primaryEntity.computed_emails,
          ...duplicateEntities.map(e => e.computed_emails)
        ].filter(Boolean).join(',').split(',').map(e => e.trim()).filter(e => e));

        logger.info('Combined data', {
          allPhones: Array.from(allPhones),
          allEmails: Array.from(allEmails)
        });

        // Update primary entity with combined data
        const updatedPrimary = await entitiesPrisma.entity.update({
          where: { entity_id: parseInt(primaryEntityId) },
          data: {
            computed_phones: Array.from(allPhones).join(', '),
            computed_emails: Array.from(allEmails).join(', '),
            updated_at: new Date()
          }
        });

        logger.info('Primary entity updated', { 
          entityId: updatedPrimary.entity_id,
          newPhones: updatedPrimary.computed_phones,
          newEmails: updatedPrimary.computed_emails
        });

        // Mark duplicates as deleted
        let mergedCount = 0;
        for (const duplicateId of duplicateEntityIds) {
          try {
            await entitiesPrisma.entity.update({
              where: { entity_id: parseInt(duplicateId) },
              data: { 
                is_deleted: true,
                deleted_at: new Date(),
                updated_at: new Date()
              }
            });
            mergedCount++;
            logger.info('Marked entity as deleted', { entityId: duplicateId });
          } catch (updateError) {
            logger.error('Failed to mark entity as deleted', { 
              entityId: duplicateId, 
              error: updateError 
            });
            // Continue with other entities even if one fails
          }
        }

        return APIResponseWriter({
          res,
          success: true,
          message: `Auto-merge completed successfully. Merged ${mergedCount} duplicates and combined phone/email data.`,
          statusCode: StatusCodes.OK,
          data: {
            mergedCount,
            primaryEntityId,
            mergedEntityIds: duplicateEntityIds,
            combinedPhones: Array.from(allPhones).length,
            combinedEmails: Array.from(allEmails).length,
            aiPowered: false,
            reason: "Enhanced merge with data combination"
          }
        });
      } catch (mergeError: any) {
        logger.error('Merge operation failed', { primaryEntityId, error: mergeError });
        
        return APIResponseWriter({
          res,
          success: false,
          message: "Merge operation failed",
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          error: mergeError.message || 'Unknown merge error'
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
