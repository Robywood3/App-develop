import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Row { id: number; ts: string; utente: string; servizio: string | null; target: string; valore: unknown; esito: string }

/** Command log (RF-07): who sent which command and when. */
export function Registro() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    api<{ comandi: Row[] }>('GET', '/api/commands?limit=200').then((r) => setRows(r.comandi)).catch(() => setRows([]));
  }, []);
  return (
    <section className="card">
      {rows === null ? <div className="empty">Caricamento…</div> : rows.length === 0 ? <div className="empty">Nessun comando registrato.</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quando</th><th>Utente</th><th>Comando</th><th>Valore</th><th>Esito</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{new Date(r.ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td>{r.utente}</td>
                  <td>{r.target}</td>
                  <td className="num">{r.valore === null || r.valore === undefined ? '–' : String(r.valore)}</td>
                  <td className={r.esito === 'ok' ? 'ok' : 'err'}>{r.esito}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
