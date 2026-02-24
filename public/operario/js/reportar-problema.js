import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const cajaSerialInput = document.getElementById('cajaSerialInput');
    const cajaNumeroInput = document.getElementById('cajaNumeroInput');
    const cajaModeloInput = document.getElementById('cajaModeloInput');
    const tipoCajaSelect = document.getElementById('tipoCajaSelect');
    const modeloCajaSelect = document.getElementById('modeloCajaSelect');
    const problemaCheckboxes = document.querySelectorAll('input[name="problema"]');
    const otroCheckbox = document.getElementById('problema_otro');
    const otroProblemaContainer = document.getElementById('otroProblemaContainer');
    const otroProblemaTextarea = document.getElementById('otroProblemaTextarea');
    const enviarReporteBtn = document.getElementById('enviarReporteBtn');
    const messageDiv = document.getElementById('message');
    const backBtn = document.getElementById('back-btn');

    let currentUser = null;

    // --- INICIO: Lógica para checkboxes "No tiene" ---
    const addNoOptionCheckbox = (inputElement, labelText, noValue) => {
        if (!inputElement) return;
        
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginTop = '5px';
        wrapper.style.marginBottom = '15px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `chk_no_${inputElement.id}`;
        checkbox.style.marginRight = '8px';
        checkbox.style.width = '18px';
        checkbox.style.height = '18px';
        checkbox.style.cursor = 'pointer';

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = labelText;
        label.style.cursor = 'pointer';
        label.style.fontSize = '0.9rem';
        label.style.color = '#555';

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);

        inputElement.parentNode.insertBefore(wrapper, inputElement.nextSibling);

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                inputElement.dataset.lastValue = inputElement.value;
                inputElement.value = noValue;
                inputElement.readOnly = true;
                inputElement.style.backgroundColor = '#e9ecef';
            } else {
                inputElement.value = inputElement.dataset.lastValue || '';
                inputElement.readOnly = false;
                inputElement.style.backgroundColor = '';
                inputElement.focus();
            }
        });
    };

    addNoOptionCheckbox(cajaSerialInput, 'No tiene número de serie', 'S/S');
    addNoOptionCheckbox(cajaNumeroInput, 'No tiene número de caja', '00');

    // Evitar que se seleccionen ambas opciones "No tiene" al mismo tiempo
    const chkNoSerial = document.getElementById(`chk_no_${cajaSerialInput.id}`);
    const chkNoNumero = document.getElementById(`chk_no_${cajaNumeroInput.id}`);

    if (chkNoSerial && chkNoNumero) {
        chkNoSerial.addEventListener('change', () => {
            if (chkNoSerial.checked && chkNoNumero.checked) {
                chkNoNumero.click(); // Desmarca el otro si ambos están marcados
            }
        });
        chkNoNumero.addEventListener('change', () => {
            if (chkNoNumero.checked && chkNoSerial.checked) {
                chkNoSerial.click(); // Desmarca el otro si ambos están marcados
            }
        });
    }
    // --- FIN: Lógica para checkboxes "No tiene" ---

    // --- INICIO: Nueva Lista de Problemas (Dinámica) ---
    const nuevosProblemas = [
        "Contenedoras mal grabadas o sin grabar",
        "Arreglar manijas",
        "Cambiar fresas",
        "Afilar fresas",
        "Agregar mecha",
        "Faltante de instrumental",
        "Roscas dañadas",
        "Canulado dañado",
        "Vastagos inclinados",
        "Instrumental no grabado"
    ];

    // 1. Ocultar checkboxes anteriores (excepto 'Otro')
    const existingCheckboxes = document.querySelectorAll('input[name="problema"]');
    existingCheckboxes.forEach(chk => {
        if (chk.id !== 'problema_otro') {
            if (chk.parentElement && (chk.parentElement.classList.contains('form-check') || chk.parentElement.tagName === 'DIV')) {
                chk.parentElement.style.display = 'none';
            } else {
                chk.style.display = 'none';
                const label = document.querySelector(`label[for="${chk.id}"]`);
                if (label) label.style.display = 'none';
            }
        }
    });

    // 2. Inyectar nueva lista
    if (otroCheckbox) {
        const container = document.createElement('div');
        container.id = 'lista-problemas-dinamica';
        container.style.marginBottom = '10px';

        nuevosProblemas.forEach((texto, index) => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.flexWrap = 'wrap';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'problema';
            input.value = texto;
            input.id = `prob_new_${index}`;
            input.style.marginRight = '10px';
            input.style.transform = "scale(1.2)";
            input.style.cursor = 'pointer';

            const label = document.createElement('label');
            label.htmlFor = `prob_new_${index}`;
            label.textContent = texto;
            label.style.cursor = 'pointer';
            label.style.fontSize = '1rem';
            label.style.marginRight = '10px';

            div.appendChild(input);
            div.appendChild(label);

            // Lógica para campo de diámetro en fresas
            if (texto === "Cambiar fresas" || texto === "Afilar fresas") {
                const diamContainer = document.createElement('div');
                diamContainer.id = `container_diam_${index}`;
                diamContainer.style.display = 'none';
                diamContainer.style.alignItems = 'center';
                diamContainer.style.marginLeft = '5px';
                diamContainer.style.flexWrap = 'wrap';

                const diamLabel = document.createElement('span');
                diamLabel.textContent = 'diametro: ';
                diamLabel.style.fontSize = '0.9rem';
                diamLabel.style.marginRight = '5px';
                diamContainer.appendChild(diamLabel);

                const inputsWrapper = document.createElement('div');
                inputsWrapper.style.display = 'flex';
                inputsWrapper.style.flexWrap = 'wrap';
                inputsWrapper.style.gap = '5px';
                inputsWrapper.style.alignItems = 'center';
                diamContainer.appendChild(inputsWrapper);

                const addInput = () => {
                    const newInput = document.createElement('input');
                    newInput.type = 'text';
                    newInput.className = `diam-input-${index}`;
                    newInput.maxLength = 2;
                    newInput.style.width = '40px';
                    newInput.style.padding = '2px 5px';
                    newInput.style.textAlign = 'center';
                    newInput.placeholder = '00';
                    inputsWrapper.appendChild(newInput);
                    return newInput;
                };

                const firstInput = addInput();

                const plusBtn = document.createElement('button');
                plusBtn.textContent = '+';
                plusBtn.type = 'button';
                plusBtn.style.marginLeft = '5px';
                plusBtn.style.cursor = 'pointer';
                plusBtn.style.padding = '0 6px';
                plusBtn.style.height = '26px';
                plusBtn.style.lineHeight = '1';
                plusBtn.style.fontSize = '1.2rem';
                plusBtn.style.background = '#e9ecef';
                plusBtn.style.border = '1px solid #ced4da';
                plusBtn.style.borderRadius = '4px';

                plusBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const inp = addInput();
                    inp.focus();
                });

                diamContainer.appendChild(plusBtn);
                div.appendChild(diamContainer);

                input.addEventListener('change', () => {
                    diamContainer.style.display = input.checked ? 'flex' : 'none';
                    if (input.checked) {
                        firstInput.focus();
                    } else {
                        inputsWrapper.innerHTML = '';
                        addInput();
                    }
                });
            }

            // Lógica para instrumental (Faltante o No grabado)
            if (texto === "Faltante de instrumental" || texto === "Instrumental no grabado") {
                const instrContainer = document.createElement('div');
                instrContainer.id = `container_instr_${index}`;
                instrContainer.style.display = 'none';
                instrContainer.style.alignItems = 'center';
                instrContainer.style.marginLeft = '5px';
                instrContainer.style.flexWrap = 'wrap';

                const instrLabel = document.createElement('span');
                instrLabel.textContent = 'Detalle: ';
                instrLabel.style.fontSize = '0.9rem';
                instrLabel.style.marginRight = '5px';
                instrContainer.appendChild(instrLabel);

                const inputsWrapper = document.createElement('div');
                inputsWrapper.style.display = 'flex';
                inputsWrapper.style.flexWrap = 'wrap';
                inputsWrapper.style.gap = '5px';
                inputsWrapper.style.alignItems = 'center';
                instrContainer.appendChild(inputsWrapper);

                const addInput = () => {
                    const newInput = document.createElement('input');
                    newInput.type = 'text';
                    newInput.className = `instr-input-${index}`;
                    newInput.style.width = '120px';
                    newInput.style.padding = '2px 5px';
                    newInput.placeholder = 'Descripción';
                    inputsWrapper.appendChild(newInput);
                    return newInput;
                };

                const firstInput = addInput();

                const plusBtn = document.createElement('button');
                plusBtn.textContent = '+';
                plusBtn.type = 'button';
                plusBtn.style.marginLeft = '5px';
                plusBtn.style.cursor = 'pointer';
                plusBtn.style.padding = '0 6px';
                plusBtn.style.height = '26px';
                plusBtn.style.lineHeight = '1';
                plusBtn.style.fontSize = '1.2rem';
                plusBtn.style.background = '#e9ecef';
                plusBtn.style.border = '1px solid #ced4da';
                plusBtn.style.borderRadius = '4px';

                plusBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const inp = addInput();
                    inp.focus();
                });

                instrContainer.appendChild(plusBtn);
                div.appendChild(instrContainer);

                input.addEventListener('change', () => {
                    instrContainer.style.display = input.checked ? 'flex' : 'none';
                    if (input.checked) {
                        firstInput.focus();
                    } else {
                        inputsWrapper.innerHTML = '';
                        addInput();
                    }
                });
            }

            container.appendChild(div);
        });

        // Insertar antes del bloque de "Otro"
        let target = otroCheckbox;
        if (otroCheckbox.parentElement && (otroCheckbox.parentElement.classList.contains('form-check') || otroCheckbox.parentElement.tagName === 'DIV')) {
            target = otroCheckbox.parentElement;
        }
        if (target.parentNode) {
            target.parentNode.insertBefore(container, target);
        }
    }
    // --- FIN: Nueva Lista de Problemas ---

    // Forzar mayúsculas al escribir el serial
    if (cajaSerialInput) {
        cajaSerialInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 6);
        });
    }

    // Validación input N° (Solo números, max 2)
    if (cajaNumeroInput) {
        cajaNumeroInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
        });
    }

    // Navegación con tecla Enter entre campos (Serial -> Número -> Modelo -> Checkboxes)
    if (cajaSerialInput) {
        cajaSerialInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita que se envíe el formulario o haga salto de línea
                if (cajaNumeroInput) {
                    cajaNumeroInput.focus();
                } else if (cajaModeloInput) {
                    cajaModeloInput.focus();
                }
            }
        });
    }

    if (cajaNumeroInput) {
        cajaNumeroInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (cajaModeloInput) cajaModeloInput.focus();
            }
        });
    }

    if (cajaModeloInput) {
        cajaModeloInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Intenta enfocar el primer checkbox de la lista
                if (problemaCheckboxes.length > 0) {
                    problemaCheckboxes[0].focus();
                } else if (otroCheckbox) {
                    otroCheckbox.focus();
                }
            }
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            const urlParams = new URLSearchParams(window.location.search);
            const serial = urlParams.get('serial');
            const modelo = urlParams.get('modelo');
            if (serial) {
                cajaSerialInput.value = serial;
            }
            if (modelo) {
                cajaModeloInput.value = modelo;
                // Si viene con modelo predefinido, asumimos modo "Otro" o manual para mostrarlo directamente
                if (tipoCajaSelect) tipoCajaSelect.value = 'OTRO';
                if (cajaModeloInput) cajaModeloInput.style.display = 'block';
            }
            if (urlParams.get('sinNumero') === 'true' && cajaNumeroInput) {
                const chkNoNumero = document.getElementById(`chk_no_${cajaNumeroInput.id}`);
                if (chkNoNumero) {
                    chkNoNumero.checked = true;
                    chkNoNumero.dispatchEvent(new Event('change'));
                }
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- Lógica para Selectores de Tipo y Modelo ---
    if (tipoCajaSelect && modeloCajaSelect && cajaModeloInput) {
        tipoCajaSelect.addEventListener('change', async () => {
            const tipo = tipoCajaSelect.value;
            
            // Resetear estados
            modeloCajaSelect.innerHTML = '<option value="">Seleccione Modelo...</option>';
            cajaModeloInput.value = '';
            
            if (tipo === 'OTRO') {
                modeloCajaSelect.style.display = 'none';
                cajaModeloInput.style.display = 'block';
                cajaModeloInput.focus();
            } else if (tipo === 'PLACAS' || tipo === 'CLAVOS') {
                cajaModeloInput.style.display = 'none';
                modeloCajaSelect.style.display = 'block';
                modeloCajaSelect.innerHTML = '<option value="">Cargando...</option>';

                try {
                    // Buscar los modelos en la colección "Cajas" usando el tipo como ID
                    const docRef = doc(db, "Cajas", tipo);
                    const docSnap = await getDoc(docRef);

                    modeloCajaSelect.innerHTML = '<option value="">Seleccione Modelo...</option>';

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const modelos = Object.keys(data).sort();
                        
                        modelos.forEach(mod => {
                            const option = document.createElement('option');
                            option.value = mod;
                            option.textContent = mod;
                            modeloCajaSelect.appendChild(option);
                        });
                    } else {
                        modeloCajaSelect.innerHTML = '<option value="">No hay modelos disponibles</option>';
                    }
                } catch (error) {
                    console.error("Error cargando modelos:", error);
                    modeloCajaSelect.innerHTML = '<option value="">Error al cargar</option>';
                }
            } else {
                // Caso "Seleccione Tipo..." (vacío)
                modeloCajaSelect.style.display = 'none';
                cajaModeloInput.style.display = 'none';
            }
        });

        modeloCajaSelect.addEventListener('change', () => {
            // Al seleccionar un modelo del dropdown, actualizamos el input oculto
            // que es el que usa el botón de enviar.
            cajaModeloInput.value = modeloCajaSelect.value;
        });
    }

    backBtn.addEventListener('click', () => {
        window.history.back();
    });
    otroCheckbox.addEventListener('change', () => {
        if (otroCheckbox.checked) {
            otroProblemaContainer.style.display = 'block';
        } else {
            otroProblemaContainer.style.display = 'none';
        }
    });
    enviarReporteBtn.addEventListener('click', async () => {
        const serial = cajaSerialInput.value.trim();
        const numero = cajaNumeroInput ? cajaNumeroInput.value.trim() : '';
        const modelo = cajaModeloInput.value.trim();
        const selectedProblemas = document.querySelectorAll('input[name="problema"]:checked');
        const otroProblema = otroProblemaTextarea.value.trim();

        const tareas = [];

        // Validaciones de formato
        const serialRegex = /^[A-Z]{2}\d{4}$/; // 2 Letras + 4 Números
        
        const isNoSerial = document.getElementById(`chk_no_${cajaSerialInput.id}`)?.checked;
        if (!isNoSerial && !serialRegex.test(serial)) {
            messageDiv.textContent = 'El número de serie debe tener 2 letras y 4 números (Ej: AA1234).';
            messageDiv.style.color = 'red';
            return;
        }

        const isNoNumero = cajaNumeroInput ? document.getElementById(`chk_no_${cajaNumeroInput.id}`)?.checked : false;

        if (cajaNumeroInput && !isNoNumero && !/^\d{2}$/.test(numero)) {
            messageDiv.textContent = 'El campo N° debe tener exactamente 2 números.';
            messageDiv.style.color = 'red';
            return;
        }

        if (!serial || !modelo) {
            messageDiv.textContent = 'El número de serie y el modelo son obligatorios.';
            messageDiv.style.color = 'red';
            return;
        }

        selectedProblemas.forEach(checkbox => {
            if (checkbox.value !== 'Otro') {
                let textoProblema = checkbox.value;
                
                // Verificar si tiene input de diámetro asociado
                if (textoProblema === "Cambiar fresas" || textoProblema === "Afilar fresas") {
                    const index = checkbox.id.split('_').pop();
                    const inputs = document.querySelectorAll(`.diam-input-${index}`);
                    const values = [];
                    inputs.forEach(inp => {
                        if (inp.value.trim()) values.push(inp.value.trim());
                    });
                    
                    if (values.length > 0) {
                        textoProblema += ` (Diám: ${values.join(', ')})`;
                    }
                }

                // Verificar si tiene input de instrumental asociado
                if (textoProblema === "Faltante de instrumental" || textoProblema === "Instrumental no grabado") {
                    const index = checkbox.id.split('_').pop();
                    const inputs = document.querySelectorAll(`.instr-input-${index}`);
                    const values = [];
                    inputs.forEach(inp => {
                        if (inp.value.trim()) values.push(inp.value.trim());
                    });
                    
                    if (values.length > 0) {
                        textoProblema += ` (Detalle: ${values.join(', ')})`;
                    }
                }

                tareas.push({ texto: textoProblema, completada: false });
            }
        });

        if (otroCheckbox.checked) {
            if (!otroProblema) {
                messageDiv.textContent = 'Por favor, describe el problema en el campo "Otro".';
                messageDiv.style.color = 'red';
                return;
            }
            tareas.push({ texto: otroProblema, completada: false });
        }

        if (tareas.length === 0) {
            messageDiv.textContent = 'Por favor, selecciona al menos un tipo de problema.';
            messageDiv.style.color = 'red';
            return;
        }

        if (!currentUser) {
            messageDiv.textContent = 'Error: No se ha podido verificar al usuario.';
            messageDiv.style.color = 'red';
            return;
        }
        try {
            // 1. Verificar si ya existe un reporte "nuevo" para este serial
            const q = query(
                collection(db, 'problemas_cajas'),
                where('cajaSerial', '==', serial),
                where('estado', '==', 'nuevo')
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // YA EXISTE: Añadimos los problemas al reporte existente
                const existingDoc = querySnapshot.docs[0];
                const existingData = existingDoc.data();
                const existingTareas = existingData.tareas || [];
                const updatedTareas = [...existingTareas, ...tareas];

                await updateDoc(doc(db, 'problemas_cajas', existingDoc.id), {
                    tareas: updatedTareas,
                    cajaNumero: numero
                });
                messageDiv.textContent = 'Problemas añadidos al reporte existente (Estado: Nuevo).';
            } else {
                // NO EXISTE: Creamos uno nuevo
                await addDoc(collection(db, 'problemas_cajas'), {
                    cajaSerial: serial,
                    cajaNumero: numero,
                    cajaModelo: modelo,
                    tareas: tareas, 
                    reportadoPor: currentUser.uid,
                    fechaReporte: serverTimestamp(),
                    estado: 'nuevo'
                });
                messageDiv.textContent = '¡Reporte enviado con éxito!';
            }

            messageDiv.style.color = 'green';
            
            // --- Limpieza completa del formulario ---
            cajaSerialInput.value = '';
            cajaSerialInput.dataset.lastValue = ''; 
            if (cajaNumeroInput) {
                cajaNumeroInput.value = '';
                cajaNumeroInput.dataset.lastValue = '';
            }
            cajaModeloInput.value = '';

            // Resetear checkboxes "No tiene"
            const chkNoSerial = document.getElementById(`chk_no_${cajaSerialInput.id}`);
            if (chkNoSerial && chkNoSerial.checked) {
                chkNoSerial.checked = false;
                chkNoSerial.dispatchEvent(new Event('change'));
                cajaSerialInput.value = ''; 
            }

            if (cajaNumeroInput) {
                const chkNoNumero = document.getElementById(`chk_no_${cajaNumeroInput.id}`);
                if (chkNoNumero && chkNoNumero.checked) {
                    chkNoNumero.checked = false;
                    chkNoNumero.dispatchEvent(new Event('change'));
                    cajaNumeroInput.value = ''; 
                }
            }

            // Resetear todos los checkboxes de problemas (incluidos dinámicos)
            const allCheckboxes = document.querySelectorAll('input[name="problema"]');
            allCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    checkbox.checked = false;
                    checkbox.dispatchEvent(new Event('change')); // Resetea inputs dinámicos asociados
                }
            });

            otroProblemaTextarea.value = '';
            if (otroCheckbox && otroCheckbox.checked) {
                otroCheckbox.checked = false;
                otroCheckbox.dispatchEvent(new Event('change'));
            }
            
            // Enfocar el primer campo para el siguiente reporte
            cajaSerialInput.focus();

            setTimeout(() => {
                messageDiv.textContent = '';
            }, 3000);

        } catch (error) {
            console.error("Error al enviar el reporte: ", error);
            messageDiv.textContent = 'Error al enviar el reporte. Inténtalo de nuevo.';
            messageDiv.style.color = 'red';
        }
    });
});
