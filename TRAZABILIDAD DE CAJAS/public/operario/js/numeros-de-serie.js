import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc,
    registrarMovimientoCaja
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const modelNameDisplay = document.getElementById("model-name-display");
    const serialNumbersList = document.getElementById("serialNumbersList");
    const addCajaBtn = document.getElementById("add-caja-btn");
    const backBtn = document.getElementById("back-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userDisplayName = document.getElementById("user-display-name");
    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const emptyState = document.getElementById("empty-state");
    const serialSearchInput = document.getElementById("search-input");
    const confirmEntryModal = document.getElementById("confirmEntryModal");
    const confirmEntryModalText = document.getElementById("confirm-entry-modal-text");
    const cancelEntryBtn = document.getElementById("cancel-entry-btn");
    const confirmEntryBtn = document.getElementById("confirm-entry-btn");

    let currentModelName = "";
    let currentZonaName = "";
    let serialToConfirmEntry = null;
    let allSerials = [];
    let userRole = "operario";
    let notificationTimeout;

    const showNotification = (message, type = "success") => {
        const toast = document.getElementById("notification-toast");
        const icon = document.getElementById("toast-icon");
        const msg = document.getElementById("toast-message");
        if (!toast || !icon || !msg) return;

        clearTimeout(notificationTimeout);
        msg.textContent = message;
        icon.textContent = type === "success" ? "check_circle" : (type === "error" ? "error" : "info");
        
        // Dynamic styling for premium toast
        toast.querySelector(".glass-card").className = `glass-card rounded-2xl p-4 flex items-center gap-4 border-none shadow-2xl transition-all ${type === "success" ? "text-emerald-500" : (type === "error" ? "text-rose-500" : "text-villalba-blue")}`;

        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(-20px)";
        toast.style.pointerEvents = "auto";

        notificationTimeout = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(0)";
            toast.style.pointerEvents = "none";
        }, 3000);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                userRole = userDocSnap.data().role || "operario";
                userDisplayName.textContent = userDocSnap.data().name || user.email;
            } else {
                userDisplayName.textContent = user.email;
            }
            
            if (userRole === "supervisor" || userRole === "operario") {
                if(addCajaBtn) addCajaBtn.classList.remove("hidden");
            }

            loadSerialNumbers();
        } catch (error) {
            console.error("Error authentication:", error);
            loadSerialNumbers();
        }
    });

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, serialNumbersList].forEach(el => {
            if (el) el.classList.add("hidden");
        });

        if (stateElement) {
            stateElement.classList.remove("hidden");
            if (stateElement === serialNumbersList) {
                stateElement.classList.add("grid");
            }
        }
    };

    const loadSerialNumbers = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        currentModelName = urlParams.get("modelName");
        currentZonaName = urlParams.get("zonaName");

        if (!currentModelName || !currentZonaName) {
            modelNameDisplay.textContent = "FATAL ERROR: MISSING DATA";
            showState(errorState);
            return;
        }
        modelNameDisplay.textContent = currentModelName.toUpperCase();

        try {
            const zonaDocRef = doc(db, "Cajas", currentZonaName);
            const zonaDocSnap = await getDoc(zonaDocRef);

            if (zonaDocSnap.exists()) {
                const serialsString = zonaDocSnap.data()[currentModelName];
                if (serialsString && typeof serialsString === "string") {
                    allSerials = serialsString.split(",").map(s => s.trim()).filter(Boolean);
                    renderSerialNumbers(allSerials);
                } else { showState(emptyState); }
            } else { showState(emptyState); }
        } catch (error) {
            console.error("Database sync error:", error);
            showState(errorState);
        }
    };

    const renderSerialNumbers = (serials) => {
        serialNumbersList.innerHTML = "";
        if (serials.length === 0) {
            showState(emptyState);
            return;
        }

        const groups = {};
        serials.forEach(serial => {
            const letter = serial.charAt(0).toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(serial);
        });

        serialNumbersList.className = "flex flex-col gap-6 w-full";

        const sortedKeys = Object.keys(groups).sort();

        sortedKeys.forEach(key => {
            const groupSerials = groups[key].sort();
            const groupDiv = document.createElement("div");
            groupDiv.className = "flex flex-col gap-4";
            
            groupDiv.innerHTML = `
                <div class="px-2">
                    <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Serie ${key}</h3>
                </div>
                <div class="flex flex-col gap-2"></div>
            `;

            const itemsContainer = groupDiv.querySelector("div:last-child");

            groupSerials.forEach(serial => {
                const item = document.createElement("div");
                item.className = "group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-xl cursor-pointer";
                
                item.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 shrink-0 rounded-xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue group-hover:scale-110 transition-transform">
                            <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                        </div>
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate">${serial}</span>
                    </div>
                `;

                const entryBtn = document.createElement("button");
                entryBtn.className = "p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/10 ml-2";
                entryBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">login</span>';
                entryBtn.onclick = (e) => {
                    e.stopPropagation();
                    serialToConfirmEntry = serial;
                    confirmEntryModalText.textContent = `¿Estás seguro de que deseas registrar una ENTRADA para la caja "${serial.toUpperCase()}"?`;
                    confirmEntryModal.classList.remove("hidden");
                    confirmEntryModal.classList.add("flex");
                };
                item.appendChild(entryBtn);

                item.onclick = () => {
                    const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
                    window.location.href = url;
                };

                itemsContainer.appendChild(item);
            });

            serialNumbersList.appendChild(groupDiv);
        });

        showState(serialNumbersList);
    };

    if (serialSearchInput) {
        serialSearchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allSerials.filter(s => s.toLowerCase().includes(term));
            renderSerialNumbers(filtered);
        });
    }

    cancelEntryBtn.addEventListener("click", () => {
        confirmEntryModal.classList.add("hidden");
        confirmEntryModal.classList.remove("flex");
    });

    confirmEntryBtn.addEventListener("click", async () => {
        if (!serialToConfirmEntry) return;

        try {
            showNotification(`Procesando entrada: ${serialToConfirmEntry.toUpperCase()}...`, "info");
            await registrarMovimientoCaja("Entrada", serialToConfirmEntry, currentModelName);
            showNotification(`Entrada de caja "${serialToConfirmEntry.toUpperCase()}" registrada con �xito.`, "success");
        } catch (error) {
            showNotification(`Error de registro para "${serialToConfirmEntry.toUpperCase()}".`, "error");
            console.error(error);
        } finally {
            confirmEntryModal.classList.add("hidden");
            confirmEntryModal.classList.remove("flex");
        }
    });

    addCajaBtn.addEventListener("click", () => {
        window.location.href = `agregar-caja.html?modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
    });

    backBtn.addEventListener("click", () => {
        window.location.href = `modelado-caja.html?zonaName=${encodeURIComponent(currentZonaName)}`;
    });

    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "../login.html";
    });
});
