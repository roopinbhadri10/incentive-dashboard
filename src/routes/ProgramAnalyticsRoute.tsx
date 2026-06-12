import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ProgramAnalyticsPage } from "@/pages/ProgramAnalyticsPage";

/** Per-program analytics, keyed by the `:id` route param. */
export function ProgramAnalyticsRoute() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) return <Navigate to="/programs" replace />;

  return <ProgramAnalyticsPage programmeId={id} onBack={() => navigate("/programs")} />;
}
