import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const modelNameDisplay = document.getElementById("model-name-display");
    const modelFieldsList = document.getElementById("modelFieldsList");
    const userDisplayName = document.getElementById("user-display-name");
    const backBtn = document.getElementById("back-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const menuBtn = document.getElementById("menu-btn");
    const loadingState = document.getElementById("loading-state");
    const errorState = document.getElementById("error-state");
    const emptyState = document.getElementById("empty-state");
    const searchBar = document.getElementById("search-bar");

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "login.html"; return; }

        if (userDisplayName) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                userDisplayName.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email;
            } catch (error) {
                console.error(error);
                userDisplayName.textContent = user.email;
            }
        }
        loadModelDetails();
    });

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, modelFieldsList].forEach(el => {
            if (el) el.classList.add("hidden");
        });

        if (stateElement) {
            stateElement.classList.remove("hidden");
            if (stateElement === modelFieldsList) {
                stateElement.classList.add("flex");
            }
        }
    };

    const loadModelDetails = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        const zonaName = urlParams.get("zonaName");

        if (!zonaName) {
            modelNameDisplay.textContent = "Error: Zona no especificada";
            showState(errorState);
            return;
        }

        modelNameDisplay.textContent = `Modelos para: ${zonaName.toUpperCase()}`;

        try {
            const docRef = doc(db, "Cajas", zonaName);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const modelNames = Object.keys(data).sort();

                modelFieldsList.innerHTML = "";

                if (modelNames.length === 0) {
                    showState(emptyState);
                    return;
                }

                modelNames.forEach(modelName => {
                    const li = document.createElement("li");
                    li.className = "group flex items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-xl cursor-pointer relative overflow-hidden";

                    li.innerHTML = `
                        <div class="flex items-center gap-5 z-10 w-full">
                            <div class="w-12 h-12 rounded-xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue group-hover:scale-110 transition-transform duration-500">
                                <span class="material-symbols-outlined text-2xl tracking-normal">category</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <h3 class="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest leading-none mt-1">${modelName}</h3>
                                <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none">Explorar unidades de la categoria</p>
                            </div>
                        </div>
                        <div class="z-10 text-slate-300 group-hover:text-villalba-blue group-hover:translate-x-1 transition-all duration-300">
                            <span class="material-symbols-outlined text-lg">chevron_right</span>
                        </div>
                        <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    `;

                    li.addEventListener("click", () => {
                        window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
                    });

                    modelFieldsList.appendChild(li);
                });

                showState(modelFieldsList);
            } else {
                showState(emptyState);
            }
        } catch (error) {
            console.error(error);
            showState(errorState);
        }
    };

    if (backBtn) backBtn.addEventListener("click", () => { window.location.href = "modelos-de-cajas.html"; });
    if (menuBtn) menuBtn.addEventListener("click", () => { window.location.href = "menu.html"; });
    if (logoutBtn) logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "../login.html";
    });

    if (searchBar) {
        searchBar.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const items = modelFieldsList.querySelectorAll("li");
            items.forEach(item => {
                const text = item.querySelector("h3").textContent.toLowerCase();
                item.style.display = text.includes(term) ? "flex" : "none";
            });
        });
    }
});
