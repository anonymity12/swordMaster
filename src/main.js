import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HandTracker } from './handTracker.js';
import { SwordSwarm } from './swordSwarm.js';

class App {
    constructor() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupEnvironment();
        
        // Initialize hand tracker and sword swarm
        this.handTracker = new HandTracker(this.onHandsDetected.bind(this));
        this.swordSwarm = new SwordSwarm(this.scene);
        
        // Add event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Start animation loop
        this.animate();
        
        // Hide loading screen when everything is ready
        document.getElementById('loading').style.display = 'none';
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 0, 10);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }
    
    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Add a point light to make the swords more visible
        const pointLight = new THREE.PointLight(0xffffff, 1, 100);
        pointLight.position.set(0, 0, 10);
        this.scene.add(pointLight);
    }
    
    setupEnvironment() {
        // Add a simple ground plane for reference
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333, 
            side: THREE.DoubleSide,
            metalness: 0.8,
            roughness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -5;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    onHandsDetected(hands) {
        if (hands.length > 0) {
            const hand = hands[0];
            // Convert screen coordinates to 3D world coordinates
            const vector = new THREE.Vector3(
                (hand.x / window.innerWidth) * 2 - 1,
                -(hand.y / window.innerHeight) * 2 + 1,
                0.5 // Z value between 0.0 and 1.0
            );
            
            // Unproject the 2D point to 3D space
            vector.unproject(this.camera);
            
            // Calculate direction from camera to the point in world space
            const dir = vector.sub(this.camera.position).normalize();
            
            // Calculate position along the direction vector (scaled by distance)
            const distance = 10; // Fixed distance from camera
            const targetPosition = this.camera.position.clone().add(dir.multiplyScalar(distance));
            
            // Update sword swarm target
            this.swordSwarm.setTarget(targetPosition);
        } else {
            // No hands detected, reset target
            this.swordSwarm.resetTarget();
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Update sword swarm
        this.swordSwarm.update();
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    new App();
});
