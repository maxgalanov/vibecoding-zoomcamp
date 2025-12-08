/**
 * Real Backend API Client
 * Communicates with FastAPI backend
 */

// In Docker: uses /api (nginx proxies to backend)
// In local dev: uses http://localhost:3001
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Helper to handle fetch requests
 */
async function fetchAPI(endpoint, options = {}) {
    // URL Normalization Logic
    let baseUrl = API_BASE_URL;

    // 1. Handle missing protocol (Render 'host' property usually lacks it)
    if (!baseUrl.startsWith("http")) {
        baseUrl = `https://${baseUrl}`;
    }

    // 2. Handle missing TLD (Render 'host' property might just be the slug)
    // Check if it's not localhost and doesn't contain a dot (heuristic for internal slug)
    try {
        const urlObj = new URL(baseUrl);
        if (urlObj.hostname !== 'localhost' && !urlObj.hostname.includes('.')) {
            baseUrl = `${baseUrl}.onrender.com`;
        }
    } catch (e) {
        // Fallback or ignore if URL parsing fails
        console.warn("Failed to parse API_BASE_URL", e);
    }

    const url = `${baseUrl}${endpoint}`;
    const defaultHeaders = {
        "Content-Type": "application/json",
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);

        // Handle 204 No Content or empty responses
        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || "API request failed");
            }

            return data;
        } else {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return await response.text();
        }
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

/**
 * Create a new room
 * @returns {Promise<{roomId: string, room: object}>}
 */
export async function createRoom() {
    const data = await fetchAPI("/rooms", {
        method: "POST",
    });
    return data;
}

/**
 * Get room by ID
 * @param {string} roomId
 * @returns {Promise<object|null>}
 */
export async function getRoom(roomId) {
    try {
        return await fetchAPI(`/rooms/${roomId}`);
    } catch (error) {
        if (error.message.includes("404")) {
            return null;
        }
        throw error;
    }
}

/**
 * Join a room
 * @param {string} roomId
 * @param {string} username
 * @returns {Promise<{success: boolean, room?: object, error?: string}>}
 */
export async function joinRoom(roomId, username) {
    try {
        const data = await fetchAPI(`/rooms/${roomId}/join`, {
            method: "POST",
            body: JSON.stringify({ username }),
        });
        console.log("joinRoom response:", data);
        return data;
    } catch (error) {
        console.error("joinRoom error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get participants in a room
 * @param {string} roomId
 * @returns {Promise<object[]>}
 */
export async function getParticipants(roomId) {
    try {
        return await fetchAPI(`/rooms/${roomId}/participants`);
    } catch (error) {
        console.error("Failed to get participants", error);
        return [];
    }
}

/**
 * Update room code
 * @param {string} roomId
 * @param {string} code
 * @returns {Promise<{success: boolean}>}
 */
export async function updateRoomCode(roomId, code) {
    // Use PATCH for partial updates
    return await fetchAPI(`/rooms/${roomId}/code`, {
        method: "PATCH",
        body: JSON.stringify({ code }),
    });
}

/**
 * Update room language
 * @param {string} roomId
 * @param {string} language
 * @returns {Promise<{success: boolean, code: string}>}
 */
export async function updateRoomLanguage(roomId, language) {
    return await fetchAPI(`/rooms/${roomId}/language`, {
        method: "PATCH",
        body: JSON.stringify({ language }),
    });
}

// Re-export executeCode from the local code executor
// All code execution happens client-side via WASM for security
export { executeCode } from "./code-executor.js";

/**
 * Leave a room
 * @param {string} roomId
 * @param {string} username
 * @returns {Promise<{success: boolean}>}
 */
export async function leaveRoom(roomId, username) {
    return await fetchAPI(`/rooms/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({ username }),
    });
}

/**
 * Get default code for a language
 * This is static data, can keep it client-side or fetch from backend if dynamic.
 * This is static data, can keep it client-side or fetch from backend if dynamic.
 */
export function getDefaultCode(language) {
    const defaultCodes = {
        javascript: `// Welcome to the coding interview!\n// Write your JavaScript solution here\n\nfunction solution(input) {\n  // Your code here\n  return input;\n}\n\nconsole.log(solution("Hello, World!"));`,
        python: `# Welcome to the coding interview!\n# Write your Python solution here\n\ndef solution(input):\n    # Your code here\n    return input\n\nprint(solution("Hello, World!"))`,
    };
    return defaultCodes[language] || "";
}
