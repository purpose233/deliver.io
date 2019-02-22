module.exports = function (io) {
  io.sockets.on('connection', function (socket) {
    socket.on('name', function (data) {
      console.log(data);
    });

    socket.on('upload', function (data) {

    });

    socket.on('download', function (data) {

    });
  });

  return io;
};
