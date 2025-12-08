import { renderHook } from '@testing-library/react';
import { useWebSocket } from '@/hooks/use-websocket';

describe('useWebSocket', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        // Mock the global WebSocket
        global.WebSocket = jest.fn().mockImplementation(() => ({
            close: jest.fn(),
            send: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        })) as any;
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('should replace http with ws in NEXT_PUBLIC_WS_URL', () => {
        process.env.NEXT_PUBLIC_WS_URL = 'http://example.com';

        renderHook(() => useWebSocket('room1', 'user1'));

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^ws:\/\/example\.com\/ws\/room1\/user1$/));
    });

    it('should replace https with wss in NEXT_PUBLIC_WS_URL', () => {
        process.env.NEXT_PUBLIC_WS_URL = 'https://example.com';

        renderHook(() => useWebSocket('room1', 'user1'));

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^wss:\/\/example\.com\/ws\/room1\/user1$/));
    });

    it('should keep ws as is in NEXT_PUBLIC_WS_URL', () => {
        process.env.NEXT_PUBLIC_WS_URL = 'ws://example.com';

        renderHook(() => useWebSocket('room1', 'user1'));

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^ws:\/\/example\.com\/ws\/room1\/user1$/));
    });

    it('should keep wss as is in NEXT_PUBLIC_WS_URL', () => {
        process.env.NEXT_PUBLIC_WS_URL = 'wss://example.com';

        renderHook(() => useWebSocket('room1', 'user1'));

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^wss:\/\/example\.com\/ws\/room1\/user1$/));
    });

    it('should handle Render internal hostname (no protocol, no TLD) by adding wss:// and .onrender.com', () => {
        // This simulates the value from 'property: host' in Render
        process.env.NEXT_PUBLIC_WS_URL = 'coding-interview-backend';

        renderHook(() => useWebSocket('room1', 'user1'));

        // Expects wss:// + hostname + .onrender.com
        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^wss:\/\/coding-interview-backend\.onrender\.com\/ws\/room1\/user1$/));
    });

    it('should handle Render internal hostname with https:// prefix by replacing protocol and adding .onrender.com', () => {
        // Hypothetical case where protocol is present but TLD is missing
        process.env.NEXT_PUBLIC_WS_URL = 'https://coding-interview-backend';

        renderHook(() => useWebSocket('room1', 'user1'));

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^wss:\/\/coding-interview-backend\.onrender\.com\/ws\/room1\/user1$/));
    });

    it('should NOT append .onrender.com to localhost', () => {
        process.env.NEXT_PUBLIC_WS_URL = 'http://localhost:3001';

        renderHook(() => useWebSocket('room1', 'user1'));

        // Should just replace http -> ws
        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringMatching(/^ws:\/\/localhost:3001\/ws\/room1\/user1$/));
    });
});
