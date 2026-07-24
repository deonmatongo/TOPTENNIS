import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Mail, Zap, Trophy, Users } from "lucide-react";

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

async function subscribeEmail(email: string, source: string): Promise<Status> {
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: email.trim().toLowerCase(), source });
  if (!error) return 'success';
  if (error.code === '23505') return 'duplicate';
  console.error('[newsletter] subscribe error:', error.message);
  return 'error';
}

function SubscribeForm({ source }: { source: 'homepage' | 'cta' }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const dark = source === 'cta';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === 'loading') return;
    setStatus('loading');
    const result = await subscribeEmail(email, source);
    setStatus(result);
    if (result === 'success') setEmail('');
  };

  if (status === 'success') {
    return (
      <div className={`flex items-center gap-3 py-3.5 px-5 rounded-xl text-sm font-semibold border ${dark ? 'bg-green-500/15 border-green-500/25 text-green-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        You're in! We'll keep you posted.
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="Enter your email address"
          value={email}
          onChange={e => { setEmail(e.target.value); if (status !== 'idle') setStatus('idle'); }}
          disabled={status === 'loading'}
          className={`flex-1 min-w-0 px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-500/40 focus:border-orange-400 disabled:opacity-50 transition-colors ${
            dark
              ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/30'
              : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 shadow-sm'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email.trim()}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Subscribe</>}
        </button>
      </form>
      {status === 'duplicate' && (
        <p className={`flex items-center gap-1.5 text-xs mt-2 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Already subscribed.
        </p>
      )}
      {status === 'error' && (
        <p className={`flex items-center gap-1.5 text-xs mt-2 ${dark ? 'text-red-400' : 'text-red-600'}`}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Something went wrong — try again.
        </p>
      )}
    </div>
  );
}

const perks = [
  { Icon: Zap, text: "New leagues announced first" },
  { Icon: Trophy, text: "Tournament invites & early access" },
  { Icon: Users, text: "New players added in your area" },
];

const Newsletter = () => {
  return (
    <>
      {/* ── Newsletter strip (light, above CTA) ── */}
      <section id="newsletter" className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16">
            <div className="max-w-lg text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-orange-500 bg-orange-50 px-3 py-1 rounded-full mb-4">
                <Mail className="w-3.5 h-3.5" /> Newsletter
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
                Stay in the Loop
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Match opportunities, new players in your area, court updates, and league news — straight to your inbox.
              </p>
            </div>
            <div className="w-full max-w-sm lg:max-w-md">
              <SubscribeForm source="homepage" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA section — deep navy ── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: '#0B1526' }}>
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Orange glow blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left col */}
            <div>
              <span
                className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
                style={{ color: '#fb923c', backgroundColor: 'rgba(249,115,22,0.12)' }}
              >
                Ready to Play?
              </span>

              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] text-white mb-6">
                Start Playing<br />
                <span style={{ color: '#f97316' }}>This Season.</span>
              </h2>

              <p className="text-base sm:text-lg leading-relaxed mb-10" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Competitive leagues for every level. Sign up, get matched, and start climbing the ladder — all season long.
              </p>

              {/* Perk list */}
              <ul className="space-y-3 mb-10">
                {perks.map(({ Icon, text }, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div
                      className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(249,115,22,0.15)' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: '#fb923c' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 font-bold px-8 py-4 rounded-xl text-sm text-white transition-all"
                  style={{ backgroundColor: '#f97316' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#ea6c07')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = '#f97316')}
                >
                  Register Now <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/leagues"
                  className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-xl text-sm transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(249,115,22,0.5)'; (e.currentTarget as HTMLElement).style.color = '#fb923c'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; }}
                >
                  Browse Leagues
                </Link>
              </div>
            </div>

            {/* Right col — email sign-up card */}
            <div
              className="rounded-2xl p-8 sm:p-10"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-xl font-bold text-white mb-1">Get notified first</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                New leagues, court openings, and season kick-offs — straight to your inbox.
              </p>
              <SubscribeForm source="cta" />

              {/* Divider */}
              <div className="flex items-center gap-3 my-7">
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>or</span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
              </div>

              <Link
                to="/register"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ backgroundColor: '#f97316' }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#ea6c07')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = '#f97316')}
              >
                Create Your Account <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Free to join. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Newsletter;
