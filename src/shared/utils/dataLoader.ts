import {fetchAPI} from "@shared/api/fetchAPI";

let serverFsModulesPromise: Promise<{
    readFile: typeof import("fs/promises").readFile;
    existsSync: typeof import("fs").existsSync;
    join: typeof import("path").join;
}> | null = null;

function getServerFsModules() {
    if (typeof window !== "undefined") {
        throw new Error("getServerFsModules must only be called on server");
    }
    if (!serverFsModulesPromise) {
        serverFsModulesPromise = Promise.all([
            import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "fs/promises"),
            import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "fs"),
            import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "path"),
        ]).then(([fsPromises, fs, path]) => ({
            readFile: fsPromises.readFile,
            existsSync: fs.existsSync,
            join: path.join,
        }));
    }
    return serverFsModulesPromise;
}

/**
 * Loads static JSON/GeoJSON data.
 * @param fileName The name or relative path inside the `public/` directory.
 *                 For example, "routeMap.json" or "routes/WJB251000004.json"
 */
export async function loadStaticData<T>(fileName: string): Promise<T> {
    const isServer = typeof window === "undefined";
    const cleanFileName = fileName.startsWith("/") ? fileName.slice(1) : fileName;

    // Server-side: Read from public directory (bundled at build time) or /tmp
    if (isServer) {
        try {
            const {readFile, existsSync, join} = await getServerFsModules();

            const pathsToTry = [
                join("/tmp", cleanFileName),
                join(process.cwd(), "public", cleanFileName),
                join(process.cwd(), "public", "data", cleanFileName),
            ];

            for (const filePath of pathsToTry) {
                if (existsSync(/*turbopackIgnore: true*/ filePath)) {
                    const content = await readFile(/*turbopackIgnore: true*/ filePath, "utf-8");
                    return JSON.parse(content) as T;
                }
            }
        } catch (error) {
            console.error(`[loadStaticData] FS Read Error: ${cleanFileName}`, error);
        }
    }

    // Client-side (Browser): Fetch directly from public asset URL
    return fetchAPI<T>(`/${cleanFileName}`);
}
