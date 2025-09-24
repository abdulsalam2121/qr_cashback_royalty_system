export declare function signToken(payload: any, expiresIn?: string): string;
export declare function verifyToken(token: string): any;
export declare function generateHMAC(data: string, secret: string): string;
export declare function verifyHMAC(data: string, signature: string, secret: string): boolean;
/**
 * Generate a secure random token for payment links
 * @param length Token length in bytes (default 32)
 * @returns Base64 URL-safe token
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Generate a hash of a value for verification purposes
 * @param value Value to hash
 * @returns SHA-256 hash in hex format
 */
export declare function generateHash(value: string): string;
/**
 * Generate a short numeric code for verification
 * @param length Number of digits (default 6)
 * @returns Numeric string
 */
export declare function generateNumericCode(length?: number): string;
/**
 * Generate a QR code friendly alphanumeric token
 * @param length Number of characters (default 12)
 * @returns Alphanumeric string
 */
export declare function generateAlphanumericToken(length?: number): string;
//# sourceMappingURL=crypto.d.ts.map