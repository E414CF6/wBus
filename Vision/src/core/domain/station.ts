// Station location data (routeMap stations map)
export type StationLocation = {
    gpslati: number;
    gpslong: number;
    nodenm: string;
    nodeno: string | number;
};

// Bus Stop Info (route-specific stop with optional sequencing info)
export type BusStop = StationLocation & {
    nodeid: string;
    nodeord?: number;
    updowncd?: number;
};

// Bus Stop Arrival Info
export type BusStopArrival = {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
};
