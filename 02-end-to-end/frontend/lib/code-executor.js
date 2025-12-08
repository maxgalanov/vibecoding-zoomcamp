/**
 * Client-side Code Executor
 * Executes JavaScript and Python code in the browser using WASM
 */

// Pyodide instance (lazy-loaded)
let pyodide = null;
let pyodideLoading = null;

// Execution timeout in milliseconds
const EXECUTION_TIMEOUT_MS = 5000;

// Pyodide CDN URL
const PYODIDE_CDN_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/";

/**
 * Load Pyodide from CDN via script tag (to avoid Turbopack issues)
 */
async function loadPyodideRuntime() {
    if (pyodide) {
        return pyodide;
    }

    if (pyodideLoading) {
        return pyodideLoading;
    }

    pyodideLoading = new Promise((resolve, reject) => {
        // Check if loadPyodide is already available (script already loaded)
        if (typeof window !== "undefined" && window.loadPyodide) {
            window.loadPyodide({
                indexURL: PYODIDE_CDN_URL,
            }).then((py) => {
                pyodide = py;
                resolve(pyodide);
            }).catch(reject);
            return;
        }

        // Load the Pyodide script dynamically
        const script = document.createElement("script");
        script.src = `${PYODIDE_CDN_URL}pyodide.js`;
        script.async = true;

        script.onload = async () => {
            try {
                pyodide = await window.loadPyodide({
                    indexURL: PYODIDE_CDN_URL,
                });
                resolve(pyodide);
            } catch (error) {
                reject(error);
            }
        };

        script.onerror = () => {
            reject(new Error("Failed to load Pyodide script from CDN"));
        };

        document.head.appendChild(script);
    });

    return pyodideLoading;
}

/**
 * Execute JavaScript code in a sandboxed environment
 * @param {string} code - JavaScript code to execute
 * @returns {Promise<{output: string, error?: string}>}
 */
async function executeJavaScript(code) {
    const logs = [];

    try {
        // Create a sandboxed execution environment
        const sandbox = {
            console: {
                log: (...args) => logs.push(args.map((a) => formatValue(a)).join(" ")),
                error: (...args) => logs.push(`Error: ${args.map((a) => formatValue(a)).join(" ")}`),
                warn: (...args) => logs.push(`Warning: ${args.map((a) => formatValue(a)).join(" ")}`),
                info: (...args) => logs.push(args.map((a) => formatValue(a)).join(" ")),
            },
        };

        // Wrap code to use sandboxed console
        const wrappedCode = `
      (function(console) {
        ${code}
      })(this.console);
    `;

        // Execute with timeout protection
        const fn = new Function(wrappedCode);

        await Promise.race([
            Promise.resolve(fn.call(sandbox)),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Execution timed out (5 seconds)")), EXECUTION_TIMEOUT_MS)
            ),
        ]);

        return {
            output: logs.length > 0 ? logs.join("\n") : "Code executed successfully (no output)",
        };
    } catch (error) {
        return {
            output: logs.length > 0 ? logs.join("\n") + "\n" + `Error: ${error.message}` : `Error: ${error.message}`,
            error: error.message,
        };
    }
}

/**
 * Execute Python code using Pyodide
 * @param {string} code - Python code to execute
 * @param {function} onLoadingStart - Callback when Pyodide starts loading
 * @returns {Promise<{output: string, error?: string}>}
 */
async function executePython(code, onLoadingStart) {
    try {
        // Notify that Pyodide is loading (first time)
        if (!pyodide && onLoadingStart) {
            onLoadingStart();
        }

        const py = await loadPyodideRuntime();

        // Capture stdout/stderr
        py.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);

        // Execute the user's code with timeout
        const executeWithTimeout = async () => {
            try {
                await py.runPythonAsync(code);
            } catch (pyError) {
                // Python errors are handled below
                throw pyError;
            }
        };

        await Promise.race([
            executeWithTimeout(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Execution timed out (5 seconds)")), EXECUTION_TIMEOUT_MS)
            ),
        ]);

        // Get the captured output
        const stdout = py.runPython("sys.stdout.getvalue()");
        const stderr = py.runPython("sys.stderr.getvalue()");

        // Reset stdout/stderr for next execution
        py.runPython(`
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);

        const output = (stdout + stderr).trim();
        return {
            output: output || "Code executed successfully (no output)",
        };
    } catch (error) {
        return {
            output: `Error: ${error.message}`,
            error: error.message,
        };
    }
}

/**
 * Format a value for console output
 * @param {any} value
 * @returns {string}
 */
function formatValue(value) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

/**
 * Execute code in the specified language
 * @param {string} code - Code to execute
 * @param {string} language - Programming language ("javascript" or "python")
 * @param {object} options - Optional callbacks
 * @param {function} options.onPyodideLoading - Called when Pyodide starts loading
 * @returns {Promise<{output: string, error?: string}>}
 */
export async function executeCode(code, language, options = {}) {
    switch (language) {
        case "javascript":
            return executeJavaScript(code);
        case "python":
            return executePython(code, options.onPyodideLoading);
        default:
            return {
                output: `Unsupported language: ${language}`,
                error: "Unsupported language",
            };
    }
}

/**
 * Check if Pyodide is loaded
 * @returns {boolean}
 */
export function isPyodideLoaded() {
    return pyodide !== null;
}

/**
 * Preload Pyodide (optional, for better UX)
 * @returns {Promise<void>}
 */
export async function preloadPyodide() {
    await loadPyodideRuntime();
}
