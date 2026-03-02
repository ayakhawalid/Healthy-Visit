import * as React from "react";
import { useLocation } from "react-router-dom";
import logo from "../logo.svg";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const location = useLocation();
  const isSignUp = location.pathname === "/signup";

  return (
    <div className="auth-container">
      <div
        className={`auth-panel auth-panel-green ${isSignUp ? "auth-panel-slided" : ""}`}
      >
        <img
          src={logo}
          className="App-logo"
          alt="logo"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>
      <div
        className={`auth-panel auth-panel-white ${isSignUp ? "auth-panel-slided" : ""}`}
      >
        <div className="auth-form-box">
          {children}
        </div>
      </div>
    </div>
  );
}
