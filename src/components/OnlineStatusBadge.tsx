import { Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { cn } from "@/lib/utils";

interface Props {
  userId?: string;
  className?: string;
}

export default function OnlineStatusBadge({ userId, className }: Props) {
  const { online, syncing, pendingCount, triggerSync } = useSyncStatus(userId);

  let label = online ? "Online" : "Offline";
  let Icon = online ? Wifi : WifiOff;
  let tone = online ? "ok" : "warn";

  if (syncing) {
    label = "Sincronizando";
    Icon = RefreshCw;
    tone = "info";
  } else if (online && pendingCount > 0) {
    label = `${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`;
    Icon = CloudUpload;
    tone = "info";
  } else if (!online && pendingCount > 0) {
    label = `Offline · ${pendingCount}`;
    Icon = WifiOff;
    tone = "warn";
  }

  const toneClasses =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
      : "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400";

  return (
    <button
      type="button"
      onClick={triggerSync}
      disabled={!online || syncing}
      title={
        !online
          ? "Sem conexão. Suas alterações serão enviadas quando voltar online."
          : pendingCount > 0
          ? "Clique para sincronizar agora"
          : "Tudo sincronizado"
      }
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-opacity",
        toneClasses,
        "disabled:cursor-default",
        className,
      )}
    >
      <Icon size={12} className={syncing ? "animate-spin" : ""} />
      <span>{label}</span>
    </button>
  );
}
