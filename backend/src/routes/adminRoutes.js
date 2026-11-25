import { Router } from "express";
import User from "../models/User.js";
import Item from "../models/Item.js";
import Claim from "../models/Claim.js";
import { protect, adminOnly } from "../middleware/auth.js";
const router = Router();
router.use(protect, adminOnly);

router.get("/overview", async (_req, res, next) => {
  try {
    const [users, items, open, returned, pendingClaims, recentUsers] = await Promise.all([
      User.countDocuments(), Item.countDocuments(), Item.countDocuments({ status: "Open" }),
      Item.countDocuments({ status: "Returned" }), Claim.countDocuments({ status: "Pending" }),
      User.find().select("-password").sort({ createdAt: -1 }).limit(10)
    ]);
    res.json({ stats: { users, items, open, returned, pendingClaims }, users: recentUsers });
  } catch (e) { next(e); }
});
export default router;
