import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Butterflies({ count = 20 }) {
    const mesh = useRef<THREE.InstancedMesh>(null)
    const dummy = useMemo(() => new THREE.Object3D(), [])

    const particles = useMemo(() => {
        return Array.from({ length: count }).map(() => ({
            // Spawn near center
            position: new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                2 + Math.random() * 5,
                (Math.random() - 0.5) * 30
            ),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                0,
                (Math.random() - 0.5) * 0.02
            ),
            phase: Math.random() * Math.PI * 2
        }))
    }, [count])

    useFrame((state) => {
        if (!mesh.current) return
        const time = state.clock.getElapsedTime()

        particles.forEach((p, i) => {
            // Flapping motion (scale y)
            const flap = Math.sin(time * 10 + p.phase) * 0.5 + 0.5

            // Move
            p.position.add(p.velocity)
            p.position.y += Math.sin(time * 2 + p.phase) * 0.005

            // Wrap around
            if (p.position.x > 20) p.position.x = -20
            if (p.position.x < -20) p.position.x = 20
            if (p.position.z > 20) p.position.z = -20
            if (p.position.z < -20) p.position.z = 20

            dummy.position.copy(p.position)
            dummy.rotation.x = flap * 0.5 // Minimal "wing" rotation effect via whole body
            dummy.lookAt(p.position.clone().add(p.velocity))
            dummy.rotateX(Math.PI / 2) // Orient flat

            // Wing flap visual hack - we really need bone animation for true wings but we can scale width
            dummy.scale.set(1 - flap * 0.5, 1, 1)

            dummy.updateMatrix()
            mesh.current!.setMatrixAt(i, dummy.matrix)
        })
        mesh.current.instanceMatrix.needsUpdate = true
    })

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
            {/* Simple butterfly shape: 2 triangles? or just a plane */}
            <planeGeometry args={[0.5, 0.5]} />
            <meshStandardMaterial color="#ffaaee" side={THREE.DoubleSide} transparent opacity={0.9} emissive="#ff00aa" emissiveIntensity={0.5} />
        </instancedMesh>
    )
}
