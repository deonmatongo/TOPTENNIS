import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail } from "lucide-react";

const NAVY = "#0B1526";
const UPDATED = "21 July 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Acceptance of these Terms",
    body: [
      'These Terms of Service ("Terms") govern your use of the Top Tennis mobile and web applications and related services (together, the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, please do not use the Service.',
      'These Terms form a binding agreement between you and Top Tennis ("we", "us", "our").',
    ],
  },
  {
    title: "Eligibility and your account",
    body: [
      "You must be at least 16 years old, or the age of digital consent in your country, to use the Service. If you are under 18, you confirm that a parent or guardian has reviewed and agreed to these Terms on your behalf.",
      "You are responsible for keeping your login credentials secure and for all activity under your account. Tell us immediately if you believe your account has been compromised.",
      "You agree to provide accurate profile information and to keep it up to date.",
    ],
  },
  {
    title: "Using the Service",
    body: [
      "Top Tennis helps players organise tennis: scheduling matches, joining leagues and divisions, tracking standings and results, booking courts, and messaging other players.",
      "We grant you a personal, non-exclusive, non-transferable, revocable licence to use the Service for your own non-commercial tennis activity. You may not resell, sublicense or commercially exploit any part of the Service without our written permission.",
    ],
  },
  {
    title: "Fair play and player conduct",
    body: [
      "Top Tennis is a community. When using the Service you agree to report match scores honestly and promptly; show up to matches you have accepted, and give reasonable notice if you cannot attend; treat opponents, teammates and staff with respect; and follow the rules of each league or venue you take part in.",
      "Repeated no-shows, dishonest scoring, harassment or abusive behaviour may result in warnings, removal from leagues, or suspension of your account.",
    ],
  },
  {
    title: "Payments, subscriptions and refunds",
    body: [
      "Some features — such as certain leagues, tournaments or premium tools — may require payment or a subscription. Prices and what is included are shown before you pay.",
      "Subscriptions renew automatically for the same period unless cancelled before the renewal date. You can manage or cancel a subscription through your app store account or in the Service where applicable.",
      "Except where required by law, league entry fees are generally non-refundable once a league has started. If you believe you were charged in error, contact support@toptennis.app and we will review it.",
    ],
  },
  {
    title: "Matches, cancellations and disputes",
    body: [
      "Match times, courts and results are coordinated between players through the Service. We provide the tools but are not responsible for the conduct of other players or for matches that do not take place.",
      "Score disputes and no-show claims are reviewed by our team on a case-by-case basis. Our decision on how a result is recorded for league purposes is final.",
    ],
  },
  {
    title: "Your content",
    body: [
      'You keep ownership of the content you submit — messages, profile details, photos and match information ("User Content"). You grant us a licence to host, store, display and use that content solely to operate and improve the Service.',
      "You are responsible for your User Content and confirm you have the right to share it. Do not post content that is unlawful, misleading, infringing, or that reveals another person's private information without consent.",
    ],
  },
  {
    title: "Prohibited conduct",
    body: [
      "You agree not to break any law or the rights of others while using the Service; harass, threaten, impersonate or abuse other users; attempt to access accounts, data or systems you are not authorised to; interfere with, disrupt or reverse-engineer the Service; or use bots or scrapers to collect data without permission.",
    ],
  },
  {
    title: "Intellectual property",
    body: [
      "The Service, including its software, design, logos and content we create, is owned by Top Tennis and protected by intellectual-property laws. Nothing in these Terms transfers those rights to you except the limited licence to use the Service described above.",
    ],
  },
  {
    title: "Disclaimers and limitation of liability",
    body: [
      'The Service is provided "as is" and "as available". We do not guarantee it will be uninterrupted, error-free, or that it will meet every expectation.',
      "Tennis is a physical activity. You take part in matches and use booked venues at your own risk, and you are responsible for ensuring you are fit to play.",
      "To the fullest extent permitted by law, Top Tennis is not liable for indirect or consequential losses, for injuries sustained while playing, or for the acts of other users or venues. Nothing in these Terms limits liability that cannot be limited by law.",
    ],
  },
  {
    title: "Suspension and termination",
    body: [
      "You may stop using the Service and delete your account at any time from Settings.",
      "We may suspend or terminate your access if you breach these Terms, if required by law, or to protect the Service and its users. Where reasonable, we will give you notice.",
    ],
  },
  {
    title: "Changes to these Terms",
    body: [
      "We may update these Terms from time to time. If we make material changes we will notify you in the app or by other reasonable means. Continuing to use the Service after changes take effect means you accept the updated Terms.",
    ],
  },
  {
    title: "Governing law",
    body: [
      "Top Tennis operates for players in the United States. These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Any dispute that cannot be resolved informally will be handled by the competent courts of the State of Delaware, without affecting mandatory consumer rights available to you under applicable law.",
    ],
  },
  {
    title: "Contact us",
    body: ["Questions about these Terms? Email support@toptennis.app and we will be happy to help."],
  },
];

const Terms = () => (
  <div className="min-h-screen bg-white">
    <Header />

    {/* Hero */}
    <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: NAVY }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
          Legal
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">Terms of Service</h1>
        <p className="text-sm text-white/40">Last updated {UPDATED}</p>
      </div>
    </div>

    {/* Content */}
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <div className="space-y-0 divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
        {SECTIONS.map((sec, i) => (
          <div key={sec.title} className="px-6 sm:px-8 py-6">
            <div className="flex items-start gap-4">
              <span className="shrink-0 mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: "#f97316" }}>
                {i + 1}
              </span>
              <div className="space-y-3">
                <h2 className="text-sm font-black text-gray-900">{sec.title}</h2>
                {sec.body.map((p, j) => (
                  <p key={j} className="text-sm text-gray-500 leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact callout */}
      <div className="mt-10 flex items-start gap-4 p-6 rounded-2xl" style={{ backgroundColor: NAVY }}>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
          <Mail className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white mb-0.5">Questions about these Terms?</p>
          <p className="text-sm text-white/50">
            Email us at{" "}
            <a href="mailto:support@toptennis.app" className="text-orange-400 hover:text-orange-300 transition-colors">
              support@toptennis.app
            </a>{" "}
            and we'll be happy to help.
          </p>
        </div>
      </div>
    </div>

    <Footer />
  </div>
);

export default Terms;
