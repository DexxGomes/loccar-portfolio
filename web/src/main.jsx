import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfirmProvider } from './components/Modal.jsx';
import BarraProgresso from './components/BarraProgresso.jsx';
import { TemaProvider } from './hooks/useTema.jsx';
import './index.css';

// Os provedores ficam acima das rotas para que qualquer tela possa trocar o
// tema e disparar avisos (toast) e caixas de confirmação.
// A BarraProgresso fica FORA das rotas de propósito: assim ela também aparece
// na tela de login, que é justamente onde a espera mais assusta.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TemaProvider>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <App />
            <BarraProgresso />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </TemaProvider>
  </React.StrictMode>
);
