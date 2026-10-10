"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Periodo } from "@/lib/db";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  CalendarCheck,
  AlertCircle,
  X,
  Check,
} from "lucide-react";

export default function PeriodosPage() {
  const [nombre, setNombre] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Consulta reactiva a la base de datos local
  const periodos = useLiveQuery(() => db.periodos.orderBy("nombre").toArray(), []);

  const handleIniciarEdicion = (periodo: Periodo) => {
    if (!periodo.id) return;
    setEditingId(periodo.id);
    setNombre(periodo.nombre);
    setError(null);
  };

  const handleCancelarEdicion = () => {
    setEditingId(null);
    setNombre("");
    setError(null);
  };

  const handleGuardarPeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = nombre.trim();

    if (!trimmed) {
      setError("Por favor ingresa un nombre para el periodo (ej. 2026-1).");
      return;
    }

    try {
      setIsSubmitting(true);

      // Validar si ya existe otro periodo con el mismo nombre
      const existente = await db.periodos.where("nombre").equalsIgnoreCase(trimmed).first();
      if (existente && existente.id !== editingId) {
        setError(`El periodo "${trimmed}" ya se encuentra registrado.`);
        setIsSubmitting(false);
        return;
      }

      if (editingId !== null) {
        // Modo Edición
        await db.periodos.update(editingId, {
          nombre: trimmed,
        });
        setEditingId(null);
      } else {
        // Modo Creación
        await db.periodos.add({
          nombre: trimmed,
        });
      }

      setNombre("");
    } catch (err) {
      console.error("Error al guardar periodo:", err);
      setError("Ocurrió un error al guardar el periodo en la base de datos local.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminarPeriodo = async (periodo: Periodo) => {
    if (!periodo.id) return;
    const confirmacion = window.confirm(
      `¿Deseas eliminar el periodo "${periodo.nombre}"? Ten en cuenta que esto podría afectar asignaturas vinculadas.`
    );
    if (!confirmacion) return;

    try {
      if (editingId === periodo.id) {
        handleCancelarEdicion();
      }
      await db.periodos.delete(periodo.id);
    } catch (err) {
      console.error("Error al eliminar periodo:", err);
      alert("No se pudo eliminar el periodo.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <CalendarDays className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Configuración del Sistema</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Periodos Académicos
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Crea, edita y administra los semestres o ciclos lectivos en los que se dictan las asignaturas.
        </p>
      </div>

      {/* Formulario de creación / edición (Card) */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl transition-all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            {editingId !== null ? (
              <>
                <Pencil className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span>Editar Periodo Académico</span>
                <span className="text-xs font-mono font-normal text-zinc-500 dark:text-zinc-400">
                  (ID #{editingId})
                </span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <span>Registrar Nuevo Periodo</span>
              </>
            )}
          </h2>

          {editingId !== null && (
            <button
              type="button"
              onClick={handleCancelarEdicion}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancelar edición</span>
            </button>
          )}
        </div>

        <form onSubmit={handleGuardarPeriodo} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="nombrePeriodo" className="sr-only">
                Nombre del periodo
              </label>
              <input
                id="nombrePeriodo"
                type="text"
                placeholder="Nombre del periodo (ej. 2026-1, 2026-2)"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-zinc-900/10 dark:shadow-none"
              >
                {editingId !== null ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isSubmitting ? "Actualizando..." : "Actualizar Periodo"}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? "Guardando..." : "Guardar Periodo"}</span>
                  </>
                )}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={handleCancelarEdicion}
                  className="px-3.5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50 px-3.5 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Lista de Periodos (Card) */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            Periodos Registrados
          </h2>
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50 px-2 py-0.5 rounded">
            Total: {periodos ? periodos.length : 0}
          </span>
        </div>

        {periodos === undefined ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Cargando periodos desde IndexedDB...
          </div>
        ) : periodos.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">No hay periodos registrados aún</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Crea tu primer periodo académico arriba (por ejemplo: &quot;2026-1&quot;) para empezar a asociar asignaturas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/80 text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400 text-xs uppercase font-medium border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 w-24">ID</th>
                  <th className="px-6 py-3">Nombre del Periodo</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {periodos.map((periodo) => {
                  const isBeingEdited = editingId === periodo.id;

                  return (
                    <tr
                      key={periodo.id}
                      className={`transition-colors ${
                        isBeingEdited
                          ? "bg-zinc-100/70 dark:bg-zinc-800/40"
                          : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="px-6 py-3.5 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        #{periodo.id}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span>{periodo.nombre}</span>
                          {isBeingEdited && (
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                              Editando
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleIniciarEdicion(periodo)}
                            className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 p-1.5 rounded-lg transition-colors"
                            title="Editar periodo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEliminarPeriodo(periodo)}
                            className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                            title="Eliminar periodo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
