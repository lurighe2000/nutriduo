import { useState } from "react";
import { Camera } from "lucide-react";

export function MealPhotoGallery({
  photos,
  onRemove,
  disabled = false,
  alt = "Foto de la comida",
}: {
  photos: string[];
  onRemove?: (index: number) => void;
  disabled?: boolean;
  alt?: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!photos.length) return null;
  return (
    <section className="meal-photo-gallery" aria-label="Fotos adjuntas">
      <p className="muted small">
        {photos.length}{" "}
        {photos.length === 1 ? "foto adjunta" : "fotos adjuntas"} · Tocá una
        foto para ampliarla
      </p>
      <div className="meal-photo-grid">
        {photos.map((photo, index) => (
          <div className="meal-photo-card" key={index}>
            <button
              type="button"
              className="meal-photo-open"
              aria-label={`Ampliar foto ${index + 1}`}
              aria-expanded={expanded === index}
              onClick={() => setExpanded(expanded === index ? null : index)}
            >
              <img
                src={photo}
                alt={index === 0 ? alt : `${alt} ${index + 1}`}
              />
              <span>Foto {index + 1}</span>
            </button>
            {onRemove && (
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                aria-label={`Quitar foto ${index + 1}`}
                onClick={() => {
                  setExpanded(null);
                  onRemove(index);
                }}
              >
                Quitar foto
              </button>
            )}
          </div>
        ))}
      </div>
      {expanded !== null && photos[expanded] && (
        <img
          className="meal-photo-expanded"
          src={photos[expanded]}
          alt={`Vista ampliada de la foto ${expanded + 1}`}
        />
      )}
    </section>
  );
}

export default function MealPhotos({
  photos,
  onAdd,
  onRemove,
  disabled = false,
  loading = false,
  analysis = false,
}: {
  photos: string[];
  onAdd: (files: File[]) => Promise<void>;
  onRemove: (index: number) => void;
  disabled?: boolean;
  loading?: boolean;
  analysis?: boolean;
}) {
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void onAdd(files);
  };
  return (
    <>
      <div className="photo-inputs">
        <label className="upload-button">
          <Camera size={17} />
          {photos.length ? "Sacar otra foto" : "Sacar foto"}
          <input
            disabled={disabled || loading}
            aria-label={
              analysis ? "Sacar foto para analizar" : "Sacar foto de comida"
            }
            type="file"
            accept="image/*"
            capture="environment"
            onChange={upload}
          />
        </label>
        <label className="upload-button">
          Agregar fotos / etiquetas
          <input
            disabled={disabled || loading}
            aria-label={
              analysis ? "Elegir foto para analizar" : "Elegir fotos de comida"
            }
            type="file"
            accept="image/*"
            multiple
            onChange={upload}
          />
        </label>
      </div>
      <p className="muted small" role="status">
        {loading
          ? "Preparando fotos…"
          : "Podés elegir varias fotos juntas o agregarlas de a una. Las nuevas se suman a las anteriores: plato, productos, etiquetas y preparación."}
      </p>
      <MealPhotoGallery
        photos={photos}
        onRemove={onRemove}
        disabled={disabled || loading}
        alt={analysis ? "Plato para analizar" : "Comida registrada"}
      />
    </>
  );
}
