import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

import cors from 'cors';
import bodyParser from 'body-parser';
import url from 'url';

import session from 'express-session';
import sharedSession from 'express-socket.io-session';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
// import redis from 'redis';

import { v4 as uuid, validate as validateUuid } from 'uuid';
import bcrypt from 'bcrypt';

import { generateRandomColor, ClientError } from './utils';
import { ImaginaryDBSchema, OnlineUserStore } from './types';
import setupSocketHandlers from './sockets';

const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());


app.use(cors({
    credentials: true,
    origin: ['http://localhost:3000', 'https://ubiquiti-hw-todo-client-kpj59.ondigitalocean.app'],
}));

// let sessionStore;
// if (process.env.REDISTOGO_URL) {

//     const redisUrl = url.parse(process.env.REDISTOGO_URL);
//     const redisClient = redis.createClient(redisUrl.port as unknown as number, redisUrl.hostname);
//     redisClient.auth(redisUrl.auth.split(':')[1]);
//     redisClient.
//     sessionStore = redisClient;
// }

app.set('trust proxy', 1);
const todoSession = session({
    secret: 'SHOULD_BE_FROM_ENV',
    resave: false,
    saveUninitialized: true,
    proxy: true,
    cookie: {
        httpOnly: false,
        secure: 'auto',
    }

});
app.use(todoSession);

app.use(passport.initialize());
app.use(passport.session());



const imaginaryDB: ImaginaryDBSchema = {
    users: [],
    lists: [],

    listsIndex: {},
}
const onlineUsers: OnlineUserStore = {};


passport.serializeUser((user: { id: string }, done) => {
    done(null, user.id);
});
passport.deserializeUser((id: string, done) => {
   const user = imaginaryDB.users.find(u => u.id === id);
   if (user) {
       done(null, user);
   } else {
       done('Invalid');
   }
});

passport.use('local', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
}, async (username, password, done) => {
    try {
        const user = imaginaryDB.users.find(u => u.username === username);
        if (!user) {
            return done(new ClientError('Invalid login', 401))
        }

        const isMatchingPassword = await bcrypt.compare(password, user.pwdHash);

        if (isMatchingPassword) {
            return done(null, user);
        } else {
            return done(new ClientError('Invalid login', 401))
        }
    } catch (error) {
        console.error(error);
        return done(error);
    }


}));

app.post('/login', passport.authenticate('local', {
    failWithError: true,
}), (req, res) => {
    console.log(req.user);
});

app.post('/signup', async (req, res, next) => {
    const { username, password } = req.body;
    if (imaginaryDB.users.find(user => user.username === username) !== undefined) {
        return next(new ClientError('User already exists', 409));
    }

    try {
        const pwdHash = await bcrypt.hash(password, 12);

        const newUser = {
            id: uuid(),
            username,
            pwdHash,
            color: generateRandomColor(),
        };
        console.log(newUser);
        imaginaryDB.users.push(newUser);

        req.logIn(newUser, err => {
            if (err) {
                throw err;
            }

            res.json({
                username: newUser.username,
                color: newUser.color,
            });
        });
    } catch (e) {
        console.error(e);
        next(e);
    }
});

app.post('/checkAuth', (req, res) => {
    const user = req.user as { username: string, color: string };
    if (user) {
        res.json({
            success: true,
            user: {
                username: user.username,
                color: user.color,
            }
        });
    } else {
        res.json({
            success: false,
        });
    }
});

app.get('/todos', (req, res) => {
    res.json({
        lists: imaginaryDB.lists,
    });
});

/**
 * Returns a list of currently online users
 */
app.get('/users', (req, res) => {
    const onlineUserIds = Object.keys(onlineUsers);
    const users = imaginaryDB.users.filter(user => onlineUserIds.includes(user.id));

    res.json({
        users,
    });
});


const httpServer = http.createServer(app);
const io = socketIo(httpServer);
io.use(sharedSession(todoSession, {
    autoSave: true,
}));
setupSocketHandlers(io, imaginaryDB, onlineUsers);

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
