import type { Actividad, EscalaCalificaciones } from "./db";
import { ESCALA_DEFAULT } from "./db";

export type CategoriaDesempeno = "Bajo" | "Aceptable" | "Competente" | "Excelente";

export interface EstudianteConNota {
  estudianteId: number;
  nombreCompleto: string;
  identificacion: string;
  definitiva: number;
  categoria: CategoriaDesempeno;
}

export interface CategoriaResumen {
  count: number;
  porcentaje: number;
  estudiantes: EstudianteConNota[];
}

export interface DistribucionResultados {
  bajo: CategoriaResumen;
  aceptable: CategoriaResumen;
  competente: CategoriaResumen;
  excelente: CategoriaResumen;
  promedioGrupo: number;
  totalEvaluados: number;
  tasaAprobacion: number; // Porcentaje >= 3.0
  totalAprobados: number;
  totalReprobados: number;
}

export interface DetalleDefinitivaCorte {
  definitiva: number; // Redondeada a 1 decimal como valor lógico oficial (ej: 3.0)
  definitivaExacta: number; // Valor continuo flotante antes del redondeo (ej: 2.964)
  aprobado: boolean; // definitiva >= 3.0
  esArrastre: boolean; // definitivaExacta < 3.0 && definitiva >= 3.0 (ej: 2.95 - 2.99)
}

/**
 * Calcula la calificación definitiva de un estudiante en un corte dado con detalle
 * de aproximación decimal para alimentar la lógica del semáforo visual.
 */
export function calcularDetalleDefinitivaCorte(
  estudianteId: number,
  actividades: Actividad[] | undefined | null,
  notasMap: Map<string, number>,
  pesoCorte: number
): DetalleDefinitivaCorte | null {
  if (!actividades || actividades.length === 0) return null;

  const actividadesRegulares = actividades.filter((a) => !a.esBonificacion);
  const actividadesBono = actividades.filter((a) => a.esBonificacion);

  // 1. Definitiva base ponderada de actividades regulares
  let definitivaBase = 0;
  if (actividadesRegulares.length > 0) {
    let sumaTotal = 0;
    for (const act of actividadesRegulares) {
      const nota = notasMap.get(`${estudianteId}_${act.id}`) ?? 0;
      sumaTotal += nota * (act.porcentaje / 100);
    }
    // Fórmula reglamentaria: Definitiva_Corte = Suma_Total / (Peso_Corte / 100)
    definitivaBase = pesoCorte > 0 ? sumaTotal / (pesoCorte / 100) : 0;
  }

  // 2. Suma directa de décimas de bonificación
  let sumaBonos = 0;
  for (const act of actividadesBono) {
    const bono = notasMap.get(`${estudianteId}_${act.id}`) ?? 0;
    sumaBonos += bono;
  }

  // 3. Definitiva final continua con tope máximo en 5.0
  const definitivaExacta = Math.min(definitivaBase + sumaBonos, 5.0);
  // Redondeo matemático oficial a 1 decimal como valor real de la lógica (ej. 2.96 -> 3.0)
  const definitiva = Number(definitivaExacta.toFixed(1));
  const aprobado = definitiva >= 3.0;
  const esArrastre = definitivaExacta < 3.0 && definitiva >= 3.0;

  return {
    definitiva,
    definitivaExacta,
    aprobado,
    esArrastre,
  };
}

/**
 * Calcula la calificación definitiva oficial de un estudiante en un corte dado.
 * Pondera las actividades regulares (pesoCorte) y suma directamente las bonificaciones.
 * Devuelve el número redondeado a 1 decimal como valor real de la lógica (ej. 2.96 -> 3.0).
 * Aplica tope máximo institucional de 5.0.
 */
export function calcularDefinitivaCorte(
  estudianteId: number,
  actividades: Actividad[] | undefined | null,
  notasMap: Map<string, number>,
  pesoCorte: number
): number | null {
  const detalle = calcularDetalleDefinitivaCorte(
    estudianteId,
    actividades,
    notasMap,
    pesoCorte
  );
  return detalle !== null ? detalle.definitiva : null;
}

export type EstadoSemaforoNota = "reprobado" | "arrastre" | "aprobado";

/**
 * Determina el estado del semáforo para una nota:
 * - ROJO (Reprobado): notaRedondeada < 3.0
 * - AMARILLO/NARANJA (Aprobado por arrastre): notaExacta < 3.0 pero notaRedondeada es 3.0 (ej. 2.95, 2.98)
 * - VERDE (Aprobado sólido): notaExacta >= 3.0
 */
export function determinarEstadoSemaforoNota(
  notaRedondeada: number,
  notaExacta?: number | null
): EstadoSemaforoNota {
  if (notaRedondeada < 3.0) return "reprobado";
  if (notaExacta !== undefined && notaExacta !== null) {
    if (notaExacta < 3.0 && notaRedondeada >= 3.0) return "arrastre";
    return "aprobado";
  }
  return "aprobado";
}

/**
 * Retorna las clases de estilo de Tailwind según la regla de 3 estados:
 * - ROJO (Reprobado): text-rose-600 / bg-rose-50
 * - AMARILLO/NARANJA (Aprobado por arrastre): text-amber-500/600 / bg-amber-50
 * - VERDE (Aprobado sólido): text-emerald-600 / bg-emerald-50
 */
export function obtenerClasesSemaforoNota(
  notaRedondeada: number,
  notaExacta?: number | null,
  formato: "badge" | "texto" = "badge"
): string {
  const estado = determinarEstadoSemaforoNota(notaRedondeada, notaExacta);

  if (estado === "reprobado") {
    return formato === "badge"
      ? "text-rose-700 bg-rose-50 border border-rose-200/80 dark:text-rose-400 dark:bg-rose-950/40 dark:border-rose-900/60"
      : "text-rose-600 dark:text-rose-400";
  }

  if (estado === "arrastre") {
    return formato === "badge"
      ? "text-amber-700 bg-amber-50 border border-amber-300 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-800/70"
      : "text-amber-500 dark:text-amber-400";
  }

  // Aprobado sólido
  return formato === "badge"
    ? "text-emerald-700 bg-emerald-50 border border-emerald-200/80 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/60"
    : "text-emerald-600 dark:text-emerald-400";
}

/**
 * Clasifica la calificación definitiva de un estudiante en una de las 4 categorías
 * de Resultados de Aprendizaje institucional:
 * - Bajo: 0.0 a bajoMax (Reprobado)
 * - Aceptable: aceptableMin a aceptableMax (Aprobado)
 * - Competente: competenteMin a competenteMax (Aprobado)
 * - Excelente: excelenteMin a 5.0 (Aprobado)
 */
export function clasificarResultadoAprendizaje(
  nota: number,
  escala: EscalaCalificaciones = ESCALA_DEFAULT
): CategoriaDesempeno {
  const esc = escala ?? ESCALA_DEFAULT;
  if (nota <= esc.bajoMax) return "Bajo";
  if (nota <= esc.aceptableMax) return "Aceptable";
  if (nota <= esc.competenteMax) return "Competente";
  return "Excelente";
}

export interface ProyeccionCorte3 {
  acumulado70: number; // Puntos acumulados sobre el 70% (0.0 a 3.5)
  notaRequeridaCorte3: number; // Nota mínima requerida en el Corte 3 (sobre 5.0)
  estado: "ya_aprobo" | "alcanzable" | "dificil" | "imposible" | "pendiente";
  mensaje: string;
  corte1Presente: boolean;
  corte2Presente: boolean;
}

/**
 * Calcula la proyección requerida en el Corte 3 (30%) para alcanzar la definitiva mínima aprobatoria (3.0).
 *
 * Fórmula reglamentaria:
 *   Acumulado_70 = (Definitiva_Corte1 * 0.35) + (Definitiva_Corte2 * 0.35)
 *   Nota_Requerida_Corte3 = (3.0 - Acumulado_70) / 0.30
 */
export function calcularProyeccionCorte3(
  definitivaCorte1: number | null,
  definitivaCorte2: number | null
): ProyeccionCorte3 {
  const corte1Presente = definitivaCorte1 !== null;
  const corte2Presente = definitivaCorte2 !== null;

  const c1 = definitivaCorte1 ?? 0;
  const c2 = definitivaCorte2 ?? 0;

  // Si ninguno de los dos cortes tiene actividades/notas registradas
  if (!corte1Presente && !corte2Presente) {
    return {
      acumulado70: 0,
      notaRequeridaCorte3: 3.0,
      estado: "pendiente",
      mensaje: "Sin notas registradas",
      corte1Presente: false,
      corte2Presente: false,
    };
  }

  // Acumulado real sobre el 70%
  const acumulado70 = Number(((c1 * 0.35) + (c2 * 0.35)).toFixed(2));

  // Nota requerida en el Corte 3 (30%) para llegar a 3.0
  const requeridaExacta = (3.0 - acumulado70) / 0.30;
  const notaRequeridaCorte3 = Number(requeridaExacta.toFixed(2));

  // Semáforo de estados
  if (notaRequeridaCorte3 <= 0) {
    return {
      acumulado70,
      notaRequeridaCorte3: 0.0,
      estado: "ya_aprobo",
      mensaje: "¡Materia Aprobada! (0.0)",
      corte1Presente,
      corte2Presente,
    };
  }

  if (notaRequeridaCorte3 <= 3.0) {
    return {
      acumulado70,
      notaRequeridaCorte3,
      estado: "alcanzable",
      mensaje: `Alcanzable (${notaRequeridaCorte3.toFixed(1)})`,
      corte1Presente,
      corte2Presente,
    };
  }

  if (notaRequeridaCorte3 <= 5.0) {
    return {
      acumulado70,
      notaRequeridaCorte3,
      estado: "dificil",
      mensaje: `Exigente (${notaRequeridaCorte3.toFixed(1)})`,
      corte1Presente,
      corte2Presente,
    };
  }

  return {
    acumulado70,
    notaRequeridaCorte3,
    estado: "imposible",
    mensaje: `Reprobado (${notaRequeridaCorte3.toFixed(1)} > 5.0)`,
    corte1Presente,
    corte2Presente,
  };
}

export interface DefinitivaAsignatura {
  notaFinal: number; // Redondeada a 1 decimal (escala 0.0 - 5.0)
  notaFinalExacta: number; // Valor con precisión flotante
  aporteC1: number; // (Definitiva_C1 * peso1 / 100)
  aporteC2: number; // (Definitiva_C2 * peso2 / 100)
  aporteC3: number; // (Definitiva_C3 * peso3 / 100)
  aprobado: boolean; // true si notaFinal >= 3.0
  categoria: CategoriaDesempeno; // "Bajo" | "Aceptable" | "Competente" | "Excelente"
  esArrastre: boolean; // notaFinalExacta < 3.0 && notaFinal >= 3.0
  corte1Presente: boolean;
  corte2Presente: boolean;
  corte3Presente: boolean;
}

/**
 * Calcula la calificación definitiva semestral al 100% de la asignatura:
 * Nota_Final = (Definitiva_C1 * 0.35) + (Definitiva_C2 * 0.35) + (Definitiva_C3 * 0.30)
 * Aplica tope máximo de 5.0 y categorización de aprendizaje institucional.
 */
export function calcularDefinitivaAsignatura(
  defC1: number | null,
  defC2: number | null,
  defC3: number | null,
  peso1: number = 35,
  peso2: number = 35,
  peso3: number = 30,
  escala?: EscalaCalificaciones
): DefinitivaAsignatura {
  const c1 = defC1 ?? 0;
  const c2 = defC2 ?? 0;
  const c3 = defC3 ?? 0;

  const aporteC1 = Number(((c1 * peso1) / 100).toFixed(3));
  const aporteC2 = Number(((c2 * peso2) / 100).toFixed(3));
  const aporteC3 = Number(((c3 * peso3) / 100).toFixed(3));

  const suma = aporteC1 + aporteC2 + aporteC3;
  const notaFinalExacta = Math.min(suma, 5.0);
  const notaFinal = Number(Math.min(suma, 5.0).toFixed(1));

  return {
    notaFinal,
    notaFinalExacta,
    aporteC1,
    aporteC2,
    aporteC3,
    aprobado: notaFinal >= 3.0,
    categoria: clasificarResultadoAprendizaje(notaFinal, escala),
    esArrastre: notaFinalExacta < 3.0 && notaFinal >= 3.0,
    corte1Presente: defC1 !== null,
    corte2Presente: defC2 !== null,
    corte3Presente: defC3 !== null,
  };
}

