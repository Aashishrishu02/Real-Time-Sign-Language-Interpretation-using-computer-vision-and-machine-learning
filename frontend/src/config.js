// Base URL for the backend API (defaults to localhost:8000 for local development)
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// WebSocket URL derived dynamically from the API_URL
export const WS_URL = API_URL.replace(/^http/, 'ws');
