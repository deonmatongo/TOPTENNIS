import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Status = 'idle' | 'loading' | 'success' | 'duplicate' | 'error';

async function subscribeEmail(email: string, source: string): Promise<Status> {
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email: email.trim().toLowerCase(), source });

  if (!error) return 'success';

  // Postgres unique-violation code
  if (error.code === '23505') return 'duplicate';

  console.error('[newsletter] subscribe error:', error.message);
  return 'error';
}

// ─── Reusable subscribe form ──────────────────────────────────────────────────

interface SubscribeFormProps {
  source: 'homepage' | 'cta';
  inputClassName?: string;
  buttonClassName?: string;
}

function SubscribeForm({ source, inputClassName, buttonClassName }: SubscribeFormProps) {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<Status>('idle');

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
      <div className="flex items-center gap-3 py-4 px-5 bg-green-50 border border-green-200 rounded-full text-green-700 text-sm font-semibold">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        You're in! We'll keep you posted.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full lg:w-auto">
      <input
        type="email"
        required
        placeholder="Enter your email"
        value={email}
        onChange={e => {
          setEmail(e.target.value);
          if (status !== 'idle') setStatus('idle');
        }}
        disabled={status === 'loading'}
        className={inputClassName}
      />

      <button
        type="submit"
        disabled={status === 'loading' || !email.trim()}
        className={buttonClassName}
      >
        {status === 'loading'
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : 'SUBSCRIBE'
        }
      </button>

      {status === 'duplicate' && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1 sm:absolute sm:bottom-[-1.5rem]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          That email is already subscribed.
        </p>
      )}
      {status === 'error' && (
        <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1 sm:absolute sm:bottom-[-1.5rem]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Something went wrong — please try again.
        </p>
      )}
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const Newsletter = () => {
  return (
    <>
      {/* Newsletter Section */}
      <section id="newsletter" className="py-12 sm:py-16 lg:py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-black mb-4">
                STAY CONNECTED
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Get notified about new players in your area,<br className="hidden sm:block" />
                upcoming tournaments, and match opportunities.
              </p>
            </div>

            <div className="relative w-full lg:w-auto">
              <SubscribeForm
                source="homepage"
                inputClassName="px-4 sm:px-6 py-3 sm:py-4 border border-gray-300 rounded-full text-sm sm:text-lg w-full sm:min-w-80 focus:outline-none focus:border-orange-600 disabled:opacity-50"
                buttonClassName="flex items-center justify-center bg-orange-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-lg font-bold hover:bg-orange-700 transition-colors rounded-full whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-left">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-6 sm:mb-8 leading-tight">
            READY TO START<br />
            PLAYING?
          </h2>

          <div className="flex flex-col gap-3 sm:gap-4 mb-12 sm:mb-16">
            <span className="text-base sm:text-lg mb-2">Join thousands of players</span>
            <div className="relative w-full sm:w-auto">
              <SubscribeForm
                source="cta"
                inputClassName="px-4 sm:px-6 py-2 sm:py-3 bg-transparent border border-white rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-orange-600 w-full sm:w-80 disabled:opacity-50"
                buttonClassName="flex items-center justify-center bg-orange-600 text-white px-6 sm:px-8 py-2 sm:py-3 font-bold hover:bg-orange-700 transition-colors rounded-full whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed mt-3 sm:mt-0"
              />
            </div>
            <Link
              to="/register"
              className="bg-orange-600 text-white px-6 sm:px-8 py-2 sm:py-3 font-bold hover:bg-orange-700 transition-colors rounded-full whitespace-nowrap text-center w-full sm:w-fit mt-2"
            >
              REGISTER
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default Newsletter;
