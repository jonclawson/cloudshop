import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function CartPage() {
  const { isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState([]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to continue</h2>
          <a href="/login" className="text-indigo-600 hover:text-indigo-700">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

        {cartItems.length === 0 ? (
          <div className="text-center">
            <p className="text-gray-600 mb-4">Your cart is empty</p>
            <a href="/" className="text-indigo-600 hover:text-indigo-700">
              Continue shopping
            </a>
          </div>
        ) : (
          <div>
            {/* Cart items will go here */}
            <button className="mt-8 w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
