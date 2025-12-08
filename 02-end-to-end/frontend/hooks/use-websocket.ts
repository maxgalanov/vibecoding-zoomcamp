import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';

export type WebSocketMessage =
    | { type: 'join'; username: string; timestamp: number }
    | { type: 'leave'; username: string; timestamp: number }
    | { type: 'code-update'; data: { code: string } }
    | { type: 'language-update'; data: { language: string; code: string } }
    | { type: 'cursor-update'; data: CursorUpdateData }
    | { type: 'selection-update'; data: SelectionUpdateData };

export interface CursorUpdateData {
    oderId: string;
    username: string;
    position: number;
    selectionStart: number;
    selectionEnd: number;
    cursorColor: string;
    selectionColor: string;
}

export interface SelectionUpdateData {
    // Add specific selection data if different from cursor update,
    // but usually cursor update covers selection too.
    // keeping it simple for now as cursor-update handles both in the current design plan.
    [key: string]: any
}

export const useWebSocket = (roomId: string, username: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId || !username) return;

        // Build WebSocket URL
        // Use NEXT_PUBLIC_WS_URL if set (for explicit configuration)
        // Otherwise derive from API_BASE_URL or window.location
        const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL;

        let wsUrl: string;
        if (WS_BASE_URL) {
            // Explicitly configured WebSocket URL
            let validatedUrl = WS_BASE_URL;

            // 1. Ensure protocol is ws/wss even if http/https is provided
            if (validatedUrl.startsWith('http')) {
                validatedUrl = validatedUrl.replace(/^http/, 'ws');
            } else if (!validatedUrl.startsWith('ws')) {
                // If no protocol, assume wss (secure)
                validatedUrl = `wss://${validatedUrl}`;
            }

            // 2. Handle missing TLD (Render 'host' property check)
            try {
                // Extract hostname to check for dots
                // Handle cases like wss://hostname or just hostname (though protocol added above)
                const urlParts = validatedUrl.split('://');
                const protocol = urlParts[0];
                const hostPath = urlParts[1];
                let hostname = hostPath.split('/')[0];

                // Strip port number if present
                if (hostname.includes(':')) {
                    hostname = hostname.split(':')[0];
                }

                if (hostname !== 'localhost' && !hostname.includes('.')) {
                    // Reconstruct with .onrender.com
                    validatedUrl = `${protocol}://${hostname}.onrender.com`;
                    if (hostPath.indexOf('/') !== -1) {
                        const path = hostPath.substring(hostPath.indexOf('/'));
                        validatedUrl += path;
                    }
                }
            } catch (e) {
                console.warn("Failed to parse WS_BASE_URL", e);
            }

            wsUrl = `${validatedUrl}/ws/${roomId}/${username}`;
        } else if (API_BASE_URL.startsWith('http')) {
            // Local dev: derive from API_BASE_URL
            const wsBaseUrl = API_BASE_URL.replace('http', 'ws');
            wsUrl = `${wsBaseUrl}/ws/${roomId}/${username}`;
        } else {
            // Docker/production with nginx reverse proxy
            // WebSocket endpoint is at /ws/, NOT /api/ws/
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}/ws/${roomId}/${username}`;
        }

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to WebSocket');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                setLastMessage(message);
            } catch (e) {
                console.error('Failed to parse websocket message', e);
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from WebSocket');
            setIsConnected(false);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socketRef.current = ws;

        return () => {
            ws.close();
        };
    }, [roomId, username]);

    const sendMessage = useCallback((message: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(message));
        }
    }, []);

    return { isConnected, lastMessage, sendMessage };
};
