
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-black text-white py-8 sm:py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1 text-center sm:text-left">
            <h3 className="text-xl sm:text-2xl font-black mb-3 sm:mb-4">TENNISMATCH</h3>
            <p className="text-gray-400 leading-relaxed text-sm sm:text-base">
              Connect with tennis players at your level. Play more, compete more, improve together.
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-center sm:text-left">
            <h4 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">QUICK LINKS</h4>
            <ul className="space-y-1 sm:space-y-2">
              <li><a href="#players" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Find Players</a></li>
              <li><a href="#locations" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Court Locations</a></li>
              <li><a href="#faq" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">FAQ</a></li>
              <li><a href="#newsletter" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Newsletter</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="text-center sm:text-left">
            <h4 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">SUPPORT</h4>
            <ul className="space-y-1 sm:space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Help Center</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Contact Us</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base">Terms of Service</a></li>
            </ul>
          </div>

          {/* Social Media */}
          <div className="text-center sm:text-left">
            <h4 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">FOLLOW US</h4>
            <div className="flex justify-center sm:justify-start space-x-3 sm:space-x-4 mb-3 sm:mb-4">
              <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-600 rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors">
                <Facebook className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-600 rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors">
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-600 rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors">
                <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-600 rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors">
                <Youtube className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a href="#" className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-600 rounded-full flex items-center justify-center hover:bg-orange-700 transition-colors">
                <Linkedin className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
            <p className="text-gray-400 text-xs sm:text-sm">
              Join our community of tennis enthusiasts
            </p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 pt-6 sm:pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
              © 2024 TennisMatch. All rights reserved.
            </p>
            <div className="flex items-center space-x-4 sm:space-x-6">
              <a href="#" className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white text-xs sm:text-sm transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
