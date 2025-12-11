import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Stars } from '@react-three/drei'
import * as THREE from 'three'

export function Background() {
    const starRef = useRef<any>(null)

    useFrame((state) => {
        if (starRef.current) {
            starRef.current.rotation.y = state.clock.getElapsedTime() * 0.01 // Slower star rotation
        }
    })

    return (
        <group>
            {/* Twinkling Stars */}
            <group ref={starRef}>
                <Stars radius={150} depth={50} count={6000} factor={4} saturation={0} fade speed={1} />
            </group>

            {/* 1. The Sun/Moon (Golden Radiant) */}
            <Float speed={1} rotationIntensity={0.2} floatIntensity={0.2}>
                <mesh position={[-30, 25, -60]}>
                    <sphereGeometry args={[6, 64, 64]} />
                    <meshStandardMaterial
                        color="#fff8e1"
                        emissive="#ffcc00"
                        emissiveIntensity={0.8}
                        roughness={0.4}
                    />
                </mesh>
                {/* Halo Rings */}
                <mesh position={[-30, 25, -60]} rotation={[0.5, 0.5, 0]}>
                    <ringGeometry args={[7, 7.2, 64]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} />
                </mesh>
            </Float>

            {/* 2. Gas Giant (Purple/Pink) */}
            <Float speed={0.5} rotationIntensity={0.4} floatIntensity={0.1}>
                <mesh position={[45, 30, -80]}>
                    <sphereGeometry args={[5, 32, 32]} />
                    <meshStandardMaterial
                        color="#d8b4fe"
                        roughness={0.7}
                        metalness={0.1}
                    />
                </mesh>
            </Float>

            {/* 3. Ice World (Blue/White) */}
            <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.3}>
                <mesh position={[-45, 5, -50]}>
                    <sphereGeometry args={[2.5, 32, 32]} />
                    <meshStandardMaterial
                        color="#aeeeff"
                        emissive="#0044aa"
                        emissiveIntensity={0.1}
                        roughness={0.2}
                        metalness={0.8}
                    />
                </mesh>
            </Float>

            {/* 4. Red Dwarf / Mars-like */}
            <Float speed={0.6} rotationIntensity={0.3} floatIntensity={0.2}>
                <mesh position={[20, -10, -70]}>
                    <sphereGeometry args={[2, 32, 32]} />
                    <meshStandardMaterial
                        color="#ff6b6b"
                        roughness={0.9}
                    />
                </mesh>
            </Float>

            {/* 5. Metallic Moon */}
            <Float speed={1.2} rotationIntensity={0.5} floatIntensity={0.4}>
                <mesh position={[0, 40, -40]}>
                    <sphereGeometry args={[0.8, 32, 32]} />
                    <meshStandardMaterial
                        color="#94a3b8"
                        metalness={1}
                        roughness={0.2}
                    />
                </mesh>
            </Float>

            {/* MOUNTAINS - Restored & Layered */}
            <group position={[0, -5, -80]}>
                {/* Back Layer */}
                <mesh position={[-30, 0, 0]} scale={[30, 25, 10]}>
                    <coneGeometry args={[1, 1, 4]} />
                    <meshBasicMaterial color="#1a103c" fog={true} />
                </mesh>
                <mesh position={[20, 0, -5]} scale={[40, 30, 10]}>
                    <coneGeometry args={[1, 1, 4]} />
                    <meshBasicMaterial color="#120c2b" fog={true} />
                </mesh>
                <mesh position={[0, -2, 5]} scale={[50, 15, 10]}>
                    <coneGeometry args={[1, 1, 4]} />
                    <meshBasicMaterial color="#2d1b4e" fog={true} />
                </mesh>
            </group>



        </group>
    )
}
