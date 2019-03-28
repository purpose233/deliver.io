module.exports = function (io) {
  // user: name, id, socket
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
      if (id === user.id) {
        return user;
      }
    }
  }

  function getExcludedUsers(excludedId) {
    let excludedUsers = [];
    for (let user of users) {
      if (user.id === excludedId) {
        continue;
      }
      excludedUsers.push({
        name: user.name,
        id: user.id
      });
    }
    return excludedUsers;
  }

  function updateUsers() {
    for (let user of users) {
      user.socket.emit('users', getExcludedUsers(user.socket.id));
    }
  }

  io.sockets.on('connection', function(socket) {
    // add name to clojure so that it needn't be searched
    let name = null;

    socket.on('name', function(data) {
      name = data.name;
      console.log(name + ' joins!');
      addUser(socket, name);
      updateUsers();
    });

    // TODO: extract the same handle function for socket events

    // data type: P2PFileInfo
    socket.on('send', function(data) {
      console.log('socket on send from ' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
        socket.emit('error', {
          // error:
        });
      }
      // switch the user in data to the sender
      data.remoteId = socket.id;
      data.remoteName = name;
      remoteUser.socket.emit('confirmReceive', data);
    });

    // data type: ConfirmSendInfo
    socket.on('receive', function(data) {
      console.log('socket on receive from ' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('confirmSend', data);
    });

    // data type: DescInfo
    socket.on('desc', function(data) {
      console.log('socket on desc from ' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('desc', data);
    });

    // data type: CandidateInfo
    socket.on('candidate', function(data) {
      console.log('socket on candidate from ' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('candidate', data);
    });

    // data type: ReceiveState
    socket.on('receiveState', function(data) {
      console.log('socket on receive from' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('receiveState', data);
    });

    // data type: BasicInfo
    socket.on('abort', function(data) {
      console.log('socket on abort from' + name);
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('abort', data);
    });

    socket.on('disconnect', function() {
      deleteUser(socket);
      updateUsers();
    });
  });

  return io;
};
