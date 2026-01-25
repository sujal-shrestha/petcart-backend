const router = require("express").Router();
const Product = require("../models/Product");

router.post("/products", async (req, res) => {
  await Product.deleteMany();

  const products = await Product.insertMany([
    {
      name: "Organic Dog Treats",
      description: "Healthy chicken treats for dogs",
      price: 9.99,
      category: "Dog",
      imageUrl: "/uploads/dogtreats.png",
    },
    {
      name: "Cat Scratching Post",
      description: "Save your sofa 😼",
      price: 29.99,
      category: "Cat",
      imageUrl: "/uploads/cat.png",
    },
    {
      name: "Pet Grooming Kit",
      description: "Brush, nail clipper & comb",
      price: 19.99,
      category: "Grooming",
      imageUrl: "/uploads/groom.png",
    },
    {
      name: "Pet Shampoo",
      description: "Gentle & chemical-free",
      price: 12.5,
      category: "Care",
      imageUrl: "/uploads/image.png",
    },
  ]);

  res.json({ count: products.length, products });
});

module.exports = router;
