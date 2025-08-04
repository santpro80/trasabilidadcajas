// Este código se ejecutará una vez que toda la página HTML esté cargada.
document.addEventListener('DOMContentLoaded', () => {
    // Obtenemos una referencia al formulario de registro.
    const registerForm = document.getElementById('registerForm');
    // Obtenemos una referencia al botón de envío para manejar su estado.
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    // Área para mostrar mensajes al usuario.
    const messageArea = document.getElementById('message-area');

    // Obtenemos el campo de selección de rol y el grupo de contraseña de supervisor.
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('password-supervisor-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password');

    // Lógica para mostrar/ocultar el campo de contraseña de supervisor.
    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            if (roleSelect.value === 'supervisor') {
                supervisorPasswordGroup.style.display = 'block';
                supervisorPasswordInput.setAttribute('required', 'true');
            } else {
                supervisorPasswordGroup.style.display = 'none';
                supervisorPasswordInput.removeAttribute('required');
                supervisorPasswordInput.value = ''; // Limpiar el campo si se oculta
            }
        });
    }

    // Agregamos un "escuchador de eventos" al formulario cuando se envía.
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            // Prevenimos el comportamiento por defecto del formulario (recargar la página).
            event.preventDefault();

            // Mostramos el spinner y deshabilitamos el botón.
            submitBtn.disabled = true;
            btnText.hidden = true;
            spinner.hidden = false;
            hideMessage(); // Ocultar mensajes anteriores

            // Aquí iría la lógica real de registro (por ejemplo, con Firebase Authentication).
            // Por ahora, simularemos un registro exitoso con un pequeño retraso.
            try {
                // Simulación de una llamada a un servidor o a Firebase para registrar al usuario.
                // En un caso real, aquí iría tu código de autenticación, por ejemplo:
                // await createUserWithEmailAndPassword(auth, email, password);

                // Si el rol es supervisor y la contraseña de supervisor es incorrecta (simulación)
                if (roleSelect.value === 'supervisor' && supervisorPasswordInput.value !== 'superclave') {
                    throw new Error('Contraseña de supervisor incorrecta.');
                }

                await new Promise(resolve => setTimeout(resolve, 2000)); // Simula un retraso de 2 segundos

                // Si todo fue exitoso:
                showMessage('¡Registro exitoso! Redirigiendo al inicio de sesión...', 'success');

                // *** CAMBIO CLAVE AQUÍ: Redirigimos a login.html ***
                // Después de un breve retraso para que el usuario vea el mensaje de éxito.
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500); // Redirige después de 1.5 segundos
                
            } catch (error) {
                // Si hubo un error durante el registro (simulado o real).
                console.error('Error durante el registro:', error.message);
                showMessage(`Error al registrar: ${error.message}`, 'error');
            } finally {
                // Siempre ocultamos el spinner y habilitamos el botón al finalizar.
                submitBtn.disabled = false;
                btnText.hidden = false;
                spinner.hidden = true;
            }
        });
    } else {
        console.error('Error: No se encontró el formulario con el ID "registerForm".');
    }

    // Función para mostrar mensajes al usuario.
    function showMessage(message, type) {
        messageArea.textContent = message;
        messageArea.className = `message-area ${type}`; // Añade la clase 'success' o 'error'
        messageArea.style.display = 'block';
    }

    // Función para ocultar mensajes.
    function hideMessage() {
        messageArea.style.display = 'none';
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }
});
