import http from 'http';

import express from 'express';
import socketIo from 'socket.io';

import cors from 'cors';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import { v4 as uuid, validate as validateUuid } from 'uuid';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    credentials: true,
}));

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
        console.log(itemRequest);
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
});

httpServer.listen(port, () => { console.log (`Listening on port ${port}`)});
