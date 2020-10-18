import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

const app = express();
const port = 3001;

const httpServer = http.createServer(app);
const io = socketIo(httpServer);
 
io.on('connection', socket => {
    console.log(`New connection: ${socket.id}`);
});

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
