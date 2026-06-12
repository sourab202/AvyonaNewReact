import React from "react";
import { Navigate } from "react-router-dom";
import { canAccess } from "../../utils/accessControl";

export default function AccessRoute({ module, action = "view", children }) {
  if (!canAccess(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
