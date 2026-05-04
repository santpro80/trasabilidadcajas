import {
    db, auth, onAuthStateChanged, signOut,
    collection, getDocs, doc, getDoc
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const modelosList = document.getElementById("modelos-list");
    const userDisplayElement = document.getElementById("user-email");
    const backBtn = document.getElementById("back-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const emptyState = document.getElementById("empty-state");

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        if (userDisplayElement) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                userDisplayElement.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email;
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                userDisplayElement.textContent = user.email;
            }
        }

        loadZonas();
    });

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, modelosList].forEach(el => {
            if (el) el.classList.add("hidden");
        });

        if (stateElement) {
            stateElement.classList.remove("hidden");
            if (stateElement === modelosList) {
                stateElement.classList.add("grid");
            }
        }
    };

    const loadZonas = async () => {
        showState(loadingState);
        try {
            const querySnapshot = await getDocs(collection(db, "Cajas"));
            if (modelosList) modelosList.innerHTML = "";

            if (querySnapshot.empty) {
                showState(emptyState);
                return;
            }

            querySnapshot.forEach((doc) => {
                const zonaName = doc.id;
                const li = document.createElement("li");
                li.className = "group flex items-center justify-between p-6 rounded-[2rem] bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-xl cursor-pointer overflow-hidden relative";
                
                li.innerHTML = `
                    <div class="flex items-center gap-5 z-10 w-full">
                        <div class="w-12 h-12 rounded-2xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue group-hover:scale-110 transition-transform duration-500">
                            <span class="material-symbols-outlined text-2xl tracking-normal">inventory_2</span>
                        </div>
                        <div class="flex flex-col gap-1 w-full justify-center">
                            <h3 class="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest leading-none mt-1">${zonaName}</h3>
                            <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">Ver detalles del modelo</p>
                        </div>
                    </div>
                    <div class="z-10 text-slate-300 group-hover:text-villalba-blue group-hover:translate-x-1 transition-all duration-300">
                        <span class="material-symbols-outlined text-lg">chevron_right</span>
                    </div>
                    <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                `;

                li.addEventListener("click", () => {
                    window.location.href = `modelado-caja.html?zonaName=${encodeURIComponent(zonaName)}`;
                });

                modelosList.appendChild(li);
            });

            showState(modelosList);

        } catch (error) {
            console.error("Error al cargar las zonas:", error);
            showState(errorState);
        }
    };

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "menu.html";
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "../login.html";
        });
    }
});
