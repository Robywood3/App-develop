import { useEffect, useState } from 'react';

const URL_3D = '/3d/casa-3d-live.html';

/** 3D view: first as iframe of casa-3d-live.html (section 8), integrated later. */
export function Tre3D() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(URL_3D, { method: 'HEAD' })
      .then((r) => setAvailable(r.ok && (r.headers.get('content-type') ?? '').includes('html')))
      .catch(() => setAvailable(false));
  }, []);
  if (available === null) return null;
  if (!available) {
    return (
      <div className="notice">
        La pagina 3D non è ancora nel progetto. Copia <code>casa-3d-live.html</code> in <code>frontend/public/3d/</code> e ricostruisci il frontend.
      </div>
    );
  }
  return <iframe className="frame3d" src={URL_3D} title="Casa 3D" />;
}
