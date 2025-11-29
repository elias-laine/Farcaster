import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Vite builds to dist/public - that's where our static files are
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Frontend build not found at ${distPath}. Run "npm run build" first.`,
    );
  }

  // Serve static files from dist/public
  app.use(express.static(distPath));

  // SPA routing: serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) res.status(500).send(err);
    });
  });
}
