import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerReminderServiceWorker } from './lib/pwaReminderService.ts'

registerReminderServiceWorker().catch((error) => {
  console.warn('[PWA] Service worker registration failed:', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
