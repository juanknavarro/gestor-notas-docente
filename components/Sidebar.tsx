"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  UserCheck,
  BarChart3,
  Database,
  Settings,
  Info,
  X,
  ShieldCheck,
  User,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import packageInfo from "@/package.json";

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
  const [modalAcercaDeAbierto, setModalAcercaDeAbierto] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && modalAcercaDeAbierto) {
        setModalAcercaDeAbierto(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalAcercaDeAbierto]);

  return (
    <>
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

          {/* Ítem Acerca de / Información */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setModalAcercaDeAbierto(true)}
              className={`w-full relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                modalAcercaDeAbierto
                  ? "bg-zinc-100 font-semibold text-zinc-900 shadow-2xs dark:bg-zinc-800/80 dark:text-white"
                  : "font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/40"
              }`}
            >
              {modalAcercaDeAbierto && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-zinc-900 dark:bg-zinc-100 rounded-r"
                  aria-hidden="true"
                />
              )}
              <Info
                className={`w-4 h-4 shrink-0 transition-colors ${
                  modalAcercaDeAbierto
                    ? "text-zinc-900 dark:text-zinc-100 stroke-[2.25]"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              />
              <span>Acerca de</span>
            </button>
          </div>
        </nav>

        {/* Footer Info con Theme Toggle e Indicador de Versión */}
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

          {/* Indicador de Versión */}
          <div className="flex items-center justify-between px-1 pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800/60 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
            <span>Versión</span>
            <span className="font-semibold text-zinc-500 dark:text-zinc-400">
              v{packageInfo.version}
            </span>
          </div>
        </div>
      </aside>

      {/* Modal Acerca de */}
      {modalAcercaDeAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-text"
          onClick={() => setModalAcercaDeAbierto(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700/60 shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base leading-tight">
                    Gestor Académico Local-First
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      100% Offline
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                      v{packageInfo.version}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAcercaDeAbierto(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 space-y-4 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {/* Bloque Autor */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/70">
                <div className="p-2 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 block">
                    Autor y Desarrollador
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Juan Carlos Navarro Ramos
                  </span>
                </div>
              </div>

              {/* Descripción Institucional */}
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800/70 space-y-1.5">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 block">
                  Descripción
                </span>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                  Aplicación web local-first para la gestión académica docente. Permite administrar periodos, asignaturas, cortes evaluativos y estudiantes mediante IndexedDB. Genera reportes institucionales automatizados operando de forma offline para garantizar la privacidad y el Habeas Data.
                </p>
              </div>

              {/* Pilares Institucionales */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/60 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-zinc-800 dark:text-zinc-200 text-[11px]">Habeas Data</strong>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Datos privados en tu navegador.</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/60 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-zinc-800 dark:text-zinc-200 text-[11px]">Informes Oficiales</strong>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Excel institucional listo.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie del Modal */}
            <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-end">
              <button
                type="button"
                onClick={() => setModalAcercaDeAbierto(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium rounded-lg transition-colors shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
