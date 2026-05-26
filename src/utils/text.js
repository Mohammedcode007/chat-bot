function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

module.exports = {
  normalizeText,
  normalizeUsername,
};