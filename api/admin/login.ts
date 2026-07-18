import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!isValidAdmin(req)) return res.status(401).json({ error: "invalid_credentials" });
  return res.status(200).json({ success: true });
}
