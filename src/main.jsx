import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'
import { ToastProvider } from './toast.jsx'

// No router in this app - a single extra static route doesn't need one.
// Firebase Hosting's SPA rewrite (see firebase.json) already serves
// index.html for every path, so this is the only piece needed to make
// /admin (or /admin/) resolve to a different tree.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      {isAdminRoute ? <AdminApp /> : <App />}
    </ToastProvider>
  </StrictMode>,
)
