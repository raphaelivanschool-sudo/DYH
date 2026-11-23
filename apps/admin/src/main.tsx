import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { ApiProvider } from '@dyh/api';
import { App } from './app/App';
import { api } from './api';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider api={api}>
      <App />
      <Toaster position="bottom-center" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
    </ApiProvider>
  </StrictMode>,
);
