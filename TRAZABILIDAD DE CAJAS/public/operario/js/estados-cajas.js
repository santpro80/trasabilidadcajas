import {
    db, auth, onAuthStateChanged, signOut,
    collection, getDocs, doc, getDoc
} from "./firebase-config.js";

document.addEventListener("DOMContentLoaded", () => {
    const listContainer = document.getElementById("list-container");
    const userDisplayName = document.getElementById("user-display-name");
    const searchInput = document.getElementById("searchBoxStatusInput");
    const logoutBtn = document.getElementById("logout-btn");

    let allCajasData = [];
    let userRole = "operario";

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = "../login.html"; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                userRole = userDocSnap.data().role || "operario";
                userDisplayName.textContent = userDocSnap.data().name || user.email;
            } else {
                userDisplayName.textContent = user.email;
            }
            loadAllCajas();
        } catch (error) {
            console.error(error);
            loadAllCajas();
        }
    });

    const loadAllCajas = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "Cajas"));
            allCajasData = [];
            
            querySnapshot.forEach((zonaDoc) => {
                const zonaName = zonaDoc.id;
                const zonaData = zonaDoc.data();
                
                Object.keys(zonaData).forEach(modelName => {
                    const serialsString = zonaData[modelName];
                    if (serialsString && typeof serialsString === "string") {
                        const serialsArray = serialsString.split(",").map(s => s.trim()).filter(Boolean);
                        serialsArray.forEach(serial => {
                            allCajasData.push({
                                serial,
                                modelName,
                                zonaName
                            });
                        });
                    }
                });
            });

            renderCajas(allCajasData);
        } catch (error) {
            console.error(error);
            listContainer.innerHTML = `<div class="p-8 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error de Sincronizaci�n</div>`;
        }
    };

    const renderCajas = (cajas) => {
        listContainer.innerHTML = "";
        
        if (cajas.length === 0) {
            listContainer.innerHTML = `<div class="p-12 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Sin resultados encontrados</div>`;
            return;
        }

        // Group by model
        const grouped = {};
        cajas.forEach(c => {
            if (!grouped[c.modelName]) grouped[c.modelName] = [];
            grouped[c.modelName].push(c);
        });

        Object.keys(grouped).sort().forEach(model => {
            const section = document.createElement("div");
            section.className = "flex flex-col gap-4 mb-8";
            
            section.innerHTML = `
                <div class="px-4 flex items-center justify-between border-b border-slate-200/50 dark:border-white/5 pb-2">
                    <h2 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">${model}</h2>
                    <span class="text-[10px] font-black text-villalba-blue bg-villalba-blue/10 px-2 py-1 rounded-lg">${grouped[model].length} UNIDADES</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
            `;

            const grid = section.querySelector("div:last-child");

            grouped[model].sort((a,b) => a.serial.localeCompare(b.serial)).forEach(caja => {
                const card = document.createElement("div");
                card.className = "group glass-card p-5 rounded-2xl border border-white/20 dark:border-white/5 hover:shadow-xl transition-all flex items-center justify-between cursor-pointer active:scale-95";
                
                card.innerHTML = `
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue">
                             <span class="material-symbols-outlined text-[20px]">package_2</span>
                        </div>
                        <div class="flex flex-col gap-0.5">
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">${caja.zonaName}</span>
                            <span class="text-sm font-black text-slate-700 dark:text-slate-200 tracking-tight uppercase">${caja.serial}</span>
                        </div>
                    </div>
                    <div class="text-slate-300 group-hover:text-villalba-blue transition-colors">
                        <span class="material-symbols-outlined text-lg">arrow_forward</span>
                    </div>
                `;

                card.onclick = () => {
                   window.location.href = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(caja.serial)}&modelName=${encodeURIComponent(caja.modelName)}&zonaName=${encodeURIComponent(caja.zonaName)}`;
                };

                grid.appendChild(card);
            });

            listContainer.appendChild(section);
        });
    };

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allCajasData.filter(c => 
                c.serial.toLowerCase().includes(term) || 
                c.modelName.toLowerCase().includes(term) || 
                c.zonaName.toLowerCase().includes(term)
            );
            renderCajas(filtered);
        });
    }

    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "../login.html";
    });
});
