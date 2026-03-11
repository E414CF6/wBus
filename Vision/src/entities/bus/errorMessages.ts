import type { BusDataError } from "@entities/bus/types";
import { UI_TEXT } from "@shared/config/locale";

/**
 * Map of error codes to user-friendly messages
 */
export const ERROR_MESSAGE_MAP: Record<string, string> = {
    "ERR:NONE_RUNNING": UI_TEXT.BUS_LIST.NO_RUNNING,
    "ERR:NETWORK": UI_TEXT.ERROR.FETCH_FAILED("[ERR:NETWORK]", 400),
    "ERR:INVALID_ROUTE": UI_TEXT.ERROR.ROUTE_MISSING("[ERR:INVALID_ROUTE]"),
};

/**
 * Get a user-friendly error message for a bus data error
 * @param error - The error code
 * @returns A user-friendly error message
 */
export function getBusErrorMessage(error: BusDataError): string {
    if (!error) return "";
    return ERROR_MESSAGE_MAP[error] ?? UI_TEXT.ERROR.UNKNOWN(error);
}
