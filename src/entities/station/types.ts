export type StationLocation = {
    gpslati: number;
    gpslong: number;
    nodenm: string;
    nodeno: string | number;
};

export type BusStop = StationLocation & {
    nodeid: string;
    nodeord?: number;
    updowncd?: number;
};

export type BusStopArrival = {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
};

export interface StationMapData {
    lastUpdated: string;
    stations: Record<string, StationLocation>;
}
