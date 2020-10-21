import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

import cors from 'cors';
import bodyParser from 'body-parser';

import session from 'express-session';
import sharedSession from 'express-socket.io-session';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { v4 as uuid, validate as validateUuid } from 'uuid';
import bcrypt from 'bcrypt';

import { generateRandomColor, ClientError } from 'utils';

const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(cors({
    credentials: true,
    origin: ['http://localhost:3000', 'https://murmuring-brook-39256.herokuapp.com/'],
}));

const todoSession = session({
    secret: 'SHOULD_BE_FROM_ENV',
    resave: false,
    saveUninitialized: false,
});
app.use(todoSession);

app.use(passport.initialize());
app.use(passport.session());


type ImaginaryDBSchema = {
    users: {
        id: string,
        username: string,
        pwdHash: string,
        color: string,
    }[],
    lists: {
        id: string,
        title: string,
        items: {
            id: string,
            label: string,
            isDone: boolean,
        }[],
    }[],

    listsIndex: {
        [listId: string]: number,
    }
}
const imaginaryDB: ImaginaryDBSchema = {
    users: [],
    lists: [],

    listsIndex: {},
}

const getListIndex = (listId: string) => {
    if (imaginaryDB.listsIndex[listId] !== undefined) {
        return imaginaryDB.listsIndex[listId];
    } else {
        const listIdx = imaginaryDB.lists.findIndex(list => list.id === listId);
        imaginaryDB.listsIndex[listId] = listIdx;

        return listIdx;
    }
}


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
        const user = imaginaryDB.users.find(user => user.username === username);
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


const httpServer = http.createServer(app);
const io = socketIo(httpServer);
io.use(sharedSession(todoSession, {
    autoSave: true,
}));
 
io.on('connection', socket => {
    socket.handshake.session.reload(async err => {
        if (err) {
            console.log('Unknown user socket connection request.');
            // console.error(err);
            return;
        }

        const socketUserId = socket.handshake.session.passport.user;

        const socketUser = imaginaryDB.users.find(u => u.id === socketUserId);
        const socketUserName = socketUser.username;

        console.log(`New connection! User ${socketUserId} on ${socket.id}`);

        // Let others know!
        socket.broadcast.emit('users/new', {
            username: socketUserName,
            color: socketUser.color,
        });

        socket.on('todo/create', () => {
            const listId = uuid();
    
            const listsLength = imaginaryDB.lists.push({
                id: listId,
                title: '',
                items: [],
            });
            imaginaryDB.listsIndex[listId] = listsLength - 1;
    
            io.emit('todo/add', {
                listId,
            });
    
        });
    
        type TodoUpdateRequest = {
            listId: string,
            data: {
                title?: string,
            }
        }
        socket.on('todo/update', (update: TodoUpdateRequest) => {
            const listIdx = getListIndex(update.listId);
            const list = imaginaryDB.lists[listIdx];
    
            const { data } = update;
            if (data.title !== undefined) {
                list.title = data.title;
            }
    
            socket.broadcast.emit('todo/update', update);
        });
    
        type TodoNewItemRequest = {
            listId: string,
            data: {
                tempId: string,
                label: string,
            }
        }
        socket.on('todo/addItem', (itemRequest: TodoNewItemRequest) => {
            const { 
                listId, 
                data: { tempId, label }
            } = itemRequest;
    
            const listIdx = getListIndex(listId);
            const list = imaginaryDB.lists[listIdx];
            
            let id = tempId;
            if (validateUuid(tempId) === false) {
                id = uuid();
    
                // TODO: emit correction here
            }
    
            const newItem = {
                id,
                label,
                isDone: false,
            };
            console.log(newItem);
            list.items.push(newItem);
    
            socket.broadcast.emit('todo/addItem', {
                listId: itemRequest.listId,
                data: newItem,
            });
        });
    
        type TodoEditItemRequest = {
            listId: string,
            itemId: string,
            data: {
                label?: string,
                isDone?: boolean,
            }
        }
        socket.on('todo/editItem', (itemRequest: TodoEditItemRequest) => {
            const { 
                listId,
                itemId, 
                data: { label, isDone }
            } = itemRequest;
    
            const listIdx = getListIndex(listId);
            const list = imaginaryDB.lists[listIdx];
    
            const itemIdx = list.items.findIndex(item => item.id === itemId);
            
            if (label !== undefined) {
                list.items[itemIdx].label = label;
            }
            if (isDone !== undefined) {
                list.items[itemIdx].isDone = isDone;
            }
    
            socket.broadcast.emit('todo/editItem', itemRequest);
        });

        type UserCursorUpdate = {
            id: string[],
            start: number,
            end: number,
        }
        socket.on('user-cursor', (update: UserCursorUpdate) => {
            socket.broadcast.emit('user-cursor', {
                username: socketUserName,
                id: update.id,
                start: update.start,
                end: update.end,
            });
        });
    });

});

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
