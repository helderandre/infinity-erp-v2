"use client";

interface GoogleMapsEmbedProps {
  latitude: number;
  longitude: number;
  height?: string;
}

export function GoogleMapsEmbed({
  latitude,
  longitude,
  height = "400px",
}: GoogleMapsEmbedProps) {
  // Google Maps Embed API - using coordinates for precise pinpoint location
  // Google will automatically display the street address via reverse geocoding
  const embedUrl = `https://www.google.com/maps?q=${latitude},${longitude}&hl=pt-PT&z=15&output=embed`;

  return (
    <div className="w-full overflow-hidden rounded-lg shadow-sm">
      <iframe
        src={embedUrl}
        width="100%"
        height={height}
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Localização: ${latitude}, ${longitude}`}
      />
    </div>
  );
}