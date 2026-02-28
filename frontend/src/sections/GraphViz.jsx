import {
  useEffect, useRef, useState, useMemo, useCallback, memo,
} from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "../context/AnalysisContext";

/*  Design tokens  */
const CLR = {
  normal    : "#94A3B8",
  normalFill: "#F1F5F9",
  suspect   : "#1D4ED8",
  suspectFill: "#EFF6FF",
  high      : "#EF4444",
  highFill  : "#FEF2F2",
  ring      : "#F59E0B",
  cycle     : "#1D4ED8",
  smurf     : "#B45309",
  shell     : "#7C3AED",
  edge      : "#CBD5E1",
};

/*  Node radius by tier  */
function nodeRadius(d) {
  if (d.type === "suspicious" && d.score > 85) return 21;
  if (d.type === "suspicious") return 16;
  return 13;
}

/*  Edge stroke props  */
function edgeStroke(kind) {
  switch (kind) {
    case "cycle" : return { color: CLR.cycle, width: 2,   dash: "7 0",  opacity: 0.82 };
    case "smurf" : return { color: CLR.smurf, width: 2.5, dash: "7 0",  opacity: 0.78 };
    case "shell" : return { color: CLR.shell, width: 1.8, dash: "7 4",  opacity: 0.78 };
    default      : return { color: CLR.edge,  width: 1.2, dash: "none", opacity: 0.45 };
  }
}

/*  Static demo data (flat D3)  */
const DEMO_NODES_RAW = [
  { id:"A", label:"ACC_A",     type:"suspicious", score:94, ring:"RING-01", patterns:["cycle_length_3"], explain:null },
  { id:"B", label:"ACC_B",     type:"suspicious", score:81, ring:"RING-01", patterns:["cycle_length_3"], explain:null },
  { id:"C", label:"ACC_C",     type:"suspicious", score:72, ring:"RING-01", patterns:["cycle_length_3"], explain:null },
  { id:"D", label:"ORIGIN",    type:"normal",     score:8,  ring:null,      patterns:[], explain:null },
  { id:"E", label:"COLLECTOR", type:"suspicious", score:91, ring:"RING-02", patterns:["fan_in"], explain:null },
  { id:"F", label:"MULE_01",   type:"suspicious", score:55, ring:"RING-02", patterns:["fan_in"], explain:null },
  { id:"G", label:"MULE_02",   type:"suspicious", score:52, ring:"RING-02", patterns:["fan_in"], explain:null },
  { id:"H", label:"MULE_03",   type:"suspicious", score:48, ring:null,      patterns:["high_velocity"], explain:null },
  { id:"I", label:"SOURCE",    type:"normal",     score:11, ring:null,      patterns:[], explain:null },
  { id:"J", label:"SHELL_1",   type:"suspicious", score:63, ring:"RING-03", patterns:["shell_chain"], explain:null },
  { id:"K", label:"SHELL_2",   type:"suspicious", score:61, ring:"RING-03", patterns:["shell_chain"], explain:null },
  { id:"L", label:"END_PT",    type:"normal",     score:14, ring:null,      patterns:[], explain:null },
  { id:"M", label:"VICTIM",    type:"normal",     score:5,  ring:null,      patterns:[], explain:null },
];
const DEMO_EDGES_RAW = [
  { source:"A", target:"B", kind:"cycle"  },
  { source:"B", target:"C", kind:"cycle"  },
  { source:"C", target:"A", kind:"cycle"  },
  { source:"M", target:"F", kind:"smurf"  },
  { source:"M", target:"G", kind:"smurf"  },
  { source:"M", target:"H", kind:"smurf"  },
  { source:"F", target:"E", kind:"smurf"  },
  { source:"G", target:"E", kind:"smurf"  },
  { source:"H", target:"E", kind:"smurf"  },
  { source:"I", target:"J", kind:"shell"  },
  { source:"J", target:"K", kind:"shell"  },
  { source:"K", target:"L", kind:"shell"  },
  { source:"D", target:"A", kind:"normal" },
  { source:"E", target:"B", kind:"normal" },
];

/*  Live data hooks  */
function useGraphData() {
  const { result } = useAnalysis();
  return useMemo(() => {
    if (!result?.suspicious_accounts?.length) {
      return { nodes: DEMO_NODES_RAW, edges: DEMO_EDGES_RAW };
    }
    const explainMap = {};
    for (const e of result.ai_explanations ?? []) {
      explainMap[e.account_id] = e.explanation;
    }
    const ringMap = {};
    for (const ring of result.fraud_rings ?? []) {
      for (const acc of ring.member_accounts ?? []) ringMap[acc] = ring.ring_id;
    }
    const nodeMap = new Map();
    for (const acc of result.suspicious_accounts) {
      const lbl = acc.account_id.length > 9
        ? acc.account_id.slice(0, 9) + ""
        : acc.account_id;
      nodeMap.set(acc.account_id, {
        id      : acc.account_id,
        label   : lbl,
        type    : "suspicious",
        score   : Math.round(acc.suspicion_score),
        ring    : acc.ring_id ?? null,
        patterns: acc.detected_patterns ?? [],
        explain : explainMap[acc.account_id] ?? null,
      });
    }
    const edgeList = [];
    const edgeSeen = new Set();
    for (const ring of result.fraud_rings ?? []) {
      const kind =
        ring.pattern_type?.includes("cycle")                                ? "cycle"  :
        ring.pattern_type?.includes("smur") || ring.pattern_type?.includes("fan") ? "smurf"  :
        "shell";
      const members = ring.member_accounts ?? [];
      for (let i = 0; i < members.length; i++) {
        const src = members[i];
        const tgt = members[(i + 1) % members.length];
        const key = `${src}${tgt}`;
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        if (!nodeMap.has(src)) nodeMap.set(src, { id:src, label:src.slice(0,8), type:"normal", score:5, ring:ring.ring_id, patterns:[], explain:null });
        if (!nodeMap.has(tgt)) nodeMap.set(tgt, { id:tgt, label:tgt.slice(0,8), type:"normal", score:5, ring:ring.ring_id, patterns:[], explain:null });
        edgeList.push({ source: src, target: tgt, kind });
      }
    }
    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [result]);
}

const PATTERN_META = {
  cycle   : { dotCls:"bg-accent",     title:"Circular Routing",   color:CLR.cycle },
  smurfing: { dotCls:"bg-amber-700",  title:"Fan-in Aggregation", color:CLR.smurf },
  shell   : { dotCls:"bg-violet-600", title:"Shell Layering",     color:CLR.shell },
};
const STATIC_PATTERNS = [
  { kind:"Cycle",    dotCls:"bg-accent",     title:"Circular Routing",   desc:"ACC_A  ACC_B  ACC_C — closed-loop fund cycling.",        score:94, accounts:3, color:CLR.cycle },
  { kind:"Smurfing", dotCls:"bg-amber-700",  title:"Fan-in Aggregation", desc:"Three mule accounts converge into a single collector.",     score:81, accounts:4, color:CLR.smurf },
  { kind:"Shell",    dotCls:"bg-violet-600", title:"Shell Layering",     desc:"SOURCE  SHELL_1  SHELL_2 obscures the origin of funds.", score:63, accounts:3, color:CLR.shell },
];
function usePatterns() {
  const { result } = useAnalysis();
  return useMemo(() => {
    if (!result?.fraud_rings?.length) return STATIC_PATTERNS;
    const grouped = new Map();
    for (const ring of result.fraud_rings) {
      const raw  = ring.pattern_type ?? "unknown";
      const kind = raw.includes("cycle") ? "cycle" : raw.includes("smur") || raw.includes("fan") ? "smurfing" : "shell";
      if (!grouped.has(kind)) grouped.set(kind, { kind, rings:[], members:new Set() });
      const g = grouped.get(kind);
      g.rings.push(ring);
      (ring.member_accounts ?? []).forEach((m) => g.members.add(m));
    }
    return Array.from(grouped.entries()).map(([kind, g]) => {
      const meta    = PATTERN_META[kind] ?? { dotCls:"bg-slate-500", title:kind, color:"#64748B" };
      const topRing = g.rings.reduce((a,b) => ((b.risk_score??0) > (a.risk_score??0) ? b : a), g.rings[0]);
      const mem     = topRing.member_accounts ?? [];
      const preview = mem.slice(0,3).join("  ") + (mem.length > 3 ? "  " : "");
      const desc    = mem.length >= 2 ? `${preview} — ${g.rings.length} ring(s) detected.` : `${g.rings.length} ring(s) detected.`;
      return { kind, dotCls:meta.dotCls, title:meta.title, desc, score:Math.round(topRing.risk_score??0), accounts:g.members.size, color:meta.color };
    });
  }, [result]);
}

/*  Tooltip  */
function NodeTooltip({ node }) {
  if (!node) return null;
  const score    = node.score ?? 0;
  const barColor = score >= 85 ? "#EF4444" : score >= 50 ? CLR.suspect : "#22C55E";
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key="tt"
          className="absolute top-4 right-4 z-20 pointer-events-none"
          style={{ width: 214 }}
          initial={{ opacity:0, y:6,  scale:0.97 }}
          animate={{ opacity:1, y:0,  scale:1    }}
          exit   ={{ opacity:0, y:4,  scale:0.97 }}
          transition={{ duration:0.16 }}
        >
          <div className="rounded-xl px-4 py-3"
               style={{ background:"rgba(255,255,255,0.93)", backdropFilter:"blur(16px)",
                        WebkitBackdropFilter:"blur(16px)", border:"1px solid rgba(0,0,0,0.08)",
                        boxShadow:"0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)" }}>
            <p className="text-[11.5px] font-bold text-ink font-mono truncate mb-0.5">{node.label}</p>
            <p className="text-[10px] text-faint mb-2.5 capitalize">{node.type} account</p>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width:`${score}%`, background:barColor }} />
              </div>
              <span className="text-[11px] font-black tabular-nums" style={{ color:barColor }}>{score}</span>
            </div>
            {node.ring && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider">Ring</span>
                <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50
                                 px-1.5 py-0.5 rounded border border-violet-200">{node.ring}</span>
              </div>
            )}
            {node.patterns?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {node.patterns.slice(0,4).map((p) => (
                  <span key={p} className="text-[9px] font-semibold font-mono px-1.5 py-0.5
                                           rounded bg-accent/[0.07] text-accent border border-accent/20">{p}</span>
                ))}
              </div>
            )}
            {node.explain && (
              <div className="pt-2 border-t border-black/[0.06]">
                <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />AI
                </p>
                <p className="text-[10px] text-muted leading-snug line-clamp-3">{node.explain}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/*  D3 Force Graph  */
const D3Graph = memo(function D3Graph({
  nodes: rawNodes,
  edges: rawEdges,
  highlightedNodeIds,
  onNodeHover,
  onResetIsolation,
}) {
  const svgRef          = useRef(null);
  const simRef          = useRef(null);
  const rafRef          = useRef(null);
  const gMainRef        = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const edgeEls         = useRef([]);
  const nodeCircles     = useRef([]);
  const nodeLabels      = useRef([]);
  const isolatedRef     = useRef(false);
  const [isolated, setIsolated] = useState(false);

  /*  Bootstrap simulation  */
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (simRef.current) { simRef.current.stop(); simRef.current = null; }
    cancelAnimationFrame(rafRef.current);

    const W = svgRef.current.clientWidth  || 780;
    const H = svgRef.current.clientHeight || 500;

    /* defs: filters + arrowhead markers */
    const defs = svg.append("defs");

    /* glow filter for suspicious nodes */
    const blueGlow = defs.append("filter").attr("id","glow-blue").attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
    blueGlow.append("feGaussianBlur").attr("id","fgb-blue").attr("stdDeviation","5").attr("result","blur");
    const blueComp = blueGlow.append("feMerge");
    blueComp.append("feMergeNode").attr("in","blur");
    blueComp.append("feMergeNode").attr("in","SourceGraphic");

    /* high-risk red glow */
    const redGlow = defs.append("filter").attr("id","glow-red").attr("x","-70%").attr("y","-70%").attr("width","240%").attr("height","240%");
    redGlow.append("feGaussianBlur").attr("id","fgb-red").attr("stdDeviation","7").attr("result","blur");
    const redComp = redGlow.append("feMerge");
    redComp.append("feMergeNode").attr("in","blur");
    redComp.append("feMergeNode").attr("in","SourceGraphic");

    /* hover-state intensified glow filters — used on mouseenter */
    const blueHover = defs.append("filter").attr("id","glow-blue-hover").attr("x","-90%").attr("y","-90%").attr("width","280%").attr("height","280%");
    blueHover.append("feGaussianBlur").attr("stdDeviation","10").attr("result","blur");
    const bhComp = blueHover.append("feMerge");
    bhComp.append("feMergeNode").attr("in","blur");
    bhComp.append("feMergeNode").attr("in","SourceGraphic");

    const redHover = defs.append("filter").attr("id","glow-red-hover").attr("x","-100%").attr("y","-100%").attr("width","300%").attr("height","300%");
    redHover.append("feGaussianBlur").attr("stdDeviation","14").attr("result","blur");
    const rhComp = redHover.append("feMerge");
    rhComp.append("feMergeNode").attr("in","blur");
    rhComp.append("feMergeNode").attr("in","SourceGraphic");

    /* arrowhead markers per colour */
    const mkMarker = (id, color) => {
      defs.append("marker")
          .attr("id", id)
          .attr("viewBox","0 -4 8 8")
          .attr("refX","8").attr("refY","0")
          .attr("markerWidth","6").attr("markerHeight","6")
          .attr("orient","auto")
        .append("path")
          .attr("d","M0,-4L8,0L0,4")
          .attr("fill", color);
    };
    mkMarker("arr-cycle", CLR.cycle);
    mkMarker("arr-smurf", CLR.smurf);
    mkMarker("arr-shell", CLR.shell);
    mkMarker("arr-normal", CLR.edge);

    /* dot-grid background rect */
    const patId = "dot-grid";
    const bgPat = defs.append("pattern").attr("id",patId).attr("width","28").attr("height","28").attr("patternUnits","userSpaceOnUse");
    bgPat.append("circle").attr("cx","1").attr("cy","1").attr("r","0.9").attr("fill","rgba(100,116,139,0.14)");
    svg.append("rect").attr("width","100%").attr("height","100%").attr("fill",`url(#${patId})`);

    /* zoomable group */
    const g = svg.append("g");
    gMainRef.current = g;

    /* deep-clone node/edge data so D3 can mutate x/y/vx/vy */
    const simNodes = rawNodes.map((n) => ({ ...n, r: nodeRadius(n) }));
    const idSet    = new Set(simNodes.map((n) => n.id));
    const simEdges = rawEdges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({ ...e }));

    /*  Custom clustering force  */
    function clusterForce(alpha) {
      /* compute ring centroids */
      const cx = {}, cy_c = {}, cnt = {};
      for (const n of simNodes) {
        if (!n.ring) continue;
        cx[n.ring]  = (cx[n.ring]  || 0) + (n.x || 0);
        cy_c[n.ring]= (cy_c[n.ring]|| 0) + (n.y || 0);
        cnt[n.ring] = (cnt[n.ring] || 0) + 1;
      }
      /* attract nodes toward their ring centroid */
      for (const n of simNodes) {
        if (!n.ring || !cnt[n.ring]) continue;
        const centX = cx[n.ring]   / cnt[n.ring];
        const centY = cy_c[n.ring] / cnt[n.ring];
        n.vx += (centX - (n.x||0)) * 0.10 * alpha;
        n.vy += (centY - (n.y||0)) * 0.10 * alpha;
      }
    }

    /*  Simulation  */
    const sim = d3.forceSimulation(simNodes)
      .force("link",
        d3.forceLink(simEdges)
          .id((d) => d.id)
          .distance((e) => {
            /* same-ring links shorter  tighter clusters */
            const src = e.source, tgt = e.target;
            if (src.ring && src.ring === tgt.ring) return 72;
            return 110;
          })
          .strength(0.45))
      .force("charge",
        d3.forceManyBody()
          .strength((d) => {
            /* inter-ring nodes repel harder */
            return d.ring ? -340 : -280;
          })
          .distanceMax(380))
      .force("collision",
        d3.forceCollide().radius((d) => d.r + 20).strength(0.9).iterations(3))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04))
      .force("cluster", clusterForce)
      .alphaDecay(0.022)
      .velocityDecay(0.38)
      .alpha(1);

    simRef.current = sim;

    /*  Draw edges  */
    const edgeGroup = g.append("g").attr("class","edges");
    const edgeSel   = edgeGroup.selectAll("line")
      .data(simEdges)
      .join("line")
        .attr("stroke",        (d) => edgeStroke(d.kind).color)
        .attr("stroke-width",  (d) => edgeStroke(d.kind).width)
        .attr("stroke-dasharray", (d) => edgeStroke(d.kind).dash)
        .attr("opacity",       0)
        .attr("marker-end",    (d) => `url(#arr-${d.kind || "normal"})`);
    edgeEls.current = edgeSel.nodes();

    /*  Draw nodes  */
    const nodeGroup = g.append("g").attr("class","nodes");
    const nodeSel   = nodeGroup.selectAll("g")
      .data(simNodes)
      .join("g")
        .attr("class","node-g")
        .style("opacity", 0)
        .style("cursor","pointer");

    /* circle */
    nodeSel.append("circle")
      .attr("class", "main-circle")
      .attr("r",    (d) => d.r)
      .attr("fill", (d) => {
        if (d.type === "suspicious" && d.score > 85) return CLR.highFill;
        if (d.type === "suspicious") return CLR.suspectFill;
        return CLR.normalFill;
      })
      .attr("stroke", (d) => {
        if (d.type === "suspicious" && d.score > 85) return CLR.high;
        if (d.type === "suspicious") return CLR.suspect;
        return CLR.normal;
      })
      .attr("stroke-width", (d) => (d.type === "suspicious" ? 2.2 : 1.6))
      .attr("filter", (d) => {
        if (d.type === "suspicious" && d.score > 85) return "url(#glow-red)";
        if (d.type === "suspicious") return "url(#glow-blue)";
        return null;
      });

    /* ring-member amber outer ring */
    nodeSel.filter((d) => !!d.ring)
      .append("circle")
        .attr("class",       "ring-outline")
        .attr("r",           (d) => d.r + 5)
        .attr("fill",        "none")
        .attr("stroke",      CLR.ring)
        .attr("stroke-width","1.6")
        .attr("opacity",     "0.45");

    /* risk pulse ring — animates for HIGH-risk nodes (score > 80) */
    nodeSel.filter((d) => d.type === "suspicious" && (d.score ?? 0) > 80)
      .append("circle")
        .attr("class",        "risk-pulse-ring")
        .attr("r",            (d) => d.r + 4)
        .attr("fill",         "none")
        .attr("stroke",       (d) => (d.score ?? 0) > 90 ? CLR.high : "#F59E0B")
        .attr("stroke-width", "1.4")
        .attr("opacity",      0)
        .each(function(d) {
          const el = d3.select(this);
          const r0 = d.r + 4;
          const r1 = d.r + 18;
          const clr = (d.score ?? 0) > 90 ? CLR.high : "#F59E0B";
          function beat() {
            el.attr("r", r0).attr("opacity", 0.55)
              .transition().duration(1700).ease(d3.easeExpOut)
              .attr("r", r1).attr("opacity", 0)
              .on("end", beat);
          }
          setTimeout(beat, Math.random() * 600);
        });

    /* primary label — short name; full id at zoom≥1.2; hidden below zoom 1.0 */
    nodeSel.append("text")
      .attr("class",      "t-lbl")
      .text((d) => d.label)
      .attr("text-anchor","middle")
      .attr("dy",         (d) => d.r + 12)
      .attr("font-size",  "7.5px")
      .attr("font-weight","700")
      .attr("font-family","ui-monospace,SFMono-Regular,monospace")
      .attr("fill",       "#374151")
      .attr("paint-order","stroke")
      .attr("stroke",     "#ffffff")
      .attr("stroke-width","2.5");

    /* score label — revealed at zoom ≥ 1.8 */
    nodeSel.append("text")
      .attr("class",      "t-score")
      .text((d) => d.score != null ? String(d.score) : "")
      .attr("text-anchor","middle")
      .attr("dy",         (d) => d.r + 23)
      .attr("font-size",  "6.5px")
      .attr("font-weight","600")
      .attr("font-family","ui-monospace,SFMono-Regular,monospace")
      .attr("fill",       (d) => d.score > 85 ? CLR.high : d.score > 50 ? CLR.suspect : "#64748B")
      .attr("paint-order","stroke")
      .attr("stroke",     "#ffffff")
      .attr("stroke-width","2")
      .attr("opacity",    0);

    nodeCircles.current = nodeSel.nodes();
    nodeLabels.current  = nodeSel.nodes();

    /*  Hover  */
    nodeSel
      .on("mouseenter", function(event, d) {
        if (!isolatedRef.current) {
          const hR = (d._baseR ?? d.r) + 5;
          const hFilter = d.type === "suspicious" && d.score > 85
            ? "url(#glow-red-hover)"
            : d.type === "suspicious"
            ? "url(#glow-blue-hover)"
            : "url(#glow-blue)";
          d3.select(this).select("circle.main-circle")
            .transition().duration(150)
            .attr("r",            hR)
            .attr("stroke-width", d.type === "suspicious" ? 3.2 : 2.2)
            .attr("filter",       hFilter);
        }
        onNodeHover({ ...d, _el: this });
      })
      .on("mouseleave", function(_event, d) {
        const origFilter = d.type === "suspicious" && d.score > 85
          ? "url(#glow-red)"
          : d.type === "suspicious"
          ? "url(#glow-blue)"
          : null;
        d3.select(this).select("circle.main-circle")
          .transition().duration(200)
          .attr("r",            d._baseR ?? d.r)
          .attr("stroke-width", d.type === "suspicious" ? 2.2 : 1.6)
          .attr("filter",       origFilter);
        onNodeHover(null);
      });

    /*  Click: isolate subgraph  */
    nodeSel.on("click", function(event, clicked) {
      event.stopPropagation();
      isolatedRef.current = true;
      setIsolated(true);
      const connected = new Set([clicked.id]);
      for (const e of simEdges) {
        const src = e.source.id || e.source;
        const tgt = e.target.id || e.target;
        if (src === clicked.id) connected.add(tgt);
        if (tgt === clicked.id) connected.add(src);
      }
      d3.selectAll(nodeCircles.current).each(function(_d2) {
        const nd = d3.select(this);
        const inNeigh = connected.has(_d2.id);
        nd.transition().duration(200).style("opacity", inNeigh ? 1 : 0.07);
      });
      d3.selectAll(edgeEls.current).each(function(_e2) {
        const src = (_e2.source.id || _e2.source);
        const tgt = (_e2.target.id || _e2.target);
        const vis = connected.has(src) && connected.has(tgt);
        d3.select(this).transition().duration(200)
          .attr("opacity", vis ? edgeStroke(_e2.kind).opacity : 0.04);
      });
    });

    /*  Background click: reset  */
    svg.on("click", () => {
      if (!isolatedRef.current) return;
      isolatedRef.current = false;
      setIsolated(false);
      onResetIsolation();
      d3.selectAll(nodeCircles.current)
        .transition().duration(200).style("opacity", 1);
      d3.selectAll(edgeEls.current).each(function(_e2) {
        d3.select(this).transition().duration(200)
          .attr("opacity", edgeStroke(_e2.kind).opacity);
      });
    });

    /*  Drag  */
    nodeSel.call(
      d3.drag()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.25).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end",  (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

    /* semantic zoom */
    function applySemanticZoom(transform) {
      const k    = transform.k;
      const W2   = svgRef.current?.clientWidth  || 780;
      const H2   = svgRef.current?.clientHeight || 500;
      const T    = 300;
      const ease = d3.easeCubicOut;

      // 1. Adaptive radius (visual only — keeps simulation radius stable)
      d3.selectAll(nodeCircles.current).each(function(d) {
        if (d._baseR == null) d._baseR = d.r;
        const vr = Math.min(d._baseR * (1 + (k - 1) * 0.18), d._baseR * 1.40);
        d3.select(this).select("circle.main-circle")
          .transition().duration(T).ease(ease).attr("r", vr);
        d3.select(this).select("circle.ring-outline")
          .transition().duration(T).ease(ease).attr("r", vr + 5);
      });

      // 2. High-risk glow intensifies on zoom-in
      const blueSd = k > 1.2 ? Math.min(5  + (k - 1.2) * 2.5, 11) : 5;
      const redSd  = k > 1.2 ? Math.min(7  + (k - 1.2) * 3.5, 15) : 7;
      svg.select("#fgb-blue").attr("stdDeviation", blueSd.toFixed(1));
      svg.select("#fgb-red") .attr("stdDeviation", redSd .toFixed(1));

      // 3. Progressive label disclosure
      d3.selectAll(nodeCircles.current).each(function(d) {
        const el = d3.select(this);
        el.select(".t-lbl")
          .transition().duration(T).ease(ease)
          .attr("opacity", k < 1.0 ? 0 : 1)
          .text(k >= 1.2 ? d.id : d.label);
        el.select(".t-score")
          .transition().duration(T).ease(ease)
          .attr("opacity", k >= 1.8 ? 1 : 0);
      });

      // 4. Edge simplification
      if (!isolatedRef.current) {
        d3.selectAll(edgeEls.current).each(function(e) {
          const isMinor = (e?.kind === "normal");
          const baseOp  = edgeStroke(e?.kind ?? "normal").opacity;
          let targetOp;
          if      (k < 0.8 && isMinor) targetOp = 0;
          else if (k >= 1.2)           targetOp = baseOp;
          else                         targetOp = baseOp * 0.75;
          d3.select(this).transition().duration(T).ease(ease).attr("opacity", targetOp);
        });
      }

      // 5. Ring focus: fade nodes outside the viewport-centre cluster
      if (!isolatedRef.current) {
        if (k >= 1.5) {
          const wx = (W2 / 2 - transform.x) / k;
          const wy = (H2 / 2 - transform.y) / k;
          const fr = 160 / k; // world-space focus radius
          const ringCounts = {};
          for (const n of simNodes) {
            const dx = (n.x||0) - wx, dy = (n.y||0) - wy;
            if (dx*dx + dy*dy < fr*fr && n.ring) {
              ringCounts[n.ring] = (ringCounts[n.ring] || 0) + 1;
            }
          }
          const topEntry = Object.entries(ringCounts).sort((a,b) => b[1]-a[1])[0];
          if (topEntry && topEntry[1] >= 2) {
            const focusRing = topEntry[0];
            d3.selectAll(nodeCircles.current).each(function(d) {
              d3.select(this).transition().duration(T).ease(ease)
                .style("opacity", d.ring === focusRing ? 1 : 0.2);
            });
          } else {
            d3.selectAll(nodeCircles.current)
              .transition().duration(T).ease(ease).style("opacity", 1);
          }
        } else {
          // zoomed out enough — restore full opacity
          d3.selectAll(nodeCircles.current)
            .transition().duration(T).ease(ease).style("opacity", 1);
        }
      }
    }

    /*  Zoom / pan  */
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.3, 4])
      .filter((event) => {
        if (event.type === "dblclick") return false;
        return !event.button;
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        applySemanticZoom(event.transform);
      });
    svg.call(zoomBehavior).on("dblclick.zoom", null);
    zoomBehaviorRef.current = zoomBehavior;

    /*  Tick function  */
    sim.on("tick", () => {
      /* edges */
      const eNodes = edgeSel.nodes();
      for (let i = 0; i < simEdges.length; i++) {
        const e   = simEdges[i];
        const nd  = eNodes[i];
        if (!nd || !e.source || !e.target) continue;
        const sr  = e.source.r || nodeRadius(e.source);
        const tr  = e.target.r || nodeRadius(e.target);
        const dx  = (e.target.x||0) - (e.source.x||0);
        const dy  = (e.target.y||0) - (e.source.y||0);
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        /* shorten endpoints so arrow sits at node border */
        const sx  = (e.source.x||0) + dx/len * (sr + 2);
        const sy  = (e.source.y||0) + dy/len * (sr + 2);
        const tx  = (e.target.x||0) - dx/len * (tr + 7);
        const ty  = (e.target.y||0) - dy/len * (tr + 7);
        nd.setAttribute("x1", sx);
        nd.setAttribute("y1", sy);
        nd.setAttribute("x2", tx);
        nd.setAttribute("y2", ty);
      }
      /* nodes */
      const nNodes = nodeSel.nodes();
      for (let i = 0; i < simNodes.length; i++) {
        const n  = simNodes[i];
        const nd = nNodes[i];
        if (!nd) continue;
        nd.setAttribute("transform", `translate(${n.x||0},${n.y||0})`);
      }
    });

    /*  Staggered fade-in on layout stable  */
    sim.on("end", () => {
      nodeSel.nodes().forEach((el, i) => {
        setTimeout(() =>
          d3.select(el).transition().duration(300).style("opacity", 1),
          i * 55 + 80,
        );
      });
      edgeSel.nodes().forEach((el, i) => {
        const kind = simEdges[i]?.kind ?? "normal";
        setTimeout(() =>
          d3.select(el).transition().duration(260)
            .attr("opacity", edgeStroke(kind).opacity),
          i * 38 + 640,
        );
      });

      // ─ Auto-center camera on highest-risk suspicious node ───────────────
      // Fires once after the staggered fade-in completes.
      // Threshold: score > 65 so demo data with low scores is skipped.
      const topNode = simNodes
        .filter((n) => n.type === 'suspicious' && (n.score ?? 0) > 65)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

      if (topNode && zoomBehaviorRef.current) {
        const cameraDelay = simNodes.length * 55 + 900;
        setTimeout(() => {
          const cx = svgRef.current?.clientWidth  / 2 || 390;
          const cy = svgRef.current?.clientHeight / 2 || 250;
          const k  = 1.40;
          const tx = cx - (topNode.x || 0) * k;
          const ty = cy - (topNode.y || 0) * k;
          const t  = d3.zoomIdentity.translate(tx, ty).scale(k);
          svg.transition()
            .duration(1400)
            .ease(d3.easeCubicInOut)
            .call(zoomBehaviorRef.current.transform, t);
        }, cameraDelay);
      }
    });

    /*  Animated dash-offset (cycle + smurf)  */
    let dashOffset = 0;
    const animateDash = () => {
      dashOffset = (dashOffset - 1 + 100) % 100;
      edgeSel.nodes().forEach((el, i) => {
        const kind = simEdges[i]?.kind;
        if (kind === "cycle" || kind === "smurf") {
          el.style.strokeDashoffset = dashOffset;
        }
      });
      rafRef.current = requestAnimationFrame(animateDash);
    };
    rafRef.current = requestAnimationFrame(animateDash);

    return () => {
      sim.stop();
      cancelAnimationFrame(rafRef.current);
      svg.selectAll("*").remove();
      svg.on(".zoom", null).on("click", null);
    };
  }, [rawNodes, rawEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  /*  Ring highlight effect  */
  useEffect(() => {
    if (!simRef.current) return;
    const sim = simRef.current;
    const nodes = sim.nodes();
    const edges = simRef.current.force("link")?.links() ?? [];

    if (!highlightedNodeIds || highlightedNodeIds.size === 0) {
      d3.selectAll(nodeCircles.current)
        .transition().duration(200).style("opacity", 1);
      d3.selectAll(edgeEls.current).each(function(e) {
        d3.select(this).transition().duration(200)
          .attr("opacity", edgeStroke(e?.kind ?? "normal").opacity);
      });
      return;
    }

    /* dim non-ring nodes */
    d3.selectAll(nodeCircles.current).each(function(d) {
      const inRing = highlightedNodeIds.has(d.id);
      d3.select(this).transition().duration(220).style("opacity", inRing ? 1 : 0.1);
      /* amber border for ring members */
      d3.select(this).select("circle.main-circle")
        .transition().duration(220)
        .attr("stroke", inRing && d.ring ? CLR.ring : (d.type === "suspicious" && d.score > 85 ? CLR.high : d.type === "suspicious" ? CLR.suspect : CLR.normal))
        .attr("stroke-width", inRing ? 3 : (d.type === "suspicious" ? 2.2 : 1.6));
    });
    d3.selectAll(edgeEls.current).each(function(e) {
      const src = e?.source?.id || e?.source;
      const tgt = e?.target?.id || e?.target;
      const vis = highlightedNodeIds.has(src) && highlightedNodeIds.has(tgt);
      d3.select(this).transition().duration(220)
        .attr("opacity", vis ? edgeStroke(e?.kind).opacity : 0.05);
    });

    /* zoom to fit ring nodes */
    if (!svgRef.current || !gMainRef.current) return;
    const ringNodes = nodes.filter((n) => highlightedNodeIds.has(n.id) && n.x != null);
    if (ringNodes.length === 0) return;
    const W  = svgRef.current.clientWidth  || 780;
    const H  = svgRef.current.clientHeight || 500;
    const xs = ringNodes.map((n) => n.x);
    const ys = ringNodes.map((n) => n.y);
    const x0 = Math.min(...xs) - 80, x1 = Math.max(...xs) + 80;
    const y0 = Math.min(...ys) - 80, y1 = Math.max(...ys) + 80;
    const scale = Math.min(2.2, 0.9 / Math.max((x1-x0)/W, (y1-y0)/H));
    const tx = W/2 - scale * ((x0+x1)/2);
    const ty = H/2 - scale * ((y0+y1)/2);
    const zb = zoomBehaviorRef.current;
    if (zb) {
      d3.select(svgRef.current)
        .transition().duration(550).ease(d3.easeCubicInOut)
        .call(zb.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
  }, [highlightedNodeIds]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden"
         style={{ border:"1px solid rgba(0,0,0,0.07)",
                  boxShadow:"0 4px 32px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
                  background:"linear-gradient(135deg, #F8FBFF 0%, #EFF6FF 60%, #F1F5F9 100%)" }}>
      <svg
        ref={svgRef}
        className="w-full"
        style={{ height: 500, display:"block" }}
      />
      {/* Isolated reset button */}
      <AnimatePresence>
        {isolated && (
          <motion.button key="reset"
            className="absolute bottom-3 left-3 z-10 text-[10.5px] font-semibold px-3 py-1.5
                       rounded-lg text-muted hover:text-ink transition-colors"
            style={{ background:"rgba(255,255,255,0.90)", backdropFilter:"blur(10px)",
                     border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
            onClick={() => {
              isolatedRef.current = false;
              setIsolated(false);
              onResetIsolation();
              d3.selectAll(nodeCircles.current)
                .transition().duration(200).style("opacity", 1);
              d3.selectAll(edgeEls.current).each(function(e) {
                d3.select(this).transition().duration(200)
                  .attr("opacity", edgeStroke(e?.kind ?? "normal").opacity);
              });
            }}
            initial={{ opacity:0, y:6 }}
            animate={{ opacity:1, y:0 }}
            exit   ={{ opacity:0, y:6 }}
            transition={{ duration:0.18 }}>
             Show full graph
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

/*  Main exported section  */
export default function GraphViz() {
  const [hovered, setHovered] = useState(null);
  const { nodes, edges }      = useGraphData();
  const patterns              = usePatterns();
  const { highlightedRingId, result } = useAnalysis();

  // ── Blur / reveal ──────────────────────────────────────────────────────────
  // Demo mode (no result): graph is always visible.
  // Analysis mode (result present): graph starts blurred, reveals on scroll.
  const graphRef = useRef(null);
  const [graphRevealed, setGraphRevealed] = useState(false);

  useEffect(() => {
    // No real data — show demo graph immediately
    if (!result?.analysis_id) {
      setGraphRevealed(true);
      return;
    }

    // A new result just arrived — start in blurred state
    setGraphRevealed(false);

    const el = graphRef.current;
    if (!el) return;

    // If the graph is already in view (e.g. user was scrolled here), reveal after delay
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.75) {
      const t = setTimeout(() => setGraphRevealed(true), 900);
      return () => clearTimeout(t);
    }

    // Otherwise wait for scroll-into-view (the climax moment)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const t = setTimeout(() => setGraphRevealed(true), 650);
          observer.disconnect();
          return () => clearTimeout(t);
        }
      },
      { threshold: 0.30 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [result?.analysis_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightedNodeIds = useMemo(() => {
    if (!highlightedRingId || !result?.fraud_rings) return new Set();
    const ring = result.fraud_rings.find((r) => r.ring_id === highlightedRingId);
    return new Set(ring?.member_accounts ?? []);
  }, [highlightedRingId, result]);

  const handleReset = useCallback(() => {}, []);

  return (
    <section id="graph" data-focus-target="graph" className="dark-section py-24 md:py-32" style={{ background: "linear-gradient(180deg, #07101F 0%, #060B18 100%)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="container-wide">

        {/* Header */}
        <motion.div className="mb-14"
          initial={{ opacity:0, y:24 }}
          animate={{ opacity:1, y:0  }}
          transition={{ duration:0.7, ease:[0.22,1,0.36,1] }}>
          <p className="section-label mb-3">Graph Visualization</p>
          <h2 className="section-title max-w-lg">
            See the network.<br />Identify the crime.
          </h2>
          <p className="mt-4 text-muted max-w-md leading-relaxed">
            Transactions modelled as a directed graph. Patterns invisible in
            spreadsheets become unmistakable in topology.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Graph */}
          <motion.div className="flex-1 min-w-0"
            initial={{ opacity:0, y:32 }}
            animate={{ opacity:1, y:0  }}
            transition={{ duration:0.8, delay:0.15, ease:[0.22,1,0.36,1] }}>

            {/* Legend bar */}
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10.5px]"
                   style={{ background:"rgba(255,255,255,0.90)", backdropFilter:"blur(10px)",
                            border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
                {[
                  { cls:"bg-red-400",   label:"High-risk (>85)" },
                  { cls:"bg-accent",    label:"Suspicious"      },
                  { cls:"bg-slate-300", label:"Normal"          },
                  { cls:"bg-amber-400", label:"Ring member"     },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-muted whitespace-nowrap">
                    <span className={`w-2.5 h-2.5 rounded-full ${l.cls}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Canvas — with scroll-triggered blur-to-reveal for real analysis data */}
            <div ref={graphRef} className="relative">
              <NodeTooltip node={hovered} />
              <D3Graph
                key={`${nodes.length}-${edges.length}`}
                nodes={nodes}
                edges={edges}
                highlightedNodeIds={highlightedNodeIds}
                onNodeHover={setHovered}
                onResetIsolation={handleReset}
              />

              {/* Blur overlay — lifts when graph enters viewport + short delay */}
              {/* Only shown for real analysis data, never for demo mode       */}
              <AnimatePresence>
                {!graphRevealed && result?.analysis_id && (
                  <motion.div
                    key="graph-blur"
                    className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-4"
                    style={{
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      background: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(29,78,216,0.10)',
                    }}
                    initial={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      backdropFilter: 'blur(0px)',
                      WebkitBackdropFilter: 'blur(0px)',
                      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                    }}
                  >
                    {/* Pulse indicator */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                        <motion.div
                          className="absolute inset-0 rounded-full bg-accent/10"
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[12px] font-semibold text-accent uppercase tracking-widest">
                          Network Assembling
                        </p>
                        <p className="text-[11px] text-faint mt-1">
                          Scroll to reveal the fraud network
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-2.5 text-[10.5px] text-faint text-center">
              Hover for details  Click node to isolate subgraph  Click background to reset  Scroll to zoom  Drag nodes
            </p>
          </motion.div>

          {/* Side panel */}
          <motion.div className="lg:w-[268px] flex-shrink-0 flex flex-col gap-4"
            initial={{ opacity:0, x:24 }}
            animate={{ opacity:1, x:0  }}
            transition={{ duration:0.8, delay:0.3, ease:[0.22,1,0.36,1] }}>

            <h3 className="text-[13px] font-bold text-ink">Detected Patterns</h3>
            {patterns.map((p, i) => (
              <motion.div key={p.kind} className="rounded-2xl p-4"
                style={{ background:"rgba(255,255,255,0.82)", backdropFilter:"blur(12px)",
                         border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}
                initial={{ opacity:0, y:14 }}
                animate={{ opacity:1, y:0  }}
                transition={{ delay:i*0.1+0.45, duration:0.5 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.dotCls}`} />
                    <span className="text-[12px] font-bold text-ink">{p.title}</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-accent">{p.accounts} accs</span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed mb-3">{p.desc}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ background:p.color }}
                      initial={{ width:0 }}
                      animate={{ width:`${p.score}%` }}
                      transition={{ delay:i*0.1+0.9, duration:0.8, ease:"easeOut" }} />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0"
                        style={{ color:p.color }}>{p.score}</span>
                </div>
              </motion.div>
            ))}

            {/* Edge key */}
            <div className="rounded-2xl p-4"
                 style={{ background:"rgba(255,255,255,0.82)", backdropFilter:"blur(12px)",
                          border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
              <p className="text-[10.5px] font-bold text-faint uppercase tracking-widest mb-3">Edge Key</p>
              {[
                { color:CLR.cycle, label:"Cycle route",     dash:false, thick:false },
                { color:CLR.smurf, label:"Smurfing flow",   dash:false, thick:true  },
                { color:CLR.shell, label:"Shell chain",     dash:true,  thick:false },
                { color:CLR.edge,  label:"Normal transfer", dash:false, thick:false },
              ].map((e) => (
                <div key={e.label} className="flex items-center gap-3 mb-2.5 last:mb-0">
                  <svg width="24" height="8" className="flex-shrink-0">
                    <line x1="0" y1="4" x2="24" y2="4"
                      stroke={e.color}
                      strokeWidth={e.thick ? 2.5 : 1.8}
                      strokeDasharray={e.dash ? "5 3" : "none"} />
                  </svg>
                  <span className="text-[11px] text-muted">{e.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
