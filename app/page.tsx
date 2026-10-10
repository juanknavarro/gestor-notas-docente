"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  ArrowRight,
  Users,
  Database,
} from "lucide-react";

export default function DashboardPage() {
  const periodosCount = useLiveQuery(() => db.periodos.count(), []);
  const asignaturasCount = useLiveQuery(() => db.asignaturas.count(), []);
  const estudiantesCount = useLiveQuery(() => db.estudiantes.count(), []);

  const stats = [
    {
      title: "Periodos Académicos",
      count: periodosCount ?? 0,
      description: "Ciclos o semestres lectivos configurados",
      href: "/periodos",
      icon: CalendarDays,
    },
    {
      title: "Asignaturas",
      count: asignaturasCount ?? 0,
      description: "Materias activas con sus 3 cortes reglamentarios",
      href: "/asignaturas",
      icon: BookOpen,
    },
    {
      title: "Estudiantes Matriculados",
      count: estudiantesCount ?? 0,
      description: "Importados vía Elysa y registros locales",
      href: "/asignaturas",
      icon: Users,
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <LayoutDashboard className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Panel Principal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Dashboard
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Bienvenido al Gestor Académico Local-First. Todos tus datos se almacenan de forma segura en tu navegador.
        </p>
      </div>

      {/* Tarjetas de Estadísticas en Vivo (Light & Dark Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.title}
              href={stat.href}
              className="group p-6 bg-white border border-zinc-200 shadow-sm hover:border-zinc-300 hover:shadow-md dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80 rounded-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-200 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-2xl font-bold font-mono text-zinc-900 bg-zinc-100 border border-zinc-200 dark:text-zinc-50 dark:bg-zinc-800/60 dark:border-zinc-700/50 px-3 py-0.5 rounded-lg">
                    {stat.count}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                  {stat.title}
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  {stat.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center text-xs font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                <span>Gestionar módulo</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Local-first Info Banner (Light & Dark) */}
      <div className="p-5 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl flex items-start gap-4">
        <div className="p-2.5 bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700/60 dark:text-zinc-300 rounded-lg shrink-0 mt-0.5">
          <Database className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Arquitectura Local-First con Dexie.js (v2)
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Base de datos <code className="bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-[11px] font-mono">GestorAcademicoDB</code> activa en IndexedDB.
            Tablas listas: <span className="text-zinc-800 dark:text-zinc-300 font-medium">periodos</span>,{" "}
            <span className="text-zinc-800 dark:text-zinc-300 font-medium">asignaturas</span>,{" "}
            <span className="text-zinc-800 dark:text-zinc-300 font-medium">cortes</span> (1: 35%, 2: 35%, 3: 30%),{" "}
            <span className="text-zinc-800 dark:text-zinc-300 font-medium">actividades</span>,{" "}
            <span className="text-zinc-800 dark:text-zinc-300 font-medium">estudiantes</span> e{" "}
            <span className="text-zinc-800 dark:text-zinc-300 font-medium">notas</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
