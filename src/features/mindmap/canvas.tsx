/* Mindmap – Zeichenfläche (react-native-svg). Optik und Maße wie Web tools/mindmap/mindmap.css + mindmap.js (renderMap, updateNodeView):
 * Punktraster, Thema als getönte Ellipse, Beschriftungen ohne Rahmen, gestrichelter Auswahlrahmen, Linien nach Tiefe,
 * Bewegung der Äste (380 ms, bei „Bewegung reduzieren“ aus). Verschieben und Zoomen übernimmt die iOS-ScrollView (Pinch, Schwung);
 * außerhalb von iOS (nur für Vorschauen im Browser) wird mit festen Zoomstufen skaliert.
 * Jeder Knoten ist zusätzlich ein eigenes, zugängliches Tippfeld über der Grafik (VoiceOver, Aktionen, große Tippfläche). */
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type Ref } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { usePensumTheme } from '../../theme';
import { familyOf } from './measure';
import {
  ANIMATION_MS, ROOT_FILL_OPACITY, ROOT_STROKE, edgePath, frameAt, isPaper, nodeLabel, planTransition, restingPositions,
  type Positions, type Scene, type SceneNode, type Transition,
} from './scene';
import { ZOOM, clampZoom, fitZoom, stepZoom } from './state';

export interface CanvasHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(animated?: boolean): void;
}

interface CanvasProps {
  scene: Scene;
  ink: string;
  selectedId: string;
  /** Ändert sich, wenn eine andere Mindmap oder Schrift geöffnet wird: dann wird neu eingepasst und nicht animiert. */
  fitKey: string;
  height: number;
  onSelect(id: string): void;
  /** Tippen auf den schon gewählten Punkt: Textfeld fokussieren (Web: Doppelklick). */
  onEdit(id: string): void;
  onToggleFold(id: string): void;
  ref?: Ref<CanvasHandle>;
}

const DOT = 22;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduce(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduce;
}

/* ---------- Ein Knoten in der Grafik ---------- */

interface NodeViewProps { node: SceneNode; x: number; y: number; alpha: number; ink: string; selected: boolean; background: string; customFonts: boolean }

const NodeView = memo(function NodeView({ node, x, y, alpha, ink, selected, background, customFonts }: NodeViewProps) {
  const { w, h } = node;
  return (
    <G transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} opacity={alpha}>
      {node.root ? (
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={ink} fillOpacity={ROOT_FILL_OPACITY} stroke={ink} strokeWidth={ROOT_STROKE} />
      ) : null}
      {node.lines.map((line, i) => line.kind === 'ink' ? (
        <Path key={i} d={line.d} fill="none" stroke={ink} strokeWidth={line.width} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <SvgText
          key={i}
          x={line.x}
          y={line.baseline}
          fontSize={line.size}
          fill={ink}
          textAnchor="middle"
          {...(customFonts ? { fontFamily: familyOf(line.face) } : { fontWeight: line.weight >= 600 ? '600' : '400' })}
        >
          {line.text}
        </SvgText>
      ))}
      {selected ? (node.root ? (
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2 + 6} ry={h / 2 + 6} fill="none" stroke={ink} strokeWidth={1.8} strokeDasharray="4 4" />
      ) : (
        <Rect x={-3} y={-3} width={w + 6} height={h + 6} rx={14} fill="none" stroke={ink} strokeWidth={1.8} strokeDasharray="4 4" />
      )) : null}
      {node.folded ? (
        <G>
          <Circle cx={w} cy={0} r={10} fill={background} stroke={ink} strokeWidth={1.5} />
          <SvgText x={w} y={3.6} fontSize={10.5} fill={ink} textAnchor="middle" {...(customFonts ? { fontFamily: familyOf('semibold') } : { fontWeight: '600' })}>
            {`+${node.hidden}`}
          </SvgText>
        </G>
      ) : null}
    </G>
  );
});

/* ---------- Zeichenfläche ---------- */

export const MindmapCanvas = memo(function MindmapCanvas({ scene, ink, selectedId, fitKey, height, onSelect, onEdit, onToggleFold, ref }: CanvasProps) {
  const { colors, customFonts } = usePensumTheme();
  const reduceMotion = useReduceMotion();
  const native = Platform.OS === 'ios';
  const paper = isPaper(ink);
  const background = paper ? '#ffffff' : colors.canvas;
  const dots = paper ? '#e4e4e4' : colors.border;

  /* Bewegung: der Zustand hält nur den Fortschritt, alles Übrige folgt aus (Szene, Übergang, t) */
  const [anim, setAnim] = useState<{ scene: Scene; transition: Transition; t: number } | null>(null);
  const shown = useRef<Positions | undefined>(undefined);
  const lastFit = useRef<string | null>(null);
  const raf = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null; }
    const first = lastFit.current !== fitKey;
    const transition = planTransition(first ? undefined : shown.current, scene);
    const rest = restingPositions(scene);
    if (reduceMotion || (!transition.moves && !transition.fresh.size)) {
      shown.current = rest;
      setAnim(null);
      return;
    }
    const t0 = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / ANIMATION_MS);
      if (t >= 1) { shown.current = rest; setAnim(null); raf.current = null; return; }
      shown.current = frameAt(scene, transition, t).positions;
      setAnim({ scene, transition, t });
      raf.current = requestAnimationFrame(tick);
    };
    setAnim({ scene, transition, t: 0 });
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null; } };
  }, [scene, reduceMotion, fitKey]);

  const frame = anim && anim.scene === scene ? frameAt(scene, anim.transition, anim.t) : null;
  const rest = useMemo(() => restingPositions(scene), [scene]);
  const positions = frame?.positions ?? rest;
  const alphaOf = frame?.alpha ?? (() => 1);

  /* Zoom */
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const view = useRef({ w: 0, h: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const zoom = useRef(1);
  const [webZoom, setWebZoom] = useState(1);
  const k = native ? 1 : webZoom;

  const zoomToLevel = useCallback((z: number, animated: boolean) => {
    const { w, h } = view.current;
    if (!w || !h) return;
    if (!native) { setWebZoom(clampZoom(z)); return; }
    const target = clampZoom(z);
    const now = zoom.current || 1;
    const cx = (offset.current.x + w / 2) / now, cy = (offset.current.y + h / 2) / now;
    const rw = w / target, rh = h / target;
    scroller.current?.scrollResponderZoomTo({ x: Math.max(0, cx - rw / 2), y: Math.max(0, cy - rh / 2), width: rw, height: rh, animated });
  }, [native]);

  const fit = useCallback((animated = true) => {
    const { w, h } = view.current;
    if (!w || !h) return;
    const z = fitZoom(scene.width, scene.height, w, h);
    if (!native) { setWebZoom(z); return; }
    scroller.current?.scrollResponderZoomTo({ x: 0, y: 0, width: w / z, height: h / z, animated });
    zoom.current = z;
  }, [native, scene.height, scene.width]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomToLevel(stepZoom(native ? zoom.current : webZoom, 1), true),
    zoomOut: () => zoomToLevel(stepZoom(native ? zoom.current : webZoom, -1), true),
    fit,
  }), [fit, native, webZoom, zoomToLevel]);

  // Beim Öffnen einer anderen Karte (oder Schrift) einpassen, sobald die Größe der Fläche bekannt ist
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    if (!measured || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    fit(false);
  }, [fit, fitKey, measured]);

  const onLayout = (e: LayoutChangeEvent) => {
    view.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    setMeasured(true);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = e.nativeEvent;
    offset.current = { x: n.contentOffset.x, y: n.contentOffset.y };
    if (typeof n.zoomScale === 'number') zoom.current = n.zoomScale;
  };

  const W = scene.width * k, H = scene.height * k;
  const edges = scene.edges.map((e) => ({ e, d: edgePath(e, positions) }));

  const content = (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${scene.width} ${scene.height}`} accessible={false} importantForAccessibility="no-hide-descendants">
        {edges.map(({ e, d }) => d ? (
          <Path key={e.id} d={d} fill="none" stroke={ink} strokeWidth={e.width} strokeLinecap="round" opacity={alphaOf(e.toId)} />
        ) : null)}
        {scene.nodes.map((n) => {
          const p = positions.get(n.id) ?? n;
          return <NodeView key={n.id} node={n} x={p.x} y={p.y} alpha={alphaOf(n.id)} ink={ink} selected={n.id === selectedId} background={background} customFonts={customFonts} />;
        })}
      </Svg>
      {scene.nodes.map((n) => {
        const p = positions.get(n.id) ?? n;
        const slopX = Math.min(8, Math.max(0, (44 - n.w * k) / 2)), slopY = Math.min(8, Math.max(0, (44 - n.h * k) / 2));
        const selected = n.id === selectedId;
        const foldable = n.hasKids && !n.root;
        return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={nodeLabel(n)}
            accessibilityHint={foldable ? 'Tippen wählt den Punkt, lang drücken klappt den Ast ein oder aus.' : 'Tippen wählt den Punkt.'}
            accessibilityState={{ selected, expanded: foldable ? !n.folded : undefined }}
            accessibilityActions={[
              { name: 'activate', label: selected ? 'Text bearbeiten' : 'Auswählen' },
              ...(foldable ? [{ name: 'fold', label: n.folded ? 'Ausklappen' : 'Einklappen' }] : []),
            ]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'fold') onToggleFold(n.id);
              else if (selected) onEdit(n.id);
              else onSelect(n.id);
            }}
            onPress={() => (selected ? onEdit(n.id) : onSelect(n.id))}
            onLongPress={foldable ? () => onToggleFold(n.id) : undefined}
            delayLongPress={450}
            hitSlop={{ top: slopY, bottom: slopY, left: slopX, right: slopX }}
            style={{ position: 'absolute', left: p.x * k, top: p.y * k, width: n.w * k, height: n.h * k, opacity: alphaOf(n.id) > 0 ? 1 : 0 }}
          />
        );
      })}
    </View>
  );

  return (
    <View onLayout={onLayout} style={[styles.frame, { height, backgroundColor: background, borderColor: colors.border }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
        <Defs>
          <Pattern id="mm-dots" x={0} y={0} width={DOT} height={DOT} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={dots} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#mm-dots)" />
      </Svg>
      {native ? (
        <ScrollView
          ref={scroller}
          style={StyleSheet.absoluteFill}
          minimumZoomScale={ZOOM.min}
          maximumZoomScale={ZOOM.max}
          bouncesZoom
          centerContent
          scrollEventThrottle={32}
          onScroll={onScroll}
          directionalLockEnabled={false}
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          indicatorStyle={paper ? 'black' : undefined}
          accessibilityLabel="Mindmap"
        >
          {content}
        </ScrollView>
      ) : (
        <ScrollView style={StyleSheet.absoluteFill} horizontal nestedScrollEnabled>
          <ScrollView nestedScrollEnabled>{content}</ScrollView>
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden', minHeight: 240 },
});
