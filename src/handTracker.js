import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandTracker {
    constructor(onHandsDetected) {
        this.onHandsDetected = onHandsDetected;
        this.hands = [];
        this.handDetected = false;
        this.initializeHandTracking();
        this.setupUI();
    }

    setupUI() {
        // 设置摄像头预览切换按钮
        const cameraToggle = document.getElementById('camera-toggle');
        const cameraPreview = document.getElementById('camera-preview');
        
        if (cameraToggle && cameraPreview) {
            cameraToggle.addEventListener('click', () => {
                const isHidden = cameraPreview.classList.contains('hidden');
                if (isHidden) {
                    cameraPreview.classList.remove('hidden');
                    cameraToggle.textContent = 'Hide Camera';
                } else {
                    cameraPreview.classList.add('hidden');
                    cameraToggle.textContent = 'Show Camera';
                }
            });
        }
    }

    updateStatusUI(detected, handCount = 0) {
        const statusBtn = document.getElementById('status-btn');
        if (statusBtn) {
            if (detected && handCount > 0) {
                if (handCount === 2) {
                    statusBtn.textContent = 'Dual Qi Detected (2 Hands)';
                    statusBtn.style.borderColor = '#9a6a4a';
                    statusBtn.style.color = '#d8a07e';
                } else {
                    statusBtn.textContent = 'Qi Detected (1 Hand)';
                    statusBtn.style.borderColor = '#4a9a6a';
                    statusBtn.style.color = '#7ed8a0';
                }
                statusBtn.classList.remove('detecting');
            } else {
                statusBtn.textContent = 'Searching for Qi (Hand)...';
                statusBtn.classList.add('detecting');
                statusBtn.style.borderColor = '#2a5a8a';
                statusBtn.style.color = '#7eb8da';
            }
        }
    }

    async initializeHandTracking() {
        // 获取页面上的 video 元素用于预览
        const videoElement = document.getElementById('camera-video');
        
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,  // 支持检测两只手
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onResults(results));

        // Start the camera，使用页面上的 video 元素
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await this.hands.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        
        // 默认显示摄像头预览
        const cameraPreview = document.getElementById('camera-preview');
        const cameraToggle = document.getElementById('camera-toggle');
        if (cameraPreview) {
            cameraPreview.classList.remove('hidden');
        }
        if (cameraToggle) {
            cameraToggle.textContent = 'Hide Camera';
        }
    }

    onResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // 更新 UI 状态为已检测到手
            this.updateStatusUI(true, results.multiHandLandmarks.length);
            
            const detectedHands = [];
            
            // 遍历所有检测到的手（最多2只）
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                
                // Get the palm base (wrist) and index finger tip
                const wrist = landmarks[0];
                const indexTip = landmarks[8];
                
                // Calculate the center between wrist and index finger tip
                const handX = (wrist.x + indexTip.x) / 2;
                const handY = (wrist.y + indexTip.y) / 2;
                
                // 获取手的类型（左手或右手）
                const handedness = results.multiHandedness[i];
                const isLeftHand = handedness.label === 'Left';
                
                // Calculate confidence
                const confidence = handedness.score || 0.5;
                
                // Normalize coordinates to screen space
                // 注意：摄像头画面是镜像的，所以需要翻转 X 坐标 (1 - handX)
                const screenX = (1 - handX) * window.innerWidth;
                const screenY = handY * window.innerHeight;
                
                detectedHands.push({ 
                    x: screenX, 
                    y: screenY,
                    confidence: confidence,
                    isLeftHand: isLeftHand,
                    handIndex: i
                });
            }
            
            this.onHandsDetected(detectedHands);
        } else {
            // 更新 UI 状态为未检测到手
            this.updateStatusUI(false, 0);
            
            // No hands detected
            this.onHandsDetected([]);
        }
    }
}
