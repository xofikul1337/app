const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("[health.js] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }

    console.log("[health.js] RAW BODY FROM HEALTH AUTO EXPORT:", raw);

    // আপাতত কিছুই insert করছি না, শুধু accept করছি
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[health.js] Error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
