import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

const app = express();
const port = 3001;

type ImaginaryDBSchema = {
    users: {
        username: string,
        pwdHash: string,
        color: string,
    }[],
}
const imaginaryDB: ImaginaryDBSchema = {
    users: [],
}


// passport.use('local', new LocalStrategy({
//     usernameField: 'username',
//     passwordField: 'password',
// }, (username, password, done) => {
//     // DB call goes here


// }));

// app.post('/auth', )

const httpServer = http.createServer(app);
const io = socketIo(httpServer);
 
io.on('connection', socket => {
    console.log(`New connection: ${socket.id}`);

    
});

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
