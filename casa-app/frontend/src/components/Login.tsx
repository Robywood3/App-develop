import { useState, type FormEvent } from 'react';
import { ApiError, login } from '../api/client';
import type { User } from '../api/types';

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [fixed, setFixed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await login(nome, password, fixed ? 'casa' : 'mobile');
      onLogin(r.utente);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Accesso non riuscito');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <img src="/icon.svg" alt="" width={56} height={56} />
        <h1>Casa App</h1>
        <label htmlFor="nome">Nome</label>
        <input id="nome" autoComplete="username" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <label className="check"><input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} /> Dispositivo fisso di casa (TV, tablet): resta collegato</label>
        {error && <div className="notice err" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Accesso…' : 'Entra'}</button>
      </form>
    </div>
  );
}
