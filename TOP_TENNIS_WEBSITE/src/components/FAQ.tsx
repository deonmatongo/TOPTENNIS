
import { useState } from "react";

const FAQ = () => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I find players at my skill level?",
      answer: "Our platform uses skill ratings and player preferences to match you with compatible opponents. You can filter by skill level, playing style, availability, and location to find the perfect match."
    },
    {
      question: "Is there a cost to connect with other players?",
      answer: "Basic membership is free and includes player connections and match scheduling. Premium features like advanced filtering, tournament entry, and priority booking are available with paid memberships."
    },
    {
      question: "How do I schedule matches with other players?",
      answer: "Once you connect with a player, you can use our built-in scheduling system to propose match times, book courts, and confirm details. Both players receive notifications and calendar invites."
    },
    {
      question: "What if I need to cancel a scheduled match?",
      answer: "We understand that schedules change. You can cancel matches through the app, and we encourage giving as much notice as possible. Frequent cancellations may affect your player rating."
    },
    {
      question: "Can I play in tournaments and competitions?",
      answer: "Yes! We regularly organize tournaments for different skill levels, from casual round-robins to competitive brackets. Members get priority access to tournament registration."
    },
    {
      question: "How do I improve my player rating?",
      answer: "Your rating is based on match results, opponent ratings, and consistency of play. Regular matches against quality opponents and tournament participation help improve your rating over time."
    }
  ];

  return (
    <section className="py-8 sm:py-12 lg:py-16 xl:py-20 bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 xl:gap-16">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-4 sm:mb-6 lg:mb-8">FAQS</h2>
            <p className="text-sm sm:text-base lg:text-lg opacity-80 mb-3 sm:mb-4 lg:mb-6 leading-relaxed">
              Have questions about connecting with players or using our platform? 
              Check out these common questions or reach out to our support team at
            </p>
            <a href="mailto:support@toptennisleague.com" className="text-orange-600 hover:text-orange-500 transition-colors underline text-sm sm:text-base break-all">
              support@toptennisleague.com
            </a>
          </div>

          <div className="space-y-1 sm:space-y-2 lg:space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border-b border-gray-800">
                <button
                  className="w-full text-left py-3 sm:py-4 lg:py-6 flex justify-between items-start gap-3 sm:gap-4 hover:text-orange-600 transition-colors"
                  onClick={() => setOpenQuestion(openQuestion === index ? null : index)}
                >
                  <span className="font-medium text-sm sm:text-base leading-relaxed">{faq.question}</span>
                  <svg 
                    className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform flex-shrink-0 mt-0.5 ${openQuestion === index ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openQuestion === index && (
                  <div className="pb-3 sm:pb-4 lg:pb-6 opacity-80 animate-fade-in text-sm sm:text-base leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
