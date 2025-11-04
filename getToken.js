
const fetch = require('isomorphic-fetch');

async function getToken() {
  const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const body = new URLSearchParams({
    client_id: 'a1d0e902-a2c9-45bf-8946-caabce7b4987',
    scope: 'files.readwrite offline_access',
    code: 'M.C501_BAY.2.U.ae8baf17-2adb-33d3-5b11-b903135c960b',
    redirect_uri: 'http://localhost/callback',
    grant_type: 'authorization_code',
    client_secret: 'MfG8Q~BMIrjESd5p2MFldJkmzx6Eyf6agGzLPbI_'
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

getToken();
