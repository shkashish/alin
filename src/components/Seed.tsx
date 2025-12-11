import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSpring, animated, config } from '@react-spring/three'
import * as THREE from 'three'

interface SeedProps {
    active: boolean
    targetPosition: [number, number, number]
    onPlant: () => void
}

export function Seed({ active, targetPosition, onPlant }: SeedProps) {
    const group = useRef<THREE.Group>(null)

    // Helper to store if we are currently animating to prevent double triggers
    const isAnimating = useRef(false)

    const [springs, api] = useSpring(() => ({
        position: [0, 5, 8],
        scale: 0, // Start invisible/small
        opacity: 0,
        config: config.molasses
    }))

    useEffect(() => {
        if (active && !isAnimating.current) {
            isAnimating.current = true

            // Reset to top position instantly
            api.start({
                position: [0, 5, 8],
                scale: 0.5,
                opacity: 1,
                immediate: true
            })

            // Run Sequence
            const runSequence = async () => {
                // Stage 1: Fall
                await api.start({
                    position: [targetPosition[0], 2, targetPosition[2]],
                    scale: 0.8,
                    config: config.slow
                })

                // Stage 2: Dive
                await api.start({
                    position: targetPosition,
                    scale: 0.2,
                    config: { tension: 200, friction: 10 }
                })

                // Stage 3: Disappear
                await api.start({ scale: 0, opacity: 0 })

                onPlant()
                isAnimating.current = false
            }

            runSequence()
        }
    }, [active, targetPosition, onPlant, api])

    useFrame(() => {
        if (group.current && active) {
            group.current.rotation.y += 0.1
            group.current.rotation.z += 0.05
        }
    })

    return (
        <animated.group
            ref={group}
            position={springs.position as any}
            scale={springs.scale as any}
            visible={active} // Only visible when active
        >
            <mesh>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive="#aaddff"
                    emissiveIntensity={2}
                    transparent
                    opacity={springs.opacity as any}
                />
            </mesh>
            <pointLight distance={3} intensity={2} color="#aaddff" />
        </animated.group>
    )
}
