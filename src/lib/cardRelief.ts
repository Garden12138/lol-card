export interface ReliefStrength {
  parallax: number;
  normal: number;
}

export interface ReliefViewShift {
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveReliefStrength(
  confidence: number,
  reducedMotion: boolean,
): ReliefStrength {
  const normalizedConfidence = clamp(confidence, 0, 1);
  return {
    parallax: reducedMotion ? 0 : normalizedConfidence * .046,
    normal: reducedMotion ? 5 : 2 + normalizedConfidence * 12,
  };
}

export function resolveReliefViewShift(
  localView: { x: number; y: number; z: number },
  reducedMotion: boolean,
): ReliefViewShift {
  if (reducedMotion) return { x: 0, y: 0 };
  const divisor = Math.max(.35, Math.abs(localView.z));
  return {
    x: clamp(localView.x / divisor, -1.1, 1.1),
    y: clamp(localView.y / divisor, -1.1, 1.1),
  };
}

export const CARD_RELIEF_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const CARD_RELIEF_FRAGMENT_SHADER = `
  uniform sampler2D uArtwork;
  uniform sampler2D uDepth;
  uniform vec2 uDepthTexel;
  uniform vec2 uViewShift;
  uniform vec3 uViewDir;
  uniform vec3 uLightDir;
  uniform float uParallaxStrength;
  uniform float uNormalStrength;
  varying vec2 vUv;

  void main() {
    float edge =
      smoothstep(0.0, 0.04, vUv.x) *
      smoothstep(0.0, 0.04, vUv.y) *
      smoothstep(0.0, 0.04, 1.0 - vUv.x) *
      smoothstep(0.0, 0.04, 1.0 - vUv.y);
    float firstDepth = texture2D(uDepth, vUv).r;
    vec2 firstUv = clamp(
      vUv + uViewShift * (firstDepth - 0.5) * uParallaxStrength * edge,
      uDepthTexel,
      vec2(1.0) - uDepthTexel
    );
    float refinedDepth = texture2D(uDepth, firstUv).r;
    vec2 artworkUv = clamp(
      vUv + uViewShift * (((firstDepth + refinedDepth) * 0.5) - 0.5) *
        uParallaxStrength * edge,
      uDepthTexel,
      vec2(1.0) - uDepthTexel
    );
    vec4 color = texture2D(uArtwork, artworkUv);

    float leftDepth = texture2D(uDepth, artworkUv - vec2(uDepthTexel.x, 0.0)).r;
    float rightDepth = texture2D(uDepth, artworkUv + vec2(uDepthTexel.x, 0.0)).r;
    float lowerDepth = texture2D(uDepth, artworkUv - vec2(0.0, uDepthTexel.y)).r;
    float upperDepth = texture2D(uDepth, artworkUv + vec2(0.0, uDepthTexel.y)).r;
    vec3 reliefNormal = normalize(vec3(
      (leftDepth - rightDepth) * uNormalStrength,
      (lowerDepth - upperDepth) * uNormalStrength,
      1.0
    ));

    float diffuse = 0.88 + 0.12 * max(dot(reliefNormal, uLightDir), 0.0);
    vec3 halfVector = normalize(uLightDir + uViewDir);
    float specular = pow(max(dot(reliefNormal, halfVector), 0.0), 28.0) *
      0.085 * smoothstep(0.34, 0.86, refinedDepth);
    float contour = clamp(
      length(vec2(leftDepth - rightDepth, lowerDepth - upperDepth)) * 2.2,
      0.0,
      1.0
    );
    float depthLift = mix(0.955, 1.045, smoothstep(0.2, 0.82, refinedDepth));
    vec3 reliefTint = vec3(0.22, 0.52, 0.54) * contour * 0.025;
    gl_FragColor = vec4(
      color.rgb * diffuse * depthLift + specular + reliefTint,
      color.a
    );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
