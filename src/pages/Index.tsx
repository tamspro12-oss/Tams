import { usePolicyAcknowledgment } from "@/hooks/usePolicyAcknowledgment";
import { PolicyAcknowledgmentModal } from "@/components/PolicyAcknowledgmentModal";
import Dashboard from "./Dashboard";

const Index = () => {
  const { needsAcknowledgment, loading: policyLoading, saveAcknowledgment } = usePolicyAcknowledgment();

  return (
    <>
      <PolicyAcknowledgmentModal
        open={!policyLoading && needsAcknowledgment}
        onAcknowledge={saveAcknowledgment}
      />
      <Dashboard />
    </>
  );
};

export default Index;
