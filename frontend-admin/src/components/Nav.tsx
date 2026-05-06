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
    <nav className="bg-white border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 flex justify-between items-center h-14">
        <div className="flex space-x-6">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium transition-colors ${
                isActive(href)
                  ? "text-blue-600"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <button
          onClick={logout}
          className="text-sm text-zinc-500 hover:text-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
