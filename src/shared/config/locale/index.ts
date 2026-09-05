import {
    ACCESSIBILITY_STRINGS,
    BOTTOM_NAV_STRINGS,
    BUS_ITEM_STRINGS,
    BUS_LIST_STRINGS,
    BUS_SERVICE_STRINGS,
    COMMON_STRINGS,
    CONNECTION_STRINGS,
    DATA_LABELS_STRINGS,
    ERROR_STRINGS,
    FOOTER_STRINGS,
    MAP_STRINGS,
    METADATA_STRINGS,
    NAV_STRINGS,
    ROUTE_MAP_STRINGS,
    SCHEDULE_STRINGS,
    STOP_POPUP_STRINGS,
    TIME_STRINGS,
} from "./common";
import {TIMETABLE_STRINGS} from "./timetable";
import {YONSEI_SHUTTLE_STRINGS, YONSEI_STRINGS} from "./yonsei";
import {CHAT_STRINGS} from "./chat";
import {ROUTE_SELECT_STRINGS} from "./routeSelect";
import {NOTICE_STRINGS} from "./notice";

export * from "./appLocale";
export * from "./common";
export * from "./timetable";
export * from "./yonsei";
export * from "./chat";
export * from "./routeSelect";
export * from "./notice";

// Backward-compatible data re-export
export {type YonseiDaySchedule, YONSEI_STATIC_TIMETABLES} from "@data/yonseiStaticTimetables";

/**
 * User Interface Text (Korean)
 * Aggregated domain text dictionary for backwards compatibility
 */
export const UI_TEXT = {
    COMMON: COMMON_STRINGS,
    CONNECTION: CONNECTION_STRINGS,
    TIME: TIME_STRINGS,
    ACCESSIBILITY: ACCESSIBILITY_STRINGS,
    NAV: NAV_STRINGS,
    TIMETABLE: TIMETABLE_STRINGS,
    TIMETABLE_HEADER: TIMETABLE_STRINGS,
    BOTTOM_NAV: BOTTOM_NAV_STRINGS,
    YONSEI: YONSEI_STRINGS,
    YONSEI_TIMETABLE: YONSEI_STRINGS,
    YONSEI_SHUTTLE: YONSEI_SHUTTLE_STRINGS,
    CHAT: CHAT_STRINGS,
    ROUTE_SELECT: ROUTE_SELECT_STRINGS,
    BUS_SERVICE: BUS_SERVICE_STRINGS,
    SCHEDULE: SCHEDULE_STRINGS,
    BUS_LIST: BUS_LIST_STRINGS,
    BUS_ITEM: BUS_ITEM_STRINGS,
    MAP: MAP_STRINGS,
    STOP_POPUP: STOP_POPUP_STRINGS,
    ERROR: ERROR_STRINGS,
    METADATA: METADATA_STRINGS,
    NOTICE: NOTICE_STRINGS,
    DATA_LABELS: DATA_LABELS_STRINGS,
    ROUTE_MAP: ROUTE_MAP_STRINGS,
    FOOTER: FOOTER_STRINGS,
} as const;
