function extractAdminMessage(data) {
  const text = String(data.body || "").trim();
  const sender = String(data.from || "").trim();

  return {
    text,
    sender,
    raw: data,
  };
}

function isPrivateMessage(data) {
  if (!data) {
    return false;
  }

  // نستقبل رسائل الخاص فقط
  if (data.handler !== "chat_message") {
    return false;
  }

  // نتجاهل writing وأي state
  if (data.type !== "text") {
    return false;
  }

  // لازم الرسالة يكون فيها نص
  if (!data.body) {
    return false;
  }

  // لازم نعرف المرسل
  if (!data.from) {
    return false;
  }

  // لو الرسالة من البوت نفسه نتجاهلها حتى لا يعمل loop
  if (String(data.from).toLowerCase() === "tebot") {
    return false;
  }

  return true;
}

module.exports = {
  extractAdminMessage,
  isPrivateMessage,
};