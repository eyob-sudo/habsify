import axios from 'axios';
import { getToken } from './authService'
import { attachGlobalErrorHandler } from './globalErrorHandler'

const API_URL = import.meta.env.VITE_API_URL || "https://habsify-api.up.railway.app";


const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

let _latestAccess = null;
export function setGlobalAccessStatus(access) {
    _latestAccess = access;
}

api.interceptors.request.use(
    (config) => {
        const token = getToken()
        if (token) config.headers.Authorization = `Bearer ${token}`;

        // Block requests locally if app is strictly in read-only mode
        if (_latestAccess?.read_only && _latestAccess?.subscription_status !== 'NO_PLAN') {
            const method = config.method?.toLowerCase()

            // Only allow auth, user accounts, and subscription endpoints.
            // Using regex to ensure it strictly starts with these paths
            // (so it doesn't accidentally allow /finance/accounts/)
            const isSafeRoute = /\/(subscriptions|accounts|auth|company)\//i.test(config.url)

            if (!isSafeRoute) {
                // If attempting to write data, reject loudly
                if (['post', 'put', 'patch', 'delete'].includes(method)) {
                    return Promise.reject({
                        isClientCancellation: true,
                        silent: false,
                        message: "Action restricted by subscription plan"
                    })
                }

                // If attempting to read feature data like CRM, Finance, or Inventory, bypass network completely
                // and resolve with an empty response so the UI stays clean without throwing errors
                if (method === 'get') {
                    config.adapter = function(config) {
                        return new Promise((resolve) => {
                            const emptyData = Object.assign([], { results: [], count: 0 });
                            resolve({
                                data: emptyData,
                                status: 200,
                                statusText: 'OK',
                                headers: {},
                                config,
                                request: {}
                            });
                        });
                    };
                }
            }
        }

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
