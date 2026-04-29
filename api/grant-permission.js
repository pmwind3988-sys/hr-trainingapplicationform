const { readFileSync } = require("fs");
const { resolve } = require("path");

// Load .env.local
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  });
} catch {}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const TENANT_ID     = process.env.TENANT_ID;
  const CLIENT_ID     = process.env.SYSTEM_CLIENT_ID;
  const CLIENT_SECRET = process.env.SYSTEM_CLIENT_SECRET;

  // Step 1 — verify env vars loaded
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      step: "env",
      TENANT_ID:     !!TENANT_ID,
      CLIENT_ID:     !!CLIENT_ID,
      CLIENT_SECRET: !!CLIENT_SECRET,
    });
  }

  // Step 2 — get Graph token
  let access_token;
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "client_credentials",
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          scope:         "https://graph.microsoft.com/.default",
        }).toString(),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(502).json({ step: "token_failed", tokenData });
    }

    access_token = tokenData.access_token;
  } catch (e) {
    return res.status(500).json({ step: "token_exception", error: e.message });
  }

  // Step 3 — grant permission
  // PASTE YOUR FULL SITE ID BETWEEN THE QUOTES:
  const SITE_ID = "5457fb86-10c2-4c72-9658-38a06c580e2e";

  try {
    const grantRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roles: ["write"],
          grantedToIdentities: [{
            application: {
              id:          CLIENT_ID,
              displayName: "PMW HR Forms System",
            }
          }]
        }),
      }
    );

    const grantData = await grantRes.json();
    return res.status(200).json({ ok: true, grant: grantData });

  } catch (e) {
    return res.status(500).json({ step: "grant_exception", error: e.message });
  }
};