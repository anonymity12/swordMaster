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

    updateStatusUI(detected) {
        const statusBtn = document.getElementById('status-btn');
        if (statusBtn) {
            if (detected) {
                statusBtn.textContent = 'Qi Detected (Hand Found)';
                statusBtn.classList.remove('detecting');
                statusBtn.style.borderColor = '#4a9a6a';
                statusBtn.style.color = '#7ed8a0';
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
            maxNumHands: 1,
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
            this.updateStatusUI(true);
            
            // Get the first detected hand
            const landmarks = results.multiHandLandmarks[0];
            
            // Get the palm base (wrist) and index finger tip
            const wrist = landmarks[0];
            const indexTip = landmarks[8];
            
            // Calculate the center between wrist and index finger tip
            const handX = (wrist.x + indexTip.x) / 2;
            const handY = (wrist.y + indexTip.y) / 2;
            
            // Calculate confidence (average of detection and tracking confidence)
            const confidence = (
                (results.multiHandedness[0].score || 0.5) * 
                (results.multiHandWorldLandmarks ? 1.0 : 0.8)
            );
            
            // Normalize coordinates to screen space
            // 注意：摄像头画面是镜像的，所以需要翻转 X 坐标 (1 - handX)
            const screenX = (1 - handX) * window.innerWidth;
            const screenY = handY * window.innerHeight;
            
            this.onHandsDetected([{ 
                x: screenX, 
                y: screenY,
                confidence: confidence
            }]);
        } else {
            // 更新 UI 状态为未检测到手
            this.updateStatusUI(false);
            
            // No hands detected
            this.onHandsDetected([]);
        }
    }
}
