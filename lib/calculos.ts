import type { Actividad } from "./db";

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

/**
 * Calcula la calificación definitiva de un estudiante en un corte dado.
 * Pondera las actividades regulares (pesoCorte) y suma directamente las bonificaciones.
 * Aplica tope máximo institucional de 5.0.
 */
export function calcularDefinitivaCorte(
  estudianteId: number,
  actividades: Actividad[] | undefined | null,
  notasMap: Map<string, number>,
  pesoCorte: number
): number | null {
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

  // 3. Definitiva final con tope máximo en 5.0
  const definitivaFinal = Math.min(definitivaBase + sumaBonos, 5.0);
  return definitivaFinal;
}

/**
 * Clasifica la calificación definitiva de un estudiante en una de las 4 categorías
 * de Resultados de Aprendizaje institucional:
 * - Bajo: 0.0 a 2.9 (Reprobado)
 * - Aceptable: 3.0 a 3.9 (Aprobado)
 * - Competente: 4.0 a 4.5 (Aprobado)
 * - Excelente: 4.6 a 5.0 (Aprobado)
 */
export function clasificarResultadoAprendizaje(nota: number): CategoriaDesempeno {
  if (nota < 3.0) return "Bajo";
  if (nota <= 3.9) return "Aceptable";
  if (nota <= 4.5) return "Competente";
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
