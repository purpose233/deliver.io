module.exports = function (io) {
  let users = [];

  function addUser(socket, name) {
    users.push({
      id: socket.id,
      socket: socket,
      name: name
    });
  }

  function deleteUser(socket) {
    for (let index in users) {
      if (socket.id === users[index].id) {
        users.splice(index, 1);
        return;
      }
    }
  }

  function findUser(id) {
    for (let user of users) {
      if (id === id) {
        return user;
      }
    }
  }

  function getUserStr(excludedId) {
    let tempUsers = [];
    for (let user of users) {
      if (user.id === excludedId) {
        continue;
      }
      tempUsers.push({
        name: user.name,
        id: user.id
      });
    }
    return JSON.stringify(tempUsers);
  }

  function updateUsers() {
    for (let user of users) {
      user.socket.emit('users', getUserStr(user.socket.id));
    }
  }

  io.sockets.on('connection', function (socket) {
    socket.on('name', function (data) {
      console.log(data + ' joins!');
      addUser(socket, data);
      updateUsers();
    });

    socket.on('upload', function (data) {

    });

    socket.on('download', function (data) {

    });

    socket.on('p2pDesc', function (data) {
      // data = {
      //   type: 'send'/'receive',
      //   remoteId,
      //   localDescription,
      //   fileName, fileSize
      // };
      let desc = JSON.parse(data);
      let user = findUser(desc.id);
      if (!user) {
        socket.emit('p2p')
      }
    });

    socket.on('disconnect', function () {
      deleteUser(socket);
    });
  });

  return io;
};
