
document.addEventListener('DOMContentLoaded', () => {
    const botonComenzar = document.getElementById('btn-start');
    if (botonComenzar) {
        botonComenzar.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    } else {
        console.error('Error: No se encontró el botón con el ID "btn-start".');
    }
});
