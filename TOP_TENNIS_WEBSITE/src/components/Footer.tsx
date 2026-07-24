import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t" style={{ backgroundColor: "#0B1526", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-12 mb-10">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/app-icon.png"
                alt="Top Tennis"
                className="h-9 w-9 rounded-xl object-cover"
              />
              <span className="font-bold text-sm leading-none">
                <span className="text-background">Top</span>
                <span className="text-orange-400"> Tennis</span>
                <span className="block text-[10px] font-medium text-background/40 tracking-widest uppercase mt-0.5">League</span>
              </span>
            </div>
            <p className="text-sm text-background/50 leading-relaxed max-w-[200px]">
              Structured, competitive tennis leagues for all skill levels.
            </p>

            {/* App store badges */}
            <div className="flex flex-col gap-2 mt-5">
              {/* Apple App Store */}
              <a
                href="#"
                aria-label="Download on the App Store"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.11)")}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              >
                {/* Apple logo */}
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-white fill-current">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="leading-none">
                  <p className="text-[9px] font-medium text-white/40 uppercase tracking-wider">Download on the</p>
                  <p className="text-xs font-bold text-white mt-0.5">App Store</p>
                </div>
              </a>

              {/* Google Play */}
              <a
                href="#"
                aria-label="Get it on Google Play"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.11)")}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              >
                {/* Play Store triangle logo */}
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-current text-white">
                  <path d="M3.18 23.76c.3.17.64.22.99.14l.1-.06 10.84-6.26-2.34-2.34-9.59 8.52zm-1.12-20.3C2 3.7 2 3.96 2 4.22v15.56c0 .28.06.54.17.77l.09.1 8.72-8.72v-.2L2.06 3.46zm18.54 8.03-2.32-1.34-2.6 2.6 2.6 2.6 2.34-1.35c.67-.39.67-1.12-.02-1.51zM4.17.43l-.1.07 10.84 10.84 2.34-2.34L4.92.27c-.29-.17-.56-.2-.75.16z"/>
                </svg>
                <div className="leading-none">
                  <p className="text-[9px] font-medium text-white/40 uppercase tracking-wider">Get it on</p>
                  <p className="text-xs font-bold text-white mt-0.5">Google Play</p>
                </div>
              </a>
            </div>

            {/* Social */}
            <div className="flex gap-2 mt-4">
              {[
                { Icon: Facebook, label: "Facebook" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Twitter, label: "Twitter" },
                { Icon: Youtube, label: "YouTube" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="h-8 w-8 rounded-lg bg-background/5 hover:bg-orange-500 flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4 text-background/60 group-hover:text-white" />
                </a>
              ))}
            </div>
          </div>

          {/* Play */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-background/40 mb-4">Play</h4>
            <ul className="space-y-2.5">
              <li><Link to="/leagues" className="text-sm text-background/60 hover:text-orange-400 transition-colors">All Leagues</Link></li>
              <li><Link to="/leagues#singles" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Singles</Link></li>
              <li><Link to="/leagues#doubles" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Doubles</Link></li>
              <li><Link to="/rules" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Rules</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-background/40 mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><a href="#locations" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Find Courts</a></li>
              <li><a href="#faq" className="text-sm text-background/60 hover:text-orange-400 transition-colors">FAQ</a></li>
              <li><a href="#newsletter" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Newsletter</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-background/40 mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li><Link to="/contact" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Contact Us</Link></li>
              <li><Link to="/privacy" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-background/60 hover:text-orange-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-background/30">
            © {new Date().getFullYear()} Top Tennis League. All rights reserved.
          </p>
          <div className="flex gap-5">
            <Link to="/privacy" className="text-xs text-background/30 hover:text-orange-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="text-xs text-background/30 hover:text-orange-400 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
