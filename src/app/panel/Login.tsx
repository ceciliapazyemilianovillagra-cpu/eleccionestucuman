"use client";
import { FormEvent } from "react";

export function Login({ email, password, error, setEmail, setPassword, submit }: { email: string; password: string; error: string; setEmail: (v: string) => void; setPassword: (v: string) => void; submit: (e: FormEvent) => void }) {
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/icon.svg" alt="Logo Elecciones Tucumán" />
        <h1>Elecciones Tucumán</h1>
        <p>Ingresá</p>
        <label>
          Correo
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button>INGRESAR A LA APP</button>
      </form>
    </main>
  );
}
