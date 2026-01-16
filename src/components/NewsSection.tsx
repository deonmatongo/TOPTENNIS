
import { Clock, MapPin } from "lucide-react";

const NewsSection = () => {
  const mainNews = {
    category: "QUOTE OF THE DAY",
    title: "CARLOS TEES UP TOM HOLLAND GOLF DATE",
    subtitle: "The defending champ will face Fritz in the semis, and Spider-Man on the green.",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?ixlib=rb-4.0.3&ixid=M3wxMJA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80",
    actions: [
      { label: "READ", primary: true },
      { label: "FRITZ'S FIRST SF", primary: false }
    ]
  };

  const sideNews = [
    {
      category: "WIMBLEDON",
      title: "FRITZ FACES ALCARAZ CHALLENGE IN SEMIFINALS",
      image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    },
    {
      category: "STAT OF THE DAY", 
      title: "ANISIMOVA BECOMES FIRST WOMAN BORN IN 2000S TO REACH",
      image: "https://images.unsplash.com/photo-1594736797933-d0d4bb847a8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    },
    {
      category: "WIMBLEDON",
      title: "SINNER CANCELS PRACTICE A DAY AFTER HURTING ELBOW", 
      image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    }
  ];

  const tournament = {
    status: "LIVE",
    title: "Wimbledon",
    location: "London, England",
    day: "Day 17 of 21"
  };

  const headlines = [
    "Adrian Mannarino Plays Newport Challenger Just Four Days After Third-Round Loss At Wimbledon",
    "'Tee It Up!' Carlos Alcaraz Scores Semifinal Spot, And Tom Holland Golf Date, At Wimbledon", 
    "PHOTOS: Mirra Andreeva Cheers On Coach Conchita Martinez At Wimbledon",
    "Iga Swiatek Vs. Liudmila Samsonova: Wimbledon Betting Preview",
    "Solana Sierra Donates Kit And Racquet To Wimbledon Museum",
    "Taylor Fritz Goes Back Up The Hill With First Wimbledon Semifinal"
  ];

  return (
    <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main News - Left Side */}
          <div className="lg:col-span-2">
            <div className="relative bg-black rounded-lg overflow-hidden h-96 sm:h-[500px]">
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('${mainNews.image}')` }}
              >
                <div className="absolute inset-0 bg-black bg-opacity-60"></div>
              </div>
              
              <div className="relative z-10 p-6 sm:p-8 h-full flex flex-col justify-between">
                <div>
                  <span className="text-orange-400 text-sm font-bold tracking-wide">
                    {mainNews.category}
                  </span>
                  <h2 className="text-white text-2xl sm:text-3xl lg:text-4xl font-black mt-2 mb-4 leading-tight">
                    {mainNews.title} <span className="text-2xl">🏌️</span>
                  </h2>
                  <p className="text-white text-base sm:text-lg opacity-90 max-w-lg">
                    {mainNews.subtitle}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {mainNews.actions.map((action, index) => (
                    <button
                      key={index}
                      className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-bold rounded transition-colors ${
                        action.primary
                          ? "bg-white text-black hover:bg-gray-100"
                          : "bg-transparent border-2 border-white text-white hover:bg-white hover:text-black"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row News */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {sideNews.map((news, index) => (
                <div key={index} className="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div 
                    className="h-32 sm:h-40 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${news.image}')` }}
                  >
                    <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                  </div>
                  <div className="p-4">
                    <span className="text-orange-600 text-xs font-bold tracking-wide">
                      {news.category}
                    </span>
                    <h3 className="text-black text-sm font-bold mt-1 leading-tight">
                      {news.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Tournament Info */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-center mb-4">
                <h3 className="text-lg font-black text-black mb-2">
                  Orders Of Play, Results & Draws
                </h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                    {tournament.status}
                  </span>
                  <span className="text-sm text-gray-600">
                    {tournament.day}
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <h4 className="text-xl font-bold text-black">{tournament.title}</h4>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600 mt-1">
                  <MapPin className="w-4 h-4" />
                  {tournament.location}
                </div>
                <div className="text-sm text-gray-400 mt-2">GRAND SLAM®</div>
              </div>
            </div>

            {/* Latest News */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-black text-black mb-4">
                Latest News & Headlines
              </h3>
              <div className="space-y-4">
                {headlines.map((headline, index) => (
                  <div key={index} className="border-l-2 border-orange-500 pl-3">
                    <p className="text-sm text-gray-800 leading-snug hover:text-orange-600 cursor-pointer transition-colors">
                      {headline}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
