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

  // Serve static files first
  app.use(express.static(distPath, { maxAge: "1h" }));

  // Catch-all: serve index.html for SPA routing (but NOT for /api routes)
  app.use((req, res, next) => {
    // Skip if it's an API route
    if (req.path.startsWith("/api")) {
      return next();
    }
    
    // Try to serve the file, if not found, send index.html
    const filePath = path.join(distPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(distPath, "index.html"));
    }
  });
}
