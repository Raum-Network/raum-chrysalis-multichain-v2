import { executeSepoliaCctp } from "../server/services/sepoliaExecutor.js";
import { randomUUID } from "crypto";

const json = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return typeof req.body === "object" ? req.body : {};
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { success: false, error: "Method not allowed" });
  }

  const body = parseBody(req);
  const requestId = body.requestId || randomUUID();

  try {
    console.info("[API] Sepolia execution requested:", requestId);
    const result = await executeSepoliaCctp({ ...body, requestId });
    return json(res, 201, { success: true, ...result });
  } catch (error) {
    console.error(
      "[API] Sepolia execution error:",
      requestId,
      error instanceof Error ? error.message : error
    );
    return json(res, 500, {
      success: false,
      requestId,
      error: error instanceof Error ? error.message : "Sepolia execution failed",
    });
  }
}
