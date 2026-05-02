package app.vercel.wbus.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Urgency levels based on arrival time
 * Matches the web app design system
 */
enum class UrgencyLevel {
    URGENT,      // ≤ 3 min
    APPROACHING, // ≤ 7 min
    COMING,      // ≤ 15 min
    WAITING,     // > 15 min
    DEFAULT      // No time info
}

/**
 * Get urgency level based on minutes until arrival
 */
fun getUrgencyLevel(minutesUntilArrival: Int?): UrgencyLevel {
    return when {
        minutesUntilArrival == null -> UrgencyLevel.DEFAULT
        minutesUntilArrival <= 3 -> UrgencyLevel.URGENT
        minutesUntilArrival <= 7 -> UrgencyLevel.APPROACHING
        minutesUntilArrival <= 15 -> UrgencyLevel.COMING
        else -> UrgencyLevel.WAITING
    }
}

/**
 * Get color for urgency level
 */
fun getUrgencyColor(urgency: UrgencyLevel): Color {
    return when (urgency) {
        UrgencyLevel.URGENT -> UrgentRed
        UrgencyLevel.APPROACHING -> ApproachingAmber
        UrgencyLevel.COMING -> ComingEmerald
        UrgencyLevel.WAITING -> WaitingBlue
        UrgencyLevel.DEFAULT -> DefaultIndigo
    }
}

/**
 * Get color directly from minutes
 */
fun getUrgencyColorFromMinutes(minutesUntilArrival: Int?): Color {
    return getUrgencyColor(getUrgencyLevel(minutesUntilArrival))
}

/**
 * Get text for urgency level in Korean
 */
fun getUrgencyText(minutesUntilArrival: Int?): String {
    return when {
        minutesUntilArrival == null -> "정보 없음"
        minutesUntilArrival <= 0 -> "곧 도착"
        minutesUntilArrival == 1 -> "1분 전"
        else -> "${minutesUntilArrival}분 전"
    }
}
