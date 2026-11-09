import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useClients, useBookings, useVendors, useExpenses } from "@/hooks/useStorage";
import {
  parseExcelFile,
  parseCSVFile,
  validateClientData,
  validateVendorData,
  validateBookingData,
  validateExpenseData,
  mapClientData,
  mapVendorData,
  mapBookingData,
  mapExpenseData,
} from "@/lib/dataImporter";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type DataType = 'clients' | 'vendors' | 'bookings' | 'expenses';

interface DataImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DataImportDialog({ open, onOpenChange }: DataImportDialogProps) {
  const { toast } = useToast();
  const { addClient } = useClients();
  const { addBooking } = useBookings();
  const { addVendor } = useVendors();
  const { addExpense } = useExpenses();

  const [dataType, setDataType] = useState<DataType>('clients');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [step, setStep] = useState<'select' | 'preview' | 'result'>('select');
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setPreview([]);

    try {
      const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
      let data: any[] = [];

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        data = await parseExcelFile(selectedFile);
      } else if (fileExtension === 'csv') {
        data = await parseCSVFile(selectedFile);
      } else {
        throw new Error('Unsupported file format. Please use Excel (.xlsx, .xls) or CSV (.csv) files.');
      }

      // Validate and preview first 5 rows
      const validationErrors: Array<{ row: number; error: string }> = [];
      const validRows: any[] = [];

      data.forEach((row, index) => {
        let validation;
        switch (dataType) {
          case 'clients':
            validation = validateClientData(row, index);
            break;
          case 'vendors':
            validation = validateVendorData(row, index);
            break;
          case 'bookings':
            validation = validateBookingData(row, index);
            break;
          case 'expenses':
            validation = validateExpenseData(row, index);
            break;
        }

        if (!validation.valid) {
          validationErrors.push({ row: index + 1, error: validation.error || 'Unknown error' });
        } else {
          validRows.push(row);
        }
      });

      setErrors(validationErrors);
      setPreview(validRows.slice(0, 5));

      if (validRows.length > 0) {
        setStep('preview');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse file",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let data: any[] = [];

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        data = await parseExcelFile(file);
      } else if (fileExtension === 'csv') {
        data = await parseCSVFile(file);
      }

      for (const row of data) {
        try {
          let mappedData;
          let validation;

          switch (dataType) {
            case 'clients':
              validation = validateClientData(row, 0);
              if (validation.valid) {
                mappedData = mapClientData(row);
                await addClient.mutateAsync(mappedData);
                successCount++;
              } else {
                failCount++;
              }
              break;
            case 'vendors':
              validation = validateVendorData(row, 0);
              if (validation.valid) {
                mappedData = mapVendorData(row);
                await addVendor.mutateAsync(mappedData);
                successCount++;
              } else {
                failCount++;
              }
              break;
            case 'bookings':
              validation = validateBookingData(row, 0);
              if (validation.valid) {
                mappedData = mapBookingData(row);
                await addBooking.mutateAsync(mappedData);
                successCount++;
              } else {
                failCount++;
              }
              break;
            case 'expenses':
              validation = validateExpenseData(row, 0);
              if (validation.valid) {
                mappedData = mapExpenseData(row);
                await addExpense.mutateAsync(mappedData);
                successCount++;
              } else {
                failCount++;
              }
              break;
          }
        } catch (error) {
          failCount++;
        }
      }

      setResult({ success: successCount, failed: failCount });
      setStep('result');

      toast({
        title: "Import Complete",
        description: `Successfully imported ${successCount} records. ${failCount} failed.`,
      });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setStep('select');
    setFile(null);
    setPreview([]);
    setErrors([]);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetDialog(); }}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data from Excel/CSV</DialogTitle>
          <DialogDescription>
            Upload a file to import {dataType} data into your system
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={dataType} onValueChange={(value) => setDataType(value as DataType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clients">Clients</SelectItem>
                  <SelectItem value="vendors">Vendors</SelectItem>
                  <SelectItem value="bookings">Bookings</SelectItem>
                  <SelectItem value="expenses">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={importing}
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: Excel (.xlsx, .xls) and CSV (.csv)
              </p>
            </div>

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                Make sure your file has the correct column headers. Required columns vary by data type.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Found {preview.length} valid records. Preview of first 5 rows shown below.
              </AlertDescription>
            </Alert>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errors.length} validation errors found. These rows will be skipped.
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">Show errors</summary>
                    <ul className="mt-2 list-disc list-inside">
                      {errors.slice(0, 10).map((err, idx) => (
                        <li key={idx}>{err.error}</li>
                      ))}
                    </ul>
                  </details>
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {preview[0] && Object.keys(preview[0]).map(key => (
                      <th key={key} className="px-4 py-2 text-left font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      {Object.values(row).map((value: any, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2">{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button onClick={resetDialog} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing} className="flex-1">
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {preview.length} Records
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Import completed successfully!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{result.success}</div>
                <div className="text-sm text-muted-foreground">Records Imported</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{result.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            <Button onClick={() => { resetDialog(); onOpenChange(false); }} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
