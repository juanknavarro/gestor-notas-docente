"use client";

import { useState, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ProgramaAcademico, limpiarBaseDeDatosLocal } from "@/lib/db";
import {
  generarBackupJSON,
  validarBackupJSON,
  restaurarBackupJSON,
  type BackupPayload,
} from "@/lib/backup";
import {
  Settings,
  Download,
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Database,
  Calendar,
  BookOpen,
  Users,
  FileText,
  CheckCircle2,
  HardDrive,
  FileJson,
  X,
  RefreshCw,
  Info,
  GraduationCap,
  Plus,
  Trash2,
  Pencil,
  Check,
  User,
  Loader2,
} from "lucide-react";

export default function ConfiguracionPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados para Perfil del Docente
  const configDocente = useLiveQuery(() => db.configuracion.get(1));
  const [nombreDocente, setNombreDocente] = useState("");
  const [isSavingDocente, setIsSavingDocente] = useState(false);
  const [docenteExito, setDocenteExito] = useState(false);

  useEffect(() => {
    if (configDocente?.nombreDocente !== undefined) {
      setNombreDocente(configDocente.nombreDocente);
    }
  }, [configDocente]);

  const handleGuardarDocente = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nombreDocente.trim();
    if (!trimmed) return;

    try {
      setIsSavingDocente(true);
      await db.configuracion.put({ id: 1, nombreDocente: trimmed });
      setDocenteExito(true);
      setTimeout(() => setDocenteExito(false), 3000);
    } catch (err) {
      console.error("Error al guardar docente:", err);
    } finally {
      setIsSavingDocente(false);
    }
  };

  // Estados locales
  const [isExporting, setIsExporting] = useState(false);
  const [exportExito, setExportExito] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [importExito, setImportExito] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Estados del modal de confirmación de restauración
  const [modalAbierto, setModalAbierto] = useState(false);
  const [payloadParaRestaurar, setPayloadParaRestaurar] = useState<BackupPayload | null>(null);
  const [archivoSeleccionadoNombre, setArchivoSeleccionadoNombre] = useState<string>("");

  // Estados para Modal de Borrado Seguro / Limpieza Profunda (Zona de Peligro)
  const [modalResetAbierto, setModalResetAbierto] = useState(false);
  const [confirmResetTexto, setConfirmResetTexto] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleAbrirModalReset = () => {
    setConfirmResetTexto("");
    setModalResetAbierto(true);
  };

  const handleCerrarModalReset = () => {
    if (isResetting) return;
    setConfirmResetTexto("");
    setModalResetAbierto(false);
  };

  const handleEjecutarReset = async () => {
    if (confirmResetTexto.trim() !== "BORRAR") return;

    try {
      setIsResetting(true);
      await limpiarBaseDeDatosLocal();
      // Recargar la aplicación desde la raíz limpiando memoria por completo
      window.location.replace("/");
    } catch (error) {
      console.error("Error al ejecutar la limpieza profunda:", error);
      alert("Ocurrió un error inesperado al limpiar los datos locales.");
      setIsResetting(false);
    }
  };

  // Estados del Catálogo de Programas Académicos
  const [nuevoPrograma, setNuevoPrograma] = useState("");
  const [programaError, setProgramaError] = useState<string | null>(null);
  const [programaExito, setProgramaExito] = useState<string | null>(null);
  const [isAddingPrograma, setIsAddingPrograma] = useState(false);

  // Estados para Edición de Programa Académico
  const [editingProgramaId, setEditingProgramaId] = useState<number | null>(null);
  const [editProgramaNombre, setEditProgramaNombre] = useState<string>("");
  const [isSavingProgramaEdit, setIsSavingProgramaEdit] = useState(false);

  // Conteo reactivo de métricas locales de Dexie
  const metricas = useLiveQuery(async () => {
    const periodos = await db.periodos.count();
    const asignaturas = await db.asignaturas.count();
    const estudiantes = await db.estudiantes.count();
    const notas = await db.notas.count();
    const socializaciones = await db.socializaciones.count();
    const programasCount = await db.programas.count();

    return {
      periodos,
      asignaturas,
      estudiantes,
      notas,
      socializaciones,
      programas: programasCount,
    };
  }, []);

  // Programas académicos registrados en tiempo real
  const programas = useLiveQuery(() => db.programas.toArray(), []);

  // 0. Manejadores del Catálogo de Programas
  const handleAgregarPrograma = async (e: React.FormEvent) => {
    e.preventDefault();
    setProgramaError(null);
    setProgramaExito(null);

    const trimmed = nuevoPrograma.trim();
    if (!trimmed) {
      setProgramaError("Por favor ingresa el nombre del programa académico.");
      return;
    }

    try {
      setIsAddingPrograma(true);
      const existente = await db.programas
        .where("nombre")
        .equalsIgnoreCase(trimmed)
        .first();

      if (existente) {
        setProgramaError(`El programa "${existente.nombre}" ya se encuentra registrado.`);
        return;
      }

      await db.programas.add({ nombre: trimmed });
      setNuevoPrograma("");
      setProgramaExito(`Programa "${trimmed}" agregado exitosamente al catálogo.`);
    } catch (err) {
      console.error("Error al registrar programa:", err);
      setProgramaError("Ocurrió un error al registrar el programa académico.");
    } finally {
      setIsAddingPrograma(false);
    }
  };

  const handleEliminarPrograma = async (prog: ProgramaAcademico) => {
    if (!prog.id) return;
    setProgramaError(null);
    setProgramaExito(null);

    const asignaturasAsociadas = await db.asignaturas
      .where("programa")
      .equals(prog.nombre)
      .count();

    const mensajeConfirm =
      asignaturasAsociadas > 0
        ? `El programa "${prog.nombre}" está asignado a ${asignaturasAsociadas} asignatura(s). ¿Deseas eliminarlo del catálogo? Las asignaturas actuales conservarán su nombre registrado.`
        : `¿Estás seguro de eliminar el programa "${prog.nombre}" del catálogo?`;

    if (!window.confirm(mensajeConfirm)) return;

    try {
      await db.programas.delete(prog.id);
      setProgramaExito(`Programa "${prog.nombre}" eliminado del catálogo.`);
    } catch (err) {
      console.error("Error al eliminar programa:", err);
      setProgramaError("No se pudo eliminar el programa.");
    }
  };

  const handleIniciarEdicionPrograma = (prog: ProgramaAcademico) => {
    if (!prog.id) return;
    setEditingProgramaId(prog.id);
    setEditProgramaNombre(prog.nombre);
    setProgramaError(null);
    setProgramaExito(null);
  };

  const handleCancelarEdicionPrograma = () => {
    setEditingProgramaId(null);
    setEditProgramaNombre("");
  };

  const handleGuardarEdicionPrograma = async (id: number) => {
    const trimmed = editProgramaNombre.trim();
    setProgramaError(null);
    setProgramaExito(null);

    if (!trimmed) {
      setProgramaError("El nombre del programa no puede estar vacío.");
      return;
    }

    try {
      setIsSavingProgramaEdit(true);

      // 1. Obtener el programa original para verificar y obtener el nombre viejo
      const programaOriginal = await db.programas.get(id);
      if (!programaOriginal) {
        setProgramaError("El programa seleccionado ya no existe.");
        handleCancelarEdicionPrograma();
        return;
      }

      // Si el nombre no cambió, simplemente salir del modo de edición
      if (programaOriginal.nombre === trimmed) {
        handleCancelarEdicionPrograma();
        return;
      }

      // 2. Validar que no colisione con otro programa ya existente (otro id)
      const colision = await db.programas
        .where("nombre")
        .equalsIgnoreCase(trimmed)
        .first();

      if (colision && colision.id !== id) {
        setProgramaError(`Ya existe otro programa registrado con el nombre "${colision.nombre}".`);
        return;
      }

      // 3. Transacción atómica en cascada que involucra ambas tablas
      let totalAsignaturasActualizadas = 0;
      await db.transaction("rw", db.programas, db.asignaturas, async () => {
        // Actualizar el nombre en el catálogo
        await db.programas.update(id, { nombre: trimmed });

        // Buscar asignaturas con el nombre viejo y actualizarlas al nuevo
        const asignaturasAfectadas = await db.asignaturas
          .where("programa")
          .equals(programaOriginal.nombre)
          .toArray();

        totalAsignaturasActualizadas = asignaturasAfectadas.length;
        for (const asig of asignaturasAfectadas) {
          if (asig.id) {
            await db.asignaturas.update(asig.id, { programa: trimmed });
          }
        }
      });

      handleCancelarEdicionPrograma();
      if (totalAsignaturasActualizadas > 0) {
        setProgramaExito(
          `Programa actualizado a "${trimmed}". Se actualizaron ${totalAsignaturasActualizadas} asignatura(s) vinculadas en cascada.`
        );
      } else {
        setProgramaExito(`Programa actualizado a "${trimmed}".`);
      }
    } catch (err) {
      console.error("Error al actualizar programa:", err);
      setProgramaError("Ocurrió un error al actualizar el programa académico.");
    } finally {
      setIsSavingProgramaEdit(false);
    }
  };

  const handleSincronizarProgramasExistentes = async () => {
    try {
      setProgramaError(null);
      setProgramaExito(null);
      const asignaturas = await db.asignaturas.toArray();
      const nombresUnicos = Array.from(
        new Set(asignaturas.map((a) => a.programa?.trim()).filter(Boolean))
      );

      let agregados = 0;
      for (const nombre of nombresUnicos) {
        const existe = await db.programas.where("nombre").equalsIgnoreCase(nombre).first();
        if (!existe) {
          await db.programas.add({ nombre });
          agregados++;
        }
      }

      if (agregados > 0) {
        setProgramaExito(`Se sincronizaron ${agregados} programa(s) desde tus asignaturas.`);
      } else {
        setProgramaExito("Todos los programas de tus asignaturas ya se encuentran en el catálogo.");
      }
    } catch (err) {
      console.error("Error al sincronizar programas:", err);
      setProgramaError("Ocurrió un error al sincronizar programas.");
    }
  };

  // 1. Manejador de Exportación (Descargar JSON)
  const handleExportarBackup = async () => {
    try {
      setIsExporting(true);
      setExportExito(null);
      setImportError(null);
      setImportExito(null);

      const jsonString = await generarBackupJSON();

      // Formatear nombre de archivo con marca de tiempo precisa
      const fecha = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestamp = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(
        fecha.getDate()
      )}_${pad(fecha.getHours())}${pad(fecha.getMinutes())}`;
      const nombreArchivo = `gestor-docente-backup-${timestamp}.json`;

      // Crear Blob y forzar descarga
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      setExportExito(`Copia de seguridad descargada exitosamente (${nombreArchivo}).`);
    } catch (err) {
      console.error("Error al exportar base de datos:", err);
      alert("Ocurrió un error al generar la copia de seguridad.");
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Manejador de Selección de Archivo (FileReader + Validación de 4 etapas)
  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoSeleccionadoNombre(file.name);
    setImportError(null);
    setImportExito(null);

    const reader = new FileReader();

    reader.onload = (event) => {
      const rawContent = event.target?.result as string;
      const resultado = validarBackupJSON(rawContent);

      if (!resultado.valido || !resultado.payload) {
        setImportError(resultado.error || "El archivo de respaldo no es válido.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Archivo validado con éxito: abrir modal de confirmación con previsualización
      setPayloadParaRestaurar(resultado.payload);
      setModalAbierto(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.onerror = () => {
      setImportError("No se pudo leer el archivo seleccionado.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    reader.readAsText(file);
  };

  // 3. Confirmación definitiva de Restauración (Transacción atómica destructiva)
  const handleConfirmarRestauracion = async () => {
    if (!payloadParaRestaurar) return;

    try {
      setIsRestoring(true);
      await restaurarBackupJSON(payloadParaRestaurar);

      setModalAbierto(false);
      setPayloadParaRestaurar(null);
      setImportExito("¡Base de datos restaurada correctamente! Todos los registros fueron sincronizados.");
    } catch (err) {
      console.error("Error al restaurar base de datos:", err);
      setImportError("Ocurrió un error inesperado al restaurar los datos en IndexedDB.");
      setModalAbierto(false);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCancelarRestauracion = () => {
    setModalAbierto(false);
    setPayloadParaRestaurar(null);
    setArchivoSeleccionadoNombre("");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <Settings className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Configuración del Sistema</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Respaldos y Base de Datos
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Administra la persistencia de datos local-first. Exporta copias de seguridad portables en formato JSON o restaura datos anteriores en este equipo.
        </p>
      </div>

      {/* SECCIÓN 1: Perfil del Docente Titular */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 rounded-lg">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                Perfil del Docente Titular
              </h2>
              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                Identidad oficial en informes institucionales
              </span>
            </div>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
            Global
          </span>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Ingresa tu nombre y apellidos. Este valor se inyectará de forma automática como docente responsable en los informes institucionales y exportaciones oficiales de Excel.
        </p>

        <form onSubmit={handleGuardarDocente} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ej. Juan Carlos Navarro Ramos"
              value={nombreDocente}
              onChange={(e) => setNombreDocente(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingDocente || !nombreDocente.trim()}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-40 shrink-0"
          >
            {docenteExito ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Guardado</span>
              </>
            ) : (
              <span>{isSavingDocente ? "Guardando..." : "Guardar Perfil"}</span>
            )}
          </button>
        </form>

        {docenteExito && (
          <div className="flex items-center gap-2 p-2.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Nombre del docente actualizado correctamente.</span>
          </div>
        )}
      </div>

      {/* Input oculto para carga de archivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleSeleccionarArchivo}
        className="hidden"
      />

      {/* Grid de 2 Bloques: Zona Segura vs Zona de Precaución */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* BLOQUE 1: ZONA SEGURA (Exportación) */}
        <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    Exportar Copia de Seguridad
                  </h2>
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Acción segura (No modifica tus datos)
                  </span>
                </div>
              </div>

              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                JSON
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Descarga un archivo con toda la información registrada en el gestor: periodos académicos, asignaturas, actividades, estudiantes matriculados, calificaciones y bitácora de socializaciones.
            </p>

            {/* Tarjeta de Métricas Locales Actuales */}
            <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/80 dark:bg-zinc-950/80 dark:border-zinc-800/80 space-y-2.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
                Datos almacenados actualmente en este navegador:
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metricas?.periodos ?? 0} periodo(s)</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metricas?.programas ?? 0} programa(s)</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metricas?.asignaturas ?? 0} asignatura(s)</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metricas?.estudiantes ?? 0} estudiante(s)</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 col-span-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{metricas?.notas ?? 0} calificación(es) registradas</span>
                </div>
              </div>
            </div>

            {exportExito && (
              <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{exportExito}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleExportarBackup}
              disabled={isExporting}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando copia...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Descargar Copia de Seguridad (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* BLOQUE 2: ZONA DE PRECAUCIÓN (Restauración) */}
        <div className="bg-white border border-amber-200/80 shadow-sm dark:bg-zinc-900/50 dark:border-amber-900/40 dark:shadow-none rounded-xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded-lg">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    Restaurar Base de Datos
                  </h2>
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Zona de precaución (Reemplaza datos)
                  </span>
                </div>
              </div>

              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold uppercase">
                Peligro
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Carga un archivo de respaldo generado previamente para restaurar el estado completo de tus asignaturas. El archivo pasará por una validación de seguridad antes de solicitar confirmación.
            </p>

            {/* Banner de Advertencia Preventivo */}
            <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Advertencia de sobreescritura:</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal pl-5">
                Al confirmar la restauración, todos los datos actuales de este navegador serán reemplazados por los contenidos en el archivo .json seleccionado.
              </p>
            </div>

            {importError && (
              <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/60 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{importError}</span>
              </div>
            )}

            {importExito && (
              <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{importExito}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:text-zinc-100 dark:border-zinc-700 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <UploadCloud className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>Seleccionar Archivo de Respaldo (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN: CATÁLOGO DE PROGRAMAS ACADÉMICOS */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 rounded-xl">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-zinc-900 dark:text-zinc-50">
                Catálogo de Programas Académicos
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Estandariza los programas disponibles para vincular a tus asignaturas y grupos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSincronizarProgramasExistentes}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors flex items-center gap-1.5"
              title="Importar nombres de programas ya registrados en tus asignaturas"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar desde Asignaturas</span>
            </button>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
              {programas ? programas.length : 0} programa(s)
            </span>
          </div>
        </div>

        {/* Formulario para agregar programa */}
        <form onSubmit={handleAgregarPrograma} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="nuevoProgramaInput"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Nuevo Programa Académico
              </label>
              <input
                id="nuevoProgramaInput"
                type="text"
                placeholder="Ej. Ingeniería de Sistemas, Medicina, Psicología..."
                value={nuevoPrograma}
                onChange={(e) => setNuevoPrograma(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              />
            </div>
            <div className="sm:self-end">
              <button
                type="submit"
                disabled={isAddingPrograma}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingPrograma ? "Guardando..." : "Agregar Programa"}</span>
              </button>
            </div>
          </div>

          {programaError && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/60 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{programaError}</span>
            </div>
          )}

          {programaExito && (
            <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{programaExito}</span>
            </div>
          )}
        </form>

        {/* Lista de programas registrados */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
            Programas Activos en el Sistema
          </span>

          {programas && programas.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {programas.map((prog) => {
                const isEditing = editingProgramaId === prog.id;
                return (
                  <div
                    key={prog.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                      isEditing
                        ? "bg-white border-zinc-400 dark:bg-zinc-900 dark:border-zinc-600 shadow-2xs ring-1 ring-zinc-300 dark:ring-zinc-700"
                        : "bg-zinc-50 border-zinc-200/80 dark:bg-zinc-950/70 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editProgramaNombre}
                          onChange={(e) => setEditProgramaNombre(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleGuardarEdicionPrograma(prog.id!);
                            } else if (e.key === "Escape") {
                              handleCancelarEdicionPrograma();
                            }
                          }}
                          autoFocus
                          disabled={isSavingProgramaEdit}
                          className="flex-1 min-w-0 px-2 py-1 text-xs rounded bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-100 dark:focus:border-zinc-500 transition-colors"
                          placeholder="Nombre del programa"
                        />
                        <button
                          type="button"
                          onClick={() => handleGuardarEdicionPrograma(prog.id!)}
                          disabled={isSavingProgramaEdit}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 rounded-md transition-colors shrink-0 disabled:opacity-50"
                          title="Guardar cambios y actualizar en cascada"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelarEdicionPrograma}
                          disabled={isSavingProgramaEdit}
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors shrink-0"
                          title="Cancelar edición"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <GraduationCap className="w-4 h-4 text-zinc-400 shrink-0" />
                          <span
                            className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate"
                            title={prog.nombre}
                          >
                            {prog.nombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleIniciarEdicionPrograma(prog)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            title={`Editar "${prog.nombre}"`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarPrograma(prog)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                            title={`Eliminar "${prog.nombre}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
              <GraduationCap className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Aún no has registrado programas académicos
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Agrega tu primer programa usando el formulario superior o sincroniza los que ya tengas en tus asignaturas.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. ZONA DE PELIGRO: RESTABLECIMIENTO DE FÁBRICA / LIMPIEZA PROFUNDA */}
      <div className="rounded-xl border border-rose-300 bg-rose-50/40 p-6 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/20 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-rose-950 dark:text-rose-200 tracking-tight">
                Zona de Peligro: Restablecimiento de Fábrica
              </h2>
            </div>
            <p className="text-xs text-rose-800/90 dark:text-rose-300/80 max-w-2xl leading-relaxed mt-1">
              Esta acción purga de forma permanente e irrecuperable todas las asignaturas, periodos, notas, cortes, estudiantes matriculados y datos del docente almacenados en este navegador. <strong>Recomendado si utilizas un equipo de uso compartido, sala de cómputo o computador del aula</strong> para no dejar ningún rastro de tu información.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAbrirModalReset}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-rose-900/20 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Restablecer y Borrar Datos Locales</span>
          </button>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE SEGURIDAD (Destructivo - Restauración) */}
      {modalAbierto && payloadParaRestaurar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">
                    Confirmar Restauración de Base de Datos
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                    {archivoSeleccionadoNombre}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelarRestauracion}
                disabled={isRestoring}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-4">
              {/* Banner Rojo de Peligro Crítico */}
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold uppercase tracking-wide">
                    ¡Advertencia crítica de sobreescritura!
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Esta acción es <strong>destructiva e irreversible</strong>. Todos los periodos, asignaturas, actividades, estudiantes y calificaciones guardados actualmente en este navegador serán reemplazados por los datos contenidos en este archivo.
                  </p>
                </div>
              </div>

              {/* Previsualización del Contenido del Respaldo */}
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 dark:bg-zinc-950 dark:border-zinc-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">
                    Fecha de creación del respaldo:
                  </span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {new Date(
                      payloadParaRestaurar.metadata.fechaExportacion
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2 space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                    Registros que se importarán:
                  </span>

                  <div className="grid grid-cols-2 gap-2 font-mono text-zinc-700 dark:text-zinc-300">
                    <div>• Periodos: {payloadParaRestaurar.data.periodos?.length ?? 0}</div>
                    <div>• Asignaturas: {payloadParaRestaurar.data.asignaturas?.length ?? 0}</div>
                    <div>• Estudiantes: {payloadParaRestaurar.data.estudiantes?.length ?? 0}</div>
                    <div>• Calificaciones: {payloadParaRestaurar.data.notas?.length ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelarRestauracion}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRestauracion}
                disabled={isRestoring}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-rose-900/20 disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restaurando datos...</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Sobreescribir y Restaurar Datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ALTA SEGURIDAD: RESTABLECIMIENTO DE FÁBRICA */}
      {modalResetAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
            {/* Cabecera del Modal */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">
                    Confirmar Restablecimiento Absoluto
                  </h3>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    Acción crítica e irreversible
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCerrarModalReset}
                disabled={isResetting}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-4">
              {/* Banner de Impacto de Datos */}
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-2">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Estás a punto de borrar:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono font-medium text-xs pt-1 border-t border-rose-200/60 dark:border-rose-900/40">
                  <div>• {metricas?.asignaturas ?? 0} asignaturas</div>
                  <div>• {metricas?.estudiantes ?? 0} estudiantes</div>
                  <div>• {metricas?.periodos ?? 0} periodos</div>
                  <div>• {metricas?.notas ?? 0} calificaciones</div>
                </div>
              </div>

              {/* Advertencia de Respaldo */}
              <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                <strong>Advertencia de Respaldo:</strong> Sin un archivo de respaldo previo (descargado en formato <code>.json</code> desde la sección superior), <strong>toda tu información se perderá irremediablemente</strong> y no podrá ser recuperada en ningún dispositivo.
              </div>

              {/* Input de confirmación con palabra clave */}
              <div className="space-y-2 pt-1">
                <label
                  htmlFor="confirmResetInput"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-normal"
                >
                  Para confirmar la eliminación, escribe la palabra{" "}
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    BORRAR
                  </span>{" "}
                  en el campo a continuación:
                </label>
                <input
                  id="confirmResetInput"
                  type="text"
                  value={confirmResetTexto}
                  onChange={(e) => setConfirmResetTexto(e.target.value)}
                  placeholder="Escribe BORRAR para desbloquear"
                  disabled={isResetting}
                  autoComplete="off"
                  className="w-full px-3.5 py-2 text-sm font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-rose-500 dark:focus:ring-rose-500 transition-colors"
                />
              </div>
            </div>

            {/* Acciones del Modal */}
            <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCerrarModalReset}
                disabled={isResetting}
                className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleEjecutarReset}
                disabled={confirmResetTexto.trim() !== "BORRAR" || isResetting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-sm shadow-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-rose-600"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando datos locales...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar definitivamente todos los datos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
