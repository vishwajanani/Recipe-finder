const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const axios = require("axios");
const User = require("./models/User"); // Replace with your User model

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/foodDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Signup route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists. Please log in." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword });

  try {
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found. Please register." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials. Please try again." });
  }

  const token = jwt.sign({ userId: user._id }, "your_jwt_secret", {
    expiresIn: "1h",
  });

  res.json({ token, message: "Login successful" });
});

// Forgot password route
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "No account found with that email" });
  }

  const resetToken = jwt.sign({ userId: user._id }, "your_jwt_secret", { expiresIn: "1h" });
  const resetTokenExpiry = Date.now() + 3600000;

  user.resetToken = resetToken;
  user.resetTokenExpiry = resetTokenExpiry;
  await user.save();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "kanmanipriyas.22cse@kongu.edu",
      pass: "rncd cmmp ixyg plif",
    },
    tls: { rejectUnauthorized: false },
  });

  const mailOptions = {
    from: "kanmanipriyas.22cse@kongu.edu",
    to: email,
    subject: "Password Reset Link",
    text: `You requested a password reset. Click the link to reset your password: 
    http://localhost:5173/reset-password/${resetToken}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error sending reset link:", error);
    res.status(500).json({ message: "Error sending reset link" });
  }
});

// Reset password route
app.post("/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    const decoded = jwt.verify(resetToken, "your_jwt_secret");
    const user = await User.findOne({ _id: decoded.userId, resetToken });

    if (!user || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password successfully reset" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while resetting the password" });
  }
});

// Recipe fetching route using TheMealDB API
app.get("/api/recipes", async (req, res) => {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=Arrabiata`;

  try {
    const response = await axios.get(url);
    const recipes = response.data.meals.map((meal) => ({
      id: meal.idMeal,
      name: meal.strMeal,
      category: meal.strCategory,
      instructions: meal.strInstructions,
      imageUrl: meal.strMealThumb,
    }));
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recipes" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
