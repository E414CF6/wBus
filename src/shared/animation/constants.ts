// ----------------------------------------------------------------------
// Constants — Real-Time Smooth Interpolation, Rapid Catch-Up & Safeguards
// ----------------------------------------------------------------------

// Ignore backward jumps smaller than this (GPS jitter in meters)
export const BACKWARD_JITTER_METERS = 20;

// Scalar distance drop in meters that signals route restart / turnaround loop
export const SCALAR_LOOP_RESTART_THRESHOLD_METERS = 400;

// Maximum distance backward/forward before teleporting instead of smooth transition (800m)
export const TELEPORT_DISTANCE_METERS = 800;
export const TELEPORT_COORD_THRESHOLD = 0.0075; // ~830m

// Maximum distance the animated marker is ever allowed to dead-reckon ahead of the last confirmed API position (~1.75km)
// 1차 예측 지점 이후의 예측 거리를 넉넉하게 확장하여 다음 API 수신이 늦어져도 끊김 없이 길게 지속 주행
export const MAX_DEAD_RECKONING_LEAD_COORD = 0.0160;

// Maximum latency compensation projection allowed upon receiving fresh API data (~400m)
// 1차 예측 지점: API 지연 보정 목표 거리
export const MAX_LATENCY_PROJECTION_COORD = 0.0036;

// 1차 예측 지점 통과 후 2차 외삽 예측 속도 비율 (기본 주행 속도의 85%를 유지하여 적극적으로 전진 주행)
export const POST_TARGET_VELOCITY_RATIO = 0.85;

// React state update throttle — 20 Hz (50ms) for UI popup consumers
export const STATE_UPDATE_THROTTLE_MS = 50;

// Cap per-frame dt to prevent wild jumps when tab was backgrounded
export const MAX_DT_MS = 200;

// City bus base cruising speed (coord-units / ms)
// 1 degree ≈ 111 km → 34 km/h = 9.44 m/s ≈ 8.5e-8 deg/ms
export const CITY_BUS_BASE_VELOCITY = 0.000000085;

// Velocity limits (coord-units / ms)
// Min crawling speed (~10 km/h), Max cruising (~95 km/h), Rapid Catchup sprint (~350 km/h scalar)
export const MIN_MOVING_VELOCITY = 0.000000025;
export const MAX_VELOCITY = 0.00000024;
export const MAX_CATCHUP_VELOCITY = 0.00000085;
export const STOP_THRESHOLD = 0.000000005;

// Velocity smoothing factor (EMA weight on new measurement)
export const VELOCITY_SMOOTHING = 0.70;
// Deceleration smoothing factor (faster adaptation when new API delta shows bus slowed down)
export const VELOCITY_DECEL_SMOOTHING = 0.88;

// Weight given to measured velocity vs prior (starts high to adapt quickly)
export const VELOCITY_PRIOR_BLEND_MIN = 0.6;
export const VELOCITY_PRIOR_BLEND_MAX = 0.95;
export const VELOCITY_PRIOR_RAMP_SAMPLES = 2;

// Default estimated latency between real bus and client reception (ms)
export const DEFAULT_DATA_DELAY_MS = 12000;

// Dead reckoning duration:
// Smooth forward extrapolation for up to 60s between GPS updates (capped by MAX_DEAD_RECKONING_LEAD_COORD)
export const DEAD_RECKONING_CRUISE_MS = 60000;
// Graceful deceleration coasting from 60s to 100s if no data arrives
export const DEAD_RECKONING_FADEOUT_MS = 40000;

// Rapid Catch-Up time constant:
// Fast exponential convergence (~500ms) with non-linear boost to rapidly catch up when slow API data arrives
export const CATCHUP_TAU_MS = 500;

// Acceleration/deceleration transition easing (ms) - rapid throttle-up
export const VELOCITY_TAU_MS = 100;

// Angular smoothing
export const ANGULAR_LOOKAHEAD_THRESHOLD = 0.65;
export const ANGULAR_SMOOTHING_FACTOR = 0.22;

// --- Stop-aware speed modulation ---
// Deceleration zone before a stop (~100m ≈ 0.0009 degrees)
export const STOP_DECEL_ZONE = 0.0009;
// Acceleration zone after a stop (~65m ≈ 0.0006 degrees)
export const STOP_ACCEL_ZONE = 0.0006;
// Proximity threshold to trigger station dwell (~20m ≈ 0.00018 degrees)
export const STOP_DWELL_PROXIMITY = 0.00018;
// Minimum speed multiplier during approach (자연스러운 주행 유지를 위해 40%로 완화)
export const STOP_MIN_SPEED_MULT = 0.40;
// Realistic passenger boarding dwell time at a stop during extrapolation (ms) (과도한 정차 지연 방지)
export const STOP_DWELL_MS = 2000;
