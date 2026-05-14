#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || process.env.PUBLISH_DRY_RUN === "1";
const skipTests = args.has("--skip-tests") || process.env.PUBLISH_SKIP_TESTS === "1";
const tag = process.env.NPM_TAG;
const otp = process.env.NPM_OTP;

const packages = [
  { dir: "packages/core", name: "@memexai/core" },
  { dir: "packages/sdk", name: "@memexai/sdk" },
  { dir: "packages/admin-cli", name: "@memexai/admin" },
];

function run(command, commandArgs, options = {}) {
  console.log(`\n$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureNpmAuth() {
  console.log("\n$ npm whoami");
  const result = spawnSync("npm", ["whoami"], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    console.error("Cannot publish: npm authentication is not configured for this environment.");
    console.error("Run `npm login`, set `NPM_TOKEN`/`NODE_AUTH_TOKEN`, or configure an .npmrc token, then retry `bun run publish:packages`.");
    if (details) console.error(details);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(result.stdout);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rewriteWorkspaceRanges(manifest, localVersions) {
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = manifest[field];
    if (!deps) continue;

    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        const version = localVersions.get(name);
        if (!version) {
          throw new Error(`Cannot publish ${manifest.name}: ${name} uses ${range}, but it is not in the release set.`);
        }
        deps[name] = version;
      }
    }
  }
}

function stagePackage(pkg, localVersions, stageRoot) {
  const packageDir = path.join(root, pkg.dir);
  const manifest = readJson(path.join(packageDir, "package.json"));
  const stageDir = path.join(stageRoot, pkg.dir);

  rmSync(stageDir, { recursive: true, force: true });

  const files = new Set(["package.json", ...(manifest.files ?? [])]);
  for (const file of files) {
    const from = path.join(packageDir, file);
    if (!existsSync(from)) {
      console.warn(`Skipping missing publish file for ${manifest.name}: ${file}`);
      continue;
    }
    cpSync(from, path.join(stageDir, file), { recursive: true });
  }

  rewriteWorkspaceRanges(manifest, localVersions);

  if (manifest.scripts) {
    delete manifest.scripts.prepublishOnly;
    delete manifest.scripts.prepare;
  }

  writeJson(path.join(stageDir, "package.json"), manifest);
  return stageDir;
}

const manifests = packages.map((pkg) => ({
  ...pkg,
  manifest: readJson(path.join(root, pkg.dir, "package.json")),
}));

const localVersions = new Map(manifests.map((pkg) => [pkg.manifest.name, pkg.manifest.version]));
const versions = new Set(manifests.map((pkg) => pkg.manifest.version));

if (versions.size !== 1) {
  console.warn(`Publishing packages with mixed versions: ${[...versions].join(", ")}`);
}

if (!skipTests) {
  run("bun", ["test"]);
}

run("bun", ["run", "build"]);

if (!dryRun) {
  ensureNpmAuth();
}

const stageRoot = mkdtempSync(path.join(tmpdir(), "memexai-publish-"));
console.log(`\nStaging packages in ${stageRoot}`);

try {
  for (const pkg of manifests) {
    const stageDir = stagePackage(pkg, localVersions, stageRoot);
    const publishArgs = ["publish", "--access", "public"];
    if (dryRun) publishArgs.push("--dry-run");
    if (tag) publishArgs.push("--tag", tag);
    if (otp) publishArgs.push("--otp", otp);
    run("bun", publishArgs, { cwd: stageDir });
  }
} finally {
  if (process.env.PUBLISH_KEEP_STAGE !== "1") {
    rmSync(stageRoot, { recursive: true, force: true });
  } else {
    console.log(`Kept publish staging directory: ${stageRoot}`);
  }
}
