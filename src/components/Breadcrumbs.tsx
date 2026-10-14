export default function Breadcrumbs({
  page,
  label,
  onNavigate,
}: {
  page: string;
  label: string;
  onNavigate: (page: string) => void;
}) {
  return (
    <nav className="breadcrumb" aria-label="Ubicación actual">
      <button
        type="button"
        onClick={() => onNavigate("inicio")}
        title="Ir al inicio de mi espacio"
      >
        Mi espacio
      </button>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        aria-current="page"
        onClick={() => onNavigate(page)}
        title={`Abrir la vista principal de ${label}`}
      >
        {label}
      </button>
    </nav>
  );
}
