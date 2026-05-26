const { RECONNECT_DELAY_MS } = require("../config/env");

class ReconnectManager {
  constructor(delay = RECONNECT_DELAY_MS) {
    this.delay = delay;
  }

  scheduleReconnect(fn) {
    setTimeout(() => {
      fn();
    }, this.delay);
  }
}

module.exports = {
  ReconnectManager,
};