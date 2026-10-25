#!/usr/bin/env node
/**
 * Pull or push the crawl dataset.
 *
 * The two large JSON files (data/ubereats-gta.json, data/health-estimates.json) are not committed.
 * They live in a public Vercel Blob store under content-addressed paths, and data/manifest.json
 * records the URL base, path and sha256 of each file.
 *
 *   node scripts/dataset.mjs pull [--force]   download missing files and verify checksums (runs before `next build`)
 *   node scripts/dataset.mjs push             upload changed files to your Blob store and rewrite the manifest
 *
 * Env: DATASET_BASE_URL overrides the manifest's baseUrl for pull.
 *      BLOB_READ_WRITE_TOKEN is required for push (`vercel blob create-store <name> --access public`, then `vercel env pull`).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  const base = (process.env.DATASET_BASE_URL ?? manifest.baseUrl).replace(/\/$/, "");
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
        log(`${file.name} differs from the manifest; keeping your local copy (use --force to replace it, or data:push to publish it)`);
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

async function push() {
  const manifest = await readManifest();
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    fail(
      "BLOB_READ_WRITE_TOKEN is not set. Create a public store with `vercel blob create-store <name> --access public --yes`, then `vercel env pull` and re-run with `node --env-file=.env.local scripts/dataset.mjs push`."
    );
  }
  // The Vercel CLI refuses a read-write token when OIDC variables are also present.
  const env = { ...process.env, BLOB_READ_WRITE_TOKEN: token };
  delete env.VERCEL_OIDC_TOKEN;
  delete env.BLOB_STORE_ID;

  let changed = false;
  for (const file of manifest.files) {
    const src = path.join(DATA, file.name);
    if (!existsSync(src)) fail(`${path.relative(ROOT, src)} is missing`);
    const buf = await readFile(src);
    const hash = sha256(buf);
    if (hash === file.sha256) {
      log(`${file.name} unchanged`);
      continue;
    }
    const pathname = `datasets/${hash.slice(0, 12)}/${file.name}`;
    log(`uploading ${file.name} (${mb(buf.length)}) to ${pathname}`);
    const result = spawnSync(
      "vercel",
      ["blob", "put", src, "--access", "public", "--pathname", pathname, "--content-type", "application/json", "--non-interactive"],
      { env, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
    );
    if (result.status !== 0) fail(`upload of ${file.name} failed`);
    const url = result.stdout.match(/https:\/\/\S+/)?.[0];
    if (!url || !url.endsWith(pathname)) fail(`could not read the blob URL from the Vercel CLI output:\n${result.stdout}`);
    manifest.baseUrl = url.slice(0, url.length - pathname.length - 1);
    file.path = pathname;
    file.sha256 = hash;
    file.bytes = (await stat(src)).size;
    changed = true;
    log(`uploaded ${url}`);
  }
  if (changed) {
    manifest.updatedAt = new Date().toISOString();
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    log("manifest updated; commit data/manifest.json");
  }
}

if (command === "pull") await pull();
else if (command === "push") await push();
else fail("usage: node scripts/dataset.mjs <pull [--force] | push>");
