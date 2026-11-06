import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePolicyAcknowledgment } from "@/hooks/usePolicyAcknowledgment";
import { PolicyAcknowledgmentModal } from "@/components/PolicyAcknowledgmentModal";
import Dashboard from "./Dashboard";

const Index = () => {
  const { user, loading } = useAuth();
  const { needsAcknowledgment, loading: policyLoading, saveAcknowledgment } = usePolicyAcknowledgment();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || policyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PolicyAcknowledgmentModal
        open={needsAcknowledgment}
        onAcknowledge={saveAcknowledgment}
      />
      <Dashboard />
    </>
  );
};

export default Index;
