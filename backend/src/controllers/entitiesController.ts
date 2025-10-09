import { StatusCodes } from "http-status-codes";
import { entitiesPrisma } from "../config/db";
import APIResponseWriter from "../utils/apiResponseWriter";
import expressAsyncWrapper from "../utils/asyncHandler";

export const getAllEntitiesController = expressAsyncWrapper(
  async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    try {
      const whereClause = type ? { type: parseInt(type as string) } : {};
      
      const [entities, total] = await Promise.all([
        entitiesPrisma.entity.findMany({
          where: whereClause,
          skip: offset,
          take: limitNum,
          orderBy: { created_at: 'desc' }
        }),
        entitiesPrisma.entity.count({ where: whereClause })
      ]);

      return APIResponseWriter({
        res,
        success: true,
        message: "Entities retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          entities,
          pagination: {
            page: pageNum,
            pageSize: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1
          }
        }
      });
    } catch (error: any) {
      return APIResponseWriter({
        res,
        success: false,
        message: "Failed to retrieve entities",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }
  }
);

export const getEntityStatsController = expressAsyncWrapper(
  async (req, res) => {
    try {
      const [totalEntities, organizations, people, deleted] = await Promise.all([
        entitiesPrisma.entity.count(),
        entitiesPrisma.entity.count({ where: { type: 1 } }),
        entitiesPrisma.entity.count({ where: { type: 2 } }),
        entitiesPrisma.entity.count({ where: { is_deleted: true } })
      ]);

      return APIResponseWriter({
        res,
        success: true,
        message: "Entity statistics retrieved successfully",
        statusCode: StatusCodes.OK,
        data: {
          total: totalEntities,
          organizations,
          people,
          deleted,
          active: totalEntities - deleted
        }
      });
    } catch (error: any) {
      return APIResponseWriter({
        res,
        success: false,
        message: "Failed to retrieve entity statistics",
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        error: error.message
      });
    }
  }
);
