import axios from 'axios';
import { getToken } from './authService'
import { attachGlobalErrorHandler } from './globalErrorHandler'

const api = axios.create({
    baseURL: 'https://habsify-saas-07g4.onrender.com',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = getToken()
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

attachGlobalErrorHandler(api)

export default api;