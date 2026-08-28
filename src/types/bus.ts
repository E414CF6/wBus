export interface TimetableEntry {
  seq: number;
  originDepTime: string;
  destDepTime: string;
  type: string;
  notes: string;
}

export interface BusRoute {
  id: string;
  rawNo: string;
  routeNo: string;
  dayType: string;
  origin: string;
  destination: string;
  firstBus: string;
  lastBus: string;
  runCount: string;
  interval: string;
  timetable: TimetableEntry[];
}

export interface RouteDataset {
  updatedAt: string;
  sourceUrl: string;
  routes: BusRoute[];
}

export type DayMode = "AUTO" | "WEEKDAY" | "VACATION";

export type DepartureDirection = "DEST" | "ORIGIN"; // DEST = 연세대/회촌 출발(하교), ORIGIN = 장양리/시내 출발(등교)
