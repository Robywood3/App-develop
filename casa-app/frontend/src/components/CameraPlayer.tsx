import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

/** Live camera via WebRTC: the backend relays offer/answer to go2rtc; media flows directly. */
export function CameraPlayer({ name }: { name: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'connessione' | 'diretta' | 'errore'>('connessione');

  useEffect(() => {
    let closed = false;
    const pc = new RTCPeerConnection();
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = (ev) => {
      if (video.current && ev.streams[0]) {
        video.current.srcObject = ev.streams[0];
        setStatus('diretta');
      }
    };
    (async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer());
        // wait for ICE gathering (max 2 s): go2rtc accepts a complete offer
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const t = setTimeout(resolve, 2000);
          pc.onicegatheringstatechange = () => pc.iceGatheringState === 'complete' && (clearTimeout(t), resolve());
        });
        const answer = await api<{ sdp: string }>('POST', `/api/cameras/${encodeURIComponent(name)}/webrtc`, { sdp: pc.localDescription?.sdp });
        if (!closed) await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      } catch {
        if (!closed) setStatus('errore');
      }
    })();
    return () => {
      closed = true;
      pc.close();
    };
  }, [name]);

  return (
    <div className="player">
      <video ref={video} autoPlay muted playsInline />
      {status !== 'diretta' && <div className="player-msg">{status === 'errore' ? 'Diretta non disponibile' : 'Connessione…'}</div>}
    </div>
  );
}
