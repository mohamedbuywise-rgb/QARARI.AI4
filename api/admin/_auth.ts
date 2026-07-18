import type { VercelRequest } from "@vercel/node";

// Simple single-admin gate for MVP purposes (Section 15). The admin frontend
// stores the username/password in sessionStorage after a successful check
// and re-sends them as headers on every admin API call.
export function isValidAdmin(req: VercelRequest): boolean {
  const username = req.headers["x-admin-username"];
  const password = req.headers["x-admin-password"];
  return (
    typeof username === "string" &&
    typeof password === "string" &&
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  );
}
