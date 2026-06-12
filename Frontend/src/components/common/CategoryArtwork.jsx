import React, { useEffect, useState } from "react";

export default function CategoryArtwork({ src, alt }) {
  const [isAvailable, setIsAvailable] = useState(Boolean(src));

  useEffect(() => {
    setIsAvailable(Boolean(src));
  }, [src]);

  return (
    <div className={`category-art ${isAvailable ? "has-image" : "is-missing"}`}>
      {isAvailable ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setIsAvailable(false)}
        />
      ) : (
        <span className="category-no-image">No image</span>
      )}
    </div>
  );
}
