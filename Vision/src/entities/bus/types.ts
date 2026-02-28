export type BusItem = {
    routeid?: string;
    routenm: string;
    gpslati: number;
    gpslong: number;
    vehicleno: string;
    nodenm?: string;
    nodeid?: string;
    nodeord?: number;
};

export type BusDataError =
    | "ERR:NONE_RUNNING"
    | "ERR:NETWORK"
    | "ERR:INVALID_ROUTE"
    | null;
