import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { removePathIfExists } from "./runtime-postbuild-shared.mjs";

function symlinkType() {
  return process.platform === "win32" ? "junction" : "dir";
}

function relativeSymlinkTarget(sourcePath, targetPath) {
  const relativeTarget = path.relative(path.dirname(targetPath), sourcePath);
  return relativeTarget || ".";
}

function shouldMaterializeSymlinkFallback(error, type) {
  if (type === "dir" || type === "junction") {
    return false;
  }
  const code = error && typeof error === "object" ? error.code : undefined;
  return code === "EPERM" || code === "EACCES" || code === "UNKNOWN";
}

function materializeSymlinkTarget(sourcePath, targetPath) {
  const resolvedSourcePath = fs.realpathSync(sourcePath);
  const stat = fs.statSync(resolvedSourcePath);
  if (stat.isDirectory()) {
    fs.cpSync(resolvedSourcePath, targetPath, { recursive: true });
    return;
  }
  fs.copyFileSync(resolvedSourcePath, targetPath);
}

function symlinkPath(sourcePath, targetPath, type) {
  try {
    fs.symlinkSync(relativeSymlinkTarget(sourcePath, targetPath), targetPath, type);
  } catch (error) {
    // Windows builds often run without file-symlink privileges. Materialize the
    // artifact so dist-runtime still mirrors the canonical dist plugin tree.
    if (shouldMaterializeSymlinkFallback(error, type)) {
      materializeSymlinkTarget(sourcePath, targetPath);
      return;
    }
    throw error;
  }
}

function cloneSymlinkPath(sourcePath, targetPath) {
  try {
    fs.symlinkSync(fs.readlinkSync(sourcePath), targetPath);
  } catch (error) {
    if (shouldMaterializeSymlinkFallback(error)) {
      materializeSymlinkTarget(sourcePath, targetPath);
      return;
    }
    throw error;
  }
}

function shouldWrapRuntimeJsFile(sourcePath) {
  return path.extname(sourcePath) === ".js";
}

function shouldCopyRuntimeFile(sourcePath) {
  const relativePath = sourcePath.replace(/\\/g, "/");
  return (
    relativePath.endsWith("/package.json") ||
    relativePath.endsWith("/openclaw.plugin.json") ||
    relativePath.endsWith("/.codex-plugin/plugin.json") ||
    relativePath.endsWith("/.claude-plugin/plugin.json") ||
    relativePath.endsWith("/.cursor-plugin/plugin.json")
  );
}

function writeRuntimeModuleWrapper(sourcePath, targetPath) {
  const specifier = relativeSymlinkTarget(sourcePath, targetPath).replace(/\\/g, "/");
  const normalizedSpecifier = specifier.startsWith(".") ? specifier : `./${specifier}`;
  fs.writeFileSync(
    targetPath,
    [
      `export * from ${JSON.stringify(normalizedSpecifier)};`,
      `import * as module from ${JSON.stringify(normalizedSpecifier)};`,
      "export default module.default;",
      "",
    ].join("\n"),
    "utf8",
  );
}

function stagePluginRuntimeOverlay(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const dirent of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (dirent.name === "node_modules") {
      continue;
    }

    const sourcePath = path.join(sourceDir, dirent.name);
    const targetPath = path.join(targetDir, dirent.name);

    if (dirent.isDirectory()) {
      stagePluginRuntimeOverlay(sourcePath, targetPath);
      continue;
    }

    if (dirent.isSymbolicLink()) {
      cloneSymlinkPath(sourcePath, targetPath);
      continue;
    }

    if (!dirent.isFile()) {
      continue;
    }

    if (shouldWrapRuntimeJsFile(sourcePath)) {
      writeRuntimeModuleWrapper(sourcePath, targetPath);
      continue;
    }

    if (shouldCopyRuntimeFile(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      continue;
    }

    symlinkPath(sourcePath, targetPath);
  }
}

function linkPluginNodeModules(params) {
  const runtimeNodeModulesDir = path.join(params.runtimePluginDir, "node_modules");
  removePathIfExists(runtimeNodeModulesDir);
  if (!fs.existsSync(params.sourcePluginNodeModulesDir)) {
    return;
  }
  fs.symlinkSync(params.sourcePluginNodeModulesDir, runtimeNodeModulesDir, symlinkType());
}

export function stageBundledPluginRuntime(params = {}) {
  const repoRoot = params.cwd ?? params.repoRoot ?? process.cwd();
  const distRoot = path.join(repoRoot, "dist");
  const runtimeRoot = path.join(repoRoot, "dist-runtime");
  const distExtensionsRoot = path.join(distRoot, "extensions");
  const runtimeExtensionsRoot = path.join(runtimeRoot, "extensions");

  if (!fs.existsSync(distExtensionsRoot)) {
    removePathIfExists(runtimeRoot);
    return;
  }

  removePathIfExists(runtimeRoot);
  fs.mkdirSync(runtimeExtensionsRoot, { recursive: true });

  for (const dirent of fs.readdirSync(distExtensionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const distPluginDir = path.join(distExtensionsRoot, dirent.name);
    const runtimePluginDir = path.join(runtimeExtensionsRoot, dirent.name);
    const distPluginNodeModulesDir = path.join(distPluginDir, "node_modules");

    stagePluginRuntimeOverlay(distPluginDir, runtimePluginDir);
    linkPluginNodeModules({
      runtimePluginDir,
      sourcePluginNodeModulesDir: distPluginNodeModulesDir,
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  stageBundledPluginRuntime();
}
