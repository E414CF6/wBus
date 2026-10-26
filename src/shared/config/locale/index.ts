import {
    ACCESSIBILITY_STRINGS,
    BOTTOM_NAV_STRINGS,
    BUS_ITEM_STRINGS,
    BUS_LIST_STRINGS,
    COMMON_STRINGS,
    ERROR_STRINGS,
    MAP_STRINGS,
    METADATA_STRINGS,
    NAV_STRINGS,
    STOP_POPUP_STRINGS,
    TIME_STRINGS,
} from "./common";
import {ROUTE_SELECT_STRINGS} from "./routeSelect";
import {NOTICE_STRINGS} from "./notice";

export * from "./appLocale";
export * from "./common";
export * from "./routeSelect";
export * from "./notice";


/**
 * User Interface Text (Korean)
 * Aggregated domain text dictionary
 */
export const UI_TEXT = {
    COMMON: COMMON_STRINGS,
    TIME: TIME_STRINGS,
    ACCESSIBILITY: ACCESSIBILITY_STRINGS,
    NAV: NAV_STRINGS,
    BOTTOM_NAV: BOTTOM_NAV_STRINGS,
    ROUTE_SELECT: ROUTE_SELECT_STRINGS,
    BUS_LIST: BUS_LIST_STRINGS,
    BUS_ITEM: BUS_ITEM_STRINGS,
    MAP: MAP_STRINGS,
    STOP_POPUP: STOP_POPUP_STRINGS,
    ERROR: ERROR_STRINGS,
    METADATA: METADATA_STRINGS,
    NOTICE: NOTICE_STRINGS,
} as const;
