/**
 * Scene - Manages entities and game objects
 */

import { Transform, Vector3 } from './Transform.js';

export interface GameObject {
    name: string;
    active: boolean;
    transform: Transform;
    update?: (deltaTime: number) => void;
    render?: (ctx: any) => void;
    onCollision?: (other: GameObject) => void;
}

export class Scene {
    private gameObjects: GameObject[] = [];
    private name: string;

    constructor(name: string = 'Default Scene') {
        this.name = name;
    }

    /**
     * Add game object to scene
     */
    addObject(obj: GameObject): void {
        this.gameObjects.push(obj);
    }

    /**
     * Remove game object from scene
     */
    removeObject(obj: GameObject): void {
        const index = this.gameObjects.indexOf(obj);
        if (index > -1) {
            this.gameObjects.splice(index, 1);
        }
    }

    /**
     * Get object by name
     */
    getObjectByName(name: string): GameObject | undefined {
        return this.gameObjects.find(obj => obj.name === name);
    }

    /**
     * Get all objects
     */
    getObjects(): GameObject[] {
        return [...this.gameObjects];
    }

    /**
     * Update all game objects
     */
    update(deltaTime: number): void {
        for (const obj of this.gameObjects) {
            if (obj.active) {
                obj.update?.(deltaTime);
            }
        }

        // Simple AABB collision detection
        for (let i = 0; i < this.gameObjects.length; i++) {
            for (let j = i + 1; j < this.gameObjects.length; j++) {
                if (this.checkCollision(this.gameObjects[i], this.gameObjects[j])) {
                    this.gameObjects[i].onCollision?.(this.gameObjects[j]);
                    this.gameObjects[j].onCollision?.(this.gameObjects[i]);
                }
            }
        }
    }

    /**
     * Simple AABB collision detection
     */
    private checkCollision(a: GameObject, b: GameObject): boolean {
        const aWidth = (a as any).width || 1;
        const aHeight = (a as any).height || 1;
        const bWidth = (b as any).width || 1;
        const bHeight = (b as any).height || 1;

        return (
            a.transform.position.x < b.transform.position.x + bWidth &&
            a.transform.position.x + aWidth > b.transform.position.x &&
            a.transform.position.y < b.transform.position.y + bHeight &&
            a.transform.position.y + aHeight > b.transform.position.y
        );
    }

    /**
     * Clear all objects
     */
    clear(): void {
        this.gameObjects = [];
    }

    /**
     * Get object count
     */
    getObjectCount(): number {
        return this.gameObjects.length;
    }
}

/**
 * Simple 2D Sprite class
 */
export class Sprite implements GameObject {
    name: string;
    active: boolean = true;
    transform: Transform;
    width: number = 1;
    height: number = 1;
    color: string = '#ffffff';
    update?: (deltaTime: number) => void;
    render?: (ctx: CanvasRenderingContext2D) => void;
    onCollision?: (other: GameObject) => void;

    constructor(name: string, x: number, y: number, width: number, height: number, color: string = '#ffffff') {
        this.name = name;
        this.transform = new Transform({ x, y, z: 0 });
        this.width = width;
        this.height = height;
        this.color = color;
    }

    /**
     * Default sprite rendering
     */
    drawDefault(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.color;
        ctx.fillRect(
            this.transform.position.x - this.width / 2,
            this.transform.position.y - this.height / 2,
            this.width,
            this.height
        );
    }
}
