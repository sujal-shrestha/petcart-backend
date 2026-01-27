const Product = require("../models/Product");

// helpers
const toNumberOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const cleanStr = (v, max = 200) => {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
};

// ✅ PUBLIC: list products
exports.listProducts = async (req, res) => {
  try {
    const { q, category } = req.query;

    const filter = { isActive: true };

    if (category && category !== "All") {
      filter.category = category;
    }

    if (q && String(q).trim()) {
      const query = String(q).trim();
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    return res.json({ products });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load products." });
  }
};

// ✅ PUBLIC: get single product
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, isActive: true });
    if (!product) return res.status(404).json({ message: "Product not found." });

    return res.json({ product });
  } catch (e) {
    return res.status(400).json({ message: "Invalid product id." });
  }
};

// ✅ ADMIN: create product
exports.createProduct = async (req, res) => {
  try {
    const name = cleanStr(req.body?.name, 120);
    const description = cleanStr(req.body?.description, 1200);
    const category = cleanStr(req.body?.category, 40) || "Other";

    const price = toNumberOrNull(req.body?.price);
    const stock = req.body?.stock === undefined ? 20 : toNumberOrNull(req.body?.stock);

    // support either imageUrl or imageUrl coming from frontend
    const imageUrl = cleanStr(req.body?.imageUrl || req.body?.image || "", 600);

    if (!name) return res.status(400).json({ message: "Name is required." });
    if (price === null || price < 0) return res.status(400).json({ message: "Valid price is required." });
    if (stock === null || stock < 0) return res.status(400).json({ message: "Valid stock is required." });

    const product = await Product.create({
      name,
      description,
      category,
      price,
      imageUrl,
      stock,
      isActive: true,
    });

    return res.status(201).json({ product });
  } catch (e) {
    return res.status(400).json({ message: "Invalid product data." });
  }
};

// ✅ ADMIN: update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const updates = {};

    if (typeof req.body?.name === "string") {
      const name = cleanStr(req.body.name, 120);
      if (!name) return res.status(400).json({ message: "Name cannot be empty." });
      updates.name = name;
    }

    if (typeof req.body?.description === "string") {
      updates.description = cleanStr(req.body.description, 1200);
    }

    if (typeof req.body?.category === "string") {
      updates.category = cleanStr(req.body.category, 40) || "Other";
    }

    if (req.body?.price !== undefined) {
      const price = toNumberOrNull(req.body.price);
      if (price === null || price < 0) return res.status(400).json({ message: "Valid price is required." });
      updates.price = price;
    }

    if (req.body?.stock !== undefined) {
      const stock = toNumberOrNull(req.body.stock);
      if (stock === null || stock < 0) return res.status(400).json({ message: "Valid stock is required." });
      updates.stock = stock;
    }

    if (req.body?.imageUrl !== undefined || req.body?.image !== undefined) {
      updates.imageUrl = cleanStr(req.body.imageUrl || req.body.image || "", 600);
    }

    // Optional: allow admin to toggle active
    if (req.body?.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No changes provided." });
    }

    const updated = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Product not found." });

    return res.json({ product: updated });
  } catch (e) {
    return res.status(400).json({ message: "Invalid product update." });
  }
};

// ✅ ADMIN: delete product (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Product not found." });

    return res.json({ message: "Product removed (deactivated).", product: updated });
  } catch (e) {
    return res.status(400).json({ message: "Invalid product id." });
  }
};

// ADMIN: list products (includes inactive)
exports.adminListProducts = async (req, res) => {
  try {
    const { q, category, active } = req.query;

    const filter = {};

    if (category && category !== "All") {
      filter.category = category;
    }

    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.json({ products });
  } catch (e) {
    res.status(500).json({ message: "Failed to load admin products." });
  }
};

// ADMIN: toggle publish / unpublish
exports.toggleProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({ message: "Product updated.", product });
  } catch (e) {
    res.status(400).json({ message: "Failed to update product." });
  }
};

// ADMIN: delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ message: "Product deleted." });
  } catch (e) {
    res.status(400).json({ message: "Failed to delete product." });
  }
};

