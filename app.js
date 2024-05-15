
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
    console.log("parseRedirect");
    console.log(parseRedirect);
    oauthClient
      .createToken(parseRedirect)
      .then(function (authResponse) {
        console.log('The Token is  ' + JSON.stringify(authResponse.json));
        // Store the tokens in the Supabase database
        // const myAsyncFunction = async () => {
        //   const { data, error } = await supabase
        //     .from('qb_auth')
        //     .insert([
        //       {
        //         access_token: authResponse.getJson().access_token,
        //         refresh_token: authResponse.getJson().refresh_token,
        //       }
        //     ]);

        //   if (error) {
        //     throw error;
        //   }
        // };

        // myAsyncFunction();

        // console.log('Tokens stored successfully:', data);
        res.send('Authentication successful and tokens stored.');
      })
      .catch(function (e) {
        console.error('The error message is :' + e.originalMessage);
        console.error(e.intuit_tid);
  });
  
  } catch (err) {
      console.error(err);
  }
});

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Render!</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");
      @font-face {
        font-family: "neo-sans";
        src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      html {
        font-family: neo-sans;
        font-weight: 700;
        font-size: calc(62rem / 16);
      }
      body {
        background: white;
      }
      section {
        border-radius: 1em;
        padding: 1em;
        position: absolute;
        top: 50%;
        left: 50%;
        margin-right: -50%;
        transform: translate(-50%, -50%);
      }
    </style>
  </head>
  <body>
    <section>
      Hello from Render!
    </section>
  </body>
</html>
`
