import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useClients, useBookings, useVendors, useExpenses } from "@/hooks/useStorage";
import { exportToExcel, downloadFile } from "@/lib/excelExport";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function ExportManager() {
  const { toast } = useToast();
  const { clients = [] } = useClients();
  const { bookings = [] } = useBookings();
  const { vendors = [] } = useVendors();
  const { expenses = [] } = useExpenses();
  
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = {
        clients,
        bookings,
        vendors,
        expenses,
      };

      const blob = await exportToExcel(data, {
        includeClients: true,
        includeBookings: true,
        includeVendors: true,
        includeExpenses: true,
      });

      const dateStr = format(new Date(), 'yyyy-MM-dd');
      downloadFile(blob, `travelpro-export-${dateStr}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Your data has been exported to Excel with 4 sheets",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Export to Excel
        </CardTitle>
        <CardDescription>
          Download all your data (Clients, Bookings, Vendors, Expenses) in Excel format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleExport}
          disabled={exporting}
          className="w-full"
        >
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
