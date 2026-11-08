import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ProductionProvider } from './store/ProductionStore';
import { BomProvider } from './store/BomStore';
import { applyTheme, type ThemePref } from './lib/theme';
import { readJson } from './lib/storage';
import './styles.css';

applyTheme(readJson<ThemePref>('local', 'jal.theme') ?? 'system');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProductionProvider>
          <BomProvider>
            <App />
          </BomProvider>
        </ProductionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
