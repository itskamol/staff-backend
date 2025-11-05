import { Request, Response, NextFunction } from 'express';

export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction) {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
        (req as any).rawBody = Buffer.concat(chunks);
        next();
    });
}
