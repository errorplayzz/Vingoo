import { createContext, useContext, useMemo, useState } from "react";

export const INVESTIGATION_STATE = {
  IDLE: "IDLE",
  DATA_UPLOADED: "DATA_UPLOADED",
  GRAPH_BUILDING: "GRAPH_BUILDING",
  ANALYZING: "ANALYZING",
  INTELLIGENCE_READY: "INTELLIGENCE_READY",
};

const STATE_RANK = {
  [INVESTIGATION_STATE.IDLE]: 0,
  [INVESTIGATION_STATE.DATA_UPLOADED]: 1,
  [INVESTIGATION_STATE.GRAPH_BUILDING]: 2,
  [INVESTIGATION_STATE.ANALYZING]: 3,
  [INVESTIGATION_STATE.INTELLIGENCE_READY]: 4,
};

export function isStateAtLeast(currentState, targetState) {
  const currentRank = STATE_RANK[currentState] ?? 0;
  const targetRank = STATE_RANK[targetState] ?? 0;
  return currentRank >= targetRank;
}

const InvestigationContext = createContext({
  investigationState: INVESTIGATION_STATE.IDLE,
  setInvestigationState: () => {},
});

export function InvestigationProvider({ children }) {
  const [investigationState, setInvestigationState] = useState(INVESTIGATION_STATE.IDLE);

  const value = useMemo(() => ({
    investigationState,
    setInvestigationState,
  }), [investigationState]);

  return (
    <InvestigationContext.Provider value={value}>
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigationState() {
  return useContext(InvestigationContext);
}
