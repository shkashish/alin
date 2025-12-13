import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

export function Statue() {
    const group = useRef<THREE.Group>(null)

    useFrame((state) => {
        if (group.current) {
            // Subtle breathing/floating motion for the whole statue
            group.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
        }
    })

    return (
        <group ref={group} position={[0, 0, 0]} scale={[2, 2, 2]}>
            {/* Floating Abstract Head/Symbol */}
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <group position={[0, 1.5, 0]}>
                    <mesh castShadow receiveShadow>
                        <octahedronGeometry args={[0.8, 0]} />
                        <meshStandardMaterial color="#a0c0ff" roughness={0.1} metalness={0.9} emissive="#102040" emissiveIntensity={0.2} />
                    </mesh>
                    <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow>
                        <torusGeometry args={[1.2, 0.05, 16, 100]} />
                        <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={2} />
                    </mesh>
                </group>
            </Float>
        </group>
    )
}
