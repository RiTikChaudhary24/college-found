import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
const router = Router();
const makeToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = u => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "Email is already registered." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: makeToken(user._id), user: publicUser(user) });
  } catch (e) { next(e); }
});
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.password)))
      return res.status(401).json({ message: "Incorrect email or password." });
    res.json({ token: makeToken(user._id), user: publicUser(user) });
  } catch (e) { next(e); }
});
// Always returns the latest role from the database.
router.get("/me", protect, (req, res) => res.json({ user: publicUser(req.user) }));
export default router;
