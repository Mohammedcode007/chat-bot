// function extractIncomingMessage(data) {
//   if (!data) {
//     return {
//       text: "",
//       sender: "",
//       raw: data,
//     };
//   }

//   /*
//     رسائل الغرفة غالبًا تأتي بهذا الشكل:
//     {
//       handler: "room_message",
//       body: "...",
//       username: "..."
//     }

//     أو أحيانًا:
//     message / text / msg
//   */
//   const text = String(
//     data.body ||
//       data.message ||
//       data.text ||
//       data.msg ||
//       ""
//   ).trim();

//   const sender = String(
//     data.from ||
//       data.username ||
//       data.sender ||
//       data.user ||
//       data.name ||
//       ""
//   ).trim();

//   return {
//     text,
//     sender,
//     raw: data,
//   };
// }

// function extractRoomUserEvent(data) {
//   if (!data) {
//     return null;
//   }

//   const handler = String(data.handler || "").toLowerCase();
//   const type = String(data.type || data.event || data.state || "").toLowerCase();

//   /*
//     مهم:
//     لا نعتبر type: you_joined حدث دخول فردي
//     لأنه يأتي معه users كاملة، ويتم التعامل معه في extractRoomUsersSnapshot
//   */
//   if (handler === "room_event" && type === "you_joined") {
//     return null;
//   }

//   const username = String(
//     data.username ||
//       data.user ||
//       data.target ||
//       data.from ||
//       data.sender ||
//       data.member ||
//       ""
//   ).trim();

//   const roomName = String(
//     data.room ||
//       data.roomName ||
//       data.name ||
//       data.nameRoom ||
//       data.r ||
//       ""
//   ).trim();

//   /*
//     أحداث دخول مستخدم للغرفة
//     أضفنا أكثر من احتمال لأن أسماء الأحداث تختلف حسب السيرفر.
//   */
//   const isJoin =
//     (
//       handler === "room_event" &&
//       (
//         type === "user_joined" ||
//         type === "member_joined" ||
//         type === "joined" ||
//         type === "join" ||
//         type === "enter" ||
//         type === "entered"
//       )
//     ) ||
//     handler === "user_joined" ||
//     handler === "room_user_joined" ||
//     handler === "member_joined" ||
//     handler === "room_joined";

//   /*
//     أحداث خروج مستخدم من الغرفة
//   */
//   const isLeave =
//     (
//       handler === "room_event" &&
//       (
//         type === "user_left" ||
//         type === "member_left" ||
//         type === "left" ||
//         type === "leave" ||
//         type === "exit" ||
//         type === "exited"
//       )
//     ) ||
//     handler === "user_left" ||
//     handler === "room_user_left" ||
//     handler === "member_left" ||
//     handler === "room_left";

//   if (!isJoin && !isLeave) {
//     return null;
//   }

//   if (!username) {
//     return null;
//   }

//   return {
//     action: isJoin ? "join" : "leave",
//     username,
//     roomName,

//     role: data.role || "",
//     userId: data.user_id || data.userId || data.id || "",
//     photoUrl: data.photo_url || data.photoUrl || "",

//     raw: data,
//   };
// }

// function extractRoomUsersSnapshot(data) {
//   if (!data) {
//     return null;
//   }

//   const handler = String(data.handler || "").toLowerCase();
//   const type = String(data.type || "").toLowerCase();

//   /*
//     الحالة التي ظهرت عندك في اللوج الحقيقي:

//     {
//       handler: "room_event",
//       type: "you_joined",
//       name: "roomName",
//       users: [
//         { username: "...", role: "owner" },
//         { username: "...", role: "member" }
//       ]
//     }

//     لذلك أهم شيء هنا هو التقاط:
//     room_event + you_joined + users
//   */
//   const isRoomEventUsers =
//     handler === "room_event" &&
//     Array.isArray(data.users) &&
//     (
//       type === "you_joined" ||
//       type === "joined" ||
//       type === "room_update" ||
//       type === "users_update" ||
//       type === "members_update"
//     );

//   /*
//     احتمالات أخرى لو السيرفر أرسل قائمة المستخدمين باسم مختلف.
//   */
//   const isUsersList =
//     (
//       handler === "room_users" ||
//       handler === "users" ||
//       handler === "room_members" ||
//       handler === "members" ||
//       handler === "room_users_update" ||
//       handler === "online_users"
//     ) &&
//     (
//       Array.isArray(data.users) ||
//       Array.isArray(data.members) ||
//       Array.isArray(data.onlineUsers)
//     );

//   if (!isRoomEventUsers && !isUsersList) {
//     return null;
//   }

//   const usersArray =
//     data.users ||
//     data.members ||
//     data.onlineUsers ||
//     [];

//   if (!Array.isArray(usersArray)) {
//     return null;
//   }

//   const roomName = String(
//     data.room ||
//       data.roomName ||
//       data.name ||
//       data.nameRoom ||
//       ""
//   ).trim();

//   return {
//     roomName,
//     users: usersArray.map((user) => {
//       return {
//         username: String(
//           user.username ||
//             user.name ||
//             user.user ||
//             ""
//         ).trim(),

//         role: user.role || "",
//         userId: user.user_id || user.userId || user.id || "",
//         photoUrl: user.photo_url || user.photoUrl || "",
//       };
//     }).filter((user) => user.username),

//     raw: data,
//   };
// }

// module.exports = {
//   extractIncomingMessage,
//   extractRoomUserEvent,
//   extractRoomUsersSnapshot,
// };
function safeString(value) {
  return String(value || "").trim();
}

function extractText(data) {
  return safeString(
    data.body ||
      data.message ||
      data.text ||
      data.msg ||
      ""
  );
}

function extractSender(data) {
  return safeString(
    data.from ||
      data.username ||
      data.sender ||
      data.user ||
      data.name ||
      ""
  );
}

function extractUsername(data) {
  return safeString(
    data.username ||
      data.user ||
      data.target ||
      data.t_username ||
      data.from ||
      data.sender ||
      data.member ||
      data.name ||
      ""
  );
}

function extractRoomName(data) {
  return safeString(
    data.room ||
      data.roomName ||
      data.name ||
      data.nameRoom ||
      data.r ||
      ""
  );
}

function extractRole(data) {
  return safeString(
    data.role ||
      data.userRole ||
      data.user_role ||
      data.new_role ||
      data.t_role ||
      ""
  );
}

function extractUserId(data) {
  return safeString(
    data.user_id ||
      data.userId ||
      data.id ||
      data.uid ||
      ""
  );
}

function extractPhotoUrl(data) {
  return safeString(
    data.photo_url ||
      data.photoUrl ||
      data.avatar_url ||
      data.avatarUrl ||
      data.image ||
      ""
  );
}

function extractIncomingMessage(data) {
  if (!data) {
    return {
      text: "",
      sender: "",
      roomName: "",
      role: "",
      userId: "",
      photoUrl: "",
      raw: data,
    };
  }

  return {
    text: extractText(data),
    sender: extractSender(data),
    roomName: extractRoomName(data),
    role: extractRole(data),
    userId: extractUserId(data),
    photoUrl: extractPhotoUrl(data),
    raw: data,
  };
}

function extractRoomUserEvent(data) {
  if (!data) {
    return null;
  }

  const handler = safeString(data.handler).toLowerCase();
  const type = safeString(data.type || data.event || data.state).toLowerCase();

  /*
    مهم:
    type: you_joined ليس دخول مستخدم واحد.
    هذا حدث دخول البوت نفسه ومعه users كاملة.
    يتم التعامل معه في extractRoomUsersSnapshot.
  */
  if (handler === "room_event" && type === "you_joined") {
    return null;
  }

  const username = extractUsername(data);
  const roomName = extractRoomName(data);

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

    /*
      هذه أهم إضافة لنظام:
      set@autoban_none@on
    */
    role: extractRole(data),

    userId: extractUserId(data),
    photoUrl: extractPhotoUrl(data),

    raw: data,
  };
}

function normalizeSnapshotUser(user) {
  return {
    username: safeString(
      user.username ||
        user.name ||
        user.user ||
        user.from ||
        ""
    ),

    /*
      مهم جدًا:
      لو السيرفر أرسل role: "none"
      سيتم حفظها في roomUsers.json
      ويمكن استخدامها للحظر التلقائي.
    */
    role: safeString(
      user.role ||
        user.userRole ||
        user.user_role ||
        ""
    ),

    userId: safeString(
      user.user_id ||
        user.userId ||
        user.id ||
        user.uid ||
        ""
    ),

    photoUrl: safeString(
      user.photo_url ||
        user.photoUrl ||
        user.avatar_url ||
        user.avatarUrl ||
        user.image ||
        ""
    ),
  };
}

function extractRoomUsersSnapshot(data) {
  if (!data) {
    return null;
  }

  const handler = safeString(data.handler).toLowerCase();
  const type = safeString(data.type).toLowerCase();

  /*
    الحالة الأساسية:
    {
      handler: "room_event",
      type: "you_joined",
      name: "roomName",
      users: [...]
    }
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

  const roomName = extractRoomName(data);

  const users = usersArray
    .map(normalizeSnapshotUser)
    .filter((user) => user.username);

  return {
    roomName,
    users,
    raw: data,
  };
}

module.exports = {
  extractIncomingMessage,
  extractRoomUserEvent,
  extractRoomUsersSnapshot,
};