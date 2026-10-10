import { Suspense, use } from "react";
import { AsignaturaDetailClient } from "@/components/AsignaturaDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

function AsignaturaContent({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  const asignaturaId = Number(resolved.id);

  return <AsignaturaDetailClient asignaturaId={asignaturaId} />;
}

export default function AsignaturaPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-6xl mx-auto">
          <div className="p-8 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl text-zinc-500 text-sm">
            Cargando información de la asignatura...
          </div>
        </div>
      }
    >
      <AsignaturaContent params={params} />
    </Suspense>
  );
}
