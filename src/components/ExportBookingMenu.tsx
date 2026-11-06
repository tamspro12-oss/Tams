import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, FileSpreadsheet, Download, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ExportBookingMenuProps {
  selectedCount: number;
  onExportPDF: () => void;
  onExportExcel: () => void;
  isExporting: boolean;
}

export function ExportBookingMenu({ 
  selectedCount, 
  onExportPDF, 
  onExportExcel,
  isExporting 
}: ExportBookingMenuProps) {
  const [open, setOpen] = useState(false);
  
  const handleExport = (exportFn: () => void) => {
    exportFn();
    setOpen(false);
  };
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          disabled={selectedCount === 0 || isExporting}
          className="gap-2"
        >
          <FileDown className="w-4 h-4" />
          Export Client Booking
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport(onExportPDF)}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="font-medium">Export as PDF</span>
            <span className="text-xs text-muted-foreground">
              {selectedCount} booking{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport(onExportExcel)}
          disabled={isExporting}
          className="gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <div className="flex flex-col">
            <span className="font-medium">Export as Excel</span>
            <span className="text-xs text-muted-foreground">
              All data in spreadsheet format
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
