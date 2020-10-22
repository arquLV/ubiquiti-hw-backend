import { ErrorRequestHandler } from 'express';

export const generateRandomColor = () => {
    const r = Math.floor(Math.random() * 128) + 128;
    const g = Math.floor(Math.random() * 128) + 128;
    const b = Math.floor(Math.random() * 128) + 128;
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

export class ClientError extends Error {
    public sendReason: boolean;
    public code: number;
    public date: Date;

    constructor(message: string, code?: number, sendReason?: boolean) {
        super(message);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this);
        }

        this.name = 'ClientError';
        this.sendReason = typeof sendReason === 'boolean' ? sendReason : true;
        this.code = code || 404;
        this.date = new Date();
    }
}

export const clientErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (err instanceof ClientError) {
        res.status(err.code).json({
            success: false,
            reason: err.sendReason ? err.message : undefined,
        });
    } else {
        next(err);
    }
}