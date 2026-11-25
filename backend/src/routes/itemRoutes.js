import { Router } from "express";
import Item from "../models/Item.js";
import Claim from "../models/Claim.js";
import { protect, optionalAuth } from "../middleware/auth.js";
const router = Router();
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isAdmin = u => u?.role === "admin";

router.get("/", async (req, res, next) => {
  try {
    const { search = "", type = "", category = "", status = "" } = req.query;
    const filter = {};
    if (type) filter.type = String(type);
    if (category) filter.category = String(category);
    if (status) filter.status = String(status);
    if (search) {
      const rx = { $regex: escapeRegex(String(search).slice(0, 80)), $options: "i" };
      filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
    }
    // contact and owner email are private: not sent in the public list
    const items = await Item.find(filter).select("-contact").populate("owner", "name").sort({ createdAt: -1 });
    res.json({ items });
  } catch (e) { next(e); }
});
router.get("/mine", protect, async (req, res, next) => {
  try { res.json({ items: await Item.find({ owner: req.user._id }).sort({ createdAt: -1 }) }); }
  catch (e) { next(e); }
});
router.post("/", protect, async (req, res, next) => {
  try {
    const { title, description, category, type, location, eventDate, contact } = req.body;
    if (![title, description, category, type, location, eventDate, contact].every(Boolean))
      return res.status(400).json({ message: "Please complete every field." });
    const item = await Item.create({ title, description, category, type, location, eventDate, contact, owner: req.user._id });
    res.status(201).json({ item });
  } catch (e) { next(e); }
});
router.get("/:id", optionalAuth, async (req, res, next) => {
  try {
    const found = await Item.findById(req.params.id).populate("owner", "name email");
    if (!found) return res.status(404).json({ message: "Item not found." });
    const item = found.toObject();
    const isOwner = req.user && String(item.owner?._id) === String(req.user._id);
    const privileged = isOwner || isAdmin(req.user);
    if (!req.user) delete item.contact;
    if (!privileged && item.owner) delete item.owner.email;
    let claims = [], myClaim = null;
    if (privileged) claims = await Claim.find({ item: item._id }).populate("claimant", "name email").sort({ createdAt: -1 });
    else if (req.user) myClaim = await Claim.findOne({ item: item._id, claimant: req.user._id });
    res.json({ item, claims, myClaim, canManage: !!privileged });
  } catch (e) { next(e); }
});
router.patch("/:id/status", protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });
    if (String(item.owner) !== String(req.user._id) && !isAdmin(req.user))
      return res.status(403).json({ message: "Only the owner can update this item." });
    if (!["Open", "Returned"].includes(req.body.status)) return res.status(400).json({ message: "Invalid status." });
    item.status = req.body.status;
    await item.save();
    res.json({ item });
  } catch (e) { next(e); }
});
// Owner or admin can delete a listing.
router.delete("/:id", protect, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });
    if (String(item.owner) !== String(req.user._id) && !isAdmin(req.user))
      return res.status(403).json({ message: "You cannot delete this listing." });
    await item.deleteOne();
    await Claim.deleteMany({ item: item._id });
    res.json({ message: "Listing deleted." });
  } catch (e) { next(e); }
});
export default router;
