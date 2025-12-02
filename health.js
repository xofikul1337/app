// health.js

const { createClient } = require("@supabase/supabase-js");

// 🔐 Supabase backend client – uses SERVICE ROLE KEY (backend only, never frontend)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[health.js] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables."
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    let body = req.body;

    // 🩺 Vercel edge sometimes does not auto-parse JSON → manual fallback
    if (!body || Object.keys(body).length === 0) {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
      }
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch (e) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid JSON body" });
        }
      } else {
        body = {};
      }
    }

    // Support array OR single JSON
    const payload = Array.isArray(body) ? body : [body];
    const rows = [];

    for (const item of payload) {
      // 🔑 Require user_id field from body (uid/id/user_id)
      const userId = item.user_id || item.uid || item.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error:
            "Missing user_id (or uid/id). Please include your THOR User UID in request body.",
        });
      }

      rows.push({
        user_id: userId, // <— Supabase Auth UID
        date: item.date,
        weight: item.weight,
        body_fat_percentage: item.body_fat_percentage,
        energy: item.energy,
        sleep_quality: item.sleep_quality,
        libido: item.libido,
        mental_clarity: item.mental_clarity,
        mood: item.mood,
      });
    }

    // Insert into Supabase table
    const { data, error } = await supabase.from("health_data").insert(rows);

    if (error) {
      console.error("[health.js] Supabase Insert Error:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Insert failed",
      });
    }

    return res.status(201).json({
      success: true,
      inserted: data ? data.length : 0,
    });
  } catch (err) {
    console.error("[health.js] Server Error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error in /api/health-data",
    });
  }
};
