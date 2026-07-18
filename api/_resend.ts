export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[Resend] Missing RESEND_API_KEY");
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Qarari.AI <onboarding@resend.dev>", // replace with a verified domain sender once one is set up
        to: [to],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[Resend] Failed to send email:", e);
  }
}
