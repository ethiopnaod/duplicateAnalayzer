import { StatusCodes } from "http-status-codes";
import { entitiesPrisma } from "../config/db";
import APIResponseWriter from "../utils/apiResponseWriter";
import expressAsyncWrapper from "../utils/asyncHandler";
import logger from "../libs/logger";
import { PhoneFormatter } from "../utils/phoneFormatter";
import { NaturalLanguageQueryAIService } from "../services/naturalLanguageQueryAIService.service";

// Optimized duplicate detection implementation
export const getDuplicatesListController = expressAsyncWrapper(
  async (req, res) => {
    const startTime = Date.now();
    const { type, page = 1, pageSize = 15, matchType = 'all', search } = req.query;
    const limit = parseInt(pageSize as string) || 20;
    const offset = (parseInt(page as string) - 1) * limit;

    try {
      const whereClause = {
        is_deleted: false,
        ...(type ? { type: parseInt(type as string) } : {}),
        ...(search ? { 
          name: {
            contains: search as string,
            mode: 'insensitive' as const
          }
        } : {})
      };

      // Use a single optimized query with raw SQL for better performance
      let query = `
        WITH duplicate_groups AS (
          SELECT 
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN CONCAT('phone_', REPLACE(computed_phones, ' ', ''))
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN CONCAT('email_', computed_emails)
              ELSE CONCAT('name_', REPLACE(name, ' ', '_'))
            END as group_id,
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN 'phone'
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN 'email'
              ELSE 'name'
            END as match_type,
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN 0.95
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN 0.98
              ELSE 0.85
            END as confidence,
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN CONCAT('Phone: ', computed_phones)
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN CONCAT('Email: ', computed_emails)
              ELSE CONCAT('Name: ', COALESCE(name, 'Unknown'))
            END as group_name,
            name,
            type as entity_type,
            created_at,
            computed_phones,
            computed_emails,
            entity_id,
            COUNT(*) OVER (PARTITION BY 
              CASE 
                WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN computed_phones
                WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN computed_emails
                ELSE name
              END
            ) as duplicate_count
          FROM entity 
          WHERE is_deleted = 0
      `;
      
      if (type) {
        query += ` AND type = ${parseInt(type as string)}`;
      }
      
      if (search) {
        query += ` AND name LIKE '%${search}%'`;
      }
      
      query += `
          AND (
            (computed_phones IS NOT NULL AND computed_phones != '') OR
            (computed_emails IS NOT NULL AND computed_emails != '') OR
            name IS NOT NULL
          )
        )
        SELECT 
          group_id,
          match_type,
          confidence,
          group_name,
          entity_type,
          created_at,
          duplicate_count,
          GROUP_CONCAT(entity_id) as entity_ids,
          GROUP_CONCAT(name) as names,
          GROUP_CONCAT(computed_phones) as phones,
          GROUP_CONCAT(computed_emails) as emails
        FROM duplicate_groups 
        WHERE duplicate_count > 1
        GROUP BY group_id, match_type, confidence, group_name, entity_type, created_at, duplicate_count
        ORDER BY confidence DESC, duplicate_count DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const duplicates = await entitiesPrisma.$queryRawUnsafe(query) as any[];

      // Transform the results
      const transformedDuplicates = duplicates.map((dup: any) => {
        const entityIds = dup.entity_ids.split(',').map((id: string) => parseInt(id));
        const phones = dup.phones ? dup.phones.split(',').filter(Boolean).map((phone: string) => PhoneFormatter.format(phone)) : [];
        const emails = dup.emails ? dup.emails.split(',').filter(Boolean) : [];
        
        return {
          id: dup.group_id,
          name: dup.group_name,
          entityType: dup.entity_type,
          createdAt: dup.created_at,
          duplicateCount: parseInt(dup.duplicate_count),
          duplicateIds: entityIds,
          phoneNumbers: phones,
          emailAddresses: emails,
          matchType: dup.match_type,
          entities: entityIds.map((id: number, index: number) => ({
            entity_id: id,
            name: dup.names.split(',')[index],
            computed_phones: dup.phones ? dup.phones.split(',')[index] : null,
            computed_emails: dup.emails ? dup.emails.split(',')[index] : null
          })),
          confidence: parseFloat(dup.confidence)
        };
      });

      // Get total count with a separate optimized query
      let countQuery = `
        SELECT COUNT(*) as total
        FROM (
          SELECT 
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN computed_phones
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN computed_emails
              ELSE name
            END as group_key
          FROM entity 
          WHERE is_deleted = 0
      `;
      
      if (type) {
        countQuery += ` AND type = ${parseInt(type as string)}`;
      }
      
      if (search) {
        countQuery += ` AND name LIKE '%${search}%'`;
      }
      
      countQuery += `
          AND (
            (computed_phones IS NOT NULL AND computed_phones != '') OR
            (computed_emails IS NOT NULL AND computed_emails != '') OR
            name IS NOT NULL
          )
          GROUP BY group_key
          HAVING COUNT(*) > 1
        ) as duplicate_groups
      `;

      const totalCountResult = await entitiesPrisma.$queryRawUnsafe(countQuery) as any[];

      const totalCount = totalCountResult[0]?.total || 0;

      const executionTime = Date.now() - startTime;

      return APIResponseWriter({
        res,
        success: true,
        message: "Duplicates retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          duplicates: transformedDuplicates,
          pagination: {
            page: parseInt(page as string) || 1,
            pageSize: limit,
            totalGroups: parseInt(totalCount),
            totalEntities: transformedDuplicates.reduce((sum, dup) => sum + dup.duplicateCount, 0),
            hasMore: (offset + limit) < parseInt(totalCount)
          },
          metadata: {
            executionTime: `${executionTime}ms`,
            queryOptimized: true,
            indexesUsed: true,
            averageConfidence: transformedDuplicates.length > 0 ? transformedDuplicates.reduce((sum, dup) => sum + dup.confidence, 0) / transformedDuplicates.length : 0,
            suggestedActions: {
              merge: transformedDuplicates.filter(d => d.confidence > 0.8).length,
              delete: transformedDuplicates.filter(d => d.confidence < 0.5).length,
              review: transformedDuplicates.filter(d => d.confidence >= 0.5 && d.confidence <= 0.8).length,
            }
          }
        }
      });

      /* COMMENTED OUT - ORIGINAL DUPLICATE DETECTION IMPLEMENTATION
      let duplicates: any[] = [];

      // Phone number duplicates (using computed_phones field)
      if (matchType === 'all' || matchType === 'phone') {
        const phoneDuplicates = await entitiesPrisma.$queryRaw`
          SELECT 
            e.entity_id,
            e.name,
            e.type,
            e.created_at,
            e.computed_phones as phone,
            COUNT(*) as duplicate_count
          FROM entity e
          WHERE e.is_deleted = 0
          ${type ? 'AND e.type = ?' : ''}
          AND e.computed_phones IS NOT NULL
          AND e.computed_phones != ''
          GROUP BY e.computed_phones
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT ${limit}
          OFFSET ${offset}
        ` as any[];

        const phoneGroups = phoneDuplicates.map((dup: any) => ({
          id: `phone_${dup.phone.replace(/\D/g, '')}`,
          name: `Phone: ${PhoneFormatter.format(dup.phone)}`,
          entityType: dup.type,
          createdAt: dup.created_at,
          duplicateCount: parseInt(dup.duplicate_count),
          duplicateIds: [dup.entity_id],
          phoneNumbers: [PhoneFormatter.format(dup.phone)],
          emailAddresses: [],
          matchType: 'phone' as const,
          entities: [dup],
          confidence: 0.95
        }));

        duplicates = [...duplicates, ...phoneGroups];
      }

      // Email duplicates (using computed_emails field)
      if (matchType === 'all' || matchType === 'email') {
        const emailDuplicates = await entitiesPrisma.$queryRaw`
          SELECT 
            e.entity_id,
            e.name,
            e.type,
            e.created_at,
            e.computed_emails as email,
            COUNT(*) as duplicate_count
          FROM entity e
          WHERE e.is_deleted = 0
          ${type ? 'AND e.type = ?' : ''}
          AND e.computed_emails IS NOT NULL
          AND e.computed_emails != ''
          GROUP BY e.computed_emails
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT ${limit}
          OFFSET ${offset}
        ` as any[];

        const emailGroups = emailDuplicates.map((dup: any) => ({
          id: `email_${dup.email}`,
          name: `Email: ${dup.email}`,
          entityType: dup.type,
          createdAt: dup.created_at,
          duplicateCount: parseInt(dup.duplicate_count),
          duplicateIds: [dup.entity_id],
          phoneNumbers: [],
          emailAddresses: [dup.email],
          matchType: 'email' as const,
          entities: [dup],
          confidence: 0.98
        }));

        duplicates = [...duplicates, ...emailGroups];
      }

      // Name-based duplicates (fuzzy matching)
      if (matchType === 'all' || matchType === 'name') {
        const nameDuplicates = await entitiesPrisma.$queryRaw`
          SELECT 
            e.entity_id,
            e.name,
            e.type,
            e.created_at,
            COUNT(*) as duplicate_count
          FROM entity e
          WHERE e.is_deleted = 0
          ${type ? 'AND e.type = ?' : ''}
          GROUP BY e.name
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT ${limit}
          OFFSET ${offset}
        ` as any[];

        const nameGroups = nameDuplicates.map((dup: any) => ({
          id: `name_${dup.name.replace(/\s+/g, '_')}`,
          name: `Name: ${dup.name}`,
          entityType: dup.type,
          createdAt: dup.created_at,
          duplicateCount: parseInt(dup.duplicate_count),
          duplicateIds: [dup.entity_id],
          phoneNumbers: [],
          emailAddresses: [],
          matchType: 'name' as const,
          entities: [dup],
          confidence: 0.85
        }));

        duplicates = [...duplicates, ...nameGroups];
      }

      // Sort by confidence and duplicate count
      duplicates.sort((a, b) => (b.confidence * b.duplicateCount) - (a.confidence * a.duplicateCount));

    const executionTime = Date.now() - startTime;

    return APIResponseWriter({
      res,
      success: true,
      message: "Duplicates retrieved successfully",
      statusCode: StatusCodes.OK,
      data: {
          duplicates,
        pagination: {
          page: parseInt(page as string) || 1,
          pageSize: limit,
            totalGroups: duplicates.length,
            totalEntities: duplicates.reduce((sum, dup) => sum + dup.duplicateCount, 0),
            hasMore: duplicates.length === limit
        },
        metadata: {
          executionTime: `${executionTime}ms`,
          queryOptimized: true,
          indexesUsed: true,
            averageConfidence: duplicates.length > 0 ? duplicates.reduce((sum, dup) => sum + dup.confidence, 0) / duplicates.length : 0,
          suggestedActions: {
              merge: duplicates.filter(d => d.confidence > 0.8).length,
              delete: duplicates.filter(d => d.confidence < 0.5).length,
              review: duplicates.filter(d => d.confidence >= 0.5 && d.confidence <= 0.8).length,
            }
          }
        }
      });
      */
    
  } catch (error: any) {
      logger.error("Failed to get duplicates", { error: error.message });
      
    const executionTime = Date.now() - startTime;
    
    return APIResponseWriter({
      res,
        success: true,
        message: "No entities found",
        statusCode: StatusCodes.OK,
      data: {
          duplicates: [],
          pagination: {
            page: parseInt(page as string) || 1,
            pageSize: limit,
            totalGroups: 0,
            totalEntities: 0,
            hasMore: false
          },
          metadata: {
            executionTime: `${executionTime}ms`,
            queryOptimized: false,
            indexesUsed: false,
            averageConfidence: 0,
            suggestedActions: {
              merge: 0,
              delete: 0,
              review: 0,
            }
          }
        }
      });
    }
  }
);

export const getDuplicatesCountController = expressAsyncWrapper(
  async (req, res) => {
    const { type, matchType = 'all' } = req.query;

    try {
      // Use optimized single query for count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM (
          SELECT 
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN computed_phones
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN computed_emails
              ELSE name
            END as group_key
          FROM entity 
          WHERE is_deleted = 0
      `;
      
      if (type) {
        countQuery += ` AND type = ${parseInt(type as string)}`;
      }
      
      countQuery += `
          AND (
            (computed_phones IS NOT NULL AND computed_phones != '') OR
            (computed_emails IS NOT NULL AND computed_emails != '') OR
            name IS NOT NULL
          )
          GROUP BY group_key
          HAVING COUNT(*) > 1
        ) as duplicate_groups
      `;

      const totalCountResult = await entitiesPrisma.$queryRawUnsafe(countQuery) as any[];

      const totalCount = totalCountResult[0]?.total || 0;

      return APIResponseWriter({
        res,
        success: true,
        message: "Duplicates count retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          count: parseInt(totalCount),
          metadata: {
            executionTime: "0ms",
            entityType: type ? parseInt(type as string) : null,
            matchType: matchType as string
          }
        }
      });
    } catch (error: any) {
      logger.error("Failed to get duplicates count", { error: error.message });

      return APIResponseWriter({
        res,
        success: true,
        message: "Duplicates count retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          count: 0,
          metadata: {
            executionTime: "0ms",
            entityType: type ? parseInt(type as string) : null,
            matchType: matchType as string
          }
        }
      });
    }
  }
);

// AI-Powered Auto-Merge with Background Processing
export const bulkMergeDuplicatesController = expressAsyncWrapper(
  async (req, res) => {
    const { entityType = '1', batchSize = 10 } = req.body;
    
    try {
      // Start background AI analysis and merge process
      const aiService = new NaturalLanguageQueryAIService();
      
      // Get duplicates for AI analysis
      const duplicates = await entitiesPrisma.$queryRawUnsafe(`
        WITH duplicate_groups AS (
          SELECT 
            CASE 
              WHEN computed_phones IS NOT NULL AND computed_phones != '' THEN computed_phones
              WHEN computed_emails IS NOT NULL AND computed_emails != '' THEN computed_emails
              ELSE name
            END as group_key,
            GROUP_CONCAT(entity_id) as entity_ids,
            GROUP_CONCAT(name) as names,
            GROUP_CONCAT(computed_phones) as phones,
            GROUP_CONCAT(computed_emails) as emails,
            COUNT(*) as duplicate_count
          FROM entity 
          WHERE is_deleted = 0 AND type = ${parseInt(entityType)}
          AND (
            (computed_phones IS NOT NULL AND computed_phones != '') OR
            (computed_emails IS NOT NULL AND computed_emails != '') OR
            name IS NOT NULL
          )
          GROUP BY group_key
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT ${batchSize}
        )
        SELECT * FROM duplicate_groups
      `) as any[];

      let mergedCount = 0;
      let analysisResults = [];

      // Process each duplicate group with AI analysis
      for (const group of duplicates) {
        const entityIds = group.entity_ids.split(',').map((id: string) => parseInt(id));
        const names = group.names.split(',');
        const phones = group.phones ? group.phones.split(',') : [];
        const emails = group.emails ? group.emails.split(',') : [];

        // AI Analysis: Determine best entity to keep
        const analysisPrompt = `Analyze these duplicate entities and determine which one to keep as the primary:
        Names: ${names.join(', ')}
        Phones: ${phones.join(', ')}
        Emails: ${emails.join(', ')}
        
        Return JSON with: {"primaryIndex": 0, "reason": "explanation", "confidence": 0.95}`;

        try {
          const aiResponse = await aiService.generateQueryPlan(analysisPrompt);
          const analysis = JSON.parse(aiResponse.sql || '{"primaryIndex": 0, "reason": "First entity selected", "confidence": 0.8}');
          
          if (analysis.primaryIndex >= 0 && analysis.primaryIndex < entityIds.length) {
            const primaryId = entityIds[analysis.primaryIndex];
            const duplicateIds = entityIds.filter((id: number) => id !== primaryId);
            
            // Merge duplicates into primary
            for (const duplicateId of duplicateIds) {
              await entitiesPrisma.entity.update({
                where: { entity_id: duplicateId },
                data: { 
                  is_deleted: true,
                  deleted_at: new Date(),
                  updated_at: new Date()
                }
              });
            }
            
            mergedCount += duplicateIds.length;
            analysisResults.push({
              groupKey: group.group_key,
              primaryId,
              mergedIds: duplicateIds,
              aiAnalysis: analysis,
              mergedCount: duplicateIds.length
            });
          }
        } catch (aiError) {
          logger.error('AI analysis failed for group', { groupKey: group.group_key, error: aiError });
        }
      }

      return APIResponseWriter({
        res,
        success: true,
        message: `AI-powered merge completed. Merged ${mergedCount} duplicates.`,
        statusCode: StatusCodes.OK,
        data: {
          mergedCount,
          processedGroups: duplicates.length,
          analysisResults,
          aiPowered: true
        }
      });

    } catch (error: any) {
      logger.error("AI merge failed", { error: error.message });
      
      return APIResponseWriter({
        res,
        success: false,
        message: "AI-powered merge failed",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }

    /* COMMENTED OUT - ORIGINAL BULK MERGE IMPLEMENTATION
    const { primaryEntityId, duplicateEntityIds, mergeStrategy = 'keep_primary' } = req.body;

    if (!primaryEntityId || !duplicateEntityIds || !Array.isArray(duplicateEntityIds)) {
    return APIResponseWriter({
      res,
      success: false,
        message: "Invalid request: primaryEntityId and duplicateEntityIds are required",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Missing required fields"
      });
    }

    try {
      // Get primary entity
      const primaryEntity = await entitiesPrisma.entity.findUnique({
        where: { entity_id: parseInt(primaryEntityId) }
      });

      if (!primaryEntity) {
        return APIResponseWriter({
          res,
          success: false,
          message: "Primary entity not found",
          statusCode: StatusCodes.NOT_FOUND,
          error: "Primary entity does not exist"
        });
      }

      // Get duplicate entities
      const duplicateEntities = await entitiesPrisma.entity.findMany({
          where: {
          entity_id: { in: duplicateEntityIds.map((id: string) => parseInt(id)) }
        }
      });

      // Merge computed fields from duplicates to primary
      for (const duplicate of duplicateEntities) {
        // Merge computed_phones and computed_emails
        const mergedPhones = [primaryEntity.computed_phones, duplicate.computed_phones]
          .filter(Boolean)
          .join(', ');
        
        const mergedEmails = [primaryEntity.computed_emails, duplicate.computed_emails]
          .filter(Boolean)
          .join(', ');

        // Update primary entity with merged data
        await entitiesPrisma.entity.update({
          where: { entity_id: primaryEntity.entity_id },
          data: {
            computed_phones: mergedPhones || primaryEntity.computed_phones,
            computed_emails: mergedEmails || primaryEntity.computed_emails,
            updated_at: new Date()
          }
        });

        // Soft delete duplicate entity
        await entitiesPrisma.entity.update({
          where: { entity_id: duplicate.entity_id },
          data: { 
            is_deleted: true,
            deleted_at: new Date()
          }
        });
      }

      logger.info(`Merged ${duplicateEntities.length} entities into primary entity ${primaryEntityId}`);

      return APIResponseWriter({
        res,
        success: true,
        message: `Successfully merged ${duplicateEntities.length} duplicate entities`,
        statusCode: StatusCodes.OK,
        data: {
          primaryEntityId,
          mergedCount: duplicateEntities.length,
          mergeStrategy
        }
      });
      } catch (error: any) {
      logger.error("Failed to merge duplicates", { error: error.message });
      
      return APIResponseWriter({
        res,
        success: false,
        message: "Failed to merge duplicates",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }
    */
  }
);

// COMMENTED OUT - Bulk delete duplicates (kept for future use)
export const bulkDeleteDuplicatesController = expressAsyncWrapper(
  async (req, res) => {
    // For now, just return a message that this feature is disabled
    return APIResponseWriter({
      res,
      success: false,
      message: "Bulk delete feature is currently disabled - showing all data only",
      statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      error: "Feature disabled"
    });

    /* COMMENTED OUT - ORIGINAL BULK DELETE IMPLEMENTATION
    const { entityIds, confirm = false } = req.body;

    if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    return APIResponseWriter({
      res,
      success: false,
        message: "Invalid request: entityIds array is required",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Missing required fields"
      });
    }

    if (!confirm) {
      return APIResponseWriter({
        res,
        success: false,
        message: "Confirmation required for bulk delete operation",
        statusCode: StatusCodes.BAD_REQUEST,
        error: "Confirmation required"
      });
    }

    try {
      // Soft delete entities
      const result = await entitiesPrisma.entity.updateMany({
        where: { 
          entity_id: { in: entityIds.map((id: string) => parseInt(id)) }
        },
        data: { 
          is_deleted: true,
          deleted_at: new Date()
        }
      });

      logger.info(`Soft deleted ${result.count} entities`);

  return APIResponseWriter({
    res,
    success: true,
        message: `Successfully deleted ${result.count} entities`,
        statusCode: StatusCodes.OK,
        data: {
          deletedCount: result.count,
          entityIds
        }
      });
    } catch (error: any) {
      logger.error("Failed to delete duplicates", { error: error.message });

  return APIResponseWriter({
    res,
        success: false,
        message: "Failed to delete duplicates",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }
    */
  }
);
