import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Noise function (same as before but we'll tweak vertex shader for rivers)
const vertexShader = `
  varying vec2 vUv;
  varying float vElevation;
  uniform float uTime;

  // ... (Noise functions omitted for brevity, assuming standard simplex/perlin)
  // Simplified for this view, we will use a standard noise logic
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; 
    vec3 x3 = x0 - D.yyy;      
    i = mod289(i); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857; 
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );  
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Tweak noise for rivers: Dig deep channels
    float noiseFrequency = 0.03;
    float n = snoise(vec3(pos.x * noiseFrequency, pos.y * noiseFrequency, 0.0));
    
    float elevation = n * 4.0;
    
    // River Bed Logic: If noise is low, push it down further to make room for water
    if (n < -0.2) {
       elevation -= 1.5; // Dig river
    } else {
       elevation += 1.0; // Raise land
    }

    // Soften transition
    elevation = mix(elevation, n * 5.0, 0.5);

    pos.z += elevation; 
    vElevation = elevation;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const  // Fragment Shader
  fragmentShader = `
    varying float vElevation;
    varying vec2 vUv;
    uniform vec3 uColorWater;
    uniform vec3 uColorSand;
    uniform vec3 uColorGrass;
    uniform vec3 uColorSnow;
    uniform vec3 uColorRock;

    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      // Base color mixing based on height
      float mixStrength = (vElevation + 1.0) * 0.25;
      vec3 color = mix(uColorWater, uColorSand, smoothstep(-0.9, -0.7, vElevation));
      color = mix(color, uColorGrass, smoothstep(-0.7, -0.4, vElevation));
      color = mix(color, uColorRock, smoothstep(2.0, 3.0, vElevation));
      color = mix(color, uColorSnow, smoothstep(5.0, 6.0, vElevation));

      // Add noise texture to ground for realism
      float noiseVal = snoise(vUv * 50.0); // High frequency noise
      vec3 textureColor = mix(color, color * 0.8, noiseVal * 0.1); // Subtle darkening

      // Grass variation
      if (vElevation > -0.7 && vElevation < 2.0) {
          float grassNoise = snoise(vUv * 100.0);
          textureColor = mix(textureColor, vec3(0.1, 0.4, 0.1), grassNoise * 0.1); 
      }

      gl_FragColor = vec4(textureColor, 1.0);
    }
  `

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null)
  const waterRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorWater: { value: new THREE.Color('#1E293B') }, // Dark Blue/Slate
    uColorSand: { value: new THREE.Color('#E2D1A6') },  // Sand
    uColorGrass: { value: new THREE.Color('#5D9C59') }, // Grass Green
    uColorSnow: { value: new THREE.Color('#FFFFFF') },  // Snow
    uColorRock: { value: new THREE.Color('#808080') },  // Rock Grey
  }), [])

  useFrame((state) => {
    if (meshRef.current) {
      // @ts-ignore
      meshRef.current.material.uniforms.uTime.value = state.clock.getElapsedTime()
    }
    if (waterRef.current) {
      // Gentle flow animation for water
      // waterRef.current.material.map.offset.x += 0.001
    }
  })

  return (
    <group>
      {/* Land */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300, 256, 256]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Water Plane (Fixed height) */}
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshPhysicalMaterial
          color="#88ccff"
          transmission={0.6}
          opacity={0.8}
          transparent
          roughness={0.1}
          metalness={0.2}
          ior={1.4}
          thickness={2}
        />
      </mesh>
    </group>
  )
}
