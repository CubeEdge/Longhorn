import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import axios from 'axios'
import { DebugProvider } from './components/DebugOverlay'

// Create an axios interceptor to add auth and view-as headers
axios.interceptors.request.use((config) => {
  const viewAsUserId = localStorage.getItem('longhorn_view_as_user');
  if (viewAsUserId) {
    config.headers['X-View-As-User'] = viewAsUserId;
  }

  // Attempt to inject valid auth token from Zustand's localStorage if missing in header
  if (!config.headers['Authorization']) {
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        const token = parsed?.state?.token;
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch (e) {
      console.error('Failed to parse auth token for interceptor', e);
    }
  }

  return config;
});

// Entry Point - v1.1.9 (Force Cache Bust)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DebugProvider>
      <App />
    </DebugProvider>
  </React.StrictMode>,
)
