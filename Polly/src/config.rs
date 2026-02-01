//! Configuration Constants

// ============================================================================
// Constants
// ============================================================================

// API Endpoints
pub const TAGO_URL: &str = "http://apis.data.go.kr/1613000/BusRouteInfoInqireService";
pub const OSRM_URL: &str = "http://router.project-osrm.org/route/v1/driving";

// Constants for the Wonju Bus Information System website.
pub const BASE_URL: &str = "http://its.wonju.go.kr/bus/bus04.do";
pub const DETAIL_URL: &str = "http://its.wonju.go.kr/bus/bus04Detail.do";

// Concurrency settings for async tasks
pub const CONCURRENCY_FETCH: usize = 10;
pub const CONCURRENCY_SNAP: usize = 4;

// OSRM chunk size (number of stops per request)
pub const OSRM_CHUNK_SIZE: usize = 120;
