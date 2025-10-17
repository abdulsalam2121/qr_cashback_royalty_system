import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-soft">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-3 animate-fade-in">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-glow animate-pulse border border-gray-100">
              <img 
                src="/logo.png" 
                alt="LoyaltyPro Logo" 
                className="w-10 h-10 object-contain"
              />
            </div>
            <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">
              LoyaltyPro
            </Link>
          </div>
          <div className="flex items-center space-x-6 animate-fade-in-down">
            <Link
              to="/login"
              className="text-gray-600 hover:text-gray-900 font-medium transition-all duration-300 hover:scale-105"
            >
              Business Login
            </Link>
            <Link
              to="/customer/login"
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105 shadow-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span>Customer Login</span>
            </Link>
            <Link
              to="/signup"
              className="px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl hover:shadow-glow-lg transition-all duration-500 transform hover:scale-105 shadow-soft font-medium animate-gradient-x hover-glow"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;