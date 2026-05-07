import 'dotenv/config';
import { google } from 'googleapis';
import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const REDIRECT_URI = 'http://localhost:3456';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function authenticate() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env\n' +
      'See README for instructions on creating OAuth2 credentials.'
    );
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // ensures refresh_token is always returned
  });

  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for Google to redirect back...');

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const { query } = parse(req.url!, true);
      if (query.error) {
        res.writeHead(400);
        res.end('Authentication failed: ' + query.error);
        server.close();
        reject(new Error(String(query.error)));
      } else if (query.code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>Authentication successful!</h2><p>You can close this tab.</p>');
        server.close();
        resolve(String(query.code));
      }
    });
    server.listen(3456);
  });

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      'No refresh token received. Try revoking access at ' +
      'https://myaccount.google.com/permissions and running again.'
    );
    process.exit(1);
  }

  // Save refresh token to .env
  const envPath = join(process.cwd(), '.env');
  let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

  if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
    envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/m, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } else {
    envContent = envContent.trimEnd() + `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`;
  }

  writeFileSync(envPath, envContent, 'utf-8');

  console.log('\nRefresh token saved to .env');
  console.log('You can now run: npm run sync');
}

authenticate().catch((err) => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
