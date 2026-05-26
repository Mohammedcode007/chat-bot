function createSilentBot({ username, password, roomName, owner }) {
  return {
    type: "silent",
    username,
    password,
    roomName,
    owner,
    profile: {
      title: "Silent Bot",
      status: "connected silently",
    },
    settings: {
      enabled: true,
    },
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  createSilentBot,
};