import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="w-full bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white font-bold text-xl">
              H
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Habsify</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
            <a href="#faqs" className="hover:text-primary transition-colors">FAQs</a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="px-5 py-2 !rounded-button whitespace-nowrap bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link to="/login" className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-button transition-colors">
                  Log in
                </Link>
                <Link to="/signup" className="px-5 py-2 !rounded-button whitespace-nowrap bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow pt-16">
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
              The Ultimate ERP for <br className="hidden md:block"/>
              <span className="text-primary">Modern Businesses</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-10">
              Manage your inventory, finances, CRM, and supply chain all in one unified, beautiful platform. Habsify helps you scale seamlessly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to={user ? "/dashboard" : "/signup"} className="w-full sm:w-auto px-8 py-3.5 !rounded-button whitespace-nowrap bg-primary text-white text-base font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Start your free trial
              </Link>
              <a href="#features" className="w-full sm:w-auto px-8 py-3.5 !rounded-button whitespace-nowrap bg-white border border-gray-300 text-gray-700 text-base font-medium hover:bg-gray-50 transition-all shadow-sm">
                Explore Features
              </a>
            </div>

            {/* Dashboard Preview or Abstract Graphic */}
            <div className="mt-16 mx-auto max-w-5xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden relative group">
               <div className="bg-gray-800 w-full h-8 flex items-center px-4 gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
               </div>
               <div className="bg-gray-100 aspect-video flex items-center justify-center flex-col relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent z-10"></div>
                  <div className="grid grid-cols-3 gap-6 p-8 w-full h-full opacity-80">
                     <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
                       <div className="w-1/3 h-6 bg-gray-200 rounded"></div>
                       <div className="flex-1 bg-gray-50 rounded border border-gray-100"></div>
                     </div>
                     <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
                       <div className="w-1/2 h-6 bg-gray-200 rounded"></div>
                       <div className="h-16 bg-gray-50 rounded border border-gray-100"></div>
                       <div className="h-16 bg-gray-50 rounded border border-gray-100"></div>
                       <div className="h-16 bg-gray-50 rounded border border-gray-100"></div>
                     </div>
                  </div>
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center backdrop-blur-[2px]">
                    <span className="text-xl font-bold text-gray-800 tracking-widest uppercase bg-white/90 px-6 py-2 rounded-full shadow-sm">Habsify ERP Dashboard</span>
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to run your business</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">From tracking customer relations to comprehensive financial reporting.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { title: 'Inventory Management', desc: 'Track stock, handle categories, and manage multiple warehouses in real-time.', icon: 'ri-archive-line' },
                { title: 'Powerful CRM', desc: 'Maintain detailed customer profiles, track communication, and grow leads efficiently.', icon: 'ri-user-heart-line' },
                { title: 'Finance Center', desc: 'Monitor your bank balances, track cash flow, and manage your day-to-day transactions.', icon: 'ri-money-dollar-circle-line' },
                { title: 'Supplier Network', desc: 'Keep supplier information secure, track purchase histories, and optimize sourcing.', icon: 'ri-truck-line' }
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                    <i className={`${f.icon} text-2xl`}></i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="py-24 bg-white border-y border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
               <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                 Simplify complexity, <br/> accelerate growth.
               </h2>
               <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                 Replace fragmented spreadsheets and legacy software with a single, intuitive platform tailored to your specific operational needs. Let automation handle the repetitive tasks so you can focus on scaling your business.
               </p>
               <ul className="space-y-4">
                 {['Intelligent Dashboards & KPIs', 'Configurable Team Roles (Coming Soon)', 'Cloud-Based Anytime Access', 'Secure & Reliable Architecture'].map((item, idx) => (
                   <li key={idx} className="flex items-center gap-3 text-gray-700 font-medium">
                     <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm">✔</span>
                     {item}
                   </li>
                 ))}
               </ul>
            </div>
            <div className="md:w-1/2 w-full">
              <div className="aspect-square bg-gray-50 rounded-3xl border flex items-center justify-center p-8 relative overflow-hidden shadow-inner">
                 <div className="absolute w-64 h-64 bg-primary/20 rounded-full blur-3xl -top-10 -right-10"></div>
                 <div className="absolute w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -bottom-10 -left-10"></div>
                 <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl border border-white/50 p-6 backdrop-blur-sm">
                   <div className="flex justify-between items-center mb-6">
                     <div className="h-4 w-24 bg-gray-200 rounded"></div>
                     <div className="h-4 w-12 bg-primary/20 rounded"></div>
                   </div>
                   <div className="space-y-4">
                     <div className="h-2 w-full bg-gray-100 rounded"></div>
                     <div className="h-2 w-5/6 bg-gray-100 rounded"></div>
                     <div className="h-2 w-4/6 bg-gray-100 rounded"></div>
                   </div>
                   <div className="mt-8 flex gap-2">
                     <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                     <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                     <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>
          <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
             <h2 className="text-4xl font-bold text-white mb-6">Ready to transform your operations?</h2>
             <p className="text-primary-100 text-xl mb-10 max-w-2xl mx-auto">
               Join hundreds of modern businesses choosing Habsify to streamline their entire workflow.
             </p>
             <Link to={user ? "/dashboard" : "/signup"} className="inline-block px-10 py-4 !rounded-button whitespace-nowrap bg-white text-primary text-lg font-bold hover:bg-gray-50 transition-colors shadow-xl">
               Get Started for Free
             </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-white font-bold text-sm">
                H
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Habsify</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              The modern ERP platform designed for growing teams and ambitious companies.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-sm text-center md:text-left flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} Habsify. All rights reserved.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
             <a href="#" className="hover:text-white transition-colors"><i className="ri-twitter-x-line text-lg"></i></a>
             <a href="#" className="hover:text-white transition-colors"><i className="ri-linkedin-box-line text-lg"></i></a>
             <a href="#" className="hover:text-white transition-colors"><i className="ri-github-line text-lg"></i></a>
          </div>
        </div>
      </footer>
    </div>
  );
}

