import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdmin, getAuthedUser } from "./_supabaseAdmin.js";
import { sendTelegramAlert } from "./_telegram.js";

const MONTHLY_PRICE = 149;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: "auth_required" });

    const { plan, screenshotUrl } = req.body || {};
    if (plan !== "monthly") {
      return res.status(400).json({ error: "invalid_plan" });
    }
    if (!screenshotUrl || typeof screenshotUrl !== "string") {
      return res.status(400).json({ error: "missing_screenshot" });
    }

    const amount = MONTHLY_PRICE;
    const admin = getSupabaseAdmin();

    // Always created as pending_review — activation happens ONLY via admin
    // approval (Section 15). This endpoint never grants Premium itself.
    const { data, error } = await admin
      .from("subscription_requests")
      .insert({
        user_id: user.id,
        plan,
        amount,
        screenshot_url: screenshotUrl,
        status: "pending_review",
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[/api/subscribe] insert failed:", error);
      return res.status(500).json({ error: "server_error" });
    }

    await sendTelegramAlert(
      `💰 <b>New subscription request</b>\nUser: ${user.email}\nPlan: ${plan}\nAmount: ${amount} EGP\nScreenshot: ${screenshotUrl}`
    );

    return res.status(200).json({ success: true, requestId: data.id });
  } catch (err) {
    console.error("[/api/subscribe] error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
