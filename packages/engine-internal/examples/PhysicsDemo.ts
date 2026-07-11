/**
 * Day 3 Demo - GPU Physics Simulation
 * 100+ physics bodies simulated on GPU
 */

import { WebGPUEngine } from '../core/WebGPUEngine.js';
import { GPUPhysicsSystem } from '../core/PhysicsSystem.js';

class PhysicsDemo {
    private engine: WebGPUEngine;
    private physics: GPUPhysicsSystem | null = null;
    private canvas: HTMLCanvasElement;
    private running: boolean = false;

    private canvas2D: HTMLCanvasElement;
    private ctx2D: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = new WebGPUEngine(canvas);

        // Create 2D canvas for visualization
        this.canvas2D = document.createElement('canvas');
        this.canvas2D.width = 1920;
        this.canvas2D.height = 1080;
        this.ctx2D = this.canvas2D.getContext('2d')!;
    }

    /**
     * Initialize demo
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();

        // Get WebGPU internals
        const device = (this.engine as any).device;
        const queue = (this.engine as any).queue;

        if (!device || !queue) {
            throw new Error('Failed to get WebGPU internals');
        }

        // Create physics system
        this.physics = new GPUPhysicsSystem(device, queue, 100);

        // Emit 100 bodies randomly
        for (let i = 0; i < 10; i++) {
            const x = (Math.random() - 0.5) * 150;
            const y = (Math.random() - 0.5) * 150;
            const z = (Math.random() - 0.5) * 50;

            this.physics.emitBodies(10, [x, y, z], [
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                0,
            ]);
        }

        console.log('✅ Physics demo initialized');
        console.log(`Simulating ${this.physics.getStats().bodyCount} bodies on GPU`);
    }

    /**
     * Run demo
     */
    async run(): Promise<void> {
        if (!this.physics) {
            console.error('Physics not initialized');
            return;
        }

        this.running = true;
        let frameCount = 0;
        let fps = 0;
        let lastTime = performance.now();

        const loop = async () => {
            if (!this.running) return;

            const now = performance.now();
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            // Update physics
            this.physics!.step();

            // Render visualization
            await this.visualize();

            frameCount++;
            if (frameCount % 30 === 0) {
                fps = Math.round(1 / dt);
                console.log(`Physics FPS: ${fps}, Bodies: ${this.physics!.getStats().bodyCount}`);
            }

            requestAnimationFrame(loop);
        };

        loop();
    }

    /**
     * Visualize physics bodies
     */
    private async visualize(): Promise<void> {
        // Clear canvas
        this.ctx2D.fillStyle = '#000';
        this.ctx2D.fillRect(0, 0, this.canvas2D.width, this.canvas2D.height);

        // Get body positions from GPU
        const positions = await this.physics!.getBodyPositions();
        const stats = this.physics!.getStats();

        // Draw bodies
        this.ctx2D.fillStyle = '#0f0';
        const scale = 1; // Pixels per unit
        const centerX = this.canvas2D.width / 2;
        const centerY = this.canvas2D.height / 2;

        for (let i = 0; i < stats.bodyCount; i++) {
            const x = positions[i * 4];
            const y = positions[i * 4 + 1];
            const z = positions[i * 4 + 2];
            const mass = positions[i * 4 + 3];

            // Project 3D to 2D (simple orthographic)
            const screenX = centerX + x * scale;
            const screenY = centerY + y * scale;

            // Skip if off-screen
            if (screenX < 0 || screenX > this.canvas2D.width || screenY < 0 || screenY > this.canvas2D.height) {
                continue;
            }

            // Draw circle (radius 5)
            this.ctx2D.beginPath();
            this.ctx2D.arc(screenX, screenY, 5, 0, Math.PI * 2);
            this.ctx2D.fill();
        }

        // Draw stats
        this.ctx2D.fillStyle = '#0f0';
        this.ctx2D.font = '16px Courier';
        this.ctx2D.fillText(`Bodies: ${stats.bodyCount}/${stats.maxBodies}`, 20, 30);
        this.ctx2D.fillText('GPU Physics: ON', 20, 50);
        this.ctx2D.fillText('Gravity: -9.81 m/s²', 20, 70);

        // Render to WebGPU
        await this.engine.renderFrame({ r: 0.1, g: 0.1, b: 0.2, a: 1.0 });
    }

    /**
     * Stop demo
     */
    stop(): void {
        this.running = false;
    }
}

// Main entry point
async function main() {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }

    try {
        const demo = new PhysicsDemo(canvas);
        await demo.initialize();
        await demo.run();

        // Run for 30 seconds then stop
        setTimeout(() => {
            demo.stop();
            console.log('✅ Physics demo completed');
        }, 30000);

    } catch (error) {
        console.error('❌ Demo error:', error);
    }
}

// Auto-start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
