import Cookies from "js-cookie";
import api from "./api";

export const register = async (payload: any) => {
  try {
    const res = await api.post("/register", payload);
    return res.data;
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.response?.data?.error ||
      err.message ||
      "Registration failed";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};

export const login = async (username: string, password: string) => {
  const params = new URLSearchParams();
  params.append("username", username);
  params.append("password", password);
  try {
    const response = await api.post("/login", params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data: any = response.data;
    if (data.access_token) {
      Cookies.set("token", data.access_token, { path: "/" });
    
      const user = await getUser();        
    
      if (user.is_superuser === true || user.is_superuser === 1) {
        window.location.replace("/admin-dashboard");
      } else if (user.is_researcher === true || user.is_researcher === 1) {
        window.location.replace("/researcher-dashboard");
      } else {
        window.location.replace("/patient-dashboard");
      }
    }
   
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.response?.data?.error ||
      err.message ||
      "Login failed";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};

export const logout = () => {
  Cookies.remove("token");
}

export const getUser = async () => {
  let token :any = Cookies.get("token");
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  let res:any = await api.get(`/verify_token`, { headers })
  return res.data
};

export const fetchAllUsers = async () => {
  let response = await api.get('/users');
  return response.data
}

export const updateSuperUser = async (id:number,payload: any) => {
  let response = await api.patch(`/change_superuser/${id}`, payload)
  return response.data
}

export const registerResearcher = async (payload: { username: string; email: string; password: string }) => {
  try {
    const res = await api.post("/create-researcher", payload);
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) {
      throw new Error(
        "Researcher API not found (404). Open http://127.0.0.1:9999/health — you should see tag hv-health-v2. If you still see Not Found, stop all Python on port 9999 and run: python server.py from the backend folder."
      );
    }
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Could not create researcher";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};

export const updateResearcher = async (id: number, payload: { is_researcher: boolean }) => {
  const res = await api.patch(`/change_researcher/${id}`, {
    username: "",
    email: "",
    is_superuser: false,
    is_researcher: payload.is_researcher,
    password: "",
  });
  return res.data;
};

export const updateUserAdmin = async (
  id: number,
  payload: { username?: string; email?: string; password?: string }
) => {
  try {
    const res = await api.patch(`/user/${id}`, payload);
    return res.data;
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Update failed";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};

export const deleteUser = async (id: number) => {
  try {
    const res = await api.delete(`/user/${id}`);
    return res.data;
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Delete failed";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};

export const updateMyProfile = async (payload: {
  username: string;
  email: string;
  current_password?: string;
  new_password?: string;
}) => {
  try {
    const res = await api.patch("/me", payload);
    const data: any = res.data;
    if (data.access_token) {
      Cookies.set("token", data.access_token, { path: "/" });
    }
    return data;
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Could not update profile";
    const message = Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg;
    throw new Error(message);
  }
};