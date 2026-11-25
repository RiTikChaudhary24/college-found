// Usage: npm run make-admin -- user@example.com
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../src/models/User.js";
dotenv.config();
const email = (process.argv[2] || "").toLowerCase().trim();
if (!email) { console.error("Usage: npm run make-admin -- <email>"); process.exit(1); }
await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
console.log(user ? `${user.email} is now an admin.` : "No user found with that email.");
await mongoose.disconnect();
