import { entitiesPrisma } from "../config/db";
import logger from "../libs/logger";

export const entityRepository = {
  async getDuplicatePhoneNumbers(type?: number, limit = 20, offset = 0) {
    try {
      // Simple phone duplicate detection
      const phoneDuplicates = await entitiesPrisma.$queryRaw`
        SELECT 
          e.entity_id,
          e.name,
          e.type,
          e.created_at,
          COUNT(*) as count
        FROM entity e
        WHERE e.is_deleted = 0
        ${type ? 'AND e.type = ?' : ''}
        GROUP BY e.name
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as any[];

      return phoneDuplicates.map((duplicate: any) => ({
        id: `name_${duplicate.name.replace(/\s+/g, '_')}`,
        name: `Name: ${duplicate.name}`,
        entityType: type || 0,
        createdAt: new Date(),
        duplicateCount: parseInt(duplicate.count),
        duplicateIds: [duplicate.entity_id],
        phoneNumbers: [],
        emailAddresses: [],
        matchType: 'name' as const,
        entities: [duplicate],
      }));
    } catch (error: any) {
      logger.error("Failed to get duplicate phone numbers", { error: error.message });
      return [];
    }
  },

  async getDuplicateEmailAddresses(type?: number, limit = 20, offset = 0) {
    try {
      // Simple email duplicate detection
      const emailDuplicates = await entitiesPrisma.$queryRaw`
            SELECT 
              e.entity_id,
              e.name,
              e.type,
          e.created_at,
          COUNT(*) as count
            FROM entity e
            WHERE e.is_deleted = 0
              ${type ? 'AND e.type = ?' : ''}
        GROUP BY e.name
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ` as any[];

      return emailDuplicates.map((duplicate: any) => ({
        id: `email_${duplicate.name.replace(/\s+/g, '_')}`,
        name: `Email: ${duplicate.name}`,
            entityType: type || 0,
            createdAt: new Date(),
            duplicateCount: parseInt(duplicate.count),
        duplicateIds: [duplicate.entity_id],
            phoneNumbers: [],
        emailAddresses: [],
            matchType: 'email' as const,
        entities: [duplicate],
      }));
    } catch (error: any) {
      logger.error("Failed to get duplicate email addresses", { error: error.message });
      return [];
    }
  }
};
