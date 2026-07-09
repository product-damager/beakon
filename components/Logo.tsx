/**
 * Beakon puffin mark — a crisp vector of the pixel-art illustration
 * (public/beakon-puffin.svg). The art has fixed colours, so it does not
 * recolour with the surrounding text like a monochrome mark would.
 *
 * On light backgrounds render it bare (`<Logo />`). On dark backgrounds
 * (e.g. the green sidebar) the dark-green body merges into the background,
 * so pass `tile` to sit it on a cream app-icon tile.
 */
export function Logo({
  size = 28,
  tile = false,
  className,
}: {
  size?: number;
  tile?: boolean;
  className?: string;
}) {
  const width = size;
  const height = Math.round((size * 19) / 26); // art is 26×19

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/beakon-puffin.svg"
      alt="Beakon"
      width={width}
      height={height}
      className="block"
    />
  );

  if (!tile) {
    return className ? <span className={className}>{img}</span> : img;
  }

  const box = Math.round(size * 1.22);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`}
      style={{ width: box, height: box, background: "#f1f4e2", borderRadius: Math.round(box * 0.26) }}
    >
      {img}
    </span>
  );
}
