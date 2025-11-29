import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  let distPath = path.resolve(process.cwd(), "dist", "public");

  // Fallback paths
  if (!fs.existsSync(distPath)) {
    const alternates = [
      path.join(process.cwd(), "public"),
      path.join(__dirname, "..", "dist", "public"),
      path.join(__dirname, "..", "public"),
    ];

    for (const alt of alternates) {
      if (fs.existsSync(alt)) {
        distPath = alt;
        console.log(`[static] Using fallback path: ${distPath}`);
        break;
      }
    }
  }

  if (!fs.existsSync(distPath)) {
    console.error(`[static] No frontend build found. Checked: ${distPath}`);
    // Don't crash - just serve a simple message
    app.get("*", (_req, res) => {
      res.status(503).json({
        error: "Frontend not built yet",
        status: "building"
      });
    });
    return;
  }

  console.log(`[static] Serving from: ${distPath}`);
  app.use(express.static(distPath));
  
  // SPA routing
  app.get("*", (_req, res) => {
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "index.html not found" });
    }
  });
}
