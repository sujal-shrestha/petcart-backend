const router = require("express").Router();
const { requireAuth, requireAdmin } = require("../middlewares/auth");
const auditController = require("../controllers/auditController");

// GET /api/admin/audit-logs (admin only)
router.get(
  "/audit-logs",
  requireAuth,
  requireAdmin,
  auditController.getAuditLogs
);

module.exports = router;
