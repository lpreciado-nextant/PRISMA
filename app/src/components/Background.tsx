/**
 * Everything glass sits on this. Three slow-drifting colour fields plus a
 * hairline grid give the blur something to actually refract — without them
 * backdrop-filter has nothing to work with and the surfaces read as flat grey.
 */
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Displacement map consumed by the .refract backdrop-filter chain. */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter
          id="glass-refraction"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.007" numOctaves="1" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="3" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="24" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 60%), var(--ground)",
        }}
      />

      {/* Static by design: animating these layers forces every backdrop-filter
          panel above to re-blur the whole screen on every frame. */}
      <div
        className="absolute -top-40 -left-32 h-[46rem] w-[46rem] rounded-full blur-[110px]"
        style={{ background: "color-mix(in srgb, var(--sa-ai) 60%, transparent)", opacity: "var(--aurora)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[40rem] w-[40rem] rounded-full blur-[120px]"
        style={{
          background: "color-mix(in srgb, var(--sa-ibo) 58%, transparent)",
          opacity: "var(--aurora)",
        }}
      />
      <div
        className="absolute -bottom-52 left-1/4 h-[44rem] w-[44rem] rounded-full blur-[130px]"
        style={{
          background: "color-mix(in srgb, var(--sa-data) 55%, transparent)",
          opacity: "var(--aurora)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in srgb, var(--ink) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--ink) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(100% 70% at 50% 0%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(100% 70% at 50% 0%, #000 0%, transparent 75%)",
        }}
      />
    </div>
  );
}
