import "server-only";

import {neonConfig, Pool} from "@neondatabase/serverless";
import {drizzle, type NeonDatabase} from "drizzle-orm/neon-serverless";
import {UI_TEXT} from "@shared/config/locale";
import * as schema from "./schema";

export type WikiDatabase = NeonDatabase<typeof schema>;

let _pool: Pool | null = null;
let _db: WikiDatabase | null = null;

function resolveDatabaseUrl(): string | null {
    const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
    return url ? url : null;
}

export function isDatabaseConfigured(): boolean {
    return resolveDatabaseUrl() !== null;
}

/**
 * Lazily initializes and returns the singleton Neon WebSocket Pool + Drizzle instance.
 * Safe at Next.js build time because no connection is opened on module import.
 */
export function getDb(): WikiDatabase {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
        throw new Error(
            UI_TEXT.API.DB.MISSING_URL
        );
    }

    if (_db) {
        return _db;
    }

    if (typeof WebSocket !== "undefined") {
        neonConfig.webSocketConstructor = WebSocket;
    }

    _pool = new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
    });

    _db = drizzle(_pool, {schema});
    return _db;
}

export async function closeDb(): Promise<void> {
    if (_pool) {
        await _pool.end();
        _pool = null;
        _db = null;
    }
}
