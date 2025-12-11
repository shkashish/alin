import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import { useMemo } from 'react'
import { Terrain } from './Terrain'
import { Plant } from './Plant'
import { Background } from './Background'
import { Galaxy } from './Galaxy'
import { useStore } from '../hooks/useStore'
import { WaitingParticles } from './WaitingParticles'
import { Effects } from './Effects'
import { Seed } from './Seed'
import { Fireflies } from './Fireflies'
import { Butterflies } from './Butterflies'
import { Statue } from './Statue'
import * as THREE from 'three'

// Separate component for dynamic garden items to isolate Suspense
function GardenContent() {
    const messages = useStore(state => state.messages)
    const isLoading = useStore(state => state.isLoading)
    const isPlanting = useStore(state => state.isPlanting)
    const finishPlanting = useStore(state => state.finishPlanting)
    const activeMessage = messages.find(m => !m.planted && m.response)

    const plantedMessages = useMemo(() =>
        messages.filter(m => m.planted).map((m, i) => {
            const angle = i * 137.5 * (Math.PI / 180)
            const radius = 4 + Math.sqrt(i) * 3
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            return { ...m, position: [x, 0, z] as [number, number, number] }
        }), [messages])

    const nextIndex = plantedMessages.length
    const nextAngle = nextIndex * 137.5 * (Math.PI / 180)
    const nextRadius = 4 + Math.sqrt(nextIndex) * 3
    const nextX = Math.cos(nextAngle) * nextRadius
    const nextZ = Math.sin(nextAngle) * nextRadius
    const targetPosition: [number, number, number] = [nextX, 0, nextZ]

    return (
        <>
            {/* Existing Plants */}
            {plantedMessages.map(msg => (
                <Plant
                    key={msg.id}
                    id={msg.id}
                    position={msg.position}
                    text={msg.text}
                    response={msg.response || ''}
                />
            ))}

            {/* active Seed Animation - ALWAYS MOUNTED (Safe Mode) */}
            <Seed
                active={!!(activeMessage && isPlanting)}
                targetPosition={targetPosition}
                onPlant={() => activeMessage && finishPlanting(activeMessage.id)}
            />

            {/* Waiting Particles - Always mounted to prevent texture/shader recompilation glitches */}
            <group visible={!!isLoading}>
                <WaitingParticles />
            </group>
        </>
    )
}

export function Scene() {
    return (
        <Canvas
            shadows
            camera={{ position: [0, 5, 12], fov: 60 }}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        >
            <color attach="background" args={['#87CEEB']} /> {/* Fallback Sky Color */}
            <ambientLight intensity={0.6} /> {/* Brightened even more */}
            <directionalLight
                position={[-10, 20, -10]}
                intensity={1.5}
                castShadow
                shadow-bias={-0.0001}
                color="#ffeedd"
            />

            <Sky sunPosition={[-10, 0, -10]} turbidity={0.5} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.7} />

            {/* Static/World Elements - Should load instantly or purely visual */}
            <Background />
            <Galaxy />
            <Terrain />

            {/* The Ancient Statue */}
            <Statue />

            {/* Toggle Fireflies & Butterflies */}
            <Fireflies count={120} />
            <Butterflies count={30} />

            {/* Dynamic Content - Suspense is now handled internally in GardenContent */}
            <GardenContent />

            <Effects />

            <OrbitControls
                maxPolarAngle={Math.PI / 2 - 0.05}
                minDistance={5}
                maxDistance={60} // Infinite zoom feel
                enablePan={true} // Allow panning now for exploration
                zoomSpeed={0.8}
                rotateSpeed={0.5}
            />
        </Canvas>
    )
}
