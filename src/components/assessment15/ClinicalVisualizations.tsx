/**
 * Kneeva Clinical Visualizations
 * Precision SVG medical charts tailored for the 15-Minute Assessment Routine.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
  Polyline,
  Polygon,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DEFAULT_WIDTH = Math.min(SCREEN_WIDTH - 40, 520);

// ─────────────────────────────────────────────────────────────
// 1. Dual-Axis Line / Area Chart with Overlays & Shading
// ─────────────────────────────────────────────────────────────

interface MultiLineSeries {
  id: string;
  name: string;
  color: string;
  data: number[];
  dashed?: boolean;
  unit?: string;
  yMin?: number;
  yMax?: number;
}

interface PhaseZone {
  label: string;
  startIdx: number;
  endIdx: number;
  fillColor: string;
}

export function MedicalTimeSeriesChart({
  title,
  subtitle,
  series,
  phases = [],
  highlightPeakIndex,
  height = 180,
  width = DEFAULT_WIDTH,
  xAxisLabels = [],
  xLabel = 'Time (s)',
}: {
  title: string;
  subtitle?: string;
  series: MultiLineSeries[];
  phases?: PhaseZone[];
  highlightPeakIndex?: number;
  height?: number;
  width?: number;
  xAxisLabels?: string[];
  xLabel?: string;
}) {
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 28;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  if (series.length === 0 || series[0].data.length === 0) {
    return null;
  }

  const numPoints = Math.max(...series.map((s) => s.data.length));

  // Determine global min and max for series
  const allY = series.flatMap((s) => s.data);
  const globalMin = Math.min(...allY, 0);
  const globalMax = Math.max(...allY, 1);
  const ySpan = globalMax - globalMin || 1;

  const getX = (idx: number) => padLeft + (idx / Math.max(1, numPoints - 1)) * plotW;
  const getY = (val: number, customMin?: number, customMax?: number) => {
    const min = customMin !== undefined ? customMin : globalMin;
    const max = customMax !== undefined ? customMax : globalMax;
    const span = max - min || 1;
    return padTop + plotH - ((val - min) / span) * plotH;
  };

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
      </View>

      <Svg width={width} height={height}>
        <Defs>
          {series.map((s, i) => (
            <LinearGradient key={`grad-${i}`} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={s.color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={s.color} stopOpacity="0.02" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Phase Shading */}
        {phases.map((p, i) => {
          const x1 = getX(p.startIdx);
          const x2 = getX(p.endIdx);
          return (
            <G key={`phase-${i}`}>
              <Rect
                x={x1}
                y={padTop}
                width={Math.max(0, x2 - x1)}
                height={plotH}
                fill={p.fillColor}
                opacity={0.35}
              />
              <SvgText
                x={(x1 + x2) / 2}
                y={padTop + 12}
                fontSize="9"
                fontWeight="bold"
                fill="#334155"
                textAnchor="middle"
              >
                {p.label}
              </SvgText>
            </G>
          );
        })}

        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padTop + plotH * ratio;
          const val = Math.round(globalMax - ratio * ySpan);
          return (
            <G key={`grid-${i}`}>
              <Line
                x1={padLeft}
                y1={y}
                x2={padLeft + plotW}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <SvgText x={padLeft - 6} y={y + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
                {val}
              </SvgText>
            </G>
          );
        })}

        {/* Series Paths */}
        {series.map((s) => {
          const points = s.data.map((val, idx) => `${getX(idx)},${getY(val, s.yMin, s.yMax)}`).join(' ');
          const areaPoints = `${getX(0)},${padTop + plotH} ${points} ${getX(s.data.length - 1)},${padTop + plotH}`;

          return (
            <G key={s.id}>
              {/* Optional Fill Underneath */}
              <Polyline points={areaPoints} fill={`url(#grad-${s.id})`} stroke="none" />
              {/* Main Line */}
              <Polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeDasharray={s.dashed ? '4,4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Highlight Peak */}
              {highlightPeakIndex !== undefined && s.data[highlightPeakIndex] !== undefined && (
                <G>
                  <Circle
                    cx={getX(highlightPeakIndex)}
                    cy={getY(s.data[highlightPeakIndex], s.yMin, s.yMax)}
                    r="5"
                    fill={s.color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <SvgText
                    x={getX(highlightPeakIndex)}
                    y={getY(s.data[highlightPeakIndex], s.yMin, s.yMax) - 8}
                    fontSize="10"
                    fontWeight="bold"
                    fill={s.color}
                    textAnchor="middle"
                  >
                    {Math.round(s.data[highlightPeakIndex])} {s.unit || ''}
                  </SvgText>
                </G>
              )}
            </G>
          );
        })}

        {/* X Axis Bottom Line */}
        <Line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke="#94A3B8"
          strokeWidth="1"
        />

        {/* X Axis Ticks & Labels */}
        {xAxisLabels.length > 0
          ? xAxisLabels.map((lbl, idx) => {
              const x = padLeft + (idx / Math.max(1, xAxisLabels.length - 1)) * plotW;
              return (
                <SvgText key={`xlbl-${idx}`} x={x} y={padTop + plotH + 15} fontSize="9" fill="#64748B" textAnchor="middle">
                  {lbl}
                </SvgText>
              );
            })
          : [0, 0.5, 1].map((r, i) => {
              const x = padLeft + plotW * r;
              return (
                <SvgText key={`xtick-${i}`} x={x} y={padTop + plotH + 15} fontSize="9" fill="#64748B" textAnchor="middle">
                  {r === 0 ? 'Start' : r === 0.5 ? 'Mid' : 'End'}
                </SvgText>
              );
            })}
      </Svg>

      {/* Legend */}
      <View style={styles.legendRow}>
        {series.map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Grouped Comparison Bar Chart (e.g. Left vs Right / Phase)
// ─────────────────────────────────────────────────────────────

interface BarGroup {
  label: string;
  leftValue: number;
  rightValue?: number;
  refValue?: number;
}

export function ComparisonBarChart({
  title,
  subtitle,
  groups,
  leftLabel = 'Left Knee',
  rightLabel = 'Right Knee',
  leftColor = '#0284C7',
  rightColor = '#0D9488',
  unit = '',
  height = 180,
  width = DEFAULT_WIDTH,
}: {
  title: string;
  subtitle?: string;
  groups: BarGroup[];
  leftLabel?: string;
  rightLabel?: string;
  leftColor?: string;
  rightColor?: string;
  unit?: string;
  height?: number;
  width?: number;
}) {
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    ...groups.flatMap((g) => [g.leftValue, g.rightValue || 0, g.refValue || 0]),
    1
  );

  const groupWidth = plotW / groups.length;
  const hasRight = groups.some((g) => g.rightValue !== undefined);
  const barW = hasRight ? groupWidth * 0.32 : groupWidth * 0.5;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
      </View>

      <Svg width={width} height={height}>
        {/* Baseline & Ticks */}
        {[0, 0.5, 1].map((r, i) => {
          const y = padTop + plotH * (1 - r);
          return (
            <G key={`tick-${i}`}>
              <Line
                x1={padLeft}
                y1={y}
                x2={padLeft + plotW}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <SvgText x={padLeft - 6} y={y + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
                {Math.round(r * maxVal)}
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {groups.map((g, idx) => {
          const groupCenterX = padLeft + idx * groupWidth + groupWidth / 2;
          const leftBarH = (g.leftValue / maxVal) * plotH;
          const leftX = hasRight ? groupCenterX - barW - 2 : groupCenterX - barW / 2;
          const leftY = padTop + plotH - leftBarH;

          return (
            <G key={`grp-${idx}`}>
              {/* Left Bar */}
              <Rect
                x={leftX}
                y={leftY}
                width={barW}
                height={leftBarH}
                fill={leftColor}
                rx="3"
              />
              <SvgText
                x={leftX + barW / 2}
                y={leftY - 4}
                fontSize="9"
                fontWeight="bold"
                fill={leftColor}
                textAnchor="middle"
              >
                {Math.round(g.leftValue)}
              </SvgText>

              {/* Right Bar */}
              {hasRight && g.rightValue !== undefined && (
                <>
                  <Rect
                    x={groupCenterX + 2}
                    y={padTop + plotH - (g.rightValue / maxVal) * plotH}
                    width={barW}
                    height={(g.rightValue / maxVal) * plotH}
                    fill={rightColor}
                    rx="3"
                  />
                  <SvgText
                    x={groupCenterX + 2 + barW / 2}
                    y={padTop + plotH - (g.rightValue / maxVal) * plotH - 4}
                    fontSize="9"
                    fontWeight="bold"
                    fill={rightColor}
                    textAnchor="middle"
                  >
                    {Math.round(g.rightValue)}
                  </SvgText>
                </>
              )}

              {/* Reference line/marker if provided */}
              {g.refValue !== undefined && (
                <Line
                  x1={groupCenterX - barW}
                  y1={padTop + plotH - (g.refValue / maxVal) * plotH}
                  x2={groupCenterX + (hasRight ? barW * 2 : barW)}
                  y2={padTop + plotH - (g.refValue / maxVal) * plotH}
                  stroke="#E11D48"
                  strokeWidth="1.5"
                  strokeDasharray="3,2"
                />
              )}

              {/* X Axis Label */}
              <SvgText
                x={groupCenterX}
                y={padTop + plotH + 16}
                fontSize="10"
                fill="#475569"
                fontWeight="500"
                textAnchor="middle"
              >
                {g.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: leftColor }]} />
          <Text style={styles.legendText}>{leftLabel} {unit ? `(${unit})` : ''}</Text>
        </View>
        {hasRight && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: rightColor }]} />
            <Text style={styles.legendText}>{rightLabel} {unit ? `(${unit})` : ''}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Postural Sway Trajectory & Area Scatter (X-Y Plot)
// ─────────────────────────────────────────────────────────────

export function PosturalSwayScatterChart({
  title,
  subtitle,
  leftPath,
  rightPath,
  leftArea,
  rightArea,
  height = 190,
  width = DEFAULT_WIDTH,
}: {
  title: string;
  subtitle?: string;
  leftPath: [number, number][];
  rightPath: [number, number][];
  leftArea: number;
  rightArea: number;
  height?: number;
  width?: number;
}) {
  const pad = 30;
  const plotSize = Math.min(width - pad * 2, height - pad * 2);
  const centerX = width / 2;
  const centerY = height / 2 + 5;
  const scale = plotSize / 7.0; // cm to px

  const toPxX = (x: number) => centerX + x * scale;
  const toPxY = (y: number) => centerY - y * scale;

  const leftPoints = leftPath.map(([x, y]) => `${toPxX(x)},${toPxY(y)}`).join(' ');
  const rightPoints = rightPath.map(([x, y]) => `${toPxX(x)},${toPxY(y)}`).join(' ');

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
      </View>

      <Svg width={width} height={height}>
        {/* Concentric Reference Rings (1cm, 2cm, 3cm radius) */}
        {[1, 2, 3].map((r) => (
          <G key={`ring-${r}`}>
            <Circle
              cx={centerX}
              cy={centerY}
              r={r * scale}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <SvgText x={centerX + r * scale} y={centerY - 3} fontSize="8" fill="#94A3B8">
              {r}cm
            </SvgText>
          </G>
        ))}

        {/* Center Crosshairs */}
        <Line x1={centerX - plotSize / 2} y1={centerY} x2={centerX + plotSize / 2} y2={centerY} stroke="#CBD5E1" strokeWidth="1" />
        <Line x1={centerX} y1={centerY - plotSize / 2} x2={centerX} y2={centerY + plotSize / 2} stroke="#CBD5E1" strokeWidth="1" />

        {/* Right Knee Sway Path (Green/Teal) */}
        <Polyline points={rightPoints} fill="none" stroke="#0D9488" strokeWidth="2" strokeOpacity="0.85" />
        {rightPath.map(([x, y], idx) => (
          <Circle key={`r-${idx}`} cx={toPxX(x)} cy={toPxY(y)} r="2" fill="#0D9488" />
        ))}

        {/* Left Knee Sway Path (Blue/Amber) */}
        <Polyline points={leftPoints} fill="none" stroke="#D97706" strokeWidth="2" strokeOpacity="0.9" />
        {leftPath.map(([x, y], idx) => (
          <Circle key={`l-${idx}`} cx={toPxX(x)} cy={toPxY(y)} r="2.5" fill="#D97706" />
        ))}

        <Circle cx={centerX} cy={centerY} r="3" fill="#0F172A" />
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
          <Text style={styles.legendText}>Left Leg Area: <Text style={styles.boldText}>{leftArea} cm²</Text></Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
          <Text style={styles.legendText}>Right Leg Area: <Text style={styles.boldText}>{rightArea} cm²</Text></Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Radar / Spiderweb Multimodal Joint Symmetry Chart
// ─────────────────────────────────────────────────────────────

interface RadarDimension {
  key: string;
  label: string;
  leftNormalized: number;  // 0.0 - 1.0
  rightNormalized: number; // 0.0 - 1.0
  rawLeft: string;
  rawRight: string;
}

export function BilateralRadarChart({
  title,
  subtitle,
  dimensions,
  height = 220,
  width = DEFAULT_WIDTH,
}: {
  title: string;
  subtitle?: string;
  dimensions: RadarDimension[];
  height?: number;
  width?: number;
}) {
  const centerX = width / 2;
  const centerY = height / 2 + 5;
  const radius = Math.min(width, height) / 2 - 38;
  const total = dimensions.length;

  const getCoord = (idx: number, ratio: number) => {
    const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
    return {
      x: centerX + radius * ratio * Math.cos(angle),
      y: centerY + radius * ratio * Math.sin(angle),
    };
  };

  const leftPoints = dimensions.map((d, i) => {
    const p = getCoord(i, d.leftNormalized);
    return `${p.x},${p.y}`;
  }).join(' ');

  const rightPoints = dimensions.map((d, i) => {
    const p = getCoord(i, d.rightNormalized);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        {subtitle && <Text style={styles.chartSubtitle}>{subtitle}</Text>}
      </View>

      <Svg width={width} height={height}>
        {/* Background Grids (25%, 50%, 75%, 100%) */}
        {[0.25, 0.5, 0.75, 1.0].map((ratio, gridIdx) => {
          const gridPoints = dimensions.map((_, i) => {
            const p = getCoord(i, ratio);
            return `${p.x},${p.y}`;
          }).join(' ');
          return (
            <Polygon
              key={`grid-${gridIdx}`}
              points={gridPoints}
              fill={gridIdx === 3 ? '#F8FAFC' : 'none'}
              stroke="#E2E8F0"
              strokeWidth="1"
            />
          );
        })}

        {/* Radial Axis Spokes */}
        {dimensions.map((d, i) => {
          const outer = getCoord(i, 1.0);
          const labelP = getCoord(i, 1.22);
          return (
            <G key={`spoke-${i}`}>
              <Line x1={centerX} y1={centerY} x2={outer.x} y2={outer.y} stroke="#CBD5E1" strokeWidth="1" />
              <SvgText
                x={labelP.x}
                y={labelP.y + 4}
                fontSize="9"
                fontWeight="bold"
                fill="#334155"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </G>
          );
        })}

        {/* Right Knee Polygon (Teal) */}
        <Polygon points={rightPoints} fill="#0D9488" fillOpacity="0.25" stroke="#0D9488" strokeWidth="2" />
        {dimensions.map((d, i) => {
          const p = getCoord(i, d.rightNormalized);
          return <Circle key={`rdot-${i}`} cx={p.x} cy={p.y} r="3" fill="#0D9488" />;
        })}

        {/* Left Knee Polygon (Orange/Amber) */}
        <Polygon points={leftPoints} fill="#D97706" fillOpacity="0.30" stroke="#D97706" strokeWidth="2" />
        {dimensions.map((d, i) => {
          const p = getCoord(i, d.leftNormalized);
          return <Circle key={`ldot-${i}`} cx={p.x} cy={p.y} r="3" fill="#D97706" />;
        })}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
          <Text style={styles.legendText}>Left Knee (Symptomatic)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0D9488' }]} />
          <Text style={styles.legendText}>Right Knee (Contralateral)</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Session Pain Trend Line (Start -> Strength -> End -> Recovery)
// ─────────────────────────────────────────────────────────────

export function PainSessionTimelineChart({
  painTimeline,
  height = 150,
  width = DEFAULT_WIDTH,
}: {
  painTimeline: { start: number; postStrength: number; endMovement: number; recovery: number };
  height?: number;
  width?: number;
}) {
  const points = [
    { label: 'Start', val: painTimeline.start },
    { label: 'Post-Strength', val: painTimeline.postStrength },
    { label: 'End Movement', val: painTimeline.endMovement },
    { label: 'Recovery (5m)', val: painTimeline.recovery },
  ];

  const padLeft = 40;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 25;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (i: number) => padLeft + (i / 3) * plotW;
  const getY = (val: number) => padTop + plotH - (val / 10) * plotH;

  const polylineStr = points.map((p, i) => `${getX(i)},${getY(p.val)}`).join(' ');

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>VAS Pain Progression Across Session</Text>
        <Text style={styles.chartSubtitle}>0-10 Visual Analogue Scale Response</Text>
      </View>

      <Svg width={width} height={height}>
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <G key={`pgrid-${v}`}>
            <Line x1={padLeft} y1={getY(v)} x2={padLeft + plotW} y2={getY(v)} stroke="#F1F5F9" strokeWidth="1" />
            <SvgText x={padLeft - 6} y={getY(v) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">
              {v}
            </SvgText>
          </G>
        ))}

        <Polyline points={polylineStr} fill="none" stroke="#E11D48" strokeWidth="2.5" />

        {points.map((p, i) => (
          <G key={`pt-${i}`}>
            <Circle cx={getX(i)} cy={getY(p.val)} r="4" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.5" />
            <SvgText x={getX(i)} y={getY(p.val) - 7} fontSize="10" fontWeight="bold" fill="#E11D48" textAnchor="middle">
              {p.val}
            </SvgText>
            <SvgText x={getX(i)} y={padTop + plotH + 15} fontSize="9" fill="#475569" textAnchor="middle">
              {p.label}
            </SvgText>
          </G>
        ))}
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  chartHeader: {
    width: '100%',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  chartSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#334155',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
});
