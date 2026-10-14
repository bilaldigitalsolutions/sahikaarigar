import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors } from '@/theme';

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}

const THUMB = 24;

interface SliderContextState {
  props: SliderProps;
  width: number;
}

let activeSlider: SliderContextState | null = null;

const panResponder = PanResponder.create({
  onStartShouldSetPanResponder: () => true,
  onMoveShouldSetPanResponder: () => true,
  onPanResponderGrant: (e) => {
    if (!activeSlider || activeSlider.width <= 0) return;
    const { min, max, step = 1, onChange } = activeSlider.props;
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / activeSlider.width));
    const raw = min + ratio * (max - min);
    onChange(Math.min(max, Math.max(min, Math.round(raw / step) * step)));
  },
  onPanResponderMove: (e) => {
    if (!activeSlider || activeSlider.width <= 0) return;
    const { min, max, step = 1, onChange } = activeSlider.props;
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / activeSlider.width));
    const raw = min + ratio * (max - min);
    onChange(Math.min(max, Math.max(min, Math.round(raw / step) * step)));
  },
});

/**
 * Dependency-free range slider (react-native PanResponder). Used by the
 * search screen's price filter.
 */
export function Slider({ min, max, step = 1, value, onChange }: SliderProps) {
  const [width, setWidth] = useState(0);

  const stateRef = useRef<SliderContextState>({
    props: { min, max, step, value, onChange },
    width: 0,
  });

  useEffect(() => {
    stateRef.current.props = { min, max, step, value, onChange };
  });

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const ratio = max > min ? (clamp(value) - min) / (max - min) : 0;

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          stateRef.current.width = w;
          setWidth(w);
        }}
        onTouchStart={() => {
          activeSlider = stateRef.current;
        }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        <View
          style={[
            styles.thumb,
            { left: Math.max(0, Math.min(width - THUMB, ratio * width - THUMB / 2)) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    justifyContent: 'center',
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primaryDark },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: colors.white,
    top: -(THUMB / 2 - 3),
  },
});
