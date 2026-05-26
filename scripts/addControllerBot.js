const { BotRepository } = require("../src/store/BotRepository");

const [username, password, roomName, owner] = process.argv.slice(2);

if (!username || !password || !roomName || !owner) {
  console.log("❌ الاستخدام:");
  console.log("npm run add-controller username password roomName ownerUsername");
  process.exit(1);
}

const repository = new BotRepository();

const bot = {
  type: "controller",
  username,
  password,
  roomName,
  owner,
  masters: [],
  profile: {
    title: "Controller Bot",
    status: "ready",
  },
  settings: {
    commandsEnabled: true,
  },
  createdAt: new Date().toISOString(),
};

try {
  repository.addControllerBot(bot);

  console.log("✅ تم إضافة بوت التحكم بنجاح:");
  console.log(bot);
} catch (err) {
  console.error("❌", err.message);
}