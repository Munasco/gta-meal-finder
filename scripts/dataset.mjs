#!/usr/bin/env node
/**
 * Pull the dataset.
 *
 * The two large JSON files (data/ubereats-gta.json, data/health-estimates.json) are not committed.
 * They live in a public Vercel Blob store under content-addressed paths, and data/manifest.json
 * records the URL base, path and sha256 of each file.
 *
 *   node scripts/dataset.mjs pull [--force]   download missing files and verify checksums (runs before `next build`)
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const MANIFEST = path.join(DATA, "manifest.json");

const [command, ...flags] = process.argv.slice(2);
const force = flags.includes("--force");

const log = (msg) => console.log(`[dataset] ${msg}`);
const fail = (msg) => {
  console.error(`[dataset] ${msg}`);
  process.exit(1);
};
const mb = (bytes) => `${(bytes / 1_048_576).toFixed(1)} MB`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST, "utf8"));
}

async function pull() {
  const manifest = await readManifest();
  const base = manifest.baseUrl.replace(/\/$/, "");
  await mkdir(DATA, { recursive: true });
  for (const file of manifest.files) {
    const dest = path.join(DATA, file.name);
    if (existsSync(dest)) {
      const local = sha256(await readFile(dest));
      if (local === file.sha256) {
        log(`${file.name} is up to date`);
        continue;
      }
      if (!force) {
        log(`${file.name} differs from the manifest; keeping your local copy (use --force to replace it)`);
        continue;
      }
    }
    const url = `${base}/${file.path}`;
    log(`downloading ${file.name} (${mb(file.bytes)}) from ${url}`);
    const res = await fetch(url);
    if (!res.ok) fail(`${url} returned HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (got !== file.sha256) fail(`${file.name}: checksum mismatch (manifest ${file.sha256}, downloaded ${got})`);
    await writeFile(dest, buf);
    log(`saved ${path.relative(ROOT, dest)}`);
  }
}

if (command === "pull") await pull();
else fail("usage: node scripts/dataset.mjs pull [--force]");
