import { z } from 'zod';
export const validate = (schema) => {
    return (req, res, next) => {
        try {
            schema.parse(req.body);
            next();
            return;
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
            return;
        }
    };
};
//# sourceMappingURL=validate.js.map