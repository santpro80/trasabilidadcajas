
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { AuthorizationCode } = require('simple-oauth2');
const axios = require('axios');

// Admin SDK's initialization is likely in index.js, but good practice to ensure it.
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

// --- Microsoft Graph OAuth2 Configuration ---
// IMPORTANT: Store these as Firebase secrets
// Get secrets
const client_id = functions.config().onedrive.client_id;
const client_secret = functions.config().onedrive.client_secret;


const oauth2Client = new AuthorizationCode({
  client: {
    id: client_id,
    secret: client_secret,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    tokenPath: 'common/oauth2/v2.0/token',
    authorizePath: 'common/oauth2/v2.0/authorize',
  },
  options: {
    authorizationMethod: 'body',
  },
});

/**
 * Refreshes the OneDrive access token for a specific user.
 * @param {string} userId The Firestore document ID for the user.
 * @returns {Promise<void>}
 */
async function refreshUserToken(userId) {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists || !userDoc.data().oneDriveRefreshToken) {
        console.log(`User ${userId} does not have a refresh token. Skipping.`);
        return;
    }

    const tokenData = userDoc.data().oneDriveTokenData || {};
    let accessToken = oauth2Client.createToken(tokenData);

     console.log(`Checking token for user ${userId}.`);

    // Force refresh, since we run this on a schedule, not on-demand
    console.log(`Attempting to refresh token for user ${userId}.`);
    try {
        const refreshTokenObject = { refresh_token: userDoc.data().oneDriveRefreshToken };
        // We use the oauth2Client library instance to refresh the token
        const newAccessToken = await new Promise((resolve, reject) => {
            const token = oauth2Client.createToken({ refresh_token: userDoc.data().oneDriveRefreshToken });
            token.refresh(refreshTokenObject, (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            });
        });

        // Save the new token (which might include a new refresh token)
        await userDocRef.update({
            oneDriveTokenData: newAccessToken.token,
            oneDriveRefreshToken: newAccessToken.token.refresh_token || userDoc.data().oneDriveRefreshToken,
        });
        console.log(`Successfully refreshed and saved token for user ${userId}.`);

    } catch (error) {
        console.error(`Error refreshing token for user ${userId}:`, error.message);
        // Optional: Notify the user or admin that re-authentication is needed
        await userDocRef.update({
            oneDriveTokenError: 'Failed to refresh token. Please reconnect your OneDrive account.'
        });
    }
}


/**
 * A Pub/Sub triggered function that iterates through all users and refreshes their tokens.
 */
exports.scheduledTokenRefresh = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
    console.log('Running scheduled token refresh for all users.');

    const usersSnapshot = await db.collection('users').where('oneDriveRefreshToken', '!=', null).get();

    if (usersSnapshot.empty) {
        console.log('No users with OneDrive refresh tokens found.');
        return null;
    }

    const promises = [];
    usersSnapshot.forEach(doc => {
        promises.push(refreshUserToken(doc.id));
    });

    await Promise.all(promises);
    console.log('Finished scheduled token refresh.');
    return null;
});
