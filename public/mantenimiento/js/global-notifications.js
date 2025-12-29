/** *
 * Sets up a real-time listener on the tickets collection to display a global notification badge.
 * The badge shows the total number of unread messages for the current user's role.
 * 
 * @param {object} db - The Firestore database instance.
 * @param {function} collection - Firestore collection function.
 * @param {function} query - Firestore query function.
 * @param {function} where - Firestore where function.
 * @param {function} onSnapshot - Firestore onSnapshot function.
 * @param {object} user - The current authenticated user object.
 * @param {string} userRole - The role of the current user ('supervisor' or 'operador').
 */
export function setupTicketNotifications(db, collection, query, where, onSnapshot, user, userRole) {
    if (!user || !userRole) return;

    let ticketsQuery;
    let countField;

    // Define the query and the field to count based on the user's role
    if (userRole === 'supervisor') {
        ticketsQuery = query(collection(db, 'tickets'), where('status', '==', 'abierto'));
        countField = 'supervisor';
    } else { // Assumes 'operador'
        ticketsQuery = query(collection(db, 'tickets'), where('operatorUid', '==', user.uid), where('status', '==', 'abierto'));
        countField = 'operator';
    }

    // Listen for real-time updates
    onSnapshot(ticketsQuery, (querySnapshot) => {
        let totalUnread = 0;
        querySnapshot.forEach((doc) => {
            totalUnread += doc.data().unreadCounts?.[countField] || 0;
        });

        updateNotificationBadge(totalUnread);
    }, (error) => {
        if (error.code === 'permission-denied') {
            console.warn("⚠️ Permisos insuficientes para ver notificaciones de tickets. (Posible bloqueo de App Check o Reglas de Firestore)");
        } else {
            console.error("Error listening for ticket notifications:", error);
        }
    });
}

/**
 * Finds the menu/ticket button and updates its notification badge.
 * @param {number} count - The total number of unread messages.
 */
function updateNotificationBadge(count) {
    // On the main menu, the button is #btn-tickets. On other pages, it's #menu-btn.
    const targetButton = document.getElementById('btn-tickets') || document.getElementById('menu-btn');
    if (!targetButton) return;

    const badgeId = 'global-ticket-badge';
    let badge = document.getElementById(badgeId);

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = badgeId;
            badge.style.position = 'absolute';
            badge.style.top = '5px';
            badge.style.right = '5px';
            badge.style.width = '22px';
            badge.style.height = '22px';
            badge.style.backgroundColor = '#dc3545'; // Red
            badge.style.color = 'white';
            badge.style.borderRadius = '50%';
            badge.style.display = 'flex';
            badge.style.justifyContent = 'center';
            badge.style.alignItems = 'center';
            badge.style.fontSize = '0.8em';
            badge.style.fontWeight = 'bold';
            badge.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            badge.style.zIndex = '2';

            // The parent button needs relative positioning
            targetButton.style.position = 'relative';
            targetButton.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.display = 'flex';
    } else if (badge) {
        badge.style.display = 'none';
    }
}
