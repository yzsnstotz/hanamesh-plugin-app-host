export type ProvisionErrorCode = 'E_MANIFEST' | 'E_SOURCE' | 'E_DOWNLOAD' | 'E_SHA256' | 'E_ARCHIVE' | 'E_UNSAFE_PATH' | 'E_VERIFY' | 'E_PROMOTE' | 'E_LEDGER' | 'E_NOT_INSTALLED' | 'E_ABORTED' | 'E_UNSUPPORTED';
export declare class ProvisionError extends Error {
    readonly name = "ProvisionError";
    readonly code: ProvisionErrorCode;
    readonly item: string | undefined;
    constructor(code: ProvisionErrorCode, message: string, options?: {
        item?: string;
        cause?: unknown;
    });
}
export declare function isProvisionError(err: unknown): err is ProvisionError;
