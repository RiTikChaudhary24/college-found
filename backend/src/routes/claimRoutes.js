import { Router } from "express";
import Claim from "../models/Claim.js";
import Item from "../models/Item.js";
import { protect } from "../middleware/auth.js";
const router = Router();

router.get("/mine", protect, async (req, res, next) => {
  try {
    const claims = await Claim.find({ claimant: req.user._id })
      .populate({ path: "item", populate: { path: "owner", select: "name" } }).sort({ createdAt: -1 });
    res.json({ claims });
  } catch (e) { next(e); }
});
router.post("/:itemId", protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Item not found." });
    if (item.type !== "Found") return res.status(400).json({ message: "Only found items can be claimed." });
    if (String(item.owner) === String(req.user._id)) return res.status(400).json({ message: "You cannot claim your own listing." });
    if (item.status === "Returned") return res.status(400).json({ message: "This item is already returned." });
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ message: "Add identifying details in your claim." });
    const claim = await Claim.create({ item: item._id, claimant: req.user._id, message });
    item.status = "Claim Pending";
    await item.save();
    res.status(201).json({ claim });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "You have already claimed this item." });
    next(e);
  }
});
// Listing owner or admin reviews a claim.
router.patch("/:claimId", protect, async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.claimId).populate("item");
    if (!claim || !claim.item) return res.status(404).json({ message: "Claim not found." });
    if (String(claim.item.owner) !== String(req.user._id) && req.user.role !== "admin")
      return res.status(403).json({ message: "Only the listing owner can review this claim." });
    if (!["Approved", "Rejected"].includes(req.body.status)) return res.status(400).json({ message: "Invalid decision." });
    if (claim.status !== "Pending") return res.status(400).json({ message: "This claim was already reviewed." });
    claim.status = req.body.status;
    await claim.save();
    if (claim.status === "Approved") {
      await Claim.updateMany({ item: claim.item._id, _id: { $ne: claim._id }, status: "Pending" }, { status: "Rejected" });
    } else if (!(await Claim.countDocuments({ item: claim.item._id, status: { $in: ["Pending", "Approved"] } }))) {
      await Item.findByIdAndUpdate(claim.item._id, { status: "Open" });
    }
    res.json({ claim });
  } catch (e) { next(e); }
});
export default router;
