const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const THOR_USER_ID = process.env.THOR_USER_ID;

const THOR_API_KEY = process.env.THOR_API_KEY || null;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    "Supabase key missing"
  );
}

if (!THOR_API_KEY) {
  console.warn(
    "thor key is not set"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();

const upload = multer({
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
});

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-thor-api-key"],
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-thor-api-key"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function requireApiKey(req, res, next) {
  if (!THOR_API_KEY) {
    return next();
  }

  const clientKey = req.headers["x-thor-api-key"];
  if (!clientKey || clientKey !== THOR_API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({ ok: true, message: "THOR backend running" });
});

app.post("/api/health", requireApiKey, upload.none(), async (req, res) => {
  try {
    const { weight, body_fat, energy, mood, libido } = req.body;

    const data = {
      log_date: new Date().toISOString().slice(0, 10),
      weight_lbs: weight ? parseFloat(weight) : null,
      body_fat_percent: body_fat ? parseFloat(body_fat) : null,
      energy_level: energy != null ? parseInt(energy, 10) : null,
      mood_score: mood != null ? parseInt(mood, 10) : null,
      libido_score: libido != null ? parseInt(libido, 10) : null,
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
      duration_minutes: duration_minutes
        ? parseInt(duration_minutes, 10)
        : null,
      intensity_level:
        intensity_level != null ? parseInt(intensity_level, 10) : null,
      recovery_score:
        recovery_score != null ? parseInt(recovery_score, 10) : null,
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

app.post("/api/injection", requireApiKey, upload.none(), async (req, res) => {
  try {
    const { compound_name, dose_amount, injection_site } = req.body;

    const data = {
      injection_date: new Date().toISOString().slice(0, 10),
      compound_name,
      dose_amount: dose_amount != null ? parseFloat(dose_amount) : null,
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

app.post(
  "/api/lab-upload",
  requireApiKey,
  upload.single("file"),
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

      if (!lab_date) {
        return res
          .status(400)
          .json({ success: false, message: "lab_date is required" });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(lab_date)) {
        return res.status(400).json({
          success: false,
          message: "lab_date must be in YYYY-MM-DD format",
        });
      }

      const safeOriginalName = path
        .basename(file.originalname)
        .replace(/[^\w.\-]/g, "_");

      const filePath = `labs/${cryptoRandom()}_${safeOriginalName}`;

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

function cryptoRandom() {
  return crypto.randomBytes(16).toString("hex");
}

app.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    console.error("Multer file size limit reached");
    return res
      .status(413)
      .json({ success: false, message: "PDF too large (max 4MB)" });
  }
  next(err);
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`THOR Node backend running at http://localhost:${PORT}`);
  });
}

module.exports = app;
