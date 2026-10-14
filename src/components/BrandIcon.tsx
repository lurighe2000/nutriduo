export default function BrandIcon() {
  return (
    <span className="brand-icon" aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}icon-192-duo.png`}
        alt=""
        width="44"
        height="44"
      />
    </span>
  );
}
