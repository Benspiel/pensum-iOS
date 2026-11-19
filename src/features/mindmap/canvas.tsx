import { memo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { usePensumTheme } from '../../theme';
import { familyOf } from './measure';
import { ROOT_FILL_OPACITY, ROOT_STROKE, edgePath, isPaper, nodeLabel, restingPositions, type Scene } from './scene';
import { ZOOM } from './state';
import { canvasViewport } from './wide';

const MapDrawing = memo(function MapDrawing({ scene, ink, width, height }: {
  scene: Scene;
  ink: string;
  width: number;
  height: number;
}) {
  const { customFonts } = usePensumTheme();
  const positions = restingPositions(scene);
  const zoom = width / scene.width;
  return (
    <View style={{ width, height, alignSelf: 'center' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${scene.width} ${scene.height}`} accessible={false} importantForAccessibility="no-hide-descendants">
        {scene.edges.map((e) => {
          const d = edgePath(e, positions);
          return d ? <Path key={e.id} d={d} fill="none" stroke={ink} strokeWidth={e.width} strokeLinecap="round" /> : null;
        })}
        {scene.nodes.map((node) => (
          <G key={node.id} x={node.x} y={node.y}>
            {node.root ? <Ellipse cx={node.w / 2} cy={node.h / 2} rx={node.w / 2} ry={node.h / 2} fill={ink} fillOpacity={ROOT_FILL_OPACITY} stroke={ink} strokeWidth={ROOT_STROKE} /> : null}
            {node.lines.map((line, i) => line.kind === 'ink' ? (
              <Path key={i} d={line.d} fill="none" stroke={ink} strokeWidth={line.width} strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <SvgText key={i} x={line.x} y={line.baseline} fontSize={line.size} fill={ink} textAnchor="middle"
                {...(customFonts ? { fontFamily: familyOf(line.face) } : { fontWeight: line.weight >= 600 ? '600' : '400' })}>
                {line.text}
              </SvgText>
            ))}
          </G>
        ))}
      </Svg>
      {scene.nodes.map((node) => (
        <View key={node.id} accessible accessibilityRole="text" accessibilityLabel={nodeLabel(node)}
          style={{ position: 'absolute', left: node.x * zoom, top: node.y * zoom, width: node.w * zoom, height: node.h * zoom }} />
      ))}
    </View>
  );
});

export const MindmapCanvas = memo(function MindmapCanvas({ scene, ink }: { scene: Scene; ink: string }) {
  const { colors } = usePensumTheme();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const paper = isPaper(ink);
  const backgroundColor = paper ? '#ffffff' : colors.canvas;
  const dots = paper ? '#e4e4e4' : colors.border;
  const geometry = viewport.width > 0 && viewport.height > 0 ? canvasViewport(scene, viewport) : undefined;
  const drawing = geometry ? <MapDrawing scene={scene} ink={ink} width={geometry.width} height={geometry.height} /> : null;

  return (
    <View style={[styles.frame, { backgroundColor, borderColor: colors.border }]}>
      <View style={styles.viewport} onLayout={({ nativeEvent: { layout: { width, height } } }) => {
        setViewport((old) => old.width === width && old.height === height ? old : { width, height });
      }}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
          <Defs>
            <Pattern id="mm-dots" width={22} height={22} patternUnits="userSpaceOnUse">
              <Circle cx={1} cy={1} r={1} fill={dots} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#mm-dots)" />
        </Svg>
        {geometry && (Platform.OS === 'ios' ? (
          <ScrollView
            key={`${viewport.width}:${viewport.height}:${geometry.width}:${geometry.height}`}
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{ width: geometry.contentWidth, height: geometry.contentHeight, justifyContent: 'center' }}
            contentOffset={geometry.offset}
            minimumZoomScale={ZOOM.min / geometry.zoom}
            maximumZoomScale={ZOOM.max / geometry.zoom}
            bouncesZoom
            centerContent
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            directionalLockEnabled={false}
            removeClippedSubviews={false}
            indicatorStyle={paper ? 'black' : undefined}
            accessibilityLabel="Mindmap"
          >
            {drawing}
          </ScrollView>
        ) : (
          <ScrollView style={StyleSheet.absoluteFill} horizontal nestedScrollEnabled contentOffset={{ x: geometry.offset.x, y: 0 }}>
            <ScrollView style={{ width: geometry.contentWidth, height: viewport.height }} contentContainerStyle={{ height: geometry.contentHeight, justifyContent: 'center' }}
              nestedScrollEnabled contentOffset={{ x: 0, y: geometry.offset.y }} accessibilityLabel="Mindmap">
              {drawing}
            </ScrollView>
          </ScrollView>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  viewport: { flex: 1 },
});
