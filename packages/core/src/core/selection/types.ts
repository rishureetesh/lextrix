export interface NormalizedNativeRange {
  start: { node: Node; offset: number };
  end: { node: Node; offset: number };
  native: AbstractRange;
}

export interface DocumentSpan {
  index: number;
  length: number;
}

export interface Bounds {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}
