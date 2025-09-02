import { Request, Response, NextFunction } from 'express';
export declare const rbac: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=rbac.d.ts.map