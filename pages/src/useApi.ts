import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export const useApi = () => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add JWT to request headers
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle token refresh on 401
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          try {
            const response = await api.post('/api/auth/refresh', {
              refresh_token: refreshToken,
            });
            localStorage.setItem('access_token', response.data.access_token);
            // Retry original request
            return api(error.config);
          } catch (refreshError) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );

  return api;
};

export const authApi = {
  signup: (email: string, password: string) =>
    axios.post(`${API_BASE_URL}/api/auth/signup`, { email, password }),

  login: (email: string, password: string) =>
    axios.post(`${API_BASE_URL}/api/auth/login`, { email, password }),

  logout: () =>
    axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    }),
};

export const productsApi = {
  getAll: () => axios.get(`${API_BASE_URL}/api/products`),

  getById: (id: string) =>
    axios.get(`${API_BASE_URL}/api/products/${id}`),
};

export const ordersApi = {
  create: (items: any[], shippingAddress: any) =>
    axios.post(
      `${API_BASE_URL}/api/orders`,
      { items, shipping_address: shippingAddress },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      }
    ),

  getAll: () =>
    axios.get(`${API_BASE_URL}/api/orders`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    }),

  getById: (id: string) =>
    axios.get(`${API_BASE_URL}/api/orders/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    }),
};

export const uploadsApi = {
  create: (file: File, designName: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('design_name', designName);

    return axios.post(`${API_BASE_URL}/api/uploads`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    });
  },

  getAll: () =>
    axios.get(`${API_BASE_URL}/api/uploads`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    }),

  delete: (id: string) =>
    axios.delete(`${API_BASE_URL}/api/uploads/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
    }),
};

export const adminApi = {
  syncProducts: () =>
    axios.post(`${API_BASE_URL}/api/admin/sync-products`, {}),
};
