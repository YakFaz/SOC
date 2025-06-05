const noblox = require('noblox.js');

async function initializeRoblox(cookie) {
  try {
    const userId = await noblox.setCookie(cookie);
    if (!userId) throw new Error('Failed to retrieve UserId from cookie');

    const username = await noblox.getUsernameFromId(userId);
    console.log(`✅ Successfully logged in as ${username} (UserID: ${userId})`);

    return noblox; // return the initialized noblox instance
  } catch (error) {
    console.error('❌ Failed to login to Roblox bot:', error);
    throw error;
  }
}

module.exports = { initializeRoblox };