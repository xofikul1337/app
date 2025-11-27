const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// ===== FIXED: FRONTEND ORIGIN HARDCODED =====
const FRONTEND_ORIGIN = "http://localhost:5173";  // <-- slash বাদ

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const THOR_USER_ID = process.env.THOR_USER_ID;
const THOR_API_KEY = process.env.KEY_DATA;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();

const upload = multer({
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
});

// ===== CLEAN CORS =====
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  })
);

// Allow OPTIONS requests
app.options("*", cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== SIMPLE API KEY CHECK =====
function requireApiKey(req, res, next) {
  const key = req.header("X-API-Key");
  if (!key || key !== THOR_API_KEY) {
    return res.status(401).json({ success: false, message: "Invalid API key" });
  }
  next();
}

// Test route
app.get("/", (req, res) => {
  res.json({ ok: true, message: "THOR backend running" });
});

// ===== HEALTH LOG =====
app.post("/api/health", requireApiKey, upload.none(), async (req, res) => {
  try {
    const { weight, body_fat, energy, mood, libido } = req.body;

    const data = {
      log_date: new Date().toISOString().slice(0, 10),
      weight_lbs: parseFloat(weight),
      body_fat_percent: parseFloat(body_fat),
      energy_level: parseInt(energy),
      mood_score: parseInt(mood),
      libido_score: parseInt(libido),
    };

    const { error } = await supabase.from("daily_health_logs").insert([data]);

    if (error) {
      console.error("Supabase error /api/health:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Health logged!" });
  } catch (err) {
    console.error("Error /api/health:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ===== TRAINING =====
app.post("/api/training", requireApiKey, upload.none(), async (req, res) => {
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
      duration_minutes: parseInt(duration_minutes),
      intensity_level: parseInt(intensity_level),
      recovery_score: parseInt(recovery_score),
      volume_adjustment_percent: parseInt(volume_adjustment_percent) || 100,
      notes: notes || "",
    };

    const { error } = await supabase.from("training_workouts").insert([data]);

    if (error) {
      console.error("Supabase error /api/training:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Workout logged!" });
  } catch (err) {
    console.error("Error /api/training:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ===== INJECTION =====
app.post("/api/injection", requireApiKey, upload.none(), async (req, res) => {
  try {
    const { compound_name, dose_amount, injection_site } = req.body;

    const data = {
      injection_date: new Date().toISOString().slice(0, 10),
      compound_name,
      dose_amount: parseFloat(dose_amount),
      injection_site,
    };

    const { error } = await supabase.from("protocol_injections").insert([data]);

    if (error) {
      console.error("Supabase error /api/injection:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json({ success: true, message: "Injection logged!" });
  } catch (err) {
    console.error("Error /api/injection:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ===== LAB UPLOAD =====
app.post(
  "/api/lab-upload",
  requireApiKey,
  upload.single("file"),
  async (req, res) => {
    try {
      const { lab_date } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ success: false, message: "No file" });
      if (!file.originalname.toLowerCase().endsWith(".pdf"))
        return res.status(400).json({ success: false, message: "Only PDF allowed" });

      const filePath = `labs/${Date.now()}_${file.originalname}`;

      const uploadResult = await supabase.storage
        .from("files")
        .upload(filePath, file.buffer, { contentType: "application/pdf" });

      if (uploadResult.error) {
        console.error("Supabase storage error:", uploadResult.error);
        return res.status(500).json({ success: false, message: "Upload failed" });
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("files").getPublicUrl(filePath);

      const insertResult = await supabase
        .from("lab_results")
        .insert([{ lab_date, pdf_url: publicUrl }]);

      if (insertResult.error) {
        console.error("Supabase error lab_results insert:", insertResult.error);
        return res.status(500).json({ success: false, message: "DB error" });
      }

      return res.json({ success: true, url: publicUrl, message: "Lab uploaded!" });
    } catch (err) {
      console.error("Error /api/lab-upload:", err);
      return res.status(500).json({ success: false, message: "Failed" });
    }
  }
);

// ===== FETCH HEALTH DATA =====
app.get("/api/health-data", requireApiKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("daily_health_logs")
      .select("*")
      .order("log_date", { ascending: true });

    if (error) {
      console.error("Supabase error /api/health-data:", error);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("Error /api/health-data:", err);
    return res.status(500).json({ success: false, message: "Failed" });
  }
});

// ===== FILE SIZE HANDLER =====
app.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "PDF too large" });
  }
  next(err);
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("THOR backend running at http://localhost:" + PORT);
  });
}

module.exports = app;
