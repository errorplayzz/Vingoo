/**
 * utils/explainer.js – Rule-based explanation generator for suspicious accounts.
 */

const PATTERN_LABELS = {
  cycle_length_3:  { short: "3-node cycle",        severity: 0.9 },
  cycle_length_4:  { short: "4-node cycle",        severity: 0.85 },
  cycle_length_5:  { short: "5-node cycle",        severity: 0.8 },
  fan_in:          { short: "fan-in aggregation",  severity: 0.7 },
  shell_chain:     { short: "shell chain layering", severity: 0.75 },
  high_velocity:   { short: "high-velocity flow",  severity: 0.65 },
  smurfing:        { short: "smurfing pattern",    severity: 0.8 },
};

function patternLabel(p) {
  return PATTERN_LABELS[p]?.short ?? p.replace(/_/g, " ");
}

function cycleLength(patterns) {
  for (const p of patterns) {
    const m = p.match(/cycle_length_(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Generate a human-readable explanation + confidence for one account.
 */
function explainAccount(account, ringMap) {
  const { account_id, suspicion_score, detected_patterns, ring_id } = account;
  const parts = [];

  const len = cycleLength(detected_patterns);
  if (len) {
    parts.push(
      `This account participates in a ${len}-node circular routing pattern, ` +
      `a key indicator of money laundering via closed-loop fund cycling.`
    );
  }

  if (detected_patterns.includes("fan_in")) {
    parts.push(
      `Multiple incoming transfers converge on this account (fan-in aggregation), ` +
      `consistent with smurfing coordination behaviour.`
    );
  }

  if (detected_patterns.includes("shell_chain")) {
    parts.push(
      `This account is embedded in a multi-hop shell chain — a layering structure ` +
      `used to obscure the origin of funds across at least 2 intermediary accounts.`
    );
  }

  if (detected_patterns.includes("high_velocity")) {
    parts.push(
      `Unusually high transaction velocity detected within the observation window, ` +
      `exceeding the 95th percentile baseline for this graph.`
    );
  }

  if (ring_id) {
    const ring = ringMap?.[ring_id];
    const size = ring?.member_accounts?.length ?? "multiple";
    parts.push(
      `Confirmed member of fraud ring ${ring_id} comprising ${size} accounts ` +
      `with an aggregate ring risk score of ${ring?.risk_score ?? "—"} / 100.`
    );
  }

  if (parts.length === 0) {
    parts.push(
      `Elevated suspicion score of ${suspicion_score} / 100 flagged through ` +
      `graph centrality analysis. Manual review recommended.`
    );
  }

  // confidence: weighted average of pattern severities + normalised suspicion score
  const severities = detected_patterns.map((p) => PATTERN_LABELS[p]?.severity ?? 0.5);
  const avgSeverity = severities.length > 0
    ? severities.reduce((a, b) => a + b, 0) / severities.length
    : 0.5;
  const aiConfidence = Math.min(
    100,
    Math.round(avgSeverity * 60 + (suspicion_score / 100) * 40),
  );

  return {
    ...account,
    explanation: parts.join(" "),
    ai_confidence: aiConfidence,
    pattern_labels: detected_patterns.map(patternLabel),
  };
}

/** Attach explanations to response (does not mutate original). */
export function generateExplanations(analysisResponse) {
  // Build ring id → ring object map for quick lookup
  const ringMap = Object.fromEntries(
    (analysisResponse.fraud_rings ?? []).map((r) => [r.ring_id, r]),
  );

  const suspicious_accounts = (analysisResponse.suspicious_accounts ?? []).map((acc) =>
    explainAccount(acc, ringMap)
  );

  return {
    ...analysisResponse,
    suspicious_accounts,
    _explained_at: new Date().toISOString(),
  };
}
