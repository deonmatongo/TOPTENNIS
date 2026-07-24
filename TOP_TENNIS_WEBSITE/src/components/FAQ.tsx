import { useState } from "react";
import { ChevronDown, Mail } from "lucide-react";

const faqs = [
  {
    question: "How do I find players at my skill level?",
    answer:
      "Your profile includes a NTRP skill rating. When you join a league, you're placed in a division with players at a similar level so every match is competitive and fair.",
  },
  {
    question: "Is there a cost to join?",
    answer:
      "Basic registration is free. League season fees vary by division — check the Leagues page for current pricing. Fees cover court reservations, prizes, and platform costs.",
  },
  {
    question: "How do I schedule matches with opponents?",
    answer:
      "Once placed in a league, you'll see your opponent list on the dashboard. Send a match invite, agree on a time and court, and both players get a calendar notification.",
  },
  {
    question: "What happens if I need to cancel?",
    answer:
      "Cancel through the dashboard as early as possible. Repeated last-minute cancellations may affect your player standing. Opponents can flag no-shows, which impacts your rating.",
  },
  {
    question: "Can I play in tournaments and events?",
    answer:
      "Yes — we run seasonal tournaments and round-robins open to league members. League members get priority registration before spots open to the public.",
  },
  {
    question: "How is my ladder ranking calculated?",
    answer:
      "Rankings update in real time after each reported match. Wins against higher-ranked opponents earn more points. Consistent play and tournament results also boost your standing.",
  },
];

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 sm:py-20 lg:py-28" style={{ backgroundColor: "#0B1526" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">

          {/* Left */}
          <div className="lg:col-span-2">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full mb-4">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-6 text-white">
              Common Questions
            </h2>
            <p className="text-base text-background/60 leading-relaxed mb-6">
              Still have questions? Our team is happy to help.
            </p>
            <a
              href="mailto:support@toptennisleague.com"
              className="inline-flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              <Mail className="w-4 h-4" />
              support@toptennisleague.com
            </a>
          </div>

          {/* Right — accordion */}
          <div className="lg:col-span-3 divide-y divide-background/10">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-start justify-between gap-4 py-5 text-left text-white/90 hover:text-orange-400 transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold leading-snug">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 mt-0.5 text-background/40 transition-transform duration-200 ${open === i ? "rotate-180 text-orange-400" : ""}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-64 pb-5" : "max-h-0"}`}
                >
                  <p className="text-sm text-background/60 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
