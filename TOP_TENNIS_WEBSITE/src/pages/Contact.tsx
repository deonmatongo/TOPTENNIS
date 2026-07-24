import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Clock, MessageCircle, Users, ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const NAVY = "#0B1526";

const contactInfo = [
  {
    Icon: Mail,
    title: "Email",
    detail: "support@toptennisleague.com",
    sub: "We respond within 24 hours",
  },
  {
    Icon: Clock,
    title: "Hours",
    detail: "Mon–Fri 9AM–6PM ET",
    sub: "Sat–Sun 10AM–4PM ET",
  },
  {
    Icon: MessageCircle,
    title: "In-App Support",
    detail: "Help & Feedback",
    sub: "Available in app settings",
  },
  {
    Icon: Users,
    title: "Community",
    detail: "Player Forums",
    sub: "Connect with other players",
  },
];

const Contact = () => {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.message) { toast.error("Please fill in email and message."); return; }
    setSending(true);
    await new Promise(r => setTimeout(r, 900));
    setSending(false);
    toast.success("Message sent! We'll get back to you shortly.");
    setForm({ firstName: "", lastName: "", email: "", phone: "", subject: "", message: "" });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
            Get in Touch
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">Contact Us</h1>
          <p className="text-base text-white/50 max-w-xl mx-auto">
            Questions about leagues, courts, or your account? We're here to help.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">

          {/* Left — contact info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {contactInfo.map(({ Icon, title, detail, sub }) => (
                <div key={title} className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-0.5">{title}</p>
                    <p className="text-sm font-semibold text-gray-900">{detail}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ quick answers */}
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-black text-gray-900">Quick Answers</p>
              </div>
              {[
                {
                  q: "How do I register for a league?",
                  a: "Head to the Leagues page, pick a division that matches your skill level, and click Register. If you're not logged in you'll be prompted to create a free account first. Registration takes under two minutes.",
                },
                {
                  q: "What skill levels do you accept?",
                  a: "Everyone from beginners to advanced competitive players. Divisions are organised by NTRP rating — typically 2.5 through 5.0+ — so you'll always be matched with players at a similar level.",
                },
                {
                  q: "How are matches scheduled?",
                  a: "Once you're placed in a league you'll see your opponent list on the dashboard. Send a match invite, agree on a time and court with your opponent, and both players receive a calendar notification automatically.",
                },
                {
                  q: "What are the league fees?",
                  a: "Basic registration is free. Seasonal league entry fees vary by division and are shown on the Leagues page before you commit. Fees cover court reservations, prizes, and platform costs.",
                },
              ].map(({ q, a }, i) => (
                <div key={i} className="border-b border-gray-50 last:border-b-0">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-orange-50/40 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-800">{q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-300 transition-transform duration-200 ${openFaq === i ? "rotate-180 text-orange-400" : ""}`} />
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-40" : "max-h-0"}`}>
                    <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-gray-100 p-6 sm:p-8">
              <h2 className="text-lg font-black text-gray-900 mb-1">Send a Message</h2>
              <p className="text-sm text-gray-400 mb-7">Fill out the form and we'll respond within one business day.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-bold text-gray-500 uppercase tracking-widest">First Name</Label>
                    <Input id="firstName" placeholder="Jane" value={form.firstName} onChange={set("firstName")} className="rounded-xl border-gray-200 focus:border-orange-400" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Last Name</Label>
                    <Input id="lastName" placeholder="Smith" value={form.lastName} onChange={set("lastName")} className="rounded-xl border-gray-200 focus:border-orange-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email <span className="text-orange-500">*</span></Label>
                  <Input id="email" type="email" placeholder="jane@example.com" value={form.email} onChange={set("email")} required className="rounded-xl border-gray-200 focus:border-orange-400" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Phone <span className="text-gray-300">(optional)</span></Label>
                  <Input id="phone" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set("phone")} className="rounded-xl border-gray-200 focus:border-orange-400" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Subject</Label>
                  <Input id="subject" placeholder="What is this about?" value={form.subject} onChange={set("subject")} className="rounded-xl border-gray-200 focus:border-orange-400" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Message <span className="text-orange-500">*</span></Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us how we can help…"
                    value={form.message}
                    onChange={set("message")}
                    required
                    className="min-h-[130px] rounded-xl border-gray-200 focus:border-orange-400 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm transition-all"
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">Send Message <ArrowRight className="h-4 w-4" /></span>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Contact;
