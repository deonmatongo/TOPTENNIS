import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail } from "lucide-react";

const NAVY = "#0B1526";
const UPDATED = "21 July 2026";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      'This Privacy Policy explains how Top Tennis ("we", "us", "our") collects, uses and protects your personal information when you use the Top Tennis apps and services (the "Service"). It applies to players in the United States.',
    ],
  },
  {
    title: "Information we collect",
    body: [
      "Account & profile: your name, email address, phone number, city/location, skill level, rating and profile photo.",
      "Tennis activity: matches, scores, league and division participation, availability, court bookings and achievements.",
      "Messages & support: messages you send to other players and to our support team, including via WhatsApp.",
      "Device & usage: app version, device type, basic diagnostics and crash reports, and notification tokens.",
      "We only collect what we need to run the Service.",
    ],
  },
  {
    title: "How we use your information",
    body: [
      "To provide the Service (accounts, matches, leagues, standings, bookings, messaging); to match you with suitable opponents and leagues; to send notifications you have enabled; to provide customer support; to keep the Service secure and prevent abuse; and to improve features using aggregated, non-identifying insights.",
    ],
  },
  {
    title: "Legal bases for processing",
    body: [
      "We process your information to perform our contract with you (to provide the Service); based on your consent for optional features such as notifications and marketing; to further our legitimate business interests (such as securing and improving the Service); and to comply with applicable US legal obligations.",
      "California residents have additional rights under the California Consumer Privacy Act (CCPA/CPRA), including the right to know, delete, correct, and opt out of the sale or sharing of personal information. We do not sell your personal information.",
      "You can withdraw consent at any time, for example by turning off notification categories in Settings.",
    ],
  },
  {
    title: "How we share information",
    body: [
      "With other players, according to your privacy settings (public, friends-only or private).",
      "With service providers who process data on our behalf under contract, including Supabase (database, auth, storage), Twilio (WhatsApp support), Anthropic (support assistant), Sentry (diagnostics) and LiveKit (in-app calling, where used).",
      "We do not sell your personal information. We may disclose information if required by law or to protect the rights and safety of our users.",
    ],
  },
  {
    title: "Data storage and security",
    body: [
      "Your data is stored on secured cloud infrastructure with access controls, encryption in transit, and regular backups. While no system is perfectly secure, we take reasonable technical and organisational measures to protect your information.",
    ],
  },
  {
    title: "Data retention",
    body: [
      "We keep your information for as long as your account is active or as needed to provide the Service. When you delete your account, we delete or anonymise your personal data within a reasonable period, except where we must retain records to meet legal, accounting or dispute-resolution obligations.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Depending on where you live, you may have the right to access, correct, delete, export, object to or restrict processing of your personal data, and to withdraw consent.",
      "You can exercise many of these directly in the app (edit your profile, adjust Privacy settings, or delete your account). For any request, contact support@toptennis.app and we will respond within the time required by law.",
    ],
  },
  {
    title: "Notifications and messaging",
    body: [
      "If you enable push or email notifications, we use your device token and contact details to send them. You control notification categories in Settings and can turn them off at any time.",
      "If you contact support over WhatsApp, your messages are processed by Twilio and may be reviewed by our support assistant and team to resolve your query.",
    ],
  },
  {
    title: "Children's privacy",
    body: [
      "The Service is not intended for children under 16 (or the age of digital consent in your country). We do not knowingly collect data from children below that age. If you believe a child has provided us data, contact us and we will remove it.",
    ],
  },
  {
    title: "International transfers",
    body: [
      "Your information may be processed in countries other than where you live, including where our service providers operate. Where required, we use appropriate safeguards (such as standard contractual clauses) to protect data transferred across borders.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      'We may update this Privacy Policy from time to time. If we make material changes, we will notify you in the app or by other reasonable means. The "Last updated" date above shows when it last changed.',
    ],
  },
  {
    title: "Contact us",
    body: [
      "For any privacy question or request, email support@toptennis.app. If you are a California resident and are not satisfied with our response, you may contact the California Privacy Protection Agency (CPPA) at cppa.ca.gov.",
    ],
  },
];

const Privacy = () => (
  <div className="min-h-screen bg-white">
    <Header />

    {/* Hero */}
    <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: NAVY }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
        <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
          Legal
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">Privacy Policy</h1>
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
          <p className="text-sm font-bold text-white mb-0.5">Privacy Questions?</p>
          <p className="text-sm text-white/50">
            Email us at{" "}
            <a href="mailto:support@toptennis.app" className="text-orange-400 hover:text-orange-300 transition-colors">
              support@toptennis.app
            </a>{" "}
            and we'll respond within the time required by law.
          </p>
        </div>
      </div>
    </div>

    <Footer />
  </div>
);

export default Privacy;
