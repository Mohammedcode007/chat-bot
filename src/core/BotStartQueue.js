function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BotStartQueue {
  constructor(options = {}) {
    this.delayMs = Number(options.delayMs || process.env.BOT_START_DELAY_MS || 3000);
    this.queue = [];
    this.running = false;
  }

  add(label, startFn) {
    this.queue.push({
      label,
      startFn,
    });

    this.run();

    return true;
  }

  async run() {
    if (this.running) {
      return;
    }

    this.running = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      try {
        console.log("⏳ [BOT_START_QUEUE]", {
          bot: item.label,
          waiting: this.delayMs,
          remaining: this.queue.length,
        });

        await sleep(this.delayMs);

        console.log("🚀 [BOT_START_NOW]", item.label);

        item.startFn();
      } catch (err) {
        console.log("❌ [BOT_START_QUEUE_ERROR]", {
          bot: item.label,
          error: err.message,
        });
      }
    }

    this.running = false;
  }
}

module.exports = {
  BotStartQueue,
};