

import { Button } from "@/components/ui/button";
const TennisLadder = () => {
  return <section className="py-8 sm:py-12 lg:py-16 xl:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-4 sm:mb-6 text-black">
            EVERY GAME MATTERS
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Explore the Tennis Ladder system where every match counts towards your ranking and reputation in the community.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
          {/* Left Card - Respect All, Fear None */}
          <div className="relative group cursor-pointer">
            <div className="w-full h-64 sm:h-80 lg:h-96 bg-cover bg-center rounded-lg sm:rounded-xl lg:rounded-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300" style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1554068865-24cecd4e34b8?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')`
          }}>
              <div className="absolute inset-0 bg-gradient-to-br from-orange-900/80 via-black/60 to-orange-800/80"></div>
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white">
                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black mb-4 sm:mb-6 leading-tight">
                    Respect All,<br />
                    Fear None
                  </h3>
                </div>
                <div>
                  <Button className="bg-white text-black hover:bg-gray-100 font-bold px-6 py-3 rounded-lg">
                    Rules
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card - Game, Set, Match */}
          <div className="relative group cursor-pointer">
            <div className="w-full h-64 sm:h-80 lg:h-96 bg-cover bg-center rounded-lg sm:rounded-xl lg:rounded-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300" style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1606107557309-bde2cf5ec836?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2064&q=80')`
          }}>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-black/60 to-blue-800/80"></div>
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white">
                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black mb-4 sm:mb-6 leading-tight">
                    Game, Set,<br />
                    Match!
                  </h3>
                </div>
                <div>
                  <Button className="bg-white text-black hover:bg-gray-100 font-bold px-6 py-3 rounded-lg">
                    Scoring
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tennis Ladder Rating Card - Full Width */}
        <div className="mt-8 sm:mt-12 lg:mt-16">
          <div className="relative group cursor-pointer">
            <div className="w-full h-64 sm:h-80 lg:h-96 bg-cover bg-center rounded-lg sm:rounded-xl lg:rounded-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-300" style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')`
          }}>
              <div className="absolute inset-0 bg-gradient-to-br from-green-900/80 via-black/60 to-green-800/80"></div>
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white">
                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black mb-4 sm:mb-6 leading-tight">
                    Tennis Ladder<br />
                    Rating
                  </h3>
                </div>
                <div>
                  <Button className="bg-white text-black hover:bg-gray-100 font-bold px-6 py-3 rounded-lg">
                    View Rankings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default TennisLadder;

