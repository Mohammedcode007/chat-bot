const fs = require("fs");
const path = require("path");

class JsonStore {
  constructor(filePath, defaultValue = []) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
    this.ensureFile();
  }

  ensureFile() {
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify(this.defaultValue, null, 2),
        "utf8"
      );
    }
  }

  read() {
    try {
      this.ensureFile();

      const raw = fs.readFileSync(this.filePath, "utf8");

      if (!raw.trim()) {
        return this.defaultValue;
      }

      return JSON.parse(raw);
    } catch (err) {
      console.error("❌ JsonStore read error:", this.filePath, err.message);
      return this.defaultValue;
    }
  }

  write(data) {
    try {
      this.ensureFile();

      fs.writeFileSync(
        this.filePath,
        JSON.stringify(data, null, 2),
        "utf8"
      );

      return true;
    } catch (err) {
      console.error("❌ JsonStore write error:", this.filePath, err.message);
      return false;
    }
  }
}

module.exports = {
  JsonStore,
};