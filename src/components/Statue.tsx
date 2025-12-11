import { useGLTF } from '@react-three/drei'
import { useLayoutEffect } from 'react'
import * as THREE from 'three'

export function Statue() {
    const { scene } = useGLTF('/model.glb')

    useLayoutEffect(() => {
        scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
                // Enhance material if needed
                if (child.material) {
                    // Disable internal glow/emission
                    child.material.emissive = new THREE.Color(0, 0, 0)
                    child.material.emissiveIntensity = 0

                    child.material.roughness = 0.5
                    child.material.metalness = 0.1
                }
            }
        })
    }, [scene])

    return (
        <group position={[0, 0, 0]}>
            <primitive object={scene} scale={[4, 4, 4]} position={[0, -1, 0]} />
        </group>
    )
}

useGLTF.preload('/model.glb')
