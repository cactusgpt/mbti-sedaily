"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/cost", label: "Cost" },
  { href: "/drivers", label: "Drivers" },
  { href: "/prompts", label: "Prompts" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    clearAuth();
    router.replace("/login");
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="glass-nav sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 flex justify-between items-center h-14">
        <div className="flex items-center gap-1">
          <span className="mr-4 text-sm font-semibold tracking-tight text-slate-900">
            AI&nbsp;LENS
            <span className="ml-1 text-slate-500 font-normal">/ admin</span>
          </span>
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                  active
                    ? "bg-white/70 text-blue-700 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/15"
                    : "text-slate-700 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={logout}
          className="text-sm font-medium px-3 py-1.5 rounded-lg text-slate-700 hover:text-red-600 hover:bg-white/50 transition-all"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
