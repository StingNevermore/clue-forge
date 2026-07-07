import { Hono } from "hono";
import { getHealthController } from "../controllers/health";

export const healthRoutes = new Hono<{ Bindings: CloudflareBindings }>();

healthRoutes.get("/health", getHealthController);
