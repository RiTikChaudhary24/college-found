import mongoose from "mongoose";
const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  type: { type: String, enum: ["Lost", "Found"], required: true },
  location: { type: String, required: true },
  eventDate: { type: Date, required: true },
  contact: { type: String, required: true },
  status: { type: String, enum: ["Open", "Claim Pending", "Returned"], default: "Open" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
export default mongoose.model("Item", itemSchema);
