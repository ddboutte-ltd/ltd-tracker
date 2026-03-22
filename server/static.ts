import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const cwd = process.cwd();
  console.log(`[static] process.cwd() = ${cwd}`);

  // Primary candidate: <cwd>/dist/public (expected when started from project root)
  const distPath = path.join(cwd, "dist", "public");
  console.log(`[static] primary distPath = ${distPath}`);
  console.log(`[static] primary distPath exists = ${fs.existsSync(distPath)}`);

  // Fallback candidate: <cwd>/public (in case the working directory is already dist/)
  const fallbackPath = path.join(cwd, "public");
  console.log(`[static] fallback path = ${fallbackPath}`);
  console.log(
    `[static] fallback path exists = ${fs.existsSync(fallbackPath)}`,
  );

  const resolvedPath = fs.existsSync(distPath)
    ? distPath
    : fs.existsSync(fallbackPath)
      ? fallbackPath
      : null;

  console.log(`[static] resolved static path = ${resolvedPath}`);

  if (!resolvedPath) {
    throw new Error(
      `Could not find the build directory. Tried:\n  1. ${distPath}\n  2. ${fallbackPath}\nMake sure to build the client first.`,
    );
  }

  app.use(express.static(resolvedPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.join(resolvedPath, "index.html"));
  });
}
