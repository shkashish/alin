import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Fireflies({ count = 100 }) {
    const mesh = useRef<THREE.InstancedMesh>(null)

    // Random initial data
    const particles = useMemo(() => {
        const temp = []
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100
            const factor = 20 + Math.random() * 100
            const speed = 0.01 + Math.random() / 200
            const xFactor = -50 + Math.random() * 100
            const yFactor = -50 + Math.random() * 100
            const zFactor = -50 + Math.random() * 100
            temp.push({ t, factor, speed, xFactor, yFactor, zFactor, mx: 0, my: 0 })
        }
        return temp
    }, [count])

    // Dummy object for setting matrix
    const dummy = useMemo(() => new THREE.Object3D(), [])

    useFrame(() => {
        if (!mesh.current) return

        particles.forEach((particle, i) => {
            let { t, factor, speed, xFactor, yFactor, zFactor } = particle

            // Update time
            t = particle.t += speed / 2
            const a = Math.cos(t) + Math.sin(t * 1) / 10
            const b = Math.sin(t) + Math.cos(t * 2) / 10

            // Update position based on noise-like movement
            dummy.position.set(
                (particle.mx / 10) * a + xFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 1) * factor) / 10,
                (particle.my / 10) * b + yFactor + Math.sin((t / 10) * factor) + (Math.cos(t * 2) * factor) / 10,
                (particle.my / 10) * b + zFactor + Math.cos((t / 10) * factor) + (Math.sin(t * 3) * factor) / 10
            )

            // Keep within bounds (optional, but good for garden center)
            if (dummy.position.y < 0.5) dummy.position.y = 0.5 + Math.random() // Keep above ground
            if (dummy.position.y > 10) dummy.position.y = 5 // Keep low

            // Scale pulse
            const s = Math.cos(t) * 0.5 + 0.5 // 0 to 1
            dummy.scale.setScalar(s * 0.15) // Size 

            dummy.updateMatrix()
            mesh.current!.setMatrixAt(i, dummy.matrix)
        })

        mesh.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#ffee88" transparent opacity={0.6} />
        </instancedMesh>
    )
}
