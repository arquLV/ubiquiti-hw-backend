export type ImaginaryDBSchema = {
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

export type OnlineUserStore = {
    [userId: string]: string, // map userId to socketId
}