import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Card, CardContent, IconButton, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CaretLeft, CaretRight, SquaresFour } from "@phosphor-icons/react";

function buildSeries(rows, field) {
  return (rows || []).map((r) => ({
    label: r.date ? r.date.slice(5) : "—",
    value: typeof r[field] === "number" && !Number.isNaN(r[field]) ? r[field] : null,
    date: r.date,
  }));
}

function yAxisUpperBound(series, fallbackMax) {
  const nums = series.map((d) => d.value).filter((v) => v != null);
  if (!nums.length) return fallbackMax;
  const m = Math.max(...nums);
  if (m <= 0) return fallbackMax;
  return Math.max(fallbackMax, Math.ceil(m * 1.15));
}

function formatTick(n) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Display one raw metric for day hover tooltip */
function formatMetricDisplay(field, raw) {
  if (raw == null || (typeof raw === "number" && Number.isNaN(raw))) return "—";
  switch (field) {
    case "steps":
      return `${Math.round(raw).toLocaleString()} steps`;
    case "sleep":
      return `${raw % 1 === 0 ? raw : raw.toFixed(1)} h`;
    case "nutrition_score":
      return `${Math.round(raw)}/100`;
    case "cigarettes_per_day":
      if (raw === 0) return "0 cigarettes";
      if (raw === 1) return "1 cigarette";
      return `${raw % 1 === 0 ? raw : raw.toFixed(1)} cigarettes`;
    case "stress_score":
    case "mood_score":
      return `${raw % 1 === 0 ? raw : raw.toFixed(1)}/10`;
    default:
      return String(raw);
  }
}

/** Tooltip for one metric (drill chart or one line on multi chart) */
function MetricPointTooltip({ row, metric, theme, x, y, containerW }) {
  if (!row || !metric) return null;
  const tx = Math.min(Math.max(x, 72), Math.max(72, containerW - 72));
  return (
    <Paper
      elevation={8}
      sx={{
        position: "absolute",
        left: tx,
        top: y,
        transform: "translate(-50%, calc(-100% - 10px))",
        zIndex: 10,
        pointerEvents: "none",
        px: 1.5,
        py: 1.15,
        minWidth: 140,
        maxWidth: 260,
        bgcolor: "#fff",
        border: `1px solid ${alpha(theme.text, 0.12)}`,
        borderRadius: 1.5,
        boxShadow: theme.cardShadow || "0 4px 20px rgba(31, 45, 61, 0.12)",
      }}
    >
      <Typography variant="caption" sx={{ color: theme.textMuted, display: "block", mb: 0.65, fontWeight: 600 }}>
        {row.date}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: metric.color, flexShrink: 0, mt: 0.35 }} />
        <Typography variant="caption" sx={{ color: theme.text, lineHeight: 1.45, fontSize: "0.8rem" }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {metric.title}
          </Box>
          {": "}
          {formatMetricDisplay(metric.field, row[metric.field])}
        </Typography>
      </Box>
    </Paper>
  );
}

const METRIC_FIELDS = [
  "steps",
  "sleep",
  "nutrition_score",
  "cigarettes_per_day",
  "stress_score",
  "mood_score",
];

function rowsHaveChartableMetric(rows) {
  if (!rows || rows.length === 0) return false;
  for (const r of rows) {
    for (const f of METRIC_FIELDS) {
      if (typeof r[f] === "number" && !Number.isNaN(r[f])) return true;
    }
  }
  return false;
}

function buildDummyRows(count) {
  const dates = [];
  const start = new Date();
  start.setDate(start.getDate() - (count - 1));
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates.map((date, i) => ({
    date,
    id: -100 - i,
    steps: Math.round(5200 + 900 * Math.sin(i * 0.85) + 180 * i),
    sleep: Math.round((6.1 + 0.35 * (i % 5) + 0.12 * i) * 10) / 10,
    nutrition_score: 58 + ((i * 5) % 32),
    cigarettes_per_day: Math.max(0, 2 - Math.floor(i / 6)),
    stress_score: 3 + (i % 6),
    mood_score: 5 + (i % 4),
  }));
}

/** Pixel layout for SVG charts */
function makeGeo(vbW, vbH) {
  const pad = {
    l: Math.max(40, Math.round(vbW * 0.05)),
    r: Math.max(18, Math.round(vbW * 0.022)),
    t: Math.max(14, Math.round(vbH * 0.045)),
    b: Math.max(36, Math.round(vbH * 0.1)),
  };
  return {
    vbW,
    vbH,
    pad,
    innerW: Math.max(1, vbW - pad.l - pad.r),
    innerH: Math.max(1, vbH - pad.t - pad.b),
  };
}

function HighlightLine({ geo, x, theme }) {
  if (x == null || Number.isNaN(x)) return null;
  return (
    <line
      x1={x}
      x2={x}
      y1={geo.pad.t}
      y2={geo.pad.t + geo.innerH}
      stroke={theme.logoGreen}
      strokeWidth={2}
      strokeDasharray="6 4"
      opacity={0.95}
      pointerEvents="none"
    />
  );
}

function SimpleWeeklyLineChart({ data, color, yMax, theme, geo, highlightDate, rowsByDay = null, hoverMetric = null }) {
  const { vbW, vbH, pad, innerW, innerH } = geo;
  const n = data.length;
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const showPointHover = rowsByDay && hoverMetric && rowsByDay.length === n;

  const { pathD, dots, gridLines, yTicks, xLabels, highlightX } = useMemo(() => {
    if (n === 0) {
      return { pathD: "", dots: [], gridLines: [], yTicks: [], xLabels: [], highlightX: null };
    }
    const yTicksArr = [0, yMax / 2, yMax].map((t) => ({
      y: pad.t + (1 - t / yMax) * innerH,
      label: formatTick(t),
    }));
    const gridLinesArr = yTicksArr.map((t) => ({
      y1: t.y,
      y2: t.y,
      x1: pad.l,
      x2: pad.l + innerW,
    }));

    const pts = data.map((d, i) => {
      const x =
        n === 1
          ? pad.l + innerW / 2
          : pad.l + (i / Math.max(n - 1, 1)) * innerW;
      const v = d.value;
      if (v == null || Number.isNaN(v)) {
        return { x, y: null, d };
      }
      const clamped = Math.min(Math.max(v, 0), yMax);
      const y = pad.t + (1 - clamped / yMax) * innerH;
      return { x, y, d };
    });

    let dPath = "";
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      if (a.y != null && b.y != null) {
        dPath += `M ${a.x} ${a.y} L ${b.x} ${b.y} `;
      }
    }

    const dotsArr = pts
      .map((p, dayIndex) => ({ ...p, dayIndex }))
      .filter((p) => p.y != null);
    const xLabelsArr = data.map((row, i) => {
      const x =
        n === 1
          ? pad.l + innerW / 2
          : pad.l + (i / Math.max(n - 1, 1)) * innerW;
      return { x, text: row.label, key: `${row.date}-${i}` };
    });

    let hx = null;
    if (highlightDate) {
      const hi = data.findIndex((row) => row.date === highlightDate);
      if (hi >= 0) {
        hx =
          n === 1
            ? pad.l + innerW / 2
            : pad.l + (hi / Math.max(n - 1, 1)) * innerW;
      }
    }

    return {
      pathD: dPath.trim(),
      dots: dotsArr,
      gridLines: gridLinesArr,
      yTicks: yTicksArr,
      xLabels: xLabelsArr,
      highlightX: hx,
    };
  }, [data, n, innerH, innerW, pad.l, pad.t, yMax, highlightDate]);

  let hoverPx = null;
  if (hover && wrapRef.current) {
    const r = wrapRef.current.getBoundingClientRect();
    hoverPx = { x: hover.clientX - r.left, y: hover.clientY - r.top, w: r.width };
  }

  return (
    <Box
      ref={wrapRef}
      sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}
      onMouseLeave={() => setHover(null)}
    >
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <rect
        x={pad.l}
        y={pad.t}
        width={innerW}
        height={innerH}
        rx={8}
        fill="#fff"
        pointerEvents="none"
      />
      {gridLines.map((g, i) => (
        <line
          key={`g-${i}`}
          x1={g.x1}
          y1={g.y1}
          x2={g.x2}
          y2={g.y2}
          stroke={alpha(theme.text, 0.12)}
          strokeWidth={1}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      ))}
      {yTicks.map((t, i) => (
        <text
          key={`yt-${i}`}
          x={pad.l - 6}
          y={t.y + 4}
          textAnchor="end"
          fill={theme.textMuted}
          fontSize={11}
        >
          {t.label}
        </text>
      ))}
      {pathD ? (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      ) : null}
      {dots.map((p) => (
        <g key={`pt-${p.dayIndex}`}>
          {showPointHover ? (
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => setHover({ dayIndex: p.dayIndex, clientX: e.clientX, clientY: e.clientY })}
              onMouseMove={(e) => setHover({ dayIndex: p.dayIndex, clientX: e.clientX, clientY: e.clientY })}
            />
          ) : null}
          <circle cx={p.x} cy={p.y} r={4} fill={color} pointerEvents="none" />
        </g>
      ))}
      <HighlightLine geo={geo} x={highlightX} theme={theme} />
      {xLabels.map((xl) => (
        <text
          key={xl.key}
          x={xl.x}
          y={vbH - 8}
          textAnchor="middle"
          fill={theme.textMuted}
          fontSize={n > 18 ? 7.5 : n > 12 ? 8.5 : 11}
        >
          {xl.text}
        </text>
      ))}
    </svg>
    {showPointHover && hover != null && hoverPx && rowsByDay[hover.dayIndex] != null && (
      <MetricPointTooltip
        row={rowsByDay[hover.dayIndex]}
        metric={hoverMetric}
        theme={theme}
        x={hoverPx.x}
        y={hoverPx.y}
        containerW={hoverPx.w}
      />
    )}
    </Box>
  );
}

function MultiNormalizedLineChart({ seriesList, theme, geo, highlightDate, rowsByDay = null, metrics: metricsForHover = null }) {
  const { vbW, vbH, pad, innerW, innerH } = geo;
  const n = seriesList[0]?.data?.length ?? 0;
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const showPointHover = rowsByDay && metricsForHover && metricsForHover.length === seriesList.length && rowsByDay.length === n;

  const { paths, xLabels, highlightX } = useMemo(() => {
    if (!n || !seriesList.length) {
      return { paths: [], xLabels: [], highlightX: null };
    }
    const pathArr = seriesList.map((s) => {
      const { data, color, yMax } = s;
      const pts = data.map((d, i) => {
        const x =
          n === 1
            ? pad.l + innerW / 2
            : pad.l + (i / Math.max(n - 1, 1)) * innerW;
        const v = d.value;
        if (v == null || Number.isNaN(v) || yMax <= 0) {
          return { x, y: null };
        }
        const norm = Math.min(1, Math.max(0, v / yMax));
        const y = pad.t + (1 - norm) * innerH;
        return { x, y };
      });
      let dPath = "";
      for (let i = 0; i < pts.length - 1; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        if (a.y != null && b.y != null) {
          dPath += `M ${a.x} ${a.y} L ${b.x} ${b.y} `;
        }
      }
      const dotsWithDay = pts
        .map((pt, dayIndex) => ({ ...pt, dayIndex }))
        .filter((pt) => pt.y != null);
      return { dPath: dPath.trim(), dots: dotsWithDay, color };
    });

    const xLabelsArr = seriesList[0].data.map((row, i) => {
      const x =
        n === 1
          ? pad.l + innerW / 2
          : pad.l + (i / Math.max(n - 1, 1)) * innerW;
      return { x, text: row.label, key: `${row.date}-${i}` };
    });

    let hx = null;
    if (highlightDate && seriesList[0]?.data) {
      const hi = seriesList[0].data.findIndex((row) => row.date === highlightDate);
      if (hi >= 0) {
        hx =
          n === 1
            ? pad.l + innerW / 2
            : pad.l + (hi / Math.max(n - 1, 1)) * innerW;
      }
    }

    return {
      paths: pathArr,
      xLabels: xLabelsArr,
      highlightX: hx,
    };
  }, [seriesList, n, innerH, innerW, pad.l, pad.t, highlightDate]);

  let hoverPx = null;
  if (hover && wrapRef.current) {
    const r = wrapRef.current.getBoundingClientRect();
    hoverPx = { x: hover.clientX - r.left, y: hover.clientY - r.top, w: r.width };
  }

  const yTicks = [0, 0.5, 1].map((t) => ({
    y: pad.t + (1 - t) * innerH,
    label: t === 0 ? "0" : t === 1 ? "max" : "50%",
  }));

  return (
    <Box
      ref={wrapRef}
      sx={{ position: "relative", width: "100%", height: "100%", minHeight: 0 }}
      onMouseLeave={() => setHover(null)}
    >
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      <rect
        x={pad.l}
        y={pad.t}
        width={innerW}
        height={innerH}
        rx={8}
        fill="#fff"
        pointerEvents="none"
      />
      {yTicks.map((t, i) => (
        <line
          key={`g-${i}`}
          x1={pad.l}
          y1={t.y}
          x2={pad.l + innerW}
          y2={t.y}
          stroke={alpha(theme.text, 0.12)}
          strokeWidth={1}
          strokeDasharray="4 4"
          pointerEvents="none"
        />
      ))}
      {yTicks.map((t, i) => (
        <text
          key={`yt-${i}`}
          x={pad.l - 6}
          y={t.y + 4}
          textAnchor="end"
          fill={theme.textMuted}
          fontSize={11}
        >
          {t.label}
        </text>
      ))}
      {paths.map((p, j) => (
        <g key={j}>
          {p.dPath ? (
            <path
              d={p.dPath}
              fill="none"
              stroke={p.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
              pointerEvents="none"
            />
          ) : null}
          {p.dots.map((dot) => (
            <g key={`d-${j}-${dot.dayIndex}`}>
              {showPointHover ? (
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={14}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    setHover({ seriesIndex: j, dayIndex: dot.dayIndex, clientX: e.clientX, clientY: e.clientY })
                  }
                  onMouseMove={(e) =>
                    setHover({ seriesIndex: j, dayIndex: dot.dayIndex, clientX: e.clientX, clientY: e.clientY })
                  }
                />
              ) : null}
              <circle cx={dot.x} cy={dot.y} r={3} fill={p.color} pointerEvents="none" />
            </g>
          ))}
        </g>
      ))}
      <HighlightLine geo={geo} x={highlightX} theme={theme} />
      {xLabels.map((xl) => (
        <text
          key={xl.key}
          x={xl.x}
          y={vbH - 10}
          textAnchor="middle"
          fill={theme.textMuted}
          fontSize={11}
        >
          {xl.text}
        </text>
      ))}
    </svg>
    {showPointHover &&
      hover != null &&
      hoverPx &&
      rowsByDay[hover.dayIndex] != null &&
      metricsForHover[hover.seriesIndex] != null && (
        <MetricPointTooltip
          row={rowsByDay[hover.dayIndex]}
          metric={metricsForHover[hover.seriesIndex]}
          theme={theme}
          x={hoverPx.x}
          y={hoverPx.y}
          containerW={hoverPx.w}
        />
      )}
    </Box>
  );
}

/**
 * @param {string|null} props.selectedCalendarDate — YYYY-MM-DD from check-in calendar; highlights day + scrolls drill chart
 * @param {() => void} [props.onShowAllMetrics] — return to the six-metric combined chart (clears Today metric selection)
 */
export default function WeeklyMetricCircles({
  weeklyRows,
  last21Rows = [],
  theme,
  selectedMetricId = null,
  selectedCalendarDate = null,
  onShowAllMetrics,
}) {
  const metrics = useMemo(
    () => [
      {
        id: "activity",
        title: "Activity",
        field: "steps",
        unit: "steps",
        yMax: 12000,
        color: theme.metric.steps,
      },
      {
        id: "sleep",
        title: "Sleep",
        field: "sleep",
        unit: "h",
        yMax: 10,
        color: theme.metric.sleep,
      },
      {
        id: "nutrition",
        title: "Nutrition",
        field: "nutrition_score",
        unit: "score",
        yMax: 100,
        color: theme.metric.nutrition,
      },
      {
        id: "smoking",
        title: "Smoking",
        field: "cigarettes_per_day",
        unit: "cigs/day",
        yMax: 20,
        color: theme.snapshotIcon.smoking,
      },
      {
        id: "stress",
        title: "Stress",
        field: "stress_score",
        unit: "score",
        yMax: 10,
        color: theme.snapshotIcon.stressSocial,
      },
      {
        id: "mood",
        title: "Mood",
        field: "mood_score",
        unit: "score",
        yMax: 10,
        color: theme.metric.mood,
      },
    ],
    [theme]
  );

  const selected = metrics.find((m) => m.id === selectedMetricId);

  const effectiveWeeklyRows = useMemo(() => {
    if (weeklyRows && weeklyRows.length > 0 && rowsHaveChartableMetric(weeklyRows)) {
      return weeklyRows;
    }
    return buildDummyRows(7);
  }, [weeklyRows]);

  const effectiveLast21Rows = useMemo(() => {
    if (last21Rows && last21Rows.length > 0 && rowsHaveChartableMetric(last21Rows)) {
      return last21Rows;
    }
    return buildDummyRows(21);
  }, [last21Rows]);

  const multiSeries = useMemo(() => {
    return metrics.map((m) => ({
      data: buildSeries(effectiveWeeklyRows, m.field),
      color: m.color,
      yMax: m.yMax,
      label: m.title,
    }));
  }, [metrics, effectiveWeeklyRows]);

  const threeWeekData = useMemo(() => {
    if (!selected) return [];
    return buildSeries(effectiveLast21Rows, selected.field);
  }, [effectiveLast21Rows, selected]);

  const yDomainMax = useMemo(() => {
    if (!selected) return 10;
    return yAxisUpperBound(threeWeekData, selected.yMax);
  }, [threeWeekData, selected]);

  const chartCardSx = {
    boxShadow: "none",
    border: "none",
    bgcolor: "transparent",
    borderRadius: 0,
  };

  const hasWeekData = multiSeries[0]?.data?.length > 0;

  const chartAreaRef = useRef(null);
  const hScrollRef = useRef(null);
  const hScrollInnerRef = useRef(null);
  const [areaSize, setAreaSize] = useState({ w: 800, h: 320 });

  useEffect(() => {
    const el = chartAreaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(280, cr.width);
      const h = Math.max(220, cr.height);
      setAreaSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedMetricId]);

  const geoAll = useMemo(() => makeGeo(areaSize.w, areaSize.h), [areaSize.w, areaSize.h]);

  /** Three “windows” wide so you scroll horizontally through ~three weeks. */
  const drillInnerW = Math.max(Math.max(1, areaSize.w - 88) * 3, 720);
  const geoDrill = useMemo(() => makeGeo(drillInnerW, areaSize.h), [drillInnerW, areaSize.h]);

  const scrollDrillToDate = useCallback(() => {
    const scrollEl = hScrollRef.current;
    const innerEl = hScrollInnerRef.current;
    if (!scrollEl || !innerEl || !selectedCalendarDate || !threeWeekData.length) return;
    const idx = threeWeekData.findIndex((d) => d.date === selectedCalendarDate);
    if (idx < 0) return;
    const n = threeWeekData.length;
    const ratio = idx / Math.max(n - 1, 1);
    const innerW = innerEl.offsetWidth;
    const vw = scrollEl.clientWidth;
    const target = ratio * innerW - vw / 2;
    scrollEl.scrollTo({ left: Math.max(0, Math.min(target, innerW - vw)), behavior: "smooth" });
  }, [selectedCalendarDate, threeWeekData]);

  useLayoutEffect(() => {
    if (!selectedMetricId || !threeWeekData.length) return;
    const t = requestAnimationFrame(() => scrollDrillToDate());
    return () => cancelAnimationFrame(t);
  }, [selectedCalendarDate, threeWeekData, selectedMetricId, scrollDrillToDate]);

  const scrollH = useCallback((dir) => {
    const el = hScrollRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        mb: 0,
      }}
    >
      <Card elevation={0} sx={{ ...chartCardSx, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <CardContent
          sx={{
            pt: 0,
            px: 0,
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            "&:last-child": { pb: 0 },
          }}
        >
          {!selectedMetricId ? (
            <>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1, rowGap: 0.5, flexShrink: 0 }}>
                {metrics.map((m) => (
                  <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: m.color }} />
                    <Typography variant="caption" sx={{ color: theme.textMuted, fontSize: "0.7rem" }}>
                      {m.title}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {!hasWeekData ? (
                <Typography variant="body2" sx={{ color: theme.textMuted }}>
                  No data for this period yet.
                </Typography>
              ) : (
                <Box
                  ref={chartAreaRef}
                  sx={{
                    flex: 1,
                    minHeight: 200,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <MultiNormalizedLineChart
                    seriesList={multiSeries}
                    theme={theme}
                    geo={geoAll}
                    highlightDate={selectedCalendarDate}
                    rowsByDay={effectiveWeeklyRows}
                    metrics={metrics}
                  />
                </Box>
              )}
            </>
          ) : selected ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  mb: 0.75,
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.text }}>
                  {selected.title} — three weeks
                </Typography>
                {typeof onShowAllMetrics === "function" ? (
                  <Button
                    type="button"
                    size="small"
                    variant="text"
                    startIcon={<SquaresFour size={18} weight="duotone" />}
                    onClick={onShowAllMetrics}
                    sx={{
                      color: theme.logoGreen,
                      textTransform: "none",
                      fontWeight: 600,
                      flexShrink: 0,
                      "&:hover": { bgcolor: alpha(theme.logoGreen, 0.08) },
                    }}
                  >
                    All metrics
                  </Button>
                ) : null}
              </Box>
              {threeWeekData.length === 0 ? (
                <Typography variant="body2" sx={{ color: theme.textMuted }}>
                  No data for this period yet.
                </Typography>
              ) : (
                <Box
                  ref={chartAreaRef}
                  sx={{
                    flex: 1,
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "stretch",
                    gap: 0.5,
                    width: "100%",
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => scrollH(-1)}
                    aria-label="Scroll chart left"
                    sx={{ alignSelf: "center", flexShrink: 0 }}
                  >
                    <CaretLeft size={22} />
                  </IconButton>
                  <Box
                    ref={hScrollRef}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflowX: "auto",
                      overflowY: "hidden",
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                      "&::-webkit-scrollbar": { display: "none" },
                    }}
                  >
                    <Box
                      ref={hScrollInnerRef}
                      sx={{
                        width: `${drillInnerW}px`,
                        height: "100%",
                        minHeight: 200,
                      }}
                    >
                      <SimpleWeeklyLineChart
                        data={threeWeekData}
                        color={selected.color}
                        yMax={yDomainMax}
                        theme={theme}
                        geo={geoDrill}
                        highlightDate={selectedCalendarDate}
                        rowsByDay={effectiveLast21Rows}
                        hoverMetric={selected}
                      />
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => scrollH(1)}
                    aria-label="Scroll chart right"
                    sx={{ alignSelf: "center", flexShrink: 0 }}
                  >
                    <CaretRight size={22} />
                  </IconButton>
                </Box>
              )}
            </>
          ) : (
            <Typography variant="body2" sx={{ color: theme.textMuted }}>
              Select a Today metric above.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
