import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Galaxy() {
    const points = useRef<THREE.Points>(null)

    // Galaxy Parameters - Tweaked for Visibility
    const parameters = {
        count: 8000,
        size: 0.8, // Much larger particles
        radius: 80,
        branches: 4,
        spin: 1,
        randomness: 0.2,
        randomnessPower: 3,
        insideColor: '#ff88cc', // Brighter Core
        outsideColor: '#44aaff' // Brighter Arms
    }

    const particles = useMemo(() => {
        const positions = new Float32Array(parameters.count * 3)
        const colors = new Float32Array(parameters.count * 3)

        const colorInside = new THREE.Color(parameters.insideColor)
        const colorOutside = new THREE.Color(parameters.outsideColor)

        for (let i = 0; i < parameters.count; i++) {
            const i3 = i * 3

            // Position
            const radius = Math.random() * parameters.radius
            const spinAngle = radius * parameters.spin
            const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

            const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
            const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius
            const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius

            positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX
            positions[i3 + 1] = randomY
            positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ

            // Color
            const mixedColor = colorInside.clone()
            mixedColor.lerp(colorOutside, radius / parameters.radius)

            // Boost color brightness
            mixedColor.addScalar(0.2)

            colors[i3] = mixedColor.r
            colors[i3 + 1] = mixedColor.g
            colors[i3 + 2] = mixedColor.b
        }

        return { positions, colors }
    }, [])

    useFrame((state) => {
        if (points.current) {
            // Slow cosmic rotation
            points.current.rotation.y = state.clock.getElapsedTime() * 0.05
            // Pulse
            const s = 1 + Math.sin(state.clock.getElapsedTime() * 0.5) * 0.05
            points.current.scale.set(s, s, s)
        }
    })

    return (
        <group position={[0, 10, -90]} rotation={[0.8, 0, 0]}> {/* Higher up and tilted to be seen in sky */}
            <points ref={points}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={parameters.count}
                        array={particles.positions}
                        itemSize={3}
                        args={[particles.positions, 3]}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={parameters.count}
                        array={particles.colors}
                        itemSize={3}
                        args={[particles.colors, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={parameters.size}
                    sizeAttenuation={true}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    vertexColors={true}
                    transparent
                    opacity={0.8} // Higher opacity
                />
            </points>
        </group>
    )
}
