import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidAdmin } from "./_auth.js";
import { getSupabaseAdmin } from "../_supabaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isValidAdmin(req)) return res.status(401).json({ error: "unauthorized" });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("subscription_requests")
    .select("*, users(email, full_name)")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: "server_error" });

  // The "screenshots" bucket is private, so generate a short-lived signed URL
  // for each request's screenshot rather than exposing a permanent public link.
  const withSignedUrls = await Promise.all(
    (data || []).map(async (r: any) => {
      const { data: signed } = await admin.storage.from("screenshots").createSignedUrl(r.screenshot_url, 3600);
      return { ...r, screenshot_signed_url: signed?.signedUrl || null };
    })
  );

  return res.status(200).json({ requests: withSignedUrls });
}
