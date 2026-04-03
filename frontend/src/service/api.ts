import axios from 'axios';
import Cookies from 'js-cookie';

const envBase = process.env.REACT_APP_API_URL;
const baseURL =
  envBase != null && envBase !== ""
    ? envBase.endsWith("/api")
      ? envBase
      : `${envBase.replace(/\/$/, "")}/api`
    : "http://localhost:9999/api";

const api = axios.create({
  baseURL,
});

// Send token from cookie on every request so /verify_token and /users work
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;