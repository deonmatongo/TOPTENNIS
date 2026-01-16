import { Play, Users } from "lucide-react";
import { Link } from "react-router-dom";
const Hero = () => {
  return <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{
      backgroundImage: `url('https://images.unsplash.com/photo-1554068865-24cecd4e34b8?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')`
    }}>
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left side - Community */}
          <div className="text-white order-2 lg:order-1">
            <div className="flex items-center mb-4 sm:mb-6 justify-start lg:justify-start">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-white rounded-full flex items-center justify-center mr-3 sm:mr-4">
                <Users className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-4 text-left lg:text-left">Join Our Community</h3>
            <p className="text-base sm:text-lg lg:text-xl opacity-90 text-left lg:text-left">Connect with fun and competitive players</p>
          </div>

          {/* Right side - Main content */}
          <div className="text-white text-left lg:text-left order-1 lg:order-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-black mb-4 sm:mb-6 leading-tight">
              Where Passion<br />
              Meets Play
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-light mb-6 sm:mb-8 max-w-2xl mx-0 lg:mx-0 leading-relaxed">
              Connect With Tennis Players At Your Level.<br className="hidden sm:block" />
              Play More. Compete More. Improve Together.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-start lg:justify-start">
              <Link to="/register" className="bg-white text-black px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold hover:bg-gray-100 transition-colors rounded-lg w-full sm:w-auto text-center">Become A Member</Link>
              <button className="bg-orange-600 text-white px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold hover:bg-orange-700 transition-colors rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                How It Works
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default Hero;