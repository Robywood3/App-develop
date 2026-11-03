const PATHS: Record<string, string> = {
  casa: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  impianto: 'M4 7h6v10H4zM14 4h6v6h-6zM14 14h6v6h-6zM10 12h2v-5h2M12 12v5h2',
  energia: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  statistiche: 'M3 3v18h18M7 15l4-5 4 3 5-7',
  tred: 'M12 2 3 7v10l9 5 9-5V7l-9-5ZM3 7l9 5 9-5M12 12v10',
  telecamere: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  auto: 'M5 16V11l2-5h10l2 5v5M3 16h18v2a1 1 0 0 1-1 1h-2v-3M3 16v2a1 1 0 0 0 1 1h2v-3M5 11h14',
  registro: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  fuoco: 'M12 22c4 0 7-2.8 7-7 0-3.5-2.2-6-4-8 0 2.5-1.3 4-2.5 4.5C13 8 12 5 9.5 2.5 9.5 6 5 9 5 15c0 4.2 3 7 7 7Z',
  ventola: 'M12 12c-1.5-3.5-1-8 2-8.5 2.5-.4 3.5 2 2.3 4.2-.9 1.6-2.6 2.8-4.3 4.3ZM12 12c3.5-1.5 8-1 8.5 2 .4 2.5-2 3.5-4.2 2.3-1.6-.9-2.8-2.6-4.3-4.3ZM12 12c1.5 3.5 1 8-2 8.5-2.5.4-3.5-2-2.3-4.2.9-1.6 2.6-2.8 4.3-4.3ZM12 12c-3.5 1.5-8 1-8.5-2-.4-2.5 2-3.5 4.2-2.3 1.6.9 2.8 2.6 4.3 4.3Z',
  acqua: 'M12 2.7S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7Z',
  termometro: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z',
  play: 'M7 4.5v15l12-7.5-12-7.5Z',
  esci: 'M10 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5M15 16l4-4-4-4M19 12H9',
  allerta: 'M12 3 2 20h20L12 3ZM12 10v4M12 17h.01',
  chiudi: 'M6 6l12 12M18 6 6 18',
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.casa} />
    </svg>
  );
}
