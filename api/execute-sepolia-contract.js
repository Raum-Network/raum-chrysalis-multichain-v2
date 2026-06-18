import { executeSepoliaCctp } from "../server/services/sepoliaExecutor.js";

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

  try {
    const result = await executeSepoliaCctp(parseBody(req));
    return json(res, 201, { success: true, ...result });
  } catch (error) {
    return json(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Sepolia execution failed",
    });
  }
}
