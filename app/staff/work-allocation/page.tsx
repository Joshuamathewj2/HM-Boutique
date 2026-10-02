import WorkAllocation from "@/app/components/WorkAllocation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Staff Work Allocation • HM Boutique",
  description: "Staff Task Tracker and Unit Progress Management",
};

export default function StaffWorkAllocationPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <header className="bg-[#F500A0] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="HM Boutique"
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
          />
          <div>
            <h1 className="text-base font-black tracking-tight leading-tight">HM BOUTIQUE</h1>
            <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
              Staff Portal • Work Allocation
            </p>
          </div>
        </div>
        <Link
          href="/pos/admin/secure/control-panel/ss-creatives"
          className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors"
        >
          <ArrowLeft size={14} />
          <span>POS Terminal</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <WorkAllocation role="staff" />
      </main>
    </div>
  );
}
