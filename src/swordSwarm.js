import * as THREE from 'three';

export class SwordSwarm {
    constructor(scene, count = 10000) {
        this.scene = scene;
        this.count = count;
        this.swords = [];
        this.target = null;
        this.swarmRadius = 20;
        this.isAttracted = false;
        
        this.init();
    }
    
    init() {
        // Create a simple sword geometry (a thin box for the blade and a small box for the hilt)
        const bladeGeometry = new THREE.BoxGeometry(0.1, 1, 0.1);
        const hiltGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        
        // Create a group to hold both parts of the sword
        const swordGroup = new THREE.Group();
        
        // Create blade (reddish metal)
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: 0x8888ff,
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0x0000ff,
            emissiveIntensity: 0.1
        });
        
        const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
        blade.position.y = 0.5; // Position the blade above the hilt
        blade.castShadow = true;
        
        // Create hilt (golden)
        const hiltMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.3
        });
        
        const hilt = new THREE.Mesh(hiltGeometry, hiltMaterial);
        hilt.position.y = 0; // Position at the bottom
        hilt.castShadow = true;
        
        // Add both parts to the group
        swordGroup.add(blade);
        swordGroup.add(hilt);
        
        // Create an InstancedMesh for the swords
        this.swordMesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.1, 1, 0.1), // Using simple box for better performance
            bladeMaterial,
            this.count
        );
        
        // Create a matrix and position for each instance
        this.matrix = new THREE.Matrix4();
        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3(1, 1, 1);
        
        // Initialize positions and velocities for each sword
        this.positions = [];
        this.velocities = [];
        this.rotations = [];
        
        for (let i = 0; i < this.count; i++) {
            // Random position in a sphere
            const radius = Math.random() * this.swarmRadius * 0.5 + this.swarmRadius * 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            this.positions.push(new THREE.Vector3(x, y, z));
            
            // Random velocity (initially zero or very small)
            this.velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            ));
            
            // Random rotation
            this.rotations.push({
                x: Math.random() * Math.PI * 2,
                y: Math.random() * Math.PI * 2,
                z: Math.random() * Math.PI * 2
            });
        }
        
        // Add the instanced mesh to the scene
        this.scene.add(this.swordMesh);
        
        // Create a point light at the target position
        this.targetLight = new THREE.PointLight(0x00ffff, 1, 20);
        this.targetLight.visible = false;
        this.scene.add(this.targetLight);
    }
    
    setTarget(position) {
        if (!this.isAttracted) {
            this.isAttracted = true;
        }
        
        if (position) {
            if (!this.target) {
                this.target = new THREE.Vector3();
            }
            this.target.copy(position);
            
            // Update target light position
            this.targetLight.position.copy(position);
            this.targetLight.visible = true;
        }
    }
    
    resetTarget() {
        this.isAttracted = false;
        this.targetLight.visible = false;
    }
    
    update() {
        const time = performance.now() * 0.001; // Time in seconds
        
        for (let i = 0; i < this.count; i++) {
            const position = this.positions[i];
            const velocity = this.velocities[i];
            const rotation = this.rotations[i];
            
            if (this.isAttracted && this.target) {
                // Calculate direction to target
                const direction = new THREE.Vector3().subVectors(this.target, position);
                const distance = direction.length();
                
                // Normalize direction
                if (distance > 0.01) {
                    direction.normalize();
                    
                    // Add attraction force
                    const attractionStrength = 0.1;
                    const maxSpeed = 1.0;
                    
                    // Scale force by distance (stronger when further away)
                    const force = Math.min(distance * 0.1, maxSpeed);
                    
                    // Apply force
                    velocity.x += direction.x * force * attractionStrength;
                    velocity.y += direction.y * force * attractionStrength;
                    velocity.z += direction.z * force * attractionStrength;
                    
                    // Add some noise to make it look more natural
                    velocity.x += (Math.random() - 0.5) * 0.02;
                    velocity.y += (Math.random() - 0.5) * 0.02;
                    velocity.z += (Math.random() - 0.5) * 0.02;
                    
                    // Damping
                    velocity.multiplyScalar(0.95);
                    
                    // Update position
                    position.add(velocity);
                    
                    // Make the sword point in the direction of movement if moving
                    if (velocity.lengthSq() > 0.01) {
                        // Calculate rotation to face movement direction
                        const targetQuaternion = new THREE.Quaternion();
                        const targetDirection = new THREE.Vector3(0, 1, 0); // Default direction (up)
                        
                        // Calculate rotation to face the movement direction
                        const rotationAxis = new THREE.Vector3()
                            .crossVectors(targetDirection, velocity.clone().normalize())
                            .normalize();
                        
                        // If the cross product is zero, set a default axis
                        if (rotationAxis.lengthSq() < 0.01) {
                            rotationAxis.set(1, 0, 0);
                        }
                        
                        const rotationAngle = Math.acos(
                            THREE.MathUtils.clamp(
                                targetDirection.dot(velocity.clone().normalize()),
                                -1,
                                1
                            )
                        );
                        
                        targetQuaternion.setFromAxisAngle(rotationAxis, rotationAngle);
                        
                        // Smoothly interpolate to the target rotation
                        this.tempQuaternion.slerp(targetQuaternion, 0.1);
                    }
                }
            } else {
                // Idle behavior - move in a random pattern
                velocity.x += (Math.random() - 0.5) * 0.01;
                velocity.y += (Math.random() - 0.5) * 0.01;
                velocity.z += (Math.random() - 0.5) * 0.01;
                
                // Damping
                velocity.multiplyScalar(0.98);
                
                // Update position
                position.add(velocity);
                
                // Keep within bounds
                const distanceFromCenter = position.length();
                if (distanceFromCenter > this.swarmRadius) {
                    const direction = position.clone().normalize();
                    position.copy(direction.multiplyScalar(this.swarmRadius * 0.9));
                    velocity.multiplyScalar(-0.5); // Bounce back
                }
                
                // Add some rotation
                rotation.x += (Math.random() - 0.5) * 0.1;
                rotation.y += (Math.random() - 0.5) * 0.1;
                rotation.z += (Math.random() - 0.5) * 0.1;
                
                this.tempQuaternion.setFromEuler(
                    new THREE.Euler(rotation.x, rotation.y, rotation.z)
                );
            }
            
            // Update the instance matrix
            this.matrix.compose(
                position,
                this.tempQuaternion,
                this.tempScale
            );
            
            this.swordMesh.setMatrixAt(i, this.matrix);
        }
        
        // Update the instanced mesh
        this.swordMesh.instanceMatrix.needsUpdate = true;
    }
}
