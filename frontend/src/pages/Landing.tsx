import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { 
  QrCode, 
  Smartphone, 
  Gift, 
  Shield, 
  TrendingUp, 
  Users, 
  Bell, 
  Award,
  ArrowRight,
  CheckCircle,
  Zap,
  Star,
  CreditCard,
  Eye,
  BarChart3,
  Clock,
  Globe,
  Sparkles
} from 'lucide-react';

const Landing: React.FC = () => {
  const { isAuthenticated, user, tenant, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      const redirectPath = 
        user.role === 'platform_admin' ? '/platform/dashboard' :
        user.role === 'tenant_admin' && tenant ? `/t/${tenant.slug}/dashboard` :
        user.role === 'cashier' && tenant ? `/t/${tenant.slug}/pos` :
        user.role === 'customer' && tenant ? `/t/${tenant.slug}/customer` :
        null;
      
      if (redirectPath) {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [isAuthenticated, user, tenant, navigate, loading]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  const features = [
    {
      icon: QrCode,
      title: "QR-Based Cards",
      description: "Instant card activation and transactions with secure QR code scanning",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Award,
      title: "Multi-Tier Rewards",
      description: "Silver, Gold, Platinum tiers with escalating cashback rates",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Bell,
      title: "Real-Time Notifications",
      description: "SMS and WhatsApp alerts for every transaction and reward",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Shield,
      title: "Secure Transactions",
      description: "Bank-level security with audit trails and fraud protection",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Comprehensive insights into customer behavior and loyalty trends",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: Globe,
      title: "Multi-Store Support",
      description: "Manage loyalty programs across multiple store locations seamlessly",
      color: "from-teal-500 to-cyan-500"
    }
  ];

  const benefits = {
    customers: [
      "Instant cashback on every purchase",
      "Transparent tier progression",
      "Mobile-friendly card management",
      "Real-time balance updates",
      "Exclusive member-only offers",
      "Easy reward redemption"
    ],
    businesses: [
      "Increase customer retention by 40%",
      "Complete transaction audit trail",
      "Automated loyalty management",
      "Multi-store support",
      "Detailed analytics and insights",
      "Reduced operational costs"
    ]
  };

  const stats = [
    { number: "40%", label: "Increase in Customer Retention" },
    { number: "25%", label: "Boost in Average Transaction Value" },
    { number: "99.9%", label: "System Uptime Guarantee" },
    { number: "24/7", label: "Customer Support" }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Store Manager",
      company: "Fresh Market",
      content: "LoyaltyPro transformed our customer relationships. We've seen a 45% increase in repeat customers since implementing their QR-based system.",
      avatar: "SJ"
    },
    {
      name: "Michael Chen",
      role: "Business Owner",
      company: "Tech Gadgets Plus",
      content: "The analytics dashboard gives us incredible insights. We can now make data-driven decisions that actually impact our bottom line.",
      avatar: "MC"
    },
    {
      name: "Emily Rodriguez",
      role: "Marketing Director",
      company: "Style Boutique",
      content: "Our customers love the simplicity of the QR system. No more lost cards or forgotten points - everything is seamless and instant.",
      avatar: "ER"
    }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="particle particle-1 top-20 left-10 animate-float"></div>
        <div className="particle particle-2 top-40 right-20 animate-float-delay"></div>
        <div className="particle particle-3 top-60 left-1/4 animate-float"></div>
        <div className="particle particle-1 bottom-40 right-1/3 animate-float-delay"></div>
        <div className="particle particle-2 bottom-20 left-1/2 animate-float"></div>
        <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-xl animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-10 w-24 h-24 bg-gradient-to-br from-cyan-400/10 to-blue-400/10 rounded-full blur-xl animate-pulse animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 px-6 py-3 rounded-full text-sm font-medium mb-8 border border-blue-100/50 shadow-soft animate-bounce-gentle hover:shadow-glow transition-all duration-300 cursor-pointer">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-semibold">
                Next-Generation Loyalty Platform
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-8xl font-bold mb-8 leading-tight animate-fade-in-up">
              Transform Customer
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">
                Loyalty Forever
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-12 animate-fade-in-up animation-delay-2000">
              Revolutionary QR-based cashback system that increases customer retention by <span className="font-bold text-blue-600">40%</span> 
              while providing seamless reward management for businesses of all sizes.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16 animate-fade-in-up animation-delay-4000">
              <Link
                to="/signup"
                className="group px-10 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-2xl text-lg font-semibold hover:shadow-glow-lg transition-all duration-300 transform hover:scale-110 flex items-center space-x-3 shadow-soft-lg animate-gradient-x hover-glow"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-200" />
              </Link>
              <Link
                to="/dashboard"
                className="px-10 py-5 border-2 border-gray-200 text-gray-700 rounded-2xl text-lg font-semibold hover:border-purple-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 flex items-center space-x-3 group hover:shadow-soft hover:scale-105"
              >
                <Eye className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                <span>Watch Demo</span>
              </Link>
            </div>
          </div>

          {/* Enhanced Stats Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-20 animate-fade-in">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group hover:scale-110 transition-all duration-300 cursor-pointer">
                <div className="relative">
                  <div className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 animate-gradient-x group-hover:animate-pulse">
                    {stat.number}
                  </div>
                  <div className="text-gray-600 font-medium group-hover:text-gray-900 transition-colors duration-200">
                    {stat.label}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-pink-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Hero Visual */}
          <div className="relative max-w-6xl mx-auto animate-scale-in">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-3xl blur-3xl"></div>
            <div className="relative bg-gradient-to-br from-gray-50/90 to-blue-50/90 backdrop-blur-xl rounded-3xl border border-white/50 p-12 shadow-soft-lg hover:shadow-glow-lg transition-all duration-400">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-soft border border-white/50 hover:shadow-glow hover:scale-105 transition-all duration-300 group cursor-pointer">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300 animate-float">
                    <QrCode className="w-8 h-8 text-white group-hover:animate-pulse" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 group-hover:text-blue-600 transition-colors duration-200">Scan QR</h3>
                  <p className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200">Customer scans their unique loyalty card</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-soft border border-white/50 hover:shadow-glow hover:scale-105 transition-all duration-300 group cursor-pointer animation-delay-2000">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-glow-purple transition-all duration-300 animate-float-delay">
                    <Gift className="w-8 h-8 text-white group-hover:animate-bounce" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 group-hover:text-purple-600 transition-colors duration-200">Earn Rewards</h3>
                  <p className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200">Automatic cashback calculation and delivery</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-soft border border-white/50 hover:shadow-glow hover:scale-105 transition-all duration-300 group cursor-pointer animation-delay-4000">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300 animate-float">
                    <TrendingUp className="w-8 h-8 text-white group-hover:animate-wiggle" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 group-hover:text-green-600 transition-colors duration-200">Level Up</h3>
                  <p className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200">Automatic tier progression and benefits</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-br from-gray-50/50 to-blue-50/30 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-10 right-10 w-72 h-72 bg-gradient-to-br from-purple-400/5 to-pink-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gradient-to-br from-blue-400/5 to-cyan-400/5 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              Powerful Features for
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">
                Modern Business
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Everything you need to create and manage a world-class loyalty program that drives exponential growth
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-soft border border-white/50 hover:shadow-glow-lg transition-all duration-400 hover:transform hover:scale-105 hover:rotate-1 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Card Background Glow */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 rounded-3xl transition-opacity duration-300`}></div>
                
                {/* Floating Icon Container */}
                <div className="relative">
                  <div className={`w-20 h-20 bg-gradient-to-br ${feature.color} rounded-3xl flex items-center justify-center mb-6 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 shadow-soft group-hover:shadow-glow animate-float`}>
                    <feature.icon className="w-10 h-10 text-white group-hover:animate-pulse" />
                  </div>
                  
                  {/* Feature Title */}
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                    {feature.title}
                  </h3>
                  
                  {/* Feature Description */}
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-800 transition-colors duration-200">
                    {feature.description}
                  </p>
                  
                  {/* Hover Arrow */}
                  <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 mt-4">
                    <ArrowRight className="w-6 h-6 text-purple-600 animate-bounce" />
                  </div>
                </div>
                
                {/* Sparkle Effect */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Sparkles className="w-6 h-6 text-yellow-400 animate-spin-slow" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              How It <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">Works</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple, fast, and secure loyalty management in three revolutionary steps
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {[
              {
                icon: Smartphone,
                title: "Scan & Connect",
                description: "Customer scans their unique QR loyalty card at checkout for instant recognition and seamless experience",
                gradient: "from-blue-500 to-cyan-500",
                delay: "0s"
              },
              {
                icon: Zap,
                title: "Instant Rewards",
                description: "Automatic cashback calculation based on purchase amount, product category, and current loyalty tier",
                gradient: "from-purple-500 to-pink-500",
                delay: "0.2s"
              },
              {
                icon: Star,
                title: "Grow Together",
                description: "Automatic tier progression unlocks higher cashback rates, exclusive rewards, and premium benefits",
                gradient: "from-green-500 to-emerald-500",
                delay: "0.4s"
              }
            ].map((step, index) => (
              <div key={index} className="text-center group animate-fade-in-up" style={{ animationDelay: step.delay }}>
                <div className="relative mb-8">
                  {/* Step Circle with Enhanced Design */}
                  <div className={`w-32 h-32 bg-gradient-to-br ${step.gradient} rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-125 transition-all duration-400 shadow-soft-lg group-hover:shadow-glow-lg animate-float cursor-pointer`}>
                    <step.icon className="w-16 h-16 text-white group-hover:animate-pulse" />
                  </div>
                  
                  {/* Step Number Badge */}
                  <div className="absolute -top-3 -right-3 w-12 h-12 bg-gradient-to-r from-pink-500 to-red-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-glow-pink group-hover:scale-125 group-hover:animate-bounce transition-all duration-300">
                    {index + 1}
                  </div>
                  
                  {/* Connection Line */}
                  {index < 2 && (
                    <div className="hidden lg:block absolute top-16 left-full w-12 h-1 bg-gradient-to-r from-gray-300 to-transparent transform -translate-y-1/2"></div>
                  )}
                </div>
                
                <h3 className="text-3xl font-bold mb-6 text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed text-lg group-hover:text-gray-800 transition-colors duration-200">
                  {step.description}
                </p>
                
                {/* Hover Effect Indicator */}
                <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 mt-6">
                  <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mx-auto"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6 lg:px-8 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-float-delay"></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              Loved by <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">Businesses Everywhere</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              See how businesses are transforming their customer relationships with LoyaltyPro
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index} 
                className="group bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-soft border border-white/50 hover:shadow-glow-lg hover:scale-105 transition-all duration-400 cursor-pointer animate-fade-in-up relative overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Card Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl"></div>
                
                {/* Profile Section */}
                <div className="flex items-center mb-6 relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4 group-hover:scale-110 group-hover:shadow-glow transition-all duration-300 animate-gradient-xy">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all duration-300">
                      {testimonial.name}
                    </div>
                    <div className="text-gray-600 text-sm group-hover:text-gray-800 transition-colors duration-200">
                      {testimonial.role} at <span className="font-semibold">{testimonial.company}</span>
                    </div>
                  </div>
                </div>
                
                {/* Testimonial Content */}
                <div className="relative z-10">
                  <div className="text-4xl text-blue-300 group-hover:text-purple-400 transition-colors duration-200 mb-4">"</div>
                  <p className="text-gray-700 leading-relaxed italic group-hover:text-gray-900 transition-colors duration-200 text-lg">
                    {testimonial.content}
                  </p>
                  <div className="text-4xl text-blue-300 group-hover:text-purple-400 transition-colors duration-200 text-right mt-4">"</div>
                </div>
                
                {/* Floating Stars */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Benefits Section */}
      <section className="py-20 px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 text-gray-900">
              Benefits for <span className="bg-gradient-to-r from-green-500 via-blue-600 to-purple-600 bg-clip-text text-transparent animate-gradient-x">Everyone</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Designed to create exceptional value for both businesses and their valued customers
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* For Customers */}
            <div className="group relative animate-fade-in-up">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-blue-50/90 to-cyan-50/90 backdrop-blur-sm rounded-3xl p-10 border border-blue-100/50 shadow-soft hover:shadow-glow-lg transition-all duration-700 hover:scale-105">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mr-6 shadow-soft group-hover:scale-110 group-hover:shadow-glow transition-all duration-500 animate-float">
                    <Users className="w-10 h-10 text-white group-hover:animate-pulse" />
                  </div>
                  <h3 className="text-4xl font-bold text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-cyan-600 group-hover:bg-clip-text transition-all duration-500">
                    For Customers
                  </h3>
                </div>
                <div className="space-y-4">
                  {benefits.customers.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-4 group/item hover:scale-105 transition-transform duration-300">
                      <CheckCircle className="w-7 h-7 text-green-500 flex-shrink-0 group-hover/item:animate-bounce" />
                      <span className="text-gray-700 font-medium text-lg group-hover/item:text-gray-900 transition-colors duration-300">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* For Businesses */}
            <div className="group relative animate-fade-in-up animation-delay-2000">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-purple-50/90 to-pink-50/90 backdrop-blur-sm rounded-3xl p-10 border border-purple-100/50 shadow-soft hover:shadow-glow-lg transition-all duration-700 hover:scale-105">
                <div className="flex items-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center mr-6 shadow-soft group-hover:scale-110 group-hover:shadow-glow-purple transition-all duration-500 animate-float-delay">
                    <TrendingUp className="w-10 h-10 text-white group-hover:animate-pulse" />
                  </div>
                  <h3 className="text-4xl font-bold text-gray-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 group-hover:bg-clip-text transition-all duration-500">
                    For Businesses
                  </h3>
                </div>
                <div className="space-y-4">
                  {benefits.businesses.map((benefit, index) => (
                    <div key={index} className="flex items-center space-x-4 group/item hover:scale-105 transition-transform duration-300">
                      <CheckCircle className="w-7 h-7 text-green-500 flex-shrink-0 group-hover/item:animate-bounce" />
                      <span className="text-gray-700 font-medium text-lg group-hover/item:text-gray-900 transition-colors duration-300">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Section */}
      <section className="py-16 px-6 lg:px-8 bg-gradient-to-br from-emerald-50 to-teal-50 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-200/30 to-teal-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-green-200/30 to-emerald-200/30 rounded-full blur-3xl"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-emerald-200">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" clipRule="evenodd"/>
              </svg>
              <span>For Customers</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Already Have a Loyalty Card?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access your loyalty rewards, check your balance, and track your cashback earnings with our easy-to-use customer portal.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Check Your Balance</h3>
                  <p className="text-gray-600">View your current loyalty points and cashback balance in real-time</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Transaction History</h3>
                  <p className="text-gray-600">See all your purchases, earnings, and redemptions in one place</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Updates</h3>
                  <p className="text-gray-600">Get notified immediately when you earn or redeem rewards</p>
                </div>
              </div>
            </div>

            <div className="text-center lg:text-left">
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Customer Portal</h3>
                  <p className="text-gray-600 mb-6">Login to access your loyalty account and manage your rewards</p>
                </div>
                
                <Link
                  to="/customer/login"
                  className="block w-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-lg font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 mb-4"
                >
                  Access Your Account
                </Link>
                
                <p className="text-sm text-gray-500">
                  Enter your card number or QR code to login
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="py-20 px-6 lg:px-8 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-gradient-x"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-xl animate-float-delay"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-float"></div>
        
        <div className="max-w-4xl mx-auto text-center text-white relative z-10">
          <div className="animate-fade-in-up">
            <h2 className="text-5xl lg:text-7xl font-bold mb-8 leading-tight">
              Ready to Transform
              <br />
              Your Business?
            </h2>
            <p className="text-xl lg:text-2xl mb-12 max-w-3xl mx-auto opacity-90 leading-relaxed">
              Join thousands of businesses already using LoyaltyPro to increase customer retention, 
              boost revenue, and build lasting relationships that drive exponential growth.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12 animate-fade-in-up animation-delay-2000">
            <Link
              to="/signup"
              className="group px-12 py-6 bg-white text-gray-900 rounded-2xl text-xl font-bold hover:bg-gray-100 transition-all duration-500 transform hover:scale-110 flex items-center justify-center space-x-3 shadow-soft-lg hover:shadow-glow-lg"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
            </Link>
            <Link
              to="/login"
              className="px-12 py-6 border-2 border-white/30 text-white rounded-2xl text-xl font-bold hover:border-white hover:bg-white/10 transition-all duration-500 hover:scale-105 shadow-soft"
            >
              Sign In to Dashboard
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-sm opacity-75 animate-fade-in-up animation-delay-4000">
            <div className="flex items-center space-x-2 hover:opacity-100 transition-opacity duration-300">
              <CheckCircle className="w-5 h-5" />
              <span>Free 30-day trial</span>
            </div>
            <div className="flex items-center space-x-2 hover:opacity-100 transition-opacity duration-300">
              <CheckCircle className="w-5 h-5" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center space-x-2 hover:opacity-100 transition-opacity duration-300">
              <CheckCircle className="w-5 h-5" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-2 hover:opacity-100 transition-opacity duration-300">
              <Shield className="w-5 h-5" />
              <span>Enterprise-grade security</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Landing;