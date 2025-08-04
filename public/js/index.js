// Este código se ejecutará una vez que toda la página HTML esté cargada.
document.addEventListener('DOMContentLoaded', () => {
    // Obtenemos una referencia al botón "Comenzar" usando su ID.
    const botonComenzar = document.getElementById('btn-start');

    // Verificamos si el botón existe antes de intentar añadirle un evento.
    if (botonComenzar) {
        // Agregamos un "escuchador de eventos" al botón.
        // Cuando se haga clic en el botón, se ejecutará la función que definimos.
        botonComenzar.addEventListener('click', () => {
            // Redirigimos al usuario a la página 'login.html'.
            // Asegúrate de que 'login.html' exista en la misma carpeta 'public'
            // o ajusta la ruta si está en otro lugar.
            window.location.href = 'login.html';
        });
    } else {
        // Si el botón no se encuentra, mostramos un mensaje en la consola.
        console.error('Error: No se encontró el botón con el ID "btn-start".');
    }
});
