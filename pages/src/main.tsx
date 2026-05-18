import React from 'react';
import ReactDOM from 'react-dom/client';
import { CartProvider } from 'use-shopping-cart';
import { AuthProvider } from './AuthContext';
import './index.css';

// Pages will be auto-imported by vite-plugin-pages
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CartProvider
      currency="USD"
      cartMode="client-only"
      mode="payment"
      stripe="pk_test_dummy"
      successUrl="/checkout"
      cancelUrl="/cart"
      shouldPersist
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </CartProvider>
  </React.StrictMode>
);
