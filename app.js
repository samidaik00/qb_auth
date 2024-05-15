
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
    console.log('The Token is ' + JSON.stringify(authResponse.getJson()));

    // Attempt to insert the tokens into the Supabase database
    const { data, error } = await supabase
      .from('qb_auth')
      .insert([
        {
          access_token: authResponse.getJson().access_token,
          refresh_token: authResponse.getJson().refresh_token,
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
