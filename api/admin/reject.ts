import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!isValidAdmin(req)) return res.status(401).json({ error: "unauthorized" });

  const { requestId, reason } = req.body || {};
  if (!requestId) return res.status(400).json({ error: "missing_request_id" });

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("subscription_requests")
    .update({ status: "rejected", reject_reason: reason || null, reviewed_by: "admin", reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending_review");

  if (error) return res.status(500).json({ error: "server_error" });
  return res.status(200).json({ success: true });
}
