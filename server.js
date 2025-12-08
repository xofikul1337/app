// api/health-data → health.js

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("[health.js] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    // ✅ Robust query parsing (works even if req.query is undefined)
    const host = req.headers.host || "localhost";
    const fullUrl = new URL(req.url, `https://${host}`);

    const userId =
      fullUrl.searchParams.get("user_id") ||
      fullUrl.searchParams.get("userId") ||
      fullUrl.searchParams.get("uid");

    if (!userId) {
      console.log("[health.js] Missing user_id in query. Full URL:", fullUrl.toString());
      return res.status(400).json({
        success: false,
        error:
          'Missing user_id query parameter. Example: /api/health-data?user_id=YOUR_THOR_UID',
      });
    }

    // Read raw body (Health Auto Export JSON)
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }

    console.log("========== [THOR Health Webhook] ==========");
    console.log("User ID from query:", userId);
    console.log("Request URL:", fullUrl.toString());
    console.log("Raw body from Health Auto Export:");
    console.log(raw);
    console.log("===========================================");

    // For now, just acknowledge. Mapping to Supabase comes next.
    return res.status(200).json({
      success: true,
      received: true,
      user_id: userId,
    });
  } catch (err) {
    console.error("[health.js] Error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error in /api/health-data",
    });
  }
};
