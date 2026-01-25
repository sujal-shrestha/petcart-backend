const AuditLog = require("../models/AuditLog");

async function writeAudit(req, action, userId = null, metadata = {}) {
  try {
    await AuditLog.create({
      userId,
      action,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
      metadata,
    });
  } catch (e) {
    // don't crash app if logging fails
    console.error("Audit log error:", e.message);
  }
}

module.exports = { writeAudit };
