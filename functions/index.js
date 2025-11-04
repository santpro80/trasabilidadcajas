// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const {defineString} = require('firebase-functions/params');

const oneDriveClientSecret = defineString('ONEDRIVE_CLIENT_SECRET');

admin.initializeApp();

/**
 * A Callable Function to initiate the OneDrive OAuth flow.
 * It checks for user authentication and returns a Microsoft login URL.
 */
exports.initiateOneDriveOAuth = functions.https.onCall((request) => {
  // Ensure the function is called by an authenticated user.
  if (!request.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called by an authenticated user.'
    );
  }

  // Configuration for Microsoft OAuth
  const tenantId = 'common'; // Your Tenant ID
  const clientId = 'a1d0e902-a2c9-45bf-8946-caabce7b4987'; // Your Client ID
  
  // The redirectUri must point to your handleOneDriveRedirect function.
  // IMPORTANT: Ensure this URL is registered in your Azure App Registration.
  // WARNING: Allowing the client to set the redirect URI is a security risk in production.
  // This is for local development only.
  const redirectUri = request.data.redirectUri || 'https://handleonedriveredirect-dutd52zycq-uc.a.run.app';
  
  // We use the state to pass both the UID and the origin of the request.
  // The origin is needed to redirect the user back to the correct environment (e.g., localhost).
  const state = JSON.stringify({ 
    uid: request.auth.uid,
    origin: request.data.origin,
    redirectUri: redirectUri
  });
  const scope = 'offline_access Files.ReadWrite.All';

  // Construct the authorization URL.
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${redirectUri}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  // Return the URL to the client.
  return { authUrl: authUrl };
});

/**
 * An HTTP Function to handle the redirect back from Microsoft after authentication.
 * It exchanges the authorization code for tokens and saves them to Firestore.
 */
exports.handleOneDriveRedirect = functions.https.onRequest(async (req, res) => {
  const { code, state, error } = req.query;

  console.log('Full request URL:', req.url);

  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch (e) {
    console.error('Invalid state parameter:', state);
    // Fallback to production URL if state is not valid JSON
    const projectId = admin.app().options.projectId;
    const appUrl = `https://${projectId}.web.app/cuenta.html`;
    return res.redirect(`${appUrl}?onedrive_auth=error&message=Invalid_state`);
  }

  const { uid, origin, redirectUri } = parsedState;
  const appUrl = origin || `https://${admin.app().options.projectId}.web.app/cuenta.html`;

  if (error) {
    console.error('Error returned from Microsoft:', error);
    return res.redirect(`${appUrl}?onedrive_auth=error&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('No authorization code received.');
    return res.redirect(`${appUrl}?onedrive_auth=error&message=No_code`);
  }
  
  // The 'state' should be the Firebase User ID (UID).
  if (!state) {
    console.error('No state parameter received (expected UID).');
    return res.redirect(`${appUrl}?onedrive_auth=error&message=No_state`);
  }

  try {
    // Retrieve client secret using the new parameterized configuration
    const clientSecret = oneDriveClientSecret.value();

    const tenantId = 'common';
    const clientId = 'a1d0e902-a2c9-45bf-8946-caabce7b4987';
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        scope: 'offline_access Files.ReadWrite.All',
        code: code,
        redirect_uri: redirectUri, // Use the redirectUri from the state
        grant_type: 'authorization_code',
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Save the refresh token securely in Firestore, linked to the user's UID.
    await admin.firestore().collection('users').doc(state).set({
      oneDriveRefreshToken: refresh_token,
      oneDriveAccessToken: access_token,
      oneDriveAccessTokenExpires: admin.firestore.Timestamp.fromMillis(Date.now() + (expires_in * 1000)),
    }, { merge: true });

    console.log(`Successfully stored OneDrive tokens for user: ${state}`);

    // Redirect the user back to their account page with a success message.
    return res.redirect(`${appUrl}?onedrive_auth=success`);

  } catch (err) {
    console.error('Error exchanging code for tokens:', err.response ? err.response.data : err.message);
    return res.redirect(`${appUrl}?onedrive_auth=error&message=Token_exchange_failed`);
  }
});

/**
 * Refreshes the OneDrive access token using the refresh token.
 * @param {string} refreshToken The user's OneDrive refresh token.
 * @return {Promise<object>} The new token data from Microsoft.
 */
async function refreshAccessToken(refreshToken) {
  const tenantId = '99b8b8ef-30d8-4de6-a5cf-2dd8f4dc3e85';
  const clientId = 'a1d0e902-a2c9-45bf-8946-caabce7b4987';
  const clientSecret = oneDriveClientSecret.value();

  try {
    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        scope: 'offline_access Files.ReadWrite.All',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    console.log('Successfully refreshed access token.');
    return response.data;
  } catch (error) {
    console.error('Error refreshing access token:', error.response ? error.response.data : error.message);
    // If refresh fails, the user might need to re-authenticate.
    // We'll clear the stored tokens to prompt re-authentication.
    // Consider how to handle this on the client side.
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Failed to refresh OneDrive token. Please reconnect your OneDrive account.',
      error.response ? error.response.data : null
    );
  }
}

/**
 * A Callable Function to upload a PDF file (as base64) to OneDrive.
 */
exports.uploadPdfToOneDrive = functions.https.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
  }

  const { pdfBase64, fileName, folderPath } = request.data;
  if (!pdfBase64 || !fileName || !folderPath) {
    throw new functions.httpss.HttpsError('invalid-argument', 'The function must be called with "pdfBase64", "fileName", and "folderPath".');
  }

  const uid = request.auth.uid;
  const userDocRef = admin.firestore().collection('users').doc(uid);

  try {
    const userDoc = await userDocRef.get();
    if (!userDoc.exists || !userDoc.data().oneDriveRefreshToken) {
      throw new functions.https.HttpsError('failed-precondition', 'User is not connected to OneDrive.');
    }

    let { oneDriveRefreshToken, oneDriveAccessToken, oneDriveAccessTokenExpires } = userDoc.data();
    const expires = oneDriveAccessTokenExpires.toDate();

    // Check if the token is expired or will expire in the next 5 minutes
    if (Date.now() >= expires.getTime() - (5 * 60 * 1000)) {
      console.log('Access token expired or expiring soon. Refreshing...');
      const newTokenData = await refreshAccessToken(oneDriveRefreshToken);
      
      // Update the local variables and save the new token to Firestore
      oneDriveAccessToken = newTokenData.access_token;
      oneDriveRefreshToken = newTokenData.refresh_token; // Microsoft may return a new refresh token
      
      await userDocRef.update({
        oneDriveAccessToken: newTokenData.access_token,
        oneDriveRefreshToken: newTokenData.refresh_token,
        oneDriveAccessTokenExpires: admin.firestore.Timestamp.fromMillis(Date.now() + (newTokenData.expires_in * 1000)),
      });
    }

    // The PDF data is a base64 string. We need to convert it to a buffer for the upload.
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Use Microsoft Graph API to upload the file.
    // This will create or replace the file at the specified path.
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`;

    await axios.put(uploadUrl, pdfBuffer, {
      headers: {
        'Authorization': `Bearer ${oneDriveAccessToken}`,
        'Content-Type': 'application/pdf',
      },
    });

    console.log(`Successfully uploaded '${fileName}' to OneDrive for user ${uid}.`);
    return { success: true, message: `Archivo '${fileName}' subido a OneDrive con éxito.` };

  } catch (error) {
    console.error(`Failed to upload file for user ${uid}:`, error.response ? error.response.data : error.message);
    if (error instanceof functions.https.HttpsError) {
      throw error; // Re-throw HttpsError from refreshAccessToken or preconditions
    }
    throw new functions.https.HttpsError('internal', 'An unexpected error occurred while uploading the file.', error.message);
  }
});