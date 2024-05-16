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

app.get("/", (req, res) => res.type('html').send(html));

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
    res.send('Authentication successful and tokens stored.');
  } catch (error) {
    console.error('Error during authentication or database operation:', error.message);
    res.status(500).send('Internal server error.');
  }
});

// New /token route to fetch and return the access_token
app.get('/token', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qb_auth')
      .select('id, access_token, refresh_token, expires_at')
      .order('id', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching token:', error.message);
      return res.status(400).json({ error: error.message });
    }

    if (data.length === 0) {
      return res.status(404).json({ error: 'No token found' });
    }

    let { id, access_token, refresh_token, expires_at } = data[0];

    // Check if the token has expired
    if (new Date() >= new Date(expires_at)) {
      // Refresh the token using the refresh token
      try {
        const refreshResponse = await oauthClient.refreshUsingToken(refresh_token);
        console.log('Tokens refreshed:', refreshResponse);

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
          return res.status(400).json({ error: updateError.message });
        }

        console.log('Tokens updated successfully:', updateData);
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError.originalMessage);
        return res.status(500).send('Internal server error during token refresh.');
      }
    }

    res.json({ access_token: access_token });
  } catch (error) {
    console.error('Error during token retrieval:', error.message);
    res.status(500).send('Internal server error.');
  }
});

const html = `
<!DOCTYPE html>
<html>
  <body>
    <section>
      Authenticating with QuickBooks Online
    </section>
  </body>
</html>
`