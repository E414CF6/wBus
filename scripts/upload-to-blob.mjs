#!/usr/bin/env node

/**
 * Upload static data files to Vercel Blob with direct overwrite.
 *
 * Usage:
 *   node scripts/upload-to-blob.mjs
 *
 * Requires BLOB_READ_WRITE_TOKEN in .env.local or environment.
 * Uploads JSON and GeoJSON static data files under public/ preserving path structure,
 * while excluding cache directories and non-data assets.
 */

import {put} from "@vercel/blob";
import {readdirSync, readFileSync, statSync} from "fs";
import {extname, join, relative} from "path";
import {config} from "dotenv";

// Load .env.local and .env
config({path: ".env.local"});
config({path: ".env"});

const PUBLIC_DIR = join(process.cwd(), "public");
const PREFIX = process.env.BLOB_PREFIX || ""; // Optional Blob path prefix

const CONTENT_TYPES = {
    ".json": "application/json",
    ".geojson": "application/geo+json",
};

/**
 * Check if a relative path inside public should be excluded from upload.
 */
function isExcluded(relPath) {
    const normalized = relPath.replace(/\\/g, "/");
    // Exclude cache directory and routeDetails.json
    if (normalized === "cache" || normalized.startsWith("cache/")) {
        return true;
    }
    if (normalized === "routeDetails.json") {
        return true;
    }
    return false;
}

function walkDir(dir) {
    const results = [];
    if (!statSync(dir).isDirectory()) return results;

    for (const entry of readdirSync(dir)) {
        if (entry.startsWith(".")) continue;

        const fullPath = join(dir, entry);
        const relPath = relative(PUBLIC_DIR, fullPath).replace(/\\/g, "/");

        if (isExcluded(relPath)) {
            continue;
        }

        if (statSync(fullPath).isDirectory()) {
            results.push(...walkDir(fullPath));
        } else {
            const ext = extname(fullPath);
            if (ext === ".json" || ext === ".geojson") {
                results.push(fullPath);
            }
        }
    }
    return results;
}

async function upload() {
    const files = walkDir(PUBLIC_DIR);
    console.log(`Found ${files.length} JSON/GeoJSON files to upload/overwrite in Vercel Blob.\n`);

    if (files.length === 0) {
        console.log("No data files found under public to upload.");
        return;
    }

    let uploaded = 0;
    const CONCURRENCY = 10;

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const chunk = files.slice(i, i + CONCURRENCY);

        await Promise.all(
            chunk.map(async (file) => {
                const relPath = relative(PUBLIC_DIR, file).replace(/\\/g, "/");
                const blobPath = PREFIX ? `${PREFIX.replace(/\/$/, "")}/${relPath}` : relPath;
                const ext = extname(file);
                const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
                const body = readFileSync(file);

                await put(blobPath, body, {
                    access: "public",
                    contentType,
                    addRandomSuffix: false,
                    allowOverwrite: true,
                });

                uploaded++;
                if (uploaded % 10 === 0 || uploaded === files.length) {
                    process.stdout.write(`\rProgress: ${uploaded} / ${files.length} uploaded`);
                }
            })
        );
    }

    console.log(`\n\nDone! Successfully overwritten/uploaded ${uploaded} files.`);
}

upload().catch((err) => {
    console.error("\nUpload failed:", err);
    process.exit(1);
});
