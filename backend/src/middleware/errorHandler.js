export function errorHandler(err, _req, res, _next) {
  if (err.code === 11000) return res.status(409).json({ message: "This record already exists." });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id or value." });
  if (err.name === "ValidationError") return res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid data." });
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : "Server error." });
}
