# API

Infrastructure documentation for the wBus project, covering `API Gateway` and `CloudFront` configuration.

## Architecture

```text
[Live API]
Client ← CloudFront (Edge Cache) ← API Gateway (Param Mapping / Header Injection) ← Public Data API

[Static Data]
Client ← CloudFront ← S3 (JSON / Static Assets)
```

## CloudFront Cache Policy

A **micro-caching** strategy is applied so that CloudFront correctly honors the `Cache-Control` headers set by API Gateway.

| Setting | Value | Notes |
| --- | --- | --- |
| Minimum TTL | `0` | Must be 0 so that API Gateway's `s-maxage` / `max-age` takes precedence |
| Default TTL | `2` | Micro-caching baseline (2 s) |
| Maximum TTL | `31536000` | 1 year — accommodates long-lived static responses |

**Cache Key Configuration:**

| Component | Value | Notes |
| --- | --- | --- |
| Headers | None | Include `Origin` if serving multiple origins |
| Query Strings | All | Required to separate caches per `busStopId`, `routeId`, etc. |
| Cookies | None | — |

## Reference Settings for API Gateway

```json
{
  "openapi": "3.0.1",
  "info": {
    "title": "wBus",
    "description": "API Gateway for Visualized Bus Project",
    "version": "2026-03-04 12:56:53UTC"
  },
  "servers": [
    {
      "url": "https://YOUR_API_GATEWAY.execute-api.ap-northeast-2.amazonaws.com/{basePath}",
      "variables": {
        "basePath": {
          "default": ""
        }
      }
    }
  ],
  "paths": {
    "/getBusArrivalInfo/{busStopId}": {
      "get": {
        "responses": {
          "default": {
            "description": "Default response for GET /getBusArrivalInfo/{busStopId}"
          }
        },
        "x-amazon-apigateway-integration": {
          "responseParameters": {
            "200": {
              "overwrite:header.Cache-Control": "public, s-maxage=3, stale-while-revalidate=9"
            }
          },
          "requestParameters": {
            "append:querystring.nodeId": "$request.path.busStopId",
            "append:querystring.numOfRows": "1024",
            "append:querystring.pageNo": "1",
            "append:querystring._type": "json",
            "append:querystring.cityCode": "32020",
            "append:querystring.serviceKey": "YOUR_DECODED_KEY"
          },
          "payloadFormatVersion": "1.0",
          "type": "http_proxy",
          "httpMethod": "GET",
          "uri": "http://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList",
          "connectionType": "INTERNET",
          "timeoutInMillis": 12000
        }
      },
      "parameters": [
        {
          "name": "busStopId",
          "in": "path",
          "description": "Generated path parameter for busStopId",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    },
    "/getBusLocation/{routeId}": {
      "get": {
        "responses": {
          "default": {
            "description": "Default response for GET /getBusLocation/{routeId}"
          }
        },
        "x-amazon-apigateway-integration": {
          "responseParameters": {
            "200": {
              "overwrite:header.Cache-Control": "public, s-maxage=2, stale-while-revalidate=4"
            }
          },
          "requestParameters": {
            "append:querystring.numOfRows": "1024",
            "append:querystring.pageNo": "1",
            "append:querystring._type": "json",
            "append:querystring.cityCode": "32020",
            "append:querystring.routeId": "$request.path.routeId",
            "append:querystring.serviceKey": "YOUR_DECODED_KEY"
          },
          "payloadFormatVersion": "1.0",
          "type": "http_proxy",
          "httpMethod": "GET",
          "uri": "http://apis.data.go.kr/1613000/BusLcInfoInqireService/getRouteAcctoBusLcList",
          "connectionType": "INTERNET",
          "timeoutInMillis": 12000
        }
      },
      "parameters": [
        {
          "name": "routeId",
          "in": "path",
          "description": "Generated path parameter for routeId",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    },
    "/getBusStopLocation/{routeId}": {
      "get": {
        "responses": {
          "default": {
            "description": "Default response for GET /getBusStopLocation/{routeId}"
          }
        },
        "x-amazon-apigateway-integration": {
          "responseParameters": {
            "200": {
              "overwrite:header.Cache-Control": "public, max-age=1000, stale-while-revalidate=24"
            }
          },
          "requestParameters": {
            "append:querystring.numOfRows": "1024",
            "append:querystring.pageNo": "1",
            "append:querystring._type": "json",
            "append:querystring.cityCode": "32020",
            "append:querystring.routeId": "$request.path.routeId",
            "append:querystring.serviceKey": "YOUR_DECODED_KEY"
          },
          "payloadFormatVersion": "1.0",
          "type": "http_proxy",
          "httpMethod": "GET",
          "uri": "http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList",
          "connectionType": "INTERNET",
          "timeoutInMillis": 12000
        }
      },
      "parameters": [
        {
          "name": "routeId",
          "in": "path",
          "description": "Generated path parameter for routeId",
          "required": true,
          "schema": {
            "type": "string"
          }
        }
      ]
    }
  },
  "x-amazon-apigateway-cors": {
    "allowMethods": [
      "GET",
      "HEAD",
      "OPTIONS"
    ],
    "allowHeaders": [
      "client",
      "content-type"
    ],
    "exposeHeaders": [
      "date"
    ],
    "maxAge": 300,
    "allowCredentials": false,
    "allowOrigins": [
      "https://wbus.vercel.app"
    ]
  },
  "x-amazon-apigateway-importexport-version": "1.0"
}
```
