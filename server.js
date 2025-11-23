// server.js  (root of backend repo)

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// ======== Supabase credentials from ENV (Vercel) ========
// এগুলো Vercel-এর Environment Variables এ সেট করবে
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const THOR_USER_ID = process.env.THOR_USER_ID; // training_workouts-এর user_id

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    "⚠️ SUPABASE_URL or SUPABASE_SERVICE_KEY is missing. Set them in Vercel Environment Variables."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
const upload = multer(); // in-memory storage

// ---------- Middleware ----------
app.use(
  cors({
    origin: "*", // আলাদা frontend ডোমেইন থেকেও কল করা যাবে
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Simple health check ----------
app.get("/", (req, res) => {
  res.json({ ok: true, message: "THOR backend running" });
});

// ---------- 1) Daily Health Log ----------
app.post("/api/health", upload.none(), async (req, res) => {
  try {
    const { weight, body_fat, energy, mood, libido } = req.body;

    const data = {
      log_date: new Date().toISOString().slice(0, 10),
      weight_lbs: weight ? parseFloat(weight) : null,
      body_fat_percent: body_fat ? parseFloat(body_fat) : null,
      energy_level: parseInt(energy, 10),
      mood_score: parseInt(mood, 10),
      libido_score: parseInt(libido, 10),
    };

    const { error } = await supabase.from("daily_health_logs").insert([data]);
    if (error) {
      console.error("Supabase error /api/health:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Health logged!" });
  } catch (err) {
    console.error("Backend error /api/health:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ---------- 2) Training Workout Log ----------
app.post("/api/training", upload.none(), async (req, res) => {
  try {
    const {
      workout_name,
      workout_type,
      duration_minutes,
      intensity_level,
      recovery_score,
      volume_adjustment_percent,
      notes,
    } = req.body;

    const data = {
      user_id: THOR_USER_ID,
      workout_date: new Date().toISOString().slice(0, 10),
      workout_name,
      workout_type,
      duration_minutes: duration_minutes
        ? parseInt(duration_minutes, 10)
        : null,
      intensity_level: parseInt(intensity_level, 10),
      recovery_score: parseInt(recovery_score, 10),
      volume_adjustment_percent: volume_adjustment_percent
        ? parseInt(volume_adjustment_percent, 10)
        : 100,
      notes: notes || "",
    };

    const { error } = await supabase.from("training_workouts").insert([data]);
    if (error) {
      console.error("Supabase error /api/training:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Workout logged!" });
  } catch (err) {
    console.error("Backend error /api/training:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ---------- 3) Injection Log ----------
app.post("/api/injection", upload.none(), async (req, res) => {
  try {
    const { compound_name, dose_amount, injection_site } = req.body;

    const data = {
      injection_date: new Date().toISOString().slice(0, 10),
      compound_name,
      dose_amount: parseFloat(dose_amount),
      injection_site,
    };

    const { error } = await supabase
      .from("protocol_injections")
      .insert([data]);
    if (error) {
      console.error("Supabase error /api/injection:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Injection logged!" });
  } catch (err) {
    console.error("Backend error /api/injection:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ---------- 4) Lab PDF Upload ----------
app.post(
  "/api/lab-upload",
  upload.single("file"), // React FormData-এর 'file' field
  async (req, res) => {
    try {
      const { lab_date } = req.body;
      const file = req.file;

      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      if (!file.originalname.toLowerCase().endsWith(".pdf")) {
        return res
          .status(400)
          .json({ success: false, message: "Only PDF allowed" });
      }

      const filePath = `labs/${cryptoRandom()}_${file.originalname}`;

      // Supabase storage bucket 'files' এ upload
      const { error: uploadError } = await supabase.storage
        .from("files")
        .upload(filePath, file.buffer, {
          contentType: "application/pdf",
        });

      if (uploadError) {
        console.error("Supabase storage error:", uploadError);
        return res
          .status(500)
          .json({ success: false, message: "Upload failed" });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("files").getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("lab_results")
        .insert([{ lab_date, pdf_url: publicUrl }]);

      if (insertError) {
        console.error("Supabase error /lab_results:", insertError);
        return res
          .status(500)
          .json({ success: false, message: "DB insert failed" });
      }

      return res.json({
        success: true,
        url: publicUrl,
        message: "Lab uploaded!",
      });
    } catch (err) {
      console.error("Backend error /api/lab-upload:", err);
      return res.status(500).json({ success: false, message: "Failed" });
    }
  }
);

// ---------- 5) Health data for chart ----------
app.get("/api/health-data", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_health_logs")
      .select("*")
      .order("log_date", { ascending: true });

    if (error) {
      console.error("Supabase error /api/health-data:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    const rows = (data || []).map((row) => ({
      ...row,
      weight: row.weight ?? row.weight_lbs ?? null,
    }));

    return res.json(rows);
  } catch (err) {
    console.error("Backend error /api/health-data:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ---------- helper: random string ----------
function cryptoRandom() {
  return Math.random().toString(36).slice(2);
}

// ---------- Local dev server (for localhost) ----------
const PORT = process.env.PORT || 8000;

// এই if ব্লক থাকার জন্য:
// - লোকালিতে `node server.js` চালালে listen করবে
// - Vercel যখন serverless হিসেবে লোড করবে তখন শুধু module.exports ব্যবহার করবে, listen করবে না
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`THOR Node backend running at http://localhost:${PORT}`);
  });
}

// Vercel @vercel/node এর জন্য Express app export
module.exports = app;
