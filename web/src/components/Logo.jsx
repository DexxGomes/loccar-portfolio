/**
 * Símbolo do LocCar: um balão de conversa com um carro dentro
 * (a reserva nasce de uma conversa no WhatsApp).
 *
 * O balão usa `currentColor`, então a cor vem da classe do elemento
 * (ex: text-blue-600 no login, text-blue-500 no menu grafite).
 */
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* balão + rabinho */}
      <rect x="4" y="4" width="40" height="30" rx="9" fill="currentColor" />
      <path d="M14 32 L14 43 L25 33 Z" fill="currentColor" />
      {/* carro */}
      <path d="M18 13 H29 L32 18 H15 Z" fill="#fff" />
      <rect x="13" y="17.5" width="22" height="6" rx="2" fill="#fff" />
      <circle cx="18" cy="24.5" r="3" fill="#fff" />
      <circle cx="30" cy="24.5" r="3" fill="#fff" />
      <circle cx="18" cy="24.5" r="1.2" fill="currentColor" />
      <circle cx="30" cy="24.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
