import { Link } from "react-router-dom";

const NAVY = "#0B1526";

/**
 * Split-panel chrome shared by the auth pages (login, register, forgot
 * password, reset password).
 *
 * Extracted from the old Login page so the auth flow does not duplicate ~90
 * lines of marketing panel across every step.
 */
const AuthLayout: React.FC<{
  /** Small pill above the headline on the left panel. */
  eyebrow: string;
  /** Left-panel headline. Two lines: the second renders in orange. */
  headline: [string, string];
  blurb: string;
  /** Right-panel form heading. */
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ eyebrow, headline, blurb, title, subtitle, children, footer }) => (
  <div className="min-h-screen flex">
    {/* ── Left panel ── */}
    <div
      className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col"
      style={{ backgroundColor: NAVY }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }}
      />
      <div
        className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }}
      />

      <div className="relative flex flex-col h-full px-12 py-12">
        <Link to="/" className="flex items-center gap-3 group w-fit">
          <img src="/app-icon.png" alt="Top Tennis" className="h-11 w-11 rounded-xl object-cover" />
          <span className="font-bold text-base leading-none">
            <span className="text-white">Top</span>
            <span className="text-orange-400"> Tennis</span>
            <span className="block text-[10px] font-medium text-white/40 tracking-widest uppercase mt-0.5">
              League
            </span>
          </span>
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-6 w-fit"
            style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}
          >
            {eyebrow}
          </span>
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
            {headline[0]}
            <br />
            <span className="text-orange-400">{headline[1]}</span>
          </h2>
          <p className="text-base text-white/50 leading-relaxed mb-10">{blurb}</p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "500+", label: "Active Players" },
              { value: "50+", label: "Active Leagues" },
              { value: "1 000+", label: "Matches Played" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="text-xl font-black text-orange-400 mb-1">{value}</div>
                <div className="text-xs text-white/40 font-medium">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/20">© {new Date().getFullYear()} Top Tennis League</p>
      </div>
    </div>

    {/* ── Right panel — form ── */}
    <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8 py-12 overflow-y-auto">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <img src="/app-icon.png" alt="Top Tennis" className="h-10 w-10 rounded-xl object-cover" />
          <span className="font-bold text-sm leading-none">
            <span className="text-gray-900">Top</span>
            <span className="text-orange-500"> Tennis</span>
            <span className="block text-[10px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">
              League
            </span>
          </span>
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mb-8">{subtitle}</p>}

        {children}

        {footer}
      </div>
    </div>
  </div>
);

export default AuthLayout;

/** Shared input styling, so every auth field matches without repeating the string. */
export const fieldClass = (hasError?: boolean) =>
  `h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${
    hasError ? "border-red-400" : ""
  }`;

export const submitClass =
  "w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2";

export const Spinner = () => (
  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
);
