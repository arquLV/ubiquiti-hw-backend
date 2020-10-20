import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { v4 as uuid } from 'uuid';

const app = express();
const port = 3001;

type ImaginaryDBSchema = {
    users: {
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


// passport.use('local', new LocalStrategy({
//     usernameField: 'username',
//     passwordField: 'password',
// }, (username, password, done) => {
//     // DB call goes here


// }));

// app.post('/auth', )

app.get('/todos', (req, res) => {
    res.json({
        lists: imaginaryDB.lists,   
    });
});

const httpServer = http.createServer(app);
const io = socketIo(httpServer);
 
io.on('connection', socket => {
    console.log(`New connection: ${socket.id}`);

    socket.on('todo/create', () => {
        const listId = uuid();

        imaginaryDB.lists.push({
            id: listId,
            title: '',
            items: [],
        });

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
});

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
