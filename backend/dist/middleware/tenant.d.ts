import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            tenant?: any;
        }
    }
}
export declare const resolveTenant: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requireActiveSubscription: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=tenant.d.ts.map