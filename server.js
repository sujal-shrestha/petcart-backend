const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");


require("dotenv").config();

const connectDB = require("./src/config/db");
const adminAuditRoutes = require("./src/routes/adminAuditRoutes");


const app = express();

// ✅ Stripe webhook MUST be mounted BEFORE express.json()
// const stripeWebhookRoutes = require("./src/routes/stripeWebhookRoutes");
// app.use("/api/stripe", stripeWebhookRoutes);

// ✅ If you're ever behind a proxy (Vercel/Render), cookies behave better with this.
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Logging
app.use(morgan("dev"));

// Body parsing (keep AFTER webhook)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// ✅ CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Static uploads
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    },
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "PawCart API running" });
});

// Routes
const authRoutes = require("./src/routes/authRoutes");
app.use("/api/auth", authRoutes);

const productRoutes = require("./src/routes/productRoutes");
app.use("/api/products", productRoutes);

const seedRoutes = require("./src/routes/seedRoutes");
app.use("/api/seed", seedRoutes);

// (Optional) Keep orders routes only if you're still using non-stripe orders
// If Stripe webhook creates orders, you can remove this later.
const orderRoutes = require("./src/routes/orderRoutes");
app.use("/api/orders", orderRoutes);

// Stripe normal routes (create session, get session)
const stripeRoutes = require("./src/routes/stripeRoutes");
app.use("/api/stripe", stripeRoutes);

app.use("/api/admin", adminAuditRoutes);

// Start
const PORT = 5050;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err.message);
    process.exit(1);
  });
