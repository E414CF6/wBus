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
                {/* Spinner */}
                {showLoader && (
                    <div
                        className="mb-8"
                        aria-label="Loading application"
                    >
                        <div
                            className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin shadow-2xl" />
                    </div>
                )}

                {/* App Name */}
                <h1 className="text-black dark:text-white text-5xl font-extrabold tracking-tight mb-8">
                    {APP_CONFIG.NAME}
                </h1>

                {/* Status Pill */}
                <div
                    className="flex items-center gap-2.5 px-6 py-2 bg-white/10 backdrop-blur-2xl rounded-full border border-white/20 shadow-2xl">
                    <div
                        className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-blue-50 text-[13px] font-bold tracking-wide">
                        {UI_TEXT.COMMON.LOADING_LIVE}
                    </span>
                </div>
            </div>
        </div>
    );
}
