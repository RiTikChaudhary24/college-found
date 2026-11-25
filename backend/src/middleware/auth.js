import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function userFromRequest(req) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.split(" ")[1] : null;
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id).select("-password");
}
export async function protect(req, res, next) {
  try {
    if (!req.headers.authorization) return res.status(401).json({ message: "Please log in first." });
    req.user = await userFromRequest(req);
    if (!req.user) return res.status(401).json({ message: "Account not found." });
    next();
  } catch { return res.status(401).json({ message: "Invalid or expired session." }); }
}
// Attaches req.user when a valid token is sent, but never blocks the request.
export async function optionalAuth(req, _res, next) {
  try { req.user = await userFromRequest(req); } catch { req.user = null; }
  next();
}
export function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}
