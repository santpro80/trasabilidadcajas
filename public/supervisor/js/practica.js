// --- LECCIÓN 1: VARIABLES Y TIPOS DE DATOS ---

// 1. Declaración de variables
// 'const' para lo que no cambia, 'let' para lo que sí.
const empresa = "Cajas Secuela"; // String (Texto)
let operarioActual = "Santi";    // String
let cajasProcesadas = 0;         // Number (Número)
let sistemaActivo = true;        // Boolean (Booleano: true o false)

// 2. Mostrar información en la consola
// Abrí la consola del navegador (F12) para ver esto.
console.log("--- Inicio de la Práctica ---");
console.log("Empresa:", empresa);
console.log("Operario:", operarioActual);
console.log("Cajas al empezar:", cajasProcesadas);

// 3. Modificar variables
// Podemos cambiar el valor de una variable declarada con 'let'
cajasProcesadas = cajasProcesadas + 5; 
operarioActual = "Santiago";

console.log("Actualización:");
console.log("Nuevo nombre del operario:", operarioActual);
console.log("Cajas procesadas ahora:", cajasProcesadas);

// 4. Operaciones básicas
let totalCajasPermitidas = 100;
let espacioDisponible = totalCajasPermitidas - cajasProcesadas;

console.log("Espacio restante en el depósito:", espacioDisponible);

// TIP: Si intentás cambiar una 'const', JavaScript te va a dar un error.
// Ejemplo: empresa = "Otra cosa"; // Esto rompería el código.

console.log("--- Fin de la Lección 1 ---");