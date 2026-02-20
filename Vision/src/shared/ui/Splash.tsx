import { APP_CONFIG, UI_CONFIG } from "@core/config/env";
import { UI_TEXT } from "@core/config/locale";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface SplashProps {
    /** Controls the visibility of the splash screen. When false, the fade-out begins. */
    isVisible: boolean;
    /** Animation duration in milliseconds for the fade-out transition. Default: 500ms. */
    duration?: number;
    /** Whether to show the circular loading spinner. Default: true. */
    showLoader?: boolean;
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * Splash screen component that displays during app initialization.
 * Handles the "Enter" -> "Wait" -> "Fade Out" -> "Unmount" lifecycle.
 */
export default function Splash({
    isVisible,
    duration = UI_CONFIG.TRANSITIONS.SPLASH_FADE_MS || 500,
    showLoader = true,
}: SplashProps) {
    return (
        <div
            role="status"
            aria-live={isVisible ? "polite" : "off"}
            aria-atomic="true"
            aria-hidden={!isVisible}
            className={`
        fixed inset-0 z-[9999] 
        flex flex-col items-center justify-center
        bg-white dark:bg-black
        transition-opacity ease-out
        ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
      `}
            style={{ transitionDuration: `${duration}ms` }}
        >
            <div className="relative z-10 flex flex-col items-center">
                {/* App Name */}
                <h1 className="text-black dark:text-white text-5xl font-extrabold tracking-tight mb-8">
                    {APP_CONFIG.NAME}
                </h1>

                {/* Spinner & Status */}
                {showLoader && (
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className="w-8 h-8 border-3 border-gray-200 dark:border-gray-800 border-t-black dark:border-t-white rounded-full animate-spin"
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide">
                            {UI_TEXT.COMMON.LOADING_LIVE}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
