require('dotenv').config();
const express = require('express');
const OAuthClient = require('intuit-oauth');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

const oauthClient = new OAuthClient({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  environment: process.env.ENVIRONMENT,
  redirectUri: process.env.REDIRECT_URL
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const checkToken = async () => {
  try {
    const { data, error } = await supabase
      .from('qb_auth')
      .select('id, access_token, refresh_token, expires_at')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching token:', error.message);
      return { reauth: true, message: error.message };
    }

    if (data.length === 0) {
      // Indicate re-authentication is needed when no token is found
      return { reauth: true, message: 'No token found' };
    }

    let { id, access_token, refresh_token, expires_at } = data[0];

    // Check if the token has expired
    if (new Date() >= new Date(expires_at)) {
      // Refresh the token using the refresh token
      try {
        const refreshResponse = await oauthClient.refreshUsingToken(refresh_token);

        const { access_token: new_access_token, refresh_token: new_refresh_token, expires_in: new_expires_in } = refreshResponse.token;
        access_token = new_access_token;
        refresh_token = new_refresh_token;
        expires_at = new Date(Date.now() + new_expires_in * 1000).toISOString();

        // Update the tokens in the Supabase database
        const { data: updateData, error: updateError } = await supabase
          .from('qb_auth')
          .update({
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: expires_at
          })
          .eq('id', id);

        if (updateError) {
          console.error('Error updating tokens:', updateError.message);
          return { reauth: true, message: updateError.message };
        }

        return { reauth: false, access_token: access_token, expires_at: expires_at };
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError.originalMessage);
        console.error(refreshError.intuit_tid);
        return { reauth: true, message: 'Refresh token failed' };
      }
    }

    return { reauth: false, access_token: access_token, expires_at: expires_at};
  } catch (error) {
    console.error('Error during token retrieval:', error.message);
    return { reauth: true, message: error.message };
  }
};

app.get("/", async (req, res) => {
  const tokenStatus = await checkToken();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Page</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #ff0080, #7928ca);
      color: white;
      text-align: center;
    }

    .container {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
    }

    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    p {
      font-size: 1.2em;
      margin-bottom: 20px;
    }

    button {
      background-color: #007bff;
      border: none;
      color: white;
      padding: 15px 30px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
      border-radius: 24px;
    }

    button:hover {
      background-color: #0056b3;
    }
  </style>
</head>
<body>
  <div class="container" id="auth-section">
  <h1>Essntl x Quickbooks</h1>
    ${tokenStatus.reauth 
      ? `<p>The session has expired. Please log in again to authorize Essntl for Quicbooks.</p>
         <button onclick="window.location.href='/auth'">Log In</button>`
      : 'Quicbooks session is active, you can close this window.'}
  </div>
</body>
</html>
  `;

  res.type('html').send(html);
});

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

app.get('/auth', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId
    ],
    state: 'Init'
  });

  res.redirect(authUri);
});

app.get('/callback', async (req, res) => {
  const parseRedirect = req.url;
  try {
    // Attempt to create the token using the OAuth client
    const authResponse = await oauthClient.createToken(parseRedirect);
    console.log('The Token details:', authResponse);

    // Access token details directly if authResponse is an object with properties
    const { access_token, refresh_token, expires_in } = authResponse.token;

    // Calculate the expiration datetime
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Check if there is an existing row
    const { data: existingData, error: existingError } = await supabase
      .from('qb_auth')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (existingError) {
      console.error('Error checking existing tokens:', existingError.message);
      return res.status(400).json({ error: existingError.message });
    }

    if (existingData.length > 0) {
      // Update the existing row
      const { id } = existingData[0];
      const { data: updateData, error: updateError } = await supabase
        .from('qb_auth')
        .update({
          access_token: access_token,
          refresh_token: refresh_token,
          expires_at: expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating tokens:', updateError.message);
        return res.status(400).json({ error: updateError.message });
      }

      console.log('Tokens updated successfully:', updateData);
      res.send('Authentication successful and tokens updated.');
    } else {
      // Insert the tokens into the Supabase database
      const { data, error } = await supabase
        .from('qb_auth')
        .insert([
          {
            access_token: access_token,
            refresh_token: refresh_token,
            expires_at: expires_at
          }
        ]);

      if (error) {
        console.error('Error storing tokens:', error.message);
        return res.status(400).json({ error: error.message });
      }

      console.log('Tokens stored successfully:', data);
      res.send('<b>Authentication successful. You can close this window now.<b>');
    }
  } catch (error) {
    console.error('Error during authentication or database operation:', error.message);
    res.status(500).send('Internal server error.');
  }
});

app.get('/token', async (req, res) => {
  const tokenStatus = await checkToken();

  if (tokenStatus.reauth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({ access_token: tokenStatus.access_token, expires_at: tokenStatus.expires_at});
});