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

export type NearbyStop = BusStop & {
    citycode?: string | number;
    distanceMeters?: number;
};

export type FavoriteStop = {
    nodeid: string;
    nodenm: string;
    nodeno: string | number;
    gpslati: number;
    gpslong: number;
    cityCode: string;
};

