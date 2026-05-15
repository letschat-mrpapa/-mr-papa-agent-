const { google } = require("googleapis");
require("dotenv").config();

async function getRefreshToken() {
  const code = process.argv[2]; // El código de la URL

  if (!code) {
    console.log("X Uso: node getRefreshToken.js CODE_AQUI");
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "http://localhost:3000/oauth2callback"
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n✅ Refresh Token:");
    console.log(tokens.refresh_token);
    console.log("\n");
  } catch (error) {
    console.error("X Error:", error.message);
  }
}

getRefreshToken();