export const CITY_CODE = "32020"; // Wonju

export class PublicApiError extends Error {
    status: number;
    url: string;

    constructor(message: string, status: number, url: string) {
        super(message);
        this.name = "PublicApiError";
        this.status = status;
        this.url = url;
    }
}

export interface PublicApiResponseEnvelope<T> {
    response?: {
        header?: {
            resultCode?: string | number;
            resultMsg?: string;
        };
        body?: {
            items?: {
                item?: T | T[];
            };
            totalCount?: number | string;
            numOfRows?: number | string;
            pageNo?: number | string;
        };
    };
    OpenAPI_ServiceResponse?: {
        cmmMsgHeader?: {
            errMsg?: string;
            returnReasonCode?: string | number;
        };
    };
}

export interface RawBusLocation {
    routeid?: string;
    routenm: string;
    gpslati: number;
    gpslong: number;
    vehicleno: string;
    nodenm?: string;
    nodeid?: string;
    nodeord?: number;
}

export interface RawBusArrival {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
    nodenm?: string;
    nodeid?: string;
}

export interface RawBusStop {
    nodeid: string;
    nodenm: string;
    nodeno: string | number;
    gpslati: number;
    gpslong: number;
    nodeord?: number;
    updowncd?: number;
}

export interface RawNearbyStop {
    nodeid: string;
    nodenm: string;
    gpslati: number;
    gpslong: number;
    citycode?: string | number;
    nodeno?: string | number;
}

export interface RawCityRoute {
    routeid: string;
    routeno: string | number;
    routetp?: string;
    startnodenm?: string;
    endnodenm?: string;
    startvehicletime?: string | number;
    endvehicletime?: string | number;
}
