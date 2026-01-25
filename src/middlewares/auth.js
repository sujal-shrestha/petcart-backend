// src/middlewares/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    // 1) Try cookie first
    let token = req.cookies?.accessToken;

    // 2) Fallback: Authorization header (Bearer)
    if (!token) {
      const auth = req.headers.authorization || "";
      if (auth.startsWith("Bearer ")) token = auth.slice(7);
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (!payload?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
