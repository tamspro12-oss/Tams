import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, FileText, Scale } from 'lucide-react';

interface PolicyAcknowledgmentModalProps {
  open: boolean;
  onAcknowledge: () => Promise<boolean>;
}

export const PolicyAcknowledgmentModal = ({
  open,
  onAcknowledge,
}: PolicyAcknowledgmentModalProps) => {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleAgree = async () => {
    if (!agreed) return;

    setSaving(true);
    const success = await onAcknowledge();
    setSaving(false);

    if (success) {
      setAgreed(false);
    }
  };

  return (
    <Dialog open={open} modal>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            Privacy Policy & Terms of Service
          </DialogTitle>
          <DialogDescription>
            Please review and accept our policies to continue using TAMS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-muted-foreground">
            By using TAMS, you agree to our:
          </p>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/privacy')}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <FileText className="w-4 h-4" />
              Privacy Policy
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              onClick={() => navigate('/terms')}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Scale className="w-4 h-4" />
              Terms of Service
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-start space-x-2 pt-4 border-t">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
            />
            <label
              htmlFor="agree"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and agree to the Privacy Policy and Terms of Service
            </label>
          </div>
        </div>

        <div className="flex justify-end flex-shrink-0 pt-4 border-t">
          <Button
            onClick={handleAgree}
            disabled={!agreed || saving}
            size="lg"
            className="w-full sm:w-auto relative z-50"
          >
            {saving ? 'Saving...' : 'I Agree & Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
