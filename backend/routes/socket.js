import {ConfirmSendInfo} from "../../frontend/src/app/deliver.service";

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

  // TODO: wrap the name data in object
  // TODO: JSON.parse for socket on
  io.sockets.on('connection', function(socket) {
    // add name to clojure so that it needn't be searched
    let name = null;

    socket.on('name', function(data) {
      console.log(data + ' joins!');
      name = data;
      addUser(socket, data);
      updateUsers();
    });

    socket.on('upload', function(data) {

    });

    socket.on('download', function(data) {

    });

    // TODO: extract the same handle function for socket events

    // data type: P2PFileInfo
    socket.on('send', function(data) {
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
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('confirmSend', data);
    });

    // data type: DescInfo
    socket.on('desc', function(data) {
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('desc', data);
    });

    // data type: CandidateInfo
    socket.on('candidate', function(data) {
      let remoteUser = findUser(data.remoteId);
      if (!remoteUser) {
        // TODO: send error
      }
      data.remoteId = socket.id;
      remoteUser.socket.emit('candidate', data);
    });

    socket.on('disconnect', function() {
      deleteUser(socket);
    });
  });

  return io;
};
