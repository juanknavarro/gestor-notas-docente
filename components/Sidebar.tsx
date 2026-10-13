"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, BookOpen, UserCheck, BarChart3, Database, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Periodos Académicos",
    href: "/periodos",
    icon: CalendarDays,
  },
  {
    label: "Asignaturas",
    href: "/asignaturas",
    icon: BookOpen,
  },
  {
    label: "Socialización",
    href: "/socializacion",
    icon: UserCheck,
  },
  {
    label: "Reportes",
    href: "/reportes",
    icon: BarChart3,
  },
  {
    label: "Configuración & Respaldos",
    href: "/configuracion",
    icon: Settings,
  },
];

function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              isActive
                ? "bg-zinc-100 font-semibold text-zinc-900 shadow-2xs dark:bg-zinc-800/80 dark:text-white"
                : "font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40"
            }`}
          >
            {isActive && (
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-zinc-900 dark:bg-zinc-100 rounded-r"
                aria-hidden="true"
              />
            )}
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive
                  ? "text-zinc-900 dark:text-zinc-100 stroke-[2.25]"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <Icon className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="p-2 bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
            Gestor Docente
          </h1>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
            Local-First
          </span>
        </div>
      </div>

      {/* Navegación Raíz - Opciones al mismo nivel, sin anidamiento */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
          Navegación Principal
        </p>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </nav>

      {/* Footer Info con Theme Toggle integrado */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 space-y-3">
        {/* Selector de Tema */}
        <ThemeToggle />

        {/* Estado IndexedDB */}
        <div className="flex items-center gap-2.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Database className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="truncate">
            <p className="font-medium text-zinc-700 dark:text-zinc-300 truncate">Dexie (IndexedDB)</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">GestorAcademicoDB</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
