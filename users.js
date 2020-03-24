const users = [];

const addUser = ({ id, nick, color, room }) => {
  nick = nick.trim().toLowerCase();

  const existingUser = users.find(
    user => user.room === room && user.nick === nick
  );

  if (existingUser) {
    return { error: "Username is taken" };
  }

  const user = { id, nick, color, room };
  users.push(user);

  return { user };
};

const removeUser = id => {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
};

const getUser = id => users.find(user => user.id === id);

const getUsersInRoom = room => users.filter(user => user.room === room);

const showUsers = () => console.log(users);

module.exports = { addUser, removeUser, getUser, getUsersInRoom, showUsers };
