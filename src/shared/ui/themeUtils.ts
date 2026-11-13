export type ThemePreference = "system" | "light" | "dark";

/**
 * Applies the selected theme preference via next-themes setter and immediately
 * synchronizes the root HTML element's `dark` class and `colorScheme`.
 */
export function applyThemePreference(
    nextTheme: ThemePreference,
    setTheme: (theme: string) => void
): void {
    setTheme(nextTheme);
    if (typeof document === "undefined") return;

    if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
    } else if (nextTheme === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.colorScheme = "light";
    } else {
        const prefersDark =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", prefersDark);
        document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";
    }
}
