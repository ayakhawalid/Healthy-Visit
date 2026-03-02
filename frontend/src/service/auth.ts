import Cookies from "js-cookie";
import api from "./api";

export const register = async (payload: any) => {
  await api
    .post("/register", payload)
    .then((response) => console.log(response))
    .catch((err) => console.log(err));
  window.location.replace("/")
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
      window.location.replace("/dashboard");
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err: any) {
    const msg =
      err.response?.data?.detail ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.response?.data?.error ||
      err.message ||
      "Login failed";
    alert(Array.isArray(msg) ? msg.map((m: any) => m.msg || m).join(", ") : msg);
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