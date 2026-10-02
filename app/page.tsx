import { MapPin, Clock, Phone, Store, Scissors, Camera, Mail } from "lucide-react";
import { BRAND_EN, BRAND_SUBTITLE, BRAND_OWNER_NAME, BRAND_ADDRESS, BRAND_PHONE_DISPLAY, BRAND_EMAIL, BRAND_INSTAGRAM, BRAND_INSTAGRAM_LINK } from "@/lib/brand";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF0F8] text-[#111111] font-sans flex flex-col justify-between selection:bg-[#F500A0] selection:text-white">
      {/* Header */}
      <header className="border-b border-[#F500A0]/20 py-4 px-6 sm:px-12 flex justify-between items-center bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-xs p-1 border border-[#F500A0]/30 overflow-hidden">
            <img src="/logo.png" alt="HM Boutique Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-black text-[#F500A0] tracking-wider uppercase block">
              {BRAND_EN}
            </span>
            <span className="text-[10px] text-gray-600 font-bold tracking-widest block uppercase -mt-0.5">
              {BRAND_SUBTITLE}
            </span>
          </div>
        </div>
      </header>

      {/* Main Info */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 flex flex-col justify-center items-center py-12">
        <div className="bg-white border border-[#F500A0]/20 rounded-3xl p-8 sm:p-12 shadow-xl w-full text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#F500A0] via-pink-400 to-[#F500A0]" />

          <span className="inline-block px-3.5 py-1 bg-[#F500A0]/10 border border-[#F500A0]/30 text-[#F500A0] text-[11px] font-black rounded-full tracking-wider uppercase mb-6">
            Boutique & Fashion Institute Directory
          </span>

          <h1 className="text-3xl sm:text-4xl font-black text-[#111111] leading-tight tracking-tight mb-2">
            HM BOUTIQUE
          </h1>
          <p className="text-xs text-[#F500A0] font-black tracking-widest uppercase mb-2">
            {BRAND_SUBTITLE}
          </p>
          <p className="text-xs text-gray-500 font-bold mb-8">
            Proprietor: <span className="text-gray-900">{BRAND_OWNER_NAME}</span>
          </p>

          <div className="space-y-6 text-left max-w-lg mx-auto text-sm font-semibold text-[#111111]/80 border-t border-[#F500A0]/15 pt-8">
            <div className="flex items-start gap-4">
              <Scissors className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Specializations</p>
                <p className="text-[#111111] leading-relaxed">
                  Tailoring Diploma Courses • Blouse & Salwar Pattern Making • Designer & Bridal Wear • Aari & Embroidery Work • Custom Tailoring & Fittings
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Store className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-[#111111] font-bold">
                  Adambakkam, Chennai, Tamil Nadu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Institute Address</p>
                <p className="text-[#111111] leading-relaxed">
                  {BRAND_ADDRESS}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Phone className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Contact Numbers</p>
                <p className="text-[#111111]">
                  +91 {BRAND_PHONE_DISPLAY}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Email</p>
                <p className="text-[#111111]">
                  {BRAND_EMAIL}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Camera className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Instagram</p>
                <a
                  href={BRAND_INSTAGRAM_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F500A0] hover:underline"
                >
                  @{BRAND_INSTAGRAM}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-[#F500A0] shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Working Hours</p>
                <p className="text-[#111111]">
                  Open Daily • 10:00 AM – 8:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#F500A0]/20 py-4 text-center bg-white/90">
        <p className="text-[11px] font-black text-[#F500A0] tracking-widest uppercase">
          HM BOUTIQUE & SCHOOL OF FASHION DESIGNING
        </p>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
          Powered by Cenexa Systems © 2026
        </p>
      </footer>
    </div>
  );
}
