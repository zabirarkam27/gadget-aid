import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { RouterProvider } from "react-router-dom";
import router from './router/router.jsx';
import AuthProvider from './provider/AuthProvider.jsx';
import { ToastContainer } from 'react-toastify';
import { initializeTheme } from './utils/theme';
import { recoverPreload } from './utils/preloadRecovery';

initializeTheme();
window.addEventListener('vite:preloadError', (event) => {
  try {
    recoverPreload(event, { storage: window.sessionStorage, reload: () => window.location.reload(), now: Date.now(), online: navigator.onLine });
  } catch {
    // The existing error boundary keeps its manual reload action available.
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
      <AuthProvider>
        <ToastContainer />
        <RouterProvider router={router} />
      </AuthProvider>
  </StrictMode>
);
