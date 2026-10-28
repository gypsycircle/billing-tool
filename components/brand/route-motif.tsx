// components/brand/route-motif.tsx
// Decorative fine-line drawing: topographic contours crossed by a dotted
// travel route with pins. Drawn in currentColor; purely decorative.

const CONTOUR =
  "M300 40C430 30 560 120 565 260C570 390 480 545 330 560C190 575 60 500 40 360C22 230 110 55 300 40Z";
const CONTOUR_SCALES = [1, 0.84, 0.69, 0.55, 0.42, 0.3, 0.19];

const ROUTE = "M-20 540C90 520 150 430 236 392S390 352 430 262S520 120 640 96";
const PINS: [number, number][] = [
  [236, 392],
  [430, 262],
];

export function RouteMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" fill="none" aria-hidden focusable="false" className={className}>
      <g stroke="currentColor" strokeWidth="1">
        {CONTOUR_SCALES.map((scale, i) => (
          <path
            key={scale}
            d={CONTOUR}
            vectorEffect="non-scaling-stroke"
            opacity={1 - i * 0.09}
            transform={`translate(300 300) rotate(${i * 7}) scale(${scale}) translate(-300 -300)`}
          />
        ))}
      </g>

      <path
        d={ROUTE}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="0.5 7"
      />

      {PINS.map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="11" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <circle r="3.5" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}
