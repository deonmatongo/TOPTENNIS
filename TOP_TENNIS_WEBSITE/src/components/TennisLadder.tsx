import { Link } from "react-router-dom";
import { Shield, Zap, TrendingUp, ArrowRight } from "lucide-react";

const cards = [
  {
    tag: "League Rules",
    title: "Respect All,\nFear None",
    description:
      "Every match is governed by a clear code of conduct. Fair play, punctuality, and sportsmanship are non-negotiable.",
    cta: "Read the Rules",
    href: "/rules",
    image:
      "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80",
    accent: "from-orange-900/85 via-orange-800/60 to-black/70",
    Icon: Shield,
  },
  {
    tag: "Scoring",
    title: "Game, Set,\nMatch!",
    description:
      "Standard tennis scoring applies throughout. Best-of-three sets with a match tiebreak in lieu of a third set.",
    cta: "Scoring Guide",
    href: "/rules",
    image:
      "https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?auto=format&fit=crop&w=900&q=80",
    accent: "from-blue-900/85 via-blue-800/60 to-black/70",
    Icon: Zap,
  },
];

const NewsSection = () => {
  return (
    <section className="py-16 sm:py-20 lg:py-28" style={{ backgroundColor: "#0B1526" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 lg:mb-14">
          <div>
            <span
              className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3"
              style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}
            >
              Compete
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              Every Game Matters
            </h2>
            <p className="mt-3 text-base max-w-xl leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your results update your ladder ranking in real time. Play more, climb higher.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(249,115,22,0.4)"; (e.currentTarget as HTMLElement).style.color = "#fb923c"; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
          >
            View Rankings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Two image cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {cards.map((card, i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden h-72 sm:h-80 lg:h-96">
              <img
                src={card.image}
                alt={card.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />

              <div className="absolute inset-0 p-7 sm:p-9 flex flex-col justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <card.Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                    {card.tag}
                  </span>
                </div>

                <div>
                  <h3 className="text-3xl sm:text-4xl font-black leading-tight mb-3 whitespace-pre-line">
                    {card.title}
                  </h3>
                  <p className="text-sm text-white/75 leading-relaxed mb-5 max-w-xs">
                    {card.description}
                  </p>
                  <Link
                    to={card.href}
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Full-width ranking banner */}
        <div className="group relative rounded-2xl overflow-hidden h-56 sm:h-64">
          <img
            src="https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=1800&q=80"
            alt="Tennis ladder ranking"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-900/90 via-green-800/70 to-black/60" />

          <div className="absolute inset-0 px-8 sm:px-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-8">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-green-300">Live Rankings</span>
              </div>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                Tennis Ladder<br />Rating
              </h3>
            </div>
            <Link
              to="/dashboard"
              className="shrink-0 inline-flex items-center gap-2 bg-white text-black font-bold px-7 py-3.5 rounded-xl hover:bg-orange-50 transition-colors text-sm"
            >
              View Rankings <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
