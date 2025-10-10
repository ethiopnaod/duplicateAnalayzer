import { StatusCodes } from "http-status-codes";
import { dmsPrisma, entitiesPrisma } from "../config/db";
import APIResponseWriter from "../utils/apiResponseWriter";
import expressAsyncWrapper from "../utils/asyncHandler";
import { format, formatDuration, intervalToDuration } from "date-fns";

export const checkHealthController = expressAsyncWrapper(async (_, res) => {
  const start = Date.now();

  try {
    await dmsPrisma.$queryRaw`SELECT 1`;
    await entitiesPrisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.warn('Database connection failed, but server is running:', error);
    // Continue with health check even if database is not available
  }

  const latency = Date.now() - start;

  const uptimeSeconds = Math.floor(process.uptime());
  const duration = intervalToDuration({ start: 0, end: uptimeSeconds * 1000 });

  return APIResponseWriter({
    res,
    success: true,
    message: "Server is running",
    statusCode: StatusCodes.OK,
    data: {
      timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      uptime: formatDuration(duration),
      latency: `${latency}ms`,
    },
  });
});
