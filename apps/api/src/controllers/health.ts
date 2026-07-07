import type { Context } from "hono";
import { getHealth } from "../services/health";

export const getHealthController = (context: Context) =>
	context.json(getHealth());
