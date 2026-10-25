export class ProvisionError extends Error {
    name = 'ProvisionError';
    code;
    item;
    constructor(code, message, options) {
        super(message, options?.cause === undefined ? undefined : { cause: options.cause });
        this.code = code;
        this.item = options?.item;
    }
}
export function isProvisionError(err) {
    return err instanceof ProvisionError;
}
