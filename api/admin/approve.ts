import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";
import { sendEmail } from "../_resend.js";

const MONTHLY_DAYS = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!isValidAdmin(req)) return res.status(401).json({ error: "unauthorized" });

  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ error: "missing_request_id" });

  const admin = getSupabaseAdmin();

  const { data: reqRow, error: reqErr } = await admin
    .from("subscription_requests")
    .select("*, users(id, email)")
    .eq("id", requestId)
    .single();

  if (reqErr || !reqRow) return res.status(404).json({ error: "request_not_found" });
  if (reqRow.status !== "pending_review") return res.status(409).json({ error: "already_reviewed" });

  const now = new Date();
  const days = MONTHLY_DAYS;
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Section 16: server-computed dates, extends/restarts on renewal
  const { data: beforeUser } = await admin.from("users").select("*").eq("id", reqRow.user_id).single();

  await admin
    .from("users")
    .update({
      tier: "premium",
      subscription_start_date: now.toISOString(),
      subscription_end_date: endDate.toISOString(),
    })
    .eq("id", reqRow.user_id);

  await admin
    .from("subscription_requests")
    .update({ status: "approved", reviewed_by: "admin", reviewed_at: now.toISOString() })
    .eq("id", requestId);

  // Section 24: audit log
  await admin.from("admin_audit_log").insert({
    admin_identity: "admin",
    action_type: "approve_subscription",
    target_user_id: reqRow.user_id,
    before_value: beforeUser,
    after_value: { tier: "premium", subscription_end_date: endDate.toISOString() },
  });

  if (reqRow.users?.email) {
    await sendEmail(
      reqRow.users.email,
      "تم تفعيل اشتراك بريميوم — Qarari.AI",
      `<p>تم تفعيل اشتراكك في بريميوم بنجاح! صالح حتى ${endDate.toLocaleDateString("ar-EG")}.</p>
       <p>Your Premium subscription is now active until ${endDate.toDateString()}.</p>`
    );
  }

  return res.status(200).json({ success: true });
}
