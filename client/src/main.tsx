import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import axios from 'axios'
import { DebugProvider } from './components/DebugOverlay'

// P2: View As functionality - Add X-View-As-User header to all requests
axios.interceptors.request.use((config) => {
  const viewAsUserId = sessionStorage.getItem('viewAsUserId');
  if (viewAsUserId) {
    config.headers['X-View-As-User'] = viewAsUserId;
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
