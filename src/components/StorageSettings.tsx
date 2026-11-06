import { StorageQuotaMeter } from "@/components/StorageQuotaMeter";
import { ManualLocalBackup } from "@/components/ManualLocalBackup";

export function StorageSettings() {
  return (
    <div className="space-y-4">
      {/* 2-Column Responsive Compact Grid for Zero-Scroll Fit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="w-full">
          <StorageQuotaMeter />
        </div>
        <div className="w-full">
          <ManualLocalBackup />
        </div>
      </div>
    </div>
  );
}
export default StorageSettings;

