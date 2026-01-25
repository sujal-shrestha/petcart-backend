const Product = require("../models/Product");

// PUBLIC: list products
exports.listProducts = async (req, res) => {
  try {
    const { q, category } = req.query;

    const filter = { isActive: true };
    if (category && category !== "All") filter.category = category;

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ products });
  } catch (e) {
    res.status(500).json({ message: "Failed to load products." });
  }
};

// ADMIN: create product
exports.createProduct = async (req, res) => {
  try {
    const { name, description, category, price, imageUrl, stock } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ message: "Name and price are required." });
    }

    const product = await Product.create({
      name,
      description: description || "",
      category: category || "Other",
      price: Number(price),
      imageUrl: imageUrl || "",
      stock: stock === undefined ? 20 : Number(stock),
    });

    res.status(201).json({ product });
  } catch (e) {
    res.status(400).json({ message: "Invalid product data." });
  }
};
