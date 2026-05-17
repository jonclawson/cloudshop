import React, { useState, useEffect } from 'react';
import { adminApi } from '../useApi';

export default function AdminSyncProductsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSync = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminApi.syncProducts();
      setResult(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to sync products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-8">Admin - Sync Products</h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            ⚠️ This page is for development only. Use with caution in production.
          </p>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg">
          <button
            onClick={handleSync}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Syncing...' : 'Sync Products from Printful'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              <p className="font-semibold">Sync Complete!</p>
              <p>Synced {result.synced_count} products</p>
              <p className="text-sm mt-2">{result.synced_at}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
