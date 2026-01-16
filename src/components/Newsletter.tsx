
import { useState } from "react";
import { Link } from "react-router-dom";

const Newsletter = () => {
  const [email, setEmail] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Newsletter signup:", email);
    setEmail("");
    // Add your newsletter signup logic here
  };
  return <>
      {/* Newsletter Section */}
      <section id="newsletter" className="py-12 sm:py-16 lg:py-20 bg-white">
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

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full lg:w-auto">
              <input type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="px-4 sm:px-6 py-3 sm:py-4 border border-gray-300 rounded-full text-sm sm:text-lg w-full sm:min-w-80 focus:outline-none focus:border-orange-600" />
              <button onClick={handleSubmit} className="bg-orange-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-lg font-bold hover:bg-orange-700 transition-colors rounded-full whitespace-nowrap">
                SUBSCRIBE
              </button>
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <input type="email" placeholder="Enter your email" className="px-4 sm:px-6 py-2 sm:py-3 bg-transparent border border-white rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-orange-600 w-full sm:w-80" />
              <Link to="/register" className="bg-orange-600 text-white px-6 sm:px-8 py-2 sm:py-3 font-bold hover:bg-orange-700 transition-colors rounded-full whitespace-nowrap text-center">REGISTER</Link>
            </div>
          </div>
        </div>
      </section>
    </>;
};
export default Newsletter;
