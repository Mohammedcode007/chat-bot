const { RoomRepository } = require("../../store/RoomRepository");
const { createRoomEntry } = require("./room.service");

const roomRepository = new RoomRepository();

function handleRoomCommand(context) {
  const { sender, socket, parsed } = context;

  const action = parsed.args[0];

  if (action === "add") {
    const roomName = parsed.args.slice(1).join(" ");

    if (!roomName) {
      socket.sendRoomMessage("❌ الاستخدام: !room add roomName");
      return;
    }

    const room = createRoomEntry(roomName, sender);
    roomRepository.addRoom(room);

    socket.sendRoomMessage(`✅ تم حفظ الغرفة: ${roomName}`);
    return;
  }

  if (action === "list") {
    const rooms = roomRepository.getRooms();

    if (!rooms.length) {
      socket.sendRoomMessage("لا توجد غرف محفوظة.");
      return;
    }

    const text = rooms.map((room, index) => `${index + 1}. ${room.roomName}`).join("\n");

    socket.sendRoomMessage(`📌 Rooms:\n${text}`);
    return;
  }

  socket.sendRoomMessage("❌ أمر room غير صحيح.");
}

module.exports = {
  handleRoomCommand,
};