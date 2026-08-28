#!/usr/bin/env node

/**
 * Upload Yonsei University bus timetable data to Vercel Blob.
 *
 * Usage:
 *   node scripts/upload-to-blob.mjs
 *
 * Works automatically with Vercel OIDC in Vercel environments,
 * or requires BLOB_READ_WRITE_TOKEN in .env.local for local development.
 */

import { put } from "@vercel/blob";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "src", "data", "yonseiRoutes.json");
const BLOB_PATH = "yonseiSchedule.json";

async function upload() {
  if (!existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  console.log("Reading timetable data from:", DATA_FILE);
  const fileContent = readFileSync(DATA_FILE, "utf-8");
  const parsed = JSON.parse(fileContent);
  console.log(`Uploading ${parsed.routes?.length || 0} routes to Vercel Blob (${BLOB_PATH})...`);

  try {
    const result = await put(BLOB_PATH, fileContent, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    console.log("Upload successful!");
    console.log("Blob URL:", result.url);
  } catch (err) {
    console.error("Failed to upload to Vercel Blob:", err.message);
    console.error("Tip: Set BLOB_READ_WRITE_TOKEN in your environment or enable Vercel Blob OIDC.");
    process.exit(1);
  }
}

upload();
