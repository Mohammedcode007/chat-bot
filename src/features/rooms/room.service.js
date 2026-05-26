function createRoomEntry(roomName, owner) {
  return {
    roomName,
    owner,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  createRoomEntry,
};