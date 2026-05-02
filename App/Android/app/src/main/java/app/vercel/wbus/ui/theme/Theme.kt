package app.vercel.wbus.ui.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColorScheme = lightColorScheme(
    primary = PrimaryIndigo,
    onPrimary = LightBackground,
    primaryContainer = Gray100,
    onPrimaryContainer = Gray900,
    secondary = PrimaryBlue,
    onSecondary = LightBackground,
    secondaryContainer = Gray200,
    onSecondaryContainer = Gray800,
    tertiary = ThemeColor,
    onTertiary = LightBackground,
    error = UrgentRed,
    onError = LightBackground,
    background = LightBackground,
    onBackground = Gray900,
    surface = LightSurface,
    onSurface = Gray900,
    surfaceVariant = Gray100,
    onSurfaceVariant = Gray600,
    outline = Gray300,
    outlineVariant = Gray200,
    scrim = Gray900.copy(alpha = 0.32f)
)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryIndigo,
    onPrimary = LightBackground, // High contrast
    primaryContainer = Gray800,
    onPrimaryContainer = Gray100,
    secondary = PrimaryBlue,
    onSecondary = LightBackground,
    secondaryContainer = Gray700,
    onSecondaryContainer = Gray200,
    tertiary = WaitingBlue,
    onTertiary = DarkBackground,
    error = UrgentRed,
    onError = DarkBackground,
    background = DarkBackground,
    onBackground = Gray100,
    surface = DarkSurface,
    onSurface = Gray100,
    surfaceVariant = Gray800,
    onSurfaceVariant = Gray400,
    outline = Gray700,
    outlineVariant = Gray800,
    scrim = LightBackground.copy(alpha = 0.32f)
)

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Composable
fun WBusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = false, // Disabled for specific brand look
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = view.context.findActivity()?.window ?: return@SideEffect
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme, typography = Typography, content = content
    )
}
