// js/index.js

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById("btn-start");

    if (startButton) {
        startButton.addEventListener("click", () => {
            console.log("Botón 'Comenzar' clickeado. Redirigiendo a login.html");
            window.location.href = "login.html";
        });
    } else {
        console.error("Error: Elemento 'btn-start' no encontrado en index.html");
    }
});
