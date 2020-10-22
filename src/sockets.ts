import socketIo from 'socket.io';
import { v4 as uuid, validate as validateUuid } from 'uuid';

import { ImaginaryDBSchema, OnlineUserStore } from './types';

const setupSocketHandlers = (io: socketIo.Server, imaginaryDB: ImaginaryDBSchema, onlineUsers: OnlineUserStore) => {

    const getListIndex = (listId: string) => {
        if (imaginaryDB.listsIndex[listId] !== undefined) {
            return imaginaryDB.listsIndex[listId];
        } else {
            const listIdx = imaginaryDB.lists.findIndex(list => list.id === listId);
            imaginaryDB.listsIndex[listId] = listIdx;
    
            return listIdx;
        }
    }

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
    
            onlineUsers[socketUserId] = socket.id;
    
            // Let others know!
            socket.broadcast.emit('users/new', {
                username: socketUserName,
                color: socketUser.color,
            });
    
            socket.on('disconnect', () => {
                delete onlineUsers[socketUserId];
                console.log(`${socketUserId} left!`);

                socket.broadcast.emit('users/leave', {
                    username: socketUserName,
                });
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

            socket.on('todo/delete', (deleteRequest: { listId: string}) => {
                const { listId } = deleteRequest;
                const lists = imaginaryDB.lists.filter(list => list.id !== listId);

                imaginaryDB.lists = lists;
                imaginaryDB.listsIndex = {};

                socket.broadcast.emit('todo/delete', {
                    listId
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
                start?: number,
                end?: number,
            };
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
    
}

export default setupSocketHandlers;