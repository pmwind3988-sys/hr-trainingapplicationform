// api/debug.js
const { readFileSync } = require("fs");
const { resolve } = require("path");

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  envFile.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").replace(/^"|"$/g, "").trim();
    }
  });
} catch {
  /* not local dev */
}

module.exports = function handler(req, res) {
  res.status(200).json({
    SP_SITE_URL: process.env.SP_SITE_URL ? "SET" : "MISSING",
    TENANT_ID: process.env.TENANT_ID ? "SET" : "MISSING",
    SYSTEM_CLIENT_ID: process.env.SYSTEM_CLIENT_ID ? "SET" : "MISSING",
    SYSTEM_CLIENT_SECRET: process.env.SYSTEM_CLIENT_SECRET ? "SET" : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
    cwd: process.cwd(),
  });
};
