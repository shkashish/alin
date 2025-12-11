import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSpring, animated } from '@react-spring/three'
import { AnimatePresence, motion } from 'framer-motion'

// V3 Plant Generator: Bigger, bolder, and recursive
function generatePlantData(seedId: string, _index: number) {
    const hash = seedId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const rng = (offset: number) => {
        const x = Math.sin(hash + offset) * 10000
        return x - Math.floor(x)
    }

    // Miracle Plant Logic (Every ~10th plant)
    // Check if index implies rarity or use a very rare RNG check 
    // User asked "Every ~10 plants", so lets use index if available or just high probability
    // Since we don't pass global index easily, lets use hash modulo
    const isMiracle = (hash % 10) === 0;

    // 1. Stem Generation
    const height = 2 + rng(1) * 4 // Taller: 2 - 6
    const thickness = 0.1 + rng(2) * 0.15

    // Curve
    const points = []
    const segments = 12
    const curvature = (rng(3) - 0.5) * 3
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = Math.sin(t * Math.PI * curvature) * (0.8 * height + (isMiracle ? 1 : 0));
        const y = t * height;
        const z = Math.cos(t * Math.PI * curvature * 0.5) * (0.3 * height);
        points.push(new THREE.Vector3(x, y, z));
    }
    const stemCurve = new THREE.CatmullRomCurve3(points);

    // 2. Leaf Generation (More abundant)
    const leafCount = Math.floor(4 + rng(4) * 6);
    const leaves = [];
    for (let i = 0; i < leafCount; i++) {
        const t = 0.1 + (i / leafCount) * 0.8;
        const pos = stemCurve.getPoint(t);
        // Random rotation
        const angle = rng(5 + i) * Math.PI * 2;
        leaves.push({ pos, angle, scale: 0.8 + rng(6 + i) * 1.0 });
    }

    // 3. Flower Generation (Big Blooms)
    const petalCount = isMiracle ? 20 : Math.floor(8 + rng(7) * 12);
    const colorHue = rng(8);
    // Miracle plants are rainbow/gold/crystal
    const color = isMiracle
        ? new THREE.Color('#ff00ff').lerp(new THREE.Color('#00ffff'), rng(20))
        : new THREE.Color().setHSL(colorHue, 0.9, 0.6);

    const petalColor = isMiracle
        ? new THREE.Color('#ffffff')
        : new THREE.Color().setHSL(colorHue, 0.8, 0.8);

    const petalLength = (0.8 + rng(9) * 0.8) * (isMiracle ? 1.5 : 1);
    const petalWidth = (0.3 + rng(10) * 0.4) * (isMiracle ? 1.5 : 1);

    return { height, stemCurve, thickness, leaves, petalCount, color, petalColor, petalLength, petalWidth, isMiracle }
}

interface PlantProps {
    id: string
    position: [number, number, number]
    text: string
    response: string
}

export function Plant({ id, position, text, response }: PlantProps) {
    const group = useRef<THREE.Group>(null)

    // Deterministic seed generation
    // We don't have a reliable sequential 'index' here easily without props drilling
    // So we rely on ID hash for "Miracle" status
    const { height, stemCurve, thickness, leaves, petalCount, color, petalColor, petalLength, petalWidth, isMiracle }
        = useMemo(() => generatePlantData(id, 0), [id])

    // Growth Animation
    const { scale } = useSpring({
        from: { scale: 0 },
        to: { scale: 1 },
        config: { mass: 1, tension: 120, friction: 60, duration: 2500 },
        delay: 500 // Wait for seed implosion
    })

    // Sway Animation
    const [showTooltip, setShowTooltip] = useState(false)
    useFrame((state) => {
        if (group.current) {
            const t = state.clock.getElapsedTime();
            const offset = id.charCodeAt(0) * 0.1;
            const speed = isMiracle ? 0.3 : 0.5;
            group.current.rotation.z = Math.sin(t * speed + offset) * (isMiracle ? 0.02 : 0.05);
            group.current.rotation.x = Math.cos(t * (speed * 0.7) + offset) * 0.03;

            if (isMiracle) {
                group.current.position.y = position[1] + Math.sin(t + offset) * 0.1 // Float slightly
            }
        }
    })

    return (
        <animated.group position={position} ref={group} scale={scale}>
            {/* Organic Stem */}
            <mesh>
                <tubeGeometry args={[stemCurve, 24, thickness, 8, false]} />
                <meshStandardMaterial color={isMiracle ? "#aaffaa" : "#4a7038"} roughness={0.6} emissive={isMiracle ? "#55ff55" : "#000000"} emissiveIntensity={isMiracle ? 0.2 : 0} />
            </mesh>

            {/* Leaves */}
            {leaves.map((leaf, i) => (
                <mesh
                    key={`leaf-${i}`}
                    position={leaf.pos}
                    rotation={[Math.PI / 3, leaf.angle, Math.PI / 4]}
                    scale={leaf.scale}
                >
                    <coneGeometry args={[0.3, 1.2, 3]} />
                    <meshStandardMaterial color={isMiracle ? "#88cc88" : "#5d8a45"} side={THREE.DoubleSide} />
                </mesh>
            ))}

            {/* Complex Flower Head */}
            <group position={stemCurve.getPoint(1)} rotation={[0, 0, Math.PI / 6]}>
                {/* Petals */}
                {Array.from({ length: petalCount }).map((_, i) => {
                    const angle = (i / petalCount) * Math.PI * 2
                    return (
                        <group key={`petal-${i}`} rotation={[0, angle, Math.PI / 4]}>
                            <mesh position={[0, petalLength / 2, 0]}>
                                <capsuleGeometry args={[petalWidth, petalLength, 4, 8]} />
                                <meshStandardMaterial
                                    color={petalColor}
                                    emissive={color}
                                    emissiveIntensity={isMiracle ? 0.8 : 0.2}
                                    roughness={0.4}
                                />
                            </mesh>
                        </group>
                    )
                })}

                {/* Center / Crystal for Miracle */}
                <mesh>
                    {isMiracle ? <octahedronGeometry args={[thickness * 6]} /> : <sphereGeometry args={[thickness * 4, 16, 16]} />}
                    <meshStandardMaterial
                        color={isMiracle ? "#ffffff" : "#ffeaa7"}
                        emissive={isMiracle ? "#ffffff" : "#ffdd00"}
                        emissiveIntensity={isMiracle ? 1 : 0.5}
                    />
                </mesh>

                {/* Halo for miracle */}
                {isMiracle && (
                    <mesh>
                        <ringGeometry args={[petalLength * 1.2, petalLength * 1.3, 32]} />
                        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.3} />
                    </mesh>
                )}

            </group>

            {/* Improved Tooltip & Hitbox */}
            {/* 2. Floating Glowing Hover Sphere (User Request) */}
            <mesh
                position={[0, height + 3, 0]}
                onPointerOver={(e) => { e.stopPropagation(); setShowTooltip(true) }}
                onPointerOut={(e) => { e.stopPropagation(); setShowTooltip(false) }}
                onClick={(e) => { e.stopPropagation(); setShowTooltip(true) }} // Fix for mobile tap
            >
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshBasicMaterial color="#aaddff" transparent opacity={0.3} wireframe={false} />
            </mesh>

            {/* Visual Pulse for Sphere */}
            <mesh position={[0, height + 3, 0]} scale={[0.5, 0.5, 0.5]}>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.1} side={THREE.BackSide} />
            </mesh>

            <Html distanceFactor={12} position={[0, height + 4.5, 0]} style={{ pointerEvents: 'none' }}>
                <AnimatePresence>
                    {showTooltip && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="w-64 bg-black/70 backdrop-blur-xl p-5 rounded-2xl text-white text-xs border border-white/20 shadow-2xl z-50 text-center"
                        >
                            <p className="font-semibold mb-2 opacity-90 text-sm border-b border-white/10 pb-2 text-center">"{text}"</p>
                            <p className="italic text-purple-200 font-serif leading-relaxed text-sm">{response}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Html>
        </animated.group>
    )
}
