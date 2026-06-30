"use client";

interface MapboxStaticImageProps {
  latitude: number;
  longitude: number;
  width?: number;
  height?: number;
  zoom?: number;
}

export function MapboxStaticImage({
  latitude,
  longitude,
  width = 600,
  height = 400,
  zoom = 15,
}: MapboxStaticImageProps) {
  // Mapbox Static Images API URL with pin marker
  // https://docs.mapbox.com/api/maps/static-images/
  // Public token vem de env (NEXT_PUBLIC_ é inlined no client pelo Next).
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  
  // Add a pin marker overlay: pin-l+000000 (large black pin)
  const markerOverlay = `pin-l+000000(${longitude},${latitude})`;
  
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markerOverlay}/${longitude},${latitude},${zoom},0/${width}x${height}?access_token=${mapboxToken}`;

  return (
    <img
      src={mapUrl}
      alt={`Mapa da localização: ${latitude}, ${longitude}`}
      className="w-full max-w-full rounded-lg shadow-sm"
      loading="lazy"
    />
  );
}