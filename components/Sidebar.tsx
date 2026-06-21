"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, ArrowDownToLine, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Stock In", href: "/stock-in", icon: ArrowDownToLine },
  { name: "Debtors", href: "/debtors", icon: Users },
  { name: "Inventory", href: "/inventory", icon: Package },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const NavContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-border bg-card gap-2.5">
        <img src="/logo.png" alt="Vegas POS Logo" className="h-8 w-8 object-contain rounded-md" />
        <span className="text-xl font-bold tracking-tight text-primary">
          Vegas POS
        </span>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4 bg-card">
        <nav className="mt-5 flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-accent-foreground",
                    "mr-3 h-5 w-5 shrink-0 transition-colors"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-full w-64 flex-col bg-card border-r border-border shadow-sm">
        <NavContent />
      </div>

      {/* Mobile Sidebar Button */}
      <div className="lg:hidden fixed top-4 left-4 z-[60]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-lg focus:outline-none hover:scale-105 transition-transform active:scale-95"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar Content */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-2xl transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent />
      </div>
    </>
  );
}
