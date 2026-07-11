/**
 * Complete Pong Game - Days 4-5 Integration
 * Keyboard input, GPU physics, particles, and scoring
 */

import { WebGPUEngine } from '../core/WebGPUEngine.js';
import { InputManager } from '../core/InputManager.js';
import { GPUPhysicsSystem } from '../core/PhysicsSystem.js';
import { GPUParticleSystem } from '../core/ParticleSystem.js';

interface GameConfig {
    width: number;
    height: number;
    ballSpeed: number;
    paddleSpeed: number;
}

class CompletePongGame {
    private engine: WebGPUEngine;
    private input: InputManager;
    private physics: GPUPhysicsSystem | null = null;
    private particles: GPUParticleSystem | null = null;

    private canvas: HTMLCanvasElement;
    private canvas2D: HTMLCanvasElement;
    private ctx2D: CanvasRenderingContext2D;
    private config: GameConfig;

    private running: boolean = false;
    private score1: number = 0;
    private score2: number = 0;

    // Ball physics body
    private ballBodyIndex: number = -1;
    private ballX: number = 0;
    private ballY: number = 0;
    private ballVelX: number = 300;
    private ballVelY: number = 300;

    // Paddle positions
    private paddle1Y: number = 0;
    private paddle2Y: number = 0;

    constructor(canvas: HTMLCanvasElement, config?: Partial<GameConfig>) {
        this.canvas = canvas;
        this.config = {
            width: 1920,
            height: 1080,
            ballSpeed: 300,
            paddleSpeed: 600,
            ...config,
        };

        this.engine = new WebGPUEngine(canvas);
        this.input = new InputManager(canvas);

        // 2D canvas for rendering
        this.canvas2D = document.createElement('canvas');
        this.canvas2D.width = this.config.width;
        this.canvas2D.height = this.config.height;
        this.ctx2D = this.canvas2D.getContext('2d')!;

        // Initialize positions
        this.ballX = this.config.width / 2;
        this.ballY = this.config.height / 2;
        this.paddle1Y = this.config.height / 2;
        this.paddle2Y = this.config.height / 2;
    }

    /**
     * Initialize game
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();
        this.input.initialize();

        // Get WebGPU internals
        const device = (this.engine as any).device;
        const queue = (this.engine as any).queue;

        if (!device || !queue) {
            throw new Error('Failed to get WebGPU internals');
        }

        // Create physics and particles
        this.physics = new GPUPhysicsSystem(device, queue, 50);
        this.particles = new GPUParticleSystem(device, queue, 100000);

        // Create ball body
        this.ballBodyIndex = this.physics.addBody(
            [this.ballX, this.ballY, 0],
            [this.ballVelX, this.ballVelY, 0],
            1,
            5
        ).index;

        console.log('✅ Complete Pong game initialized');
        console.log('Controls: W/S (Player 1), ArrowUp/ArrowDown (Player 2), ESC to quit');
    }

    /**
     * Run game loop
     */
    async run(): Promise<void> {
        if (!this.physics || !this.particles) {
            console.error('Game not initialized');
            return;
        }

        this.running = true;
        let frameCount = 0;
        let fps = 0;
        let lastTime = performance.now();

        const gameLoop = async () => {
            if (!this.running) return;

            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.016);
            lastTime = now;

            // Update input
            this.input.update();

            // Check ESC to quit
            if (this.input.isKeyJustPressed('escape')) {
                this.running = false;
                return;
            }

            // Update paddle positions
            if (this.input.isKeyPressed('w')) {
                this.paddle1Y -= this.config.paddleSpeed * dt;
            }
            if (this.input.isKeyPressed('s')) {
                this.paddle1Y += this.config.paddleSpeed * dt;
            }
            if (this.input.isKeyPressed('arrowup')) {
                this.paddle2Y -= this.config.paddleSpeed * dt;
            }
            if (this.input.isKeyPressed('arrowdown')) {
                this.paddle2Y += this.config.paddleSpeed * dt;
            }

            // Clamp paddle positions
            const paddleHeight = 100;
            this.paddle1Y = Math.max(paddleHeight / 2, Math.min(this.config.height - paddleHeight / 2, this.paddle1Y));
            this.paddle2Y = Math.max(paddleHeight / 2, Math.min(this.config.height - paddleHeight / 2, this.paddle2Y));

            // Update physics
            this.physics.step();

            // Update particles
            this.particles.step();

            // Get ball position from physics
            const ballPositions = await this.physics.getBodyPositions();
            if (this.ballBodyIndex >= 0) {
                this.ballX = ballPositions[this.ballBodyIndex * 4];
                this.ballY = ballPositions[this.ballBodyIndex * 4 + 1];
            }

            // Check ball out of bounds
            if (this.ballX < 0) {
                this.score2++;
                this.resetBall();
            } else if (this.ballX > this.config.width) {
                this.score1++;
                this.resetBall();
            }

            // Check paddle collisions
            this.checkPaddleCollisions(dt);

            // Render 2D
            this.render2D(fps);

            // Render to WebGPU
            await this.engine.renderFrame({ r: 0.1, g: 0.1, b: 0.2, a: 1.0 });

            frameCount++;
            if (frameCount % 30 === 0) {
                fps = Math.round(1 / dt);
            }

            requestAnimationFrame(gameLoop);
        };

        gameLoop();
    }

    /**
     * Check paddle collisions
     */
    private checkPaddleCollisions(dt: number): void {
        if (!this.particles) return;

        const ballRadius = 5;
        const paddleWidth = 10;
        const paddleHeight = 100;

        // Paddle 1 (left)
        if (
            this.ballX - ballRadius < 20 + paddleWidth &&
            this.ballX + ballRadius > 20 &&
            this.ballY - ballRadius < this.paddle1Y + paddleHeight / 2 &&
            this.ballY + ballRadius > this.paddle1Y - paddleHeight / 2
        ) {
            this.ballVelX = Math.abs(this.ballVelX) * 1.05; // Bounce right
            this.particles.emit([this.ballX, this.ballY, 0], 50, 1, 100);
        }

        // Paddle 2 (right)
        if (
            this.ballX + ballRadius > this.config.width - 20 - paddleWidth &&
            this.ballX - ballRadius < this.config.width - 20 &&
            this.ballY - ballRadius < this.paddle2Y + paddleHeight / 2 &&
            this.ballY + ballRadius > this.paddle2Y - paddleHeight / 2
        ) {
            this.ballVelX = -Math.abs(this.ballVelX) * 1.05; // Bounce left
            this.particles.emit([this.ballX, this.ballY, 0], 50, 1, 100);
        }
    }

    /**
     * Reset ball
     */
    private resetBall(): void {
        this.ballX = this.config.width / 2;
        this.ballY = this.config.height / 2;
        this.ballVelX = this.config.ballSpeed * (Math.random() > 0.5 ? 1 : -1);
        this.ballVelY = this.config.ballSpeed * (Math.random() - 0.5) * 2;
    }

    /**
     * Render 2D graphics
     */
    private render2D(fps: number): void {
        // Clear
        this.ctx2D.fillStyle = '#000';
        this.ctx2D.fillRect(0, 0, this.config.width, this.config.height);

        // Draw ball
        this.ctx2D.fillStyle = '#0f0';
        this.ctx2D.beginPath();
        this.ctx2D.arc(this.ballX, this.ballY, 5, 0, Math.PI * 2);
        this.ctx2D.fill();

        // Draw paddles
        const paddleWidth = 10;
        const paddleHeight = 100;

        this.ctx2D.fillStyle = '#f00';
        this.ctx2D.fillRect(20, this.paddle1Y - paddleHeight / 2, paddleWidth, paddleHeight);

        this.ctx2D.fillStyle = '#00f';
        this.ctx2D.fillRect(this.config.width - 20 - paddleWidth, this.paddle2Y - paddleHeight / 2, paddleWidth, paddleHeight);

        // Draw score
        this.ctx2D.fillStyle = '#fff';
        this.ctx2D.font = '48px Arial';
        this.ctx2D.textAlign = 'center';
        this.ctx2D.fillText(`${this.score1}    ${this.score2}`, this.config.width / 2, 60);

        // Draw stats
        this.ctx2D.font = '16px Courier';
        this.ctx2D.textAlign = 'left';
        this.ctx2D.fillText(`FPS: ${fps}`, 20, 30);
        this.ctx2D.fillText(`Particles: ${this.particles?.getParticleCount() || 0}`, 20, 50);

        // Draw instructions
        this.ctx2D.font = '12px Courier';
        this.ctx2D.fillText('W/S - Player 1 | ↑/↓ - Player 2 | ESC - Quit', 20, this.config.height - 20);
    }

    /**
     * Stop game
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
        const game = new CompletePongGame(canvas);
        await game.initialize();
        await game.run();

        console.log('🎮 Complete Pong game started');
    } catch (error) {
        console.error('❌ Game error:', error);
    }
}

// Auto-start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
