import * as THREE from 'three';

/**
 * 单个剑云类 - 管理一组剑的渲染和行为
 */
class SwordCloud {
    constructor(scene, count, color, emissiveColor, initialOffset) {
        this.scene = scene;
        this.count = count;
        this.maxCount = count;  // 最大剑数量（用于恢复）
        this.activeCount = count;  // 当前活跃的剑数量
        this.color = color;
        this.emissiveColor = emissiveColor;
        this.initialOffset = initialOffset;
        
        this.target = null;
        this.previousTarget = null;
        this.swarmRadius = 8;
        this.isAttracted = false;
        this.velocity = new THREE.Vector3();  // 整体剑云的速度
        this.speed = 0;  // 当前速度标量
        
        // 伤害和恢复系统
        this.health = 1.0;  // 1.0 = 满血, 0.0 = 完全被破坏
        this.lastDamageTime = 0;
        this.recoveryCooldown = 2000;  // 2秒冷却时间
        this.recoveryRate = 0.001;  // 每帧恢复量
        
        this.init();
    }
    
    init() {
        // 创建剑的材质
        const bladeMaterial = new THREE.MeshStandardMaterial({
            color: this.color,
            metalness: 0.9,
            roughness: 0.2,
            emissive: this.emissiveColor,
            emissiveIntensity: 0.3
        });
        
        // 创建 InstancedMesh
        this.swordMesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.08, 0.8, 0.08),
            bladeMaterial,
            this.maxCount
        );
        
        // 矩阵和临时变量
        this.matrix = new THREE.Matrix4();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3(1, 1, 1);
        
        // 初始化每把剑的位置和速度
        this.positions = [];
        this.velocities = [];
        this.rotations = [];
        
        for (let i = 0; i < this.maxCount; i++) {
            // 在球形区域内随机分布
            const radius = Math.random() * this.swarmRadius * 0.5 + this.swarmRadius * 0.3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = radius * Math.sin(phi) * Math.cos(theta) + this.initialOffset.x;
            const y = radius * Math.sin(phi) * Math.sin(theta) + this.initialOffset.y;
            const z = radius * Math.cos(phi) + this.initialOffset.z;
            
            this.positions.push(new THREE.Vector3(x, y, z));
            this.velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05
            ));
            this.rotations.push({
                x: Math.random() * Math.PI * 2,
                y: Math.random() * Math.PI * 2,
                z: Math.random() * Math.PI * 2
            });
        }
        
        this.scene.add(this.swordMesh);
        
        // 创建跟随目标的光源
        this.targetLight = new THREE.PointLight(this.color, 0.5, 15);
        this.targetLight.visible = false;
        this.scene.add(this.targetLight);
    }
    
    setTarget(position) {
        if (position) {
            // 保存上一帧的目标位置用于计算速度
            if (this.target) {
                if (!this.previousTarget) {
                    this.previousTarget = new THREE.Vector3();
                }
                this.previousTarget.copy(this.target);
            }
            
            if (!this.target) {
                this.target = new THREE.Vector3();
            }
            this.target.copy(position);
            this.isAttracted = true;
            
            // 计算剑云整体速度
            if (this.previousTarget) {
                this.velocity.subVectors(this.target, this.previousTarget);
                this.speed = this.velocity.length();
            }
            
            this.targetLight.position.copy(position);
            this.targetLight.visible = true;
        }
    }
    
    resetTarget() {
        this.isAttracted = false;
        this.targetLight.visible = false;
        this.speed = 0;
    }
    
    // 获取剑云中心位置
    getCenter() {
        if (this.target && this.isAttracted) {
            return this.target.clone();
        }
        
        // 计算所有活跃剑的平均位置
        const center = new THREE.Vector3();
        for (let i = 0; i < this.activeCount; i++) {
            center.add(this.positions[i]);
        }
        center.divideScalar(this.activeCount || 1);
        return center;
    }
    
    // 获取剑云半径
    getRadius() {
        return this.swarmRadius * this.health;
    }
    
    // 获取当前速度
    getSpeed() {
        return this.speed;
    }
    
    // 受到伤害
    takeDamage(amount) {
        this.health = Math.max(0.1, this.health - amount);
        this.lastDamageTime = performance.now();
        this.activeCount = Math.floor(this.maxCount * this.health);
    }
    
    // 恢复
    recover() {
        const now = performance.now();
        if (now - this.lastDamageTime > this.recoveryCooldown) {
            if (this.health < 1.0) {
                this.health = Math.min(1.0, this.health + this.recoveryRate);
                this.activeCount = Math.floor(this.maxCount * this.health);
            }
        }
    }
    
    update() {
        // 处理恢复
        this.recover();
        
        for (let i = 0; i < this.maxCount; i++) {
            const position = this.positions[i];
            const velocity = this.velocities[i];
            const rotation = this.rotations[i];
            
            // 如果剑不活跃，将其移到很远的地方（不渲染）
            if (i >= this.activeCount) {
                this.matrix.compose(
                    new THREE.Vector3(9999, 9999, 9999),
                    this.tempQuaternion,
                    this.tempScale
                );
                this.swordMesh.setMatrixAt(i, this.matrix);
                continue;
            }
            
            if (this.isAttracted && this.target) {
                // 计算到目标的方向
                const direction = new THREE.Vector3().subVectors(this.target, position);
                const distance = direction.length();
                
                if (distance > 0.01) {
                    direction.normalize();
                    
                    // 吸引力
                    const attractionStrength = 0.12;
                    const maxSpeed = 1.2;
                    const force = Math.min(distance * 0.15, maxSpeed);
                    
                    velocity.x += direction.x * force * attractionStrength;
                    velocity.y += direction.y * force * attractionStrength;
                    velocity.z += direction.z * force * attractionStrength;
                    
                    // 添加螺旋运动
                    const time = performance.now() * 0.001;
                    const spiralRadius = Math.min(distance * 0.3, 2);
                    velocity.x += Math.sin(time * 3 + i * 0.1) * spiralRadius * 0.02;
                    velocity.z += Math.cos(time * 3 + i * 0.1) * spiralRadius * 0.02;
                    
                    // 添加噪声
                    velocity.x += (Math.random() - 0.5) * 0.03;
                    velocity.y += (Math.random() - 0.5) * 0.03;
                    velocity.z += (Math.random() - 0.5) * 0.03;
                    
                    // 阻尼
                    velocity.multiplyScalar(0.92);
                    
                    // 更新位置
                    position.add(velocity);
                    
                    // 让剑指向运动方向
                    if (velocity.lengthSq() > 0.001) {
                        const up = new THREE.Vector3(0, 1, 0);
                        const velocityNorm = velocity.clone().normalize();
                        
                        const rotationAxis = new THREE.Vector3().crossVectors(up, velocityNorm);
                        if (rotationAxis.lengthSq() > 0.001) {
                            rotationAxis.normalize();
                            const angle = Math.acos(THREE.MathUtils.clamp(up.dot(velocityNorm), -1, 1));
                            const targetQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);
                            this.tempQuaternion.slerp(targetQuat, 0.15);
                        }
                    }
                }
            } else {
                // 空闲状态 - 随机漂浮
                velocity.x += (Math.random() - 0.5) * 0.008;
                velocity.y += (Math.random() - 0.5) * 0.008;
                velocity.z += (Math.random() - 0.5) * 0.008;
                
                velocity.multiplyScalar(0.98);
                position.add(velocity);
                
                // 保持在边界内
                const distanceFromCenter = position.length();
                if (distanceFromCenter > this.swarmRadius * 1.5) {
                    const dir = position.clone().normalize();
                    position.copy(dir.multiplyScalar(this.swarmRadius));
                    velocity.multiplyScalar(-0.3);
                }
                
                // 随机旋转
                rotation.x += (Math.random() - 0.5) * 0.05;
                rotation.y += (Math.random() - 0.5) * 0.05;
                this.tempQuaternion.setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z));
            }
            
            // 根据健康值缩放剑的大小
            const scale = 0.7 + this.health * 0.3;
            this.tempScale.set(scale, scale, scale);
            
            // 更新实例矩阵
            this.matrix.compose(position, this.tempQuaternion, this.tempScale);
            this.swordMesh.setMatrixAt(i, this.matrix);
        }
        
        this.swordMesh.instanceMatrix.needsUpdate = true;
    }
    
    dispose() {
        this.scene.remove(this.swordMesh);
        this.scene.remove(this.targetLight);
        this.swordMesh.geometry.dispose();
        this.swordMesh.material.dispose();
    }
}

/**
 * 剑云管理器 - 管理两个剑云及其碰撞
 */
export class SwordSwarm {
    constructor(scene, countPerCloud = 5000) {
        this.scene = scene;
        this.countPerCloud = countPerCloud;
        
        // 创建两个剑云，不同颜色
        // 剑云1：蓝色系（左手）
        this.cloud1 = new SwordCloud(
            scene, 
            countPerCloud, 
            0x4488ff,  // 蓝色
            0x0044aa,  // 蓝色发光
            new THREE.Vector3(-5, 0, 0)
        );
        
        // 剑云2：红色系（右手）
        this.cloud2 = new SwordCloud(
            scene, 
            countPerCloud, 
            0xff4444,  // 红色
            0xaa0000,  // 红色发光
            new THREE.Vector3(5, 0, 0)
        );
        
        // 碰撞参数
        this.collisionRadius = 4;  // 碰撞检测半径
        this.damageMultiplier = 0.05;  // 伤害倍率
    }
    
    setTarget(position, handIndex = 0) {
        if (handIndex === 0) {
            this.cloud1.setTarget(position);
        } else {
            this.cloud2.setTarget(position);
        }
    }
    
    setTargets(hands) {
        // 根据手的数量设置目标
        if (hands.length === 0) {
            this.cloud1.resetTarget();
            this.cloud2.resetTarget();
        } else if (hands.length === 1) {
            // 只有一只手时，控制第一个剑云
            this.cloud1.setTarget(hands[0].position);
            this.cloud2.resetTarget();
        } else {
            // 两只手时，分别控制两个剑云
            // 根据 isLeftHand 属性分配
            for (const hand of hands) {
                if (hand.isLeftHand) {
                    this.cloud1.setTarget(hand.position);
                } else {
                    this.cloud2.setTarget(hand.position);
                }
            }
        }
    }
    
    resetTarget() {
        this.cloud1.resetTarget();
        this.cloud2.resetTarget();
    }
    
    // 检测并处理碰撞
    checkCollision() {
        const center1 = this.cloud1.getCenter();
        const center2 = this.cloud2.getCenter();
        
        const distance = center1.distanceTo(center2);
        const combinedRadius = this.cloud1.getRadius() + this.cloud2.getRadius();
        
        // 如果两个剑云足够接近
        if (distance < combinedRadius) {
            const speed1 = this.cloud1.getSpeed();
            const speed2 = this.cloud2.getSpeed();
            
            // 速度快的剑云对速度慢的剑云造成伤害
            if (speed1 > speed2 && speed1 > 0.1) {
                const damage = (speed1 - speed2) * this.damageMultiplier;
                this.cloud2.takeDamage(damage);
            } else if (speed2 > speed1 && speed2 > 0.1) {
                const damage = (speed2 - speed1) * this.damageMultiplier;
                this.cloud1.takeDamage(damage);
            }
        }
    }
    
    update() {
        // 更新两个剑云
        this.cloud1.update();
        this.cloud2.update();
        
        // 检测碰撞
        this.checkCollision();
    }
    
    // 获取两个剑云的健康状态（用于 UI 显示）
    getHealthStatus() {
        return {
            cloud1: this.cloud1.health,
            cloud2: this.cloud2.health
        };
    }
    
    dispose() {
        this.cloud1.dispose();
        this.cloud2.dispose();
    }
}
