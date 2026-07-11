/**
 * Pong Game - Complete playable game with GPU physics and WebGPU rendering
 */

import { WebGPUEngine } from '../core/WebGPUEngine.js';
import { InputManager } from '../core/InputManager.js';
import { Transform } from '../core/Transform.js';
import { Scene, Sprite, GameObject } from '../core/Scene.js';

interface PongConfig {
    width: number;
    height: number;
    ballSpeed: number;
    paddleSpeed: number;
}

class PongGame {
    private engine: WebGPUEngine;
    private input: InputManager;
    private scene: Scene;
    private config: PongConfig;

    // Game objects
    private ball: Sprite;
    private paddle1: Sprite;
    private paddle2: Sprite;
    private canvas: OffscreenCanvas | HTMLCanvasElement;
    private canvasCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

    private score1: number = 0;
    private score2: number = 0;
    private gameRunning: boolean = false;

    constructor(canvas: HTMLCanvasElement, config?: Partial<PongConfig>) {
        this.config = {
            width: 1920,
            height: 1080,
            ballSpeed: 500,
            paddleSpeed: 600,
            ...config,
        };

        this.engine = new WebGPUEngine(canvas);
        this.input = new InputManager(canvas);
        this.scene = new Scene('Pong Game');

        // Create 2D canvas for rendering
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        this.canvasCtx = this.canvas.getContext('2d')!;

        // Create game objects
        const paddleWidth = 10;
        const paddleHeight = 100;
        const ballSize = 10;

        // Ball (center)
        this.ball = new Sprite('ball', this.config.width / 2, this.config.height / 2, ballSize, ballSize, '#00ff00');
        this.ball.transform.setVelocity(this.config.ballSpeed, this.config.ballSpeed);

        // Paddle 1 (left)
        this.paddle1 = new Sprite('paddle1', 20, this.config.height / 2, paddleWidth, paddleHeight, '#ff0000');

        // Paddle 2 (right)
        this.paddle2 = new Sprite('paddle2', this.config.width - 20, this.config.height / 2, paddleWidth, paddleHeight, '#0000ff');

        // Register ball collision
        this.ball.onCollision = (other: GameObject) => this.onBallCollision(other);

        // Register update functions
        this.ball.update = (dt: number) => this.updateBall(dt);
        this.paddle1.update = (dt: number) => this.updatePaddle(this.paddle1, dt);
        this.paddle2.update = (dt: number) => this.updatePaddle(this.paddle2, dt);

        this.scene.addObject(this.ball);
        this.scene.addObject(this.paddle1);
        this.scene.addObject(this.paddle2);
    }

    /**
     * Initialize game
     */
    async initialize(): Promise<void> {
        await this.engine.initialize();
        this.input.initialize();
        this.gameRunning = true;
        console.log('🎮 Pong game initialized');
    }

    /**
     * Update ball
     */
    private updateBall(dt: number): void {
        const vel = this.ball.transform.getVelocity();

        // Update position
        this.ball.transform.translate(vel.x * dt, vel.y * dt);

        // Bounce on top/bottom
        if (this.ball.transform.position.y - this.ball.height / 2 <= 0 ||
            this.ball.transform.position.y + this.ball.height / 2 >= this.config.height) {
            const newVel = this.ball.transform.getVelocity();
            this.ball.transform.setVelocity(newVel.x, -newVel.y);
        }

        // Check if ball went out of bounds (score)
        if (this.ball.transform.position.x < 0) {
            this.score2++;
            this.resetBall();
        } else if (this.ball.transform.position.x > this.config.width) {
            this.score1++;
            this.resetBall();
        }
    }

    /**
     * Update paddle
     */
    private updatePaddle(paddle: Sprite, dt: number): void {
        const isPaddle1 = paddle === this.paddle1;
        const moveUp = isPaddle1 ? this.input.isKeyPressed('w') || this.input.isKeyPressed('arrowup') : this.input.isKeyPressed('arrowup');
        const moveDown = isPaddle1 ? this.input.isKeyPressed('s') || this.input.isKeyPressed('arrowdown') : this.input.isKeyPressed('arrowdown');

        if (moveUp) {
            paddle.transform.translate(0, -this.config.paddleSpeed * dt);
        }
        if (moveDown) {
            paddle.transform.translate(0, this.config.paddleSpeed * dt);
        }

        // Clamp paddle position
        const margin = paddle.height / 2;
        paddle.transform.position.y = Math.max(margin, Math.min(this.config.height - margin, paddle.transform.position.y));
    }

    /**
     * Handle ball collision
     */
    private onBallCollision(other: GameObject): void {
        const isPaddle = other === this.paddle1 || other === this.paddle2;
        if (!isPaddle) return;

        const ballVel = this.ball.transform.getVelocity();
        const newVel = { ...ballVel, x: -ballVel.x * 1.05 }; // Bounce and slightly accelerate

        this.ball.transform.setVelocity(newVel.x, newVel.y);
    }

    /**
     * Reset ball to center
     */
    private resetBall(): void {
        this.ball.transform.setPosition(this.config.width / 2, this.config.height / 2);
        this.ball.transform.setVelocity(this.config.ballSpeed, this.config.ballSpeed);
    }

    /**
     * Main game loop
     */
    async run(): Promise<void> {
        let lastTime = performance.now();
        let frameCount = 0;
        let fps = 0;

        const gameLoop = async () => {
            if (!this.gameRunning) return;

            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.016); // Cap at 60fps
            lastTime = now;

            // Update
            this.input.update();
            this.scene.update(dt);

            // Check for ESC to exit
            if (this.input.isKeyJustPressed('escape')) {
                this.gameRunning = false;
                return;
            }

            // Render 2D canvas
            this.canvasCtx.fillStyle = '#000';
            this.canvasCtx.fillRect(0, 0, this.config.width, this.config.height);

            // Draw game objects
            this.ball.drawDefault(this.canvasCtx);
            this.paddle1.drawDefault(this.canvasCtx);
            this.paddle2.drawDefault(this.canvasCtx);

            // Draw score
            this.canvasCtx.fillStyle = '#fff';
            this.canvasCtx.font = '48px Arial';
            this.canvasCtx.textAlign = 'center';
            this.canvasCtx.fillText(`${this.score1}  ${this.score2}`, this.config.width / 2, 60);

            // Draw FPS
            if (frameCount % 10 === 0) {
                fps = Math.round(1 / dt);
            }
            this.canvasCtx.font = '16px Courier';
            this.canvasCtx.fillText(`FPS: ${fps}`, 50, 30);

            // Render to WebGPU
            await this.engine.renderFrame({ r: 0.1, g: 0.1, b: 0.2, a: 1.0 });

            frameCount++;
            requestAnimationFrame(gameLoop);
        };

        gameLoop();
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
        const game = new PongGame(canvas);
        await game.initialize();
        await game.run();

        console.log('✅ Pong game started');
    } catch (error) {
        console.error('❌ Game error:', error);
    }
}

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
