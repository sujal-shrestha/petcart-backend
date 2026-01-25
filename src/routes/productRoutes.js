const router = require("express").Router();
const product = require("../controllers/productController");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

// Public
router.get("/", product.listProducts);

// Admin
router.post("/", requireAuth, requireAdmin, product.createProduct);

module.exports = router;
