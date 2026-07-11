/**
 * Day 2 Demo - WebGPU Rendering Pipeline
 * Renders triangle, quad, and cube using WGSL shaders
 */

import { WebGPUEngine } from '../core/WebGPUEngine.js';
import { Renderer } from '../core/Renderer.js';

class RenderingDemo {
    private engine: WebGPUEngine;
    private renderer: Renderer | null = null;
    private canvas: HTMLCanvasElement;
    private running: boolean = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.engine = new WebGPUEngine(canvas);
    }

    /**
     * Initialize demo
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();
        
        // Get internal device/context/queue from engine (exposed via public method)
        const device = (this.engine as any).device;
        const context = (this.engine as any).context;
        const format = (this.engine as any).format;
        const queue = (this.engine as any).queue;

        if (!device || !context || !format || !queue) {
            throw new Error('Failed to get WebGPU internals from engine');
        }

        // Create renderer
        this.renderer = new Renderer(this.engine, device, context, format, queue, this.canvas);
        await this.renderer.initialize();

        // Create meshes
        const triangle = this.renderer.createTriangle();
        const quad = this.renderer.createQuad(0.3, 0.3, [0, 1, 0]);
        const cube = this.renderer.createCube(0.2, [1, 1, 0]);

        // Add to render queue
        this.renderer.addObject(triangle, [-0.3, 0, 0]);
        this.renderer.addObject(quad, [0, 0, 0]);
        this.renderer.addObject(cube, [0.3, 0, 0]);

        console.log('✅ Rendering demo initialized');
        console.log(`Rendering ${this.renderer.getObjectCount()} objects`);
    }

    /**
     * Run demo
     */
    async run(): Promise<void> {
        if (!this.renderer) {
            console.error('Renderer not initialized');
            return;
        }

        this.running = true;
        let frameCount = 0;
        let fps = 0;

        const loop = async () => {
            if (!this.running) return;

            // Render
            await this.renderer!.render({ r: 0.1, g: 0.1, b: 0.2, a: 1.0 });

            frameCount++;
            if (frameCount % 60 === 0) {
                fps = frameCount;
                console.log(`Rendering... FPS: ${fps}`);
            }

            requestAnimationFrame(loop);
        };

        loop();
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
        const demo = new RenderingDemo(canvas);
        await demo.initialize();
        await demo.run();

        // Stop after 10 seconds for demo
        setTimeout(() => {
            demo.stop();
            console.log('✅ Demo completed');
        }, 10000);

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
