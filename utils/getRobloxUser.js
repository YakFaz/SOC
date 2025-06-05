const axios = require('axios');

module.exports = async function getRobloxUser(username) {
  const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
    usernames: [username],
    excludeBannedUsers: true
  });

  const user = res.data.data[0];
  if (!user) throw new Error('Roblox user not found');
  return { id: user.id, username: user.name };
};