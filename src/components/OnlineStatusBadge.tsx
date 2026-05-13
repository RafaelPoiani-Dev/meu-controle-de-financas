import { Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export default function OnlineStatusBadge({ className }: Props) {
  const online = useOnlineStatus();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border",
        online
          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        className,
      )}
      title={online ? "Conectado" : "Sem conexão — alterações serão sincronizadas quando voltar online"}
    >
      {online ? <Wifi size={12} /> : <WifiOff size={12} />}
      <span>{online ? "Online" : "Offline"}</span>
    </div>
  );
}
