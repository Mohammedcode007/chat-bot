function extractIncomingMessage(data) {
  if (!data) {
    return {
      text: "",
      sender: "",
      raw: data,
    };
  }

  /*
    رسائل الغرفة غالبًا تأتي بهذا الشكل:
    {
      handler: "room_message",
      body: "...",
      username: "..."
    }

    أو أحيانًا:
    message / text / msg
  */
  const text = String(
    data.body ||
      data.message ||
      data.text ||
      data.msg ||
      ""
  ).trim();

  const sender = String(
    data.from ||
      data.username ||
      data.sender ||
      data.user ||
      data.name ||
      ""
  ).trim();

  return {
    text,
    sender,
    raw: data,
  };
}

function extractRoomUserEvent(data) {
  if (!data) {
    return null;
  }

  const handler = String(data.handler || "").toLowerCase();
  const type = String(data.type || data.event || data.state || "").toLowerCase();

  /*
    مهم:
    لا نعتبر type: you_joined حدث دخول فردي
    لأنه يأتي معه users كاملة، ويتم التعامل معه في extractRoomUsersSnapshot
  */
  if (handler === "room_event" && type === "you_joined") {
    return null;
  }

  const username = String(
    data.username ||
      data.user ||
      data.target ||
      data.from ||
      data.sender ||
      data.member ||
      ""
  ).trim();

  const roomName = String(
    data.room ||
      data.roomName ||
      data.name ||
      data.nameRoom ||
      data.r ||
      ""
  ).trim();

  /*
    أحداث دخول مستخدم للغرفة
    أضفنا أكثر من احتمال لأن أسماء الأحداث تختلف حسب السيرفر.
  */
  const isJoin =
    (
      handler === "room_event" &&
      (
        type === "user_joined" ||
        type === "member_joined" ||
        type === "joined" ||
        type === "join" ||
        type === "enter" ||
        type === "entered"
      )
    ) ||
    handler === "user_joined" ||
    handler === "room_user_joined" ||
    handler === "member_joined" ||
    handler === "room_joined";

  /*
    أحداث خروج مستخدم من الغرفة
  */
  const isLeave =
    (
      handler === "room_event" &&
      (
        type === "user_left" ||
        type === "member_left" ||
        type === "left" ||
        type === "leave" ||
        type === "exit" ||
        type === "exited"
      )
    ) ||
    handler === "user_left" ||
    handler === "room_user_left" ||
    handler === "member_left" ||
    handler === "room_left";

  if (!isJoin && !isLeave) {
    return null;
  }

  if (!username) {
    return null;
  }

  return {
    action: isJoin ? "join" : "leave",
    username,
    roomName,

    role: data.role || "",
    userId: data.user_id || data.userId || data.id || "",
    photoUrl: data.photo_url || data.photoUrl || "",

    raw: data,
  };
}

function extractRoomUsersSnapshot(data) {
  if (!data) {
    return null;
  }

  const handler = String(data.handler || "").toLowerCase();
  const type = String(data.type || "").toLowerCase();

  /*
    الحالة التي ظهرت عندك في اللوج الحقيقي:

    {
      handler: "room_event",
      type: "you_joined",
      name: "roomName",
      users: [
        { username: "...", role: "owner" },
        { username: "...", role: "member" }
      ]
    }

    لذلك أهم شيء هنا هو التقاط:
    room_event + you_joined + users
  */
  const isRoomEventUsers =
    handler === "room_event" &&
    Array.isArray(data.users) &&
    (
      type === "you_joined" ||
      type === "joined" ||
      type === "room_update" ||
      type === "users_update" ||
      type === "members_update"
    );

  /*
    احتمالات أخرى لو السيرفر أرسل قائمة المستخدمين باسم مختلف.
  */
  const isUsersList =
    (
      handler === "room_users" ||
      handler === "users" ||
      handler === "room_members" ||
      handler === "members" ||
      handler === "room_users_update" ||
      handler === "online_users"
    ) &&
    (
      Array.isArray(data.users) ||
      Array.isArray(data.members) ||
      Array.isArray(data.onlineUsers)
    );

  if (!isRoomEventUsers && !isUsersList) {
    return null;
  }

  const usersArray =
    data.users ||
    data.members ||
    data.onlineUsers ||
    [];

  if (!Array.isArray(usersArray)) {
    return null;
  }

  const roomName = String(
    data.room ||
      data.roomName ||
      data.name ||
      data.nameRoom ||
      ""
  ).trim();

  return {
    roomName,
    users: usersArray.map((user) => {
      return {
        username: String(
          user.username ||
            user.name ||
            user.user ||
            ""
        ).trim(),

        role: user.role || "",
        userId: user.user_id || user.userId || user.id || "",
        photoUrl: user.photo_url || user.photoUrl || "",
      };
    }).filter((user) => user.username),

    raw: data,
  };
}

module.exports = {
  extractIncomingMessage,
  extractRoomUserEvent,
  extractRoomUsersSnapshot,
};