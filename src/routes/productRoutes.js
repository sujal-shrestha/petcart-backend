const router = require("express").Router();
const product = require("../controllers/productController");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

// PUBLIC
router.get("/", product.listProducts);

// ADMIN
router.get("/admin", requireAuth, requireAdmin, product.adminListProducts);
router.post("/", requireAuth, requireAdmin, product.createProduct);
router.patch("/:id/toggle", requireAuth, requireAdmin, product.toggleProduct);
router.delete("/:id", requireAuth, requireAdmin, product.deleteProduct);

module.exports = router;
