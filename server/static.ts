import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // For both development and production builds
  const publicPath1 = path.resolve(process.cwd(), "dist", "public");
  const publicPath2 = path.resolve(process.cwd(), "public");
  
  let distPath = publicPath1;
  
  // If dist/public doesn't exist, try public directory
  if (!fs.existsSync(distPath)) {
    distPath = publicPath2;
  }
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory. Tried: ${publicPath1} and ${publicPath2}. Make sure to run "npm run build" first.`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html for all non-API routes (SPA routing)
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
