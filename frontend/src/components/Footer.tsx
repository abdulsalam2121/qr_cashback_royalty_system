import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-16 px-6 lg:px-8 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
        <div className="absolute top-10 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto text-center relative z-10">
        <div className="animate-fade-in-up">
          <div className="flex items-center justify-center space-x-4 mb-8">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-glow hover:scale-110 transition-transform duration-500 border border-gray-200/20">
              <img 
                src="/logo.png" 
                alt="LoyaltyPro Logo" 
                className="w-12 h-12 object-contain"
              />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-x">
              LoyaltyPro
            </span>
          </div>
          
          <p className="text-gray-300 mb-6 text-lg max-w-2xl mx-auto">
            Revolutionizing customer loyalty with intelligent QR-based rewards and analytics
          </p>
          
          <div className="flex items-center justify-center space-x-8 mb-8 text-sm text-gray-400">
            <div className="hover:text-white transition-colors duration-300 cursor-pointer">Privacy Policy</div>
            <div className="hover:text-white transition-colors duration-300 cursor-pointer">Terms of Service</div>
            <div className="hover:text-white transition-colors duration-300 cursor-pointer">Support</div>
            <div className="hover:text-white transition-colors duration-300 cursor-pointer">Contact</div>
          </div>
          
          <div className="border-t border-gray-700/50 pt-8">
            <p className="text-gray-400 text-sm">
              © 2025 LoyaltyPro. All rights reserved. Built with ❤️ for modern businesses worldwide.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;