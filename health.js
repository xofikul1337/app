// health.js

const { createClient } = require("@supabase/supabase-js");

// 🔐 Supabase backend client – service role key (backend only)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[health.js] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = async (req, res) => {
  // Allow only POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    let body = req.body;

    // If body not parsed (sometimes on Vercel), manual parse fallback
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

    const payload = Array.isArray(body) ? body : [body];

    const rows = [];

    for (const item of payload) {
      // 🔑 User mapping: expect uid in body
      const userId = item.user_id || item.uid || item.id;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error:
            "Missing user_id (or uid/id) in payload. Please include your THOR User UID.",
        });
      }

      rows.push({
        user_id: userId, // 👈 এখানে auth UID বসবে
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

    const { data, error } = await supabase.from("health_data").insert(rows);

    if (error) {
      console.error("[health.js] Supabase insert error:", error);
      return res
        .status(400)
        .json({ success: false, error: error.message || "Insert failed" });
    }

    return res
      .status(201)
      .json({ success: true, inserted: data ? data.length : 0 });
  } catch (err) {
    console.error("[health.js] Server error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Server error in /api/health-data" });
  }
};
