/**
 * Lightweight in-memory session manager for conversational multi-step flows
 */
const userSessions = new Map();

function setSession(userId, data) {
  userSessions.set(Number(userId), {
    ...data,
    updatedAt: Date.now()
  });
}

function getSession(userId) {
  return userSessions.get(Number(userId)) || null;
}

function clearSession(userId) {
  userSessions.delete(Number(userId));
}

function updateSession(userId, partialData) {
  const current = getSession(userId) || {};
  userSessions.set(Number(userId), {
    ...current,
    ...partialData,
    updatedAt: Date.now()
  });
}

module.exports = {
  setSession,
  getSession,
  clearSession,
  updateSession
};
