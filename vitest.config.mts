import path from "path";
import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
    }, resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "./src"),
            "@shared": path.resolve(import.meta.dirname, "./src/shared"),
            "@entities": path.resolve(import.meta.dirname, "./src/entities"),
            "@features": path.resolve(import.meta.dirname, "./src/features"),
            "@widgets": path.resolve(import.meta.dirname, "./src/widgets"),
            "@data": path.resolve(import.meta.dirname, "./src/data"),
            "@app": path.resolve(import.meta.dirname, "./src/app"),
            "@lib": path.resolve(import.meta.dirname, "./src/lib"),
            "@types": path.resolve(import.meta.dirname, "./src/types"),
        },
    },
});
