import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function WaitingParticles() {
    const group = useRef<THREE.Group>(null)

    // Create random particles
    const particles = useRef(Array.from({ length: 50 }).map(() => ({
        position: new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random()) * 4,
            (Math.random() - 0.5) * 5
        ),
        speed: Math.random() * 0.02 + 0.01,
        offset: Math.random() * Math.PI * 2
    })))

    useFrame(() => {
        if (group.current) {
            // Rotate entire group slowly
            group.current.rotation.y += 0.005;
        }
    })

    // Simple points
    const positions = new Float32Array(50 * 3)
    particles.current.forEach((p, i) => {
        positions[i * 3] = p.position.x
        positions[i * 3 + 1] = p.position.y
        positions[i * 3 + 2] = p.position.z
    })

    return (
        <group ref={group} position={[0, 2, 8]}>
            <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={50}
                        array={positions}
                        itemSize={3}
                        args={[positions, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.1}
                    color="#aaddff"
                    transparent
                    opacity={0.8}
                    sizeAttenuation
                    blending={THREE.AdditiveBlending}
                />
            </points>

            {/* Central glowing orb */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
            </mesh>
        </group>
    )
}
