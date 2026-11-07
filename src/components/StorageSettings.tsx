import { StorageQuotaMeter } from "@/components/StorageQuotaMeter";
import { ManualLocalBackup } from "@/components/ManualLocalBackup";

export function StorageSettings() {
  return (
    <div className="space-y-4 max-w-5xl">
      <ManualLocalBackup quotaCard={<StorageQuotaMeter />} />
    </div>
  );
}
export default StorageSettings;

