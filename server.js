

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
 
    const userId =
      (req.query && (req.query.user_id || req.query.uid || req.query.id)) ||
      null;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing user_id query parameter. Example: /api/health-data?user_id=YOUR_THOR_UID",
      });
    }

 
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }

    console.log("========== [THOR Health Webhook] ==========");
    console.log("User ID from query:", userId);
    console.log("Raw body from Health Auto Export:");
    console.log(raw);
    console.log("===========================================");

  

    return res.status(200).json({
      success: true,
      received: true,
    });
  } catch (err) {
    console.error("[health.js] Error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error in /api/health-data",
    });
  }
};
