export declare function signToken(payload: any, expiresIn?: string): string;
export declare function verifyToken(token: string): any;
export declare function generateHMAC(data: string, secret: string): string;
export declare function verifyHMAC(data: string, signature: string, secret: string): boolean;
//# sourceMappingURL=crypto.d.ts.map