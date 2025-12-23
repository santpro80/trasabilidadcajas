// --- Archivo de Práctica de JavaScript ---

// En este archivo vamos a aprender los conceptos básicos de JavaScript.

// ===================================================================
// TEMA 1: VARIABLES
// ===================================================================

// Una variable es como una caja con una etiqueta donde guardamos datos.
// En JavaScript moderno, tenemos principalmente 3 formas de crear (declarar) variables: const, let y var.

const nombreAplicacion = "Mi App de Cajas";
let contadorDeCajas = 0;
var versionAntigua = "1.0";

// ===================================================================
// TEMA 2: TIPOS DE DATOS - Strings (Cadenas de Texto)
// ===================================================================

const inicial = 'S';
let fruta = "Manzana";
const bienvenida = `Hola, ${fruta}. ¡Bienvenido a ${nombreAplicacion}!`;

// ===================================================================
// TEMA 3: El Punto y Coma (;)
// ===================================================================

// REGLA DE ORO: Acostúmbrate a terminar cada instrucción con un punto y coma (;).
const ciudad = "Madrid";
let codigoPostal = 28001;

// ===================================================================
// TEMA 4: FUNCIONES
// ===================================================================

/*
 * Una función es un bloque de código reutilizable que realiza una tarea.
 * Se define con la palabra 'function', se le da un nombre, y puede recibir
 * datos de entrada (parámetros) para trabajar con ellos.
 * La instrucción 'return' especifica el valor que la función devuelve como resultado.
 */

// --- Ejemplo Práctico: Una función para saludar ---
function crearSaludo(nombre) {
  const saludo = `¡Hola, ${nombre}! Bienvenido/a.`;
  return saludo;
}

// --- Ejemplo: Calculadora de IVA ---
function calcularIva(precio) {
  return precio * 0.21;
}

// --- Ejemplo: Calculadora de Promedio ---
function calcularPromedio(nota1, nota2, nota3) {
  const resultadoDelPromedio = (nota1 + nota2 + nota3) / 3;
  return resultadoDelPromedio;
}

// ===================================================================
// TEMA 6: MÉTODOS ÚTILES PARA STRINGS Y NÚMEROS
// ===================================================================

/*
 * Algunos tipos de datos (como los Strings) vienen con "herramientas" incorporadas
 * que nos permiten trabajar con ellos. Estas herramientas se llaman "métodos".
 * Se usan poniendo un punto (.) después de la variable. Por ejemplo: miVariable.metodo()
 */

// --- Métodos de Strings ---

// 1. .toLowerCase() - Convertir a minúsculas
/*
 * Devuelve una NUEVA versión de un string, pero completamente en minúsculas.
 * Es súper útil para normalizar texto (emails, usernames, etc).
 * Ejemplo: const textoOriginal = "HOLA MUNDO";
 *          const textoEnMinusculas = textoOriginal.toLowerCase(); // "hola mundo"
 */

// 2. .slice(inicio, fin) - Cortar un trozo del string
/*
 * Permite "cortar" y obtener una parte de un string.
 * - 'inicio': La posición donde empieza el corte (la primera letra es la posición 0).
 * - 'fin': La posición donde termina el corte (OJO: no se incluye el caracter de esta posición).
 * - También puedes usar números negativos para empezar a contar desde el final.
 * Ejemplo: const frase = "Hola Mundo";
 *          frase.slice(0, 4);  // "Hola"
 *          frase.slice(5);     // "Mundo"
 *          frase.slice(-5);    // "Mundo"
 */


// --- Operadores para Números ---

// 1. El Operador Módulo (%) - Obtener el resto de una división
/*
 * Este operador aritmético divide un número por otro, pero te da el "resto" de la división.
 * Es muy útil para saber si un número es par o impar, o para obtener los últimos dígitos de un número.
 * Ejemplo: const anio = 1998;
 *          const ultimosDosDigitos = anio % 100; // ultimosDosDigitos es 98
 */

// ===================================================================
// TEMA 7: PROPIEDADES Y MÉTODOS ÚTILES ADICIONALES
// ===================================================================

// --- La Propiedad .length (Longitud) ---
/*
 * Es una "propiedad" (no un método, no lleva '()') que te da el NÚMERO TOTAL de caracteres en un string.
 * Cuenta letras, números, símbolos y también los espacios.
 * Ejemplo: const frase = "Hola Mundo";
 *          console.log(frase.length); // Muestra 10
 */

// --- El Método .indexOf() (Índice de) ---
/*
 * Busca la PRIMERA APARICIÓN de un texto dentro de otro y te dice su posición (su "índice").
 * REGLA CLAVE: Las posiciones en JavaScript siempre empiezan a contar desde 0.
 * Si no encuentra el texto, devuelve -1.
 * Ejemplo: const email = "usuario@ejemplo.com";
 *          console.log(email.indexOf('@')); // Muestra 7
 *          console.log(email.indexOf('z')); // Muestra -1
 */
