import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageMeta from "@/components/PageMeta";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const NAVY = "#0B1526";

const rules = [
  {
    title: "About Top Tennis League",
    body: "Top Tennis League is one of the largest community tennis programs in the country, with thousands of players competing across cities. The league has opportunities for everyone — Men's, Women's, and Mixed Doubles, Singles, Juniors, and a High School league for grades 9–12.",
  },
  {
    title: "Levels of Play",
    body: "Players register at a level that ensures fair and competitive matches. Placement is determined by past league results, USTA/Level ratings, or Ultimate Tennis levels. New players should register at their official rating or seek coach advice. Doubles levels are based on a combination of both partners' ratings.",
  },
  {
    title: "Junior Divisions",
    bullets: [
      { label: "A", text: "Advanced players with significant tournament experience" },
      { label: "B", text: "Intermediate players with league experience" },
      { label: "C", text: "Beginners building skills and match experience" },
    ],
    body: "Junior players are grouped by age (10U, 12U, 14U) and by level. Players with high win percentages typically move up in age or skill level. Junior divisions do not include playoffs.",
  },
  {
    title: "Scheduling Matches",
    body: "Both teams are responsible for contacting each other by Wednesday of the match week to agree on a time. Each side must offer three valid options within league hours. If no agreement is reached, the match defaults to the play-by date. Matches can be rescheduled once with proper notice — repeated cancellations or forfeits may result in penalties.",
  },
  {
    title: "Match Play Rules",
    body: "Matches follow USTA rules, with Top Tennis League guidelines taking priority. Home teams provide courts and a new can of USTA-approved balls. Adults and high school players play best two of three sets, with an optional tiebreaker replacing the third set. Juniors always use a 7-point tiebreaker in the third set. Scores must be reported before the deadline.",
  },
  {
    title: "Playoffs & Division Winners",
    body: "Teams must opt in to qualify for playoffs. Division winners qualify automatically if they meet eligibility requirements (sufficient points, limited forfeits). Playoff scheduling is stricter and late passes are not permitted. Division winners are recognised with prizes such as bag tags and apparel.",
  },
  {
    title: "Weather & Special Rules",
    body: "In cases of rain, extreme heat, or freezing conditions, matches may be rescheduled. Lightning requires a 30-minute suspension before play can resume. The home team is responsible for safe courts, proper lighting, and restroom access. If a match is interrupted after it begins, play resumes from the exact score when it stopped.",
  },
  {
    title: "Waiver & Player Responsibility",
    body: "By registering, all participants accept the risks of competitive tennis and release Top Tennis League and its host facilities from liability for injuries or damages. Players are expected to honour their commitments, respect opponents, and maintain good sportsmanship both on and off the court.",
  },
];

const Rules = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white">
      <PageMeta
        title="Tennis League Rules & Format | Top Tennis League"
        description="Official match rules, scoring format, player levels, and code of conduct for Top Tennis League. Everything you need to compete with confidence."
      />
      <Header />

      {/* Hero */}
      <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
            Official Rulebook
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">League Rules</h1>
          <p className="text-base text-white/50 max-w-xl mx-auto">
            Everything you need to know about Top Tennis League rules, regulations, and player expectations.
          </p>
        </div>
      </div>

      {/* Accordion */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
          {rules.map((rule, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-orange-50/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: "#f97316" }}>
                    {i + 1}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-gray-900">{rule.title}</span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open === i ? "rotate-180 text-orange-400" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-[600px]" : "max-h-0"}`}>
                <div className="px-6 pb-6 pt-0 ml-11 space-y-3">
                  {rule.bullets && (
                    <ul className="space-y-2 mb-3">
                      {rule.bullets.map(b => (
                        <li key={b.label} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="shrink-0 font-black text-orange-500 w-4">{b.label}:</span>
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm text-gray-600 leading-relaxed">{rule.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl p-8 text-center" style={{ backgroundColor: NAVY }}>
          <h3 className="text-lg font-black text-white mb-2">Still have questions?</h3>
          <p className="text-sm text-white/50 mb-5">Our team is happy to clarify any rule or help you get started.</p>
          <a
            href="mailto:support@toptennisleague.com"
            className="inline-block px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold transition-colors"
          >
            Email Support
          </a>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Rules;
