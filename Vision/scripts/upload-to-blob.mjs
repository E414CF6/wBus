#!/usr/bin/env node

/**
 * Upload static data files to Vercel Blob.
 *
 * Usage:
 *   node scripts/upload-to-blob.mjs
 *
 * Requires BLOB_READ_WRITE_TOKEN in .env.local or environment.
 * Uploads everything under public/data/ preserving the path structure.
 */

import {del, list, put} from "@vercel/blob";
import {readdirSync, readFileSync, statSync} from "fs";
import {extname, join, relative} from "path";
import {config} from "dotenv";

// Load .env.local
config({path: ".env.local"});

const DATA_DIR = join(process.cwd(), "public", "data");
const PREFIX = "data"; // Blob path prefix

const CONTENT_TYPES = {
    ".json": "application/json",
    ".geojson": "application/geo+json",
};

function walkDir(dir) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith(".")) continue;
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
            results.push(...walkDir(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

async function cleanOldBlobs() {
    console.log("Cleaning existing blobs...");
    let cursor;
    let deleted = 0;
    do {
        const result = await list({prefix: PREFIX, cursor, limit: 1000});
        if (result.blobs.length > 0) {
            await del(result.blobs.map((b) => b.url));
            deleted += result.blobs.length;
        }
        cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
    console.log(`\tDeleted ${deleted} old blobs.`);
}

async function upload() {
    const files = walkDir(DATA_DIR);
    console.log(`Found ${files.length} files to upload.\n`);

    await cleanOldBlobs();

    let baseUrl = null;
    let uploaded = 0;

    for (const file of files) {
        const relPath = relative(DATA_DIR, file);
        const blobPath = `${PREFIX}/${relPath}`;
        const ext = extname(file);
        const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

        const body = readFileSync(file);
        const result = await put(blobPath, body, {
            access: "public",
            contentType,
            addRandomSuffix: false,
        });

        uploaded++;

        // Extract base URL from the first uploaded file
        if (!baseUrl) {
            // result.url = https://{store}.public.blob.vercel-storage.com/data/routeMap.json
            // We want: https://{store}.public.blob.vercel-storage.com/data
            const idx = result.url.indexOf(`/${PREFIX}/`);
            baseUrl = result.url.substring(0, idx + PREFIX.length + 1);
        }

        if (uploaded % 20 === 0 || uploaded === files.length) {
            console.log(`\t${uploaded}/${files.length} uploaded`);
        }
    }

    console.log(`\nDone! ${uploaded} files uploaded.`);
    console.log(`\nSet this in your .env.local and Vercel environment:\n`);
    console.log(`\tNEXT_PUBLIC_STATIC_API_URL="${baseUrl}"`);
    console.log(`\tNEXT_PUBLIC_USE_REMOTE_STATIC_DATA="true"\n`);
}

upload().catch((err) => {
    console.error("Upload failed:", err);
    process.exit(1);
});
