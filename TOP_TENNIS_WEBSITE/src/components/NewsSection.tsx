import { Link } from "react-router-dom";
import { UserPlus, Trophy, Calendar, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create Your Profile",
    description:
      "Sign up in minutes and set your skill level, availability, and preferred locations. Your profile is your passport to the league.",
  },
  {
    icon: Trophy,
    step: "02",
    title: "Join a League",
    description:
      "Choose from Men's Singles, Women's Singles, or Doubles. New sessions open every season — sign up before spots fill.",
  },
  {
    icon: Calendar,
    step: "03",
    title: "Schedule & Play",
    description:
      "Arrange matches directly with opponents using the built-in scheduler. Both players confirm, and you get a calendar invite.",
  },
  {
    icon: BarChart3,
    step: "04",
    title: "Climb the Ladder",
    description:
      "Every result updates your ranking in real time. Track your progress, earn badges, and chase the top spot on the leaderboard.",
  },
];

const stats = [
  { value: "500+", label: "Active Players" },
  { value: "12", label: "Courts Available" },
  { value: "4", label: "League Divisions" },
  { value: "95%", label: "Match Satisfaction" },
];

const NewsSection = () => {
  return (
    <section className="py-16 sm:py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-14 lg:mb-20">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
            style={{ color: "#f97316", backgroundColor: "rgba(249,115,22,0.10)" }}
          >
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight">
            From Sign-Up to<br className="hidden sm:block" /> Match Point
          </h2>
          <p className="mt-4 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-gray-500">
            Getting on the court is simple. Four steps and you're competing in a structured, fun league that fits your schedule.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mb-14 lg:mb-20">
          {steps.map((s, i) => (
            <div
              key={i}
              className="group relative rounded-2xl p-6 bg-gray-50 border border-gray-100 transition-all duration-300 hover:border-orange-200 hover:bg-white hover:shadow-md hover:shadow-orange-500/5"
            >
              <span className="absolute top-5 right-5 text-5xl font-black leading-none select-none text-gray-900/[0.05]">
                {s.step}
              </span>

              <div
                className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl"
                style={{ backgroundColor: "rgba(249,115,22,0.12)" }}
              >
                <s.icon className="h-6 w-6 text-orange-500" />
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 p-8 sm:p-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-white text-center">
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-3xl sm:text-4xl font-black mb-1">{s.value}</div>
                <div className="text-sm sm:text-base font-medium text-orange-100">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition-all"
          >
            Join the League
          </Link>
          <Link
            to="/leagues"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            View All Leagues
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
