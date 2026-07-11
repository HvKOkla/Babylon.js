/**
 * Transform - Position, rotation, and scale
 */

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

export class Transform {
    position: Vector3 = { x: 0, y: 0, z: 0 };
    rotation: Quaternion = { x: 0, y: 0, z: 0, w: 1 };
    scale: Vector3 = { x: 1, y: 1, z: 1 };

    private velocity: Vector3 = { x: 0, y: 0, z: 0 };
    private acceleration: Vector3 = { x: 0, y: 0, z: 0 };

    constructor(position?: Vector3) {
        if (position) {
            this.position = { ...position };
        }
    }

    /**
     * Set position
     */
    setPosition(x: number, y: number, z: number = 0): void {
        this.position = { x, y, z };
    }

    /**
     * Add to position
     */
    translate(dx: number, dy: number, dz: number = 0): void {
        this.position.x += dx;
        this.position.y += dy;
        this.position.z += dz;
    }

    /**
     * Set rotation (Euler angles in radians)
     */
    setRotation(x: number, y: number, z: number): void {
        // Simple Euler to Quaternion conversion
        const ex = x * 0.5;
        const ey = y * 0.5;
        const ez = z * 0.5;

        const sx = Math.sin(ex);
        const cx = Math.cos(ex);
        const sy = Math.sin(ey);
        const cy = Math.cos(ey);
        const sz = Math.sin(ez);
        const cz = Math.cos(ez);

        this.rotation = {
            x: sx * cy * cz + cx * sy * sz,
            y: cx * sy * cz - sx * cy * sz,
            z: cx * cy * sz + sx * sy * cz,
            w: cx * cy * cz - sx * sy * sz,
        };
    }

    /**
     * Set scale
     */
    setScale(x: number, y: number = x, z: number = x): void {
        this.scale = { x, y, z };
    }

    /**
     * Set velocity (for physics)
     */
    setVelocity(x: number, y: number, z: number = 0): void {
        this.velocity = { x, y, z };
    }

    /**
     * Get velocity
     */
    getVelocity(): Vector3 {
        return { ...this.velocity };
    }

    /**
     * Add force (apply acceleration)
     */
    applyForce(x: number, y: number, z: number = 0, mass: number = 1): void {
        this.acceleration.x += x / mass;
        this.acceleration.y += y / mass;
        this.acceleration.z += z / mass;
    }

    /**
     * Update physics (should be called every frame)
     */
    update(deltaTime: number, gravity: number = -9.81, damping: number = 0.99): void {
        // Apply gravity
        this.acceleration.y += gravity;

        // Update velocity
        this.velocity.x += this.acceleration.x * deltaTime;
        this.velocity.y += this.acceleration.y * deltaTime;
        this.velocity.z += this.acceleration.z * deltaTime;

        // Apply damping
        this.velocity.x *= damping;
        this.velocity.y *= damping;
        this.velocity.z *= damping;

        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;

        // Reset acceleration
        this.acceleration = { x: 0, y: 0, z: 0 };
    }

    /**
     * Clamp position to bounds
     */
    clamp(minX: number, maxX: number, minY: number, maxY: number): void {
        this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
        this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }

    /**
     * Get forward vector
     */
    getForward(): Vector3 {
        return {
            x: 2 * (this.rotation.x * this.rotation.z - this.rotation.w * this.rotation.y),
            y: 2 * (this.rotation.y * this.rotation.z + this.rotation.w * this.rotation.x),
            z: 1 - 2 * (this.rotation.x * this.rotation.x + this.rotation.y * this.rotation.y),
        };
    }

    /**
     * Get right vector
     */
    getRight(): Vector3 {
        return {
            x: 1 - 2 * (this.rotation.y * this.rotation.y + this.rotation.z * this.rotation.z),
            y: 2 * (this.rotation.x * this.rotation.y - this.rotation.w * this.rotation.z),
            z: 2 * (this.rotation.x * this.rotation.z + this.rotation.w * this.rotation.y),
        };
    }

    /**
     * Get up vector
     */
    getUp(): Vector3 {
        return {
            x: 2 * (this.rotation.x * this.rotation.y + this.rotation.w * this.rotation.z),
            y: 1 - 2 * (this.rotation.x * this.rotation.x + this.rotation.z * this.rotation.z),
            z: 2 * (this.rotation.y * this.rotation.z - this.rotation.w * this.rotation.x),
        };
    }

    /**
     * Clone transform
     */
    clone(): Transform {
        const t = new Transform(this.position);
        t.rotation = { ...this.rotation };
        t.scale = { ...this.scale };
        t.velocity = { ...this.velocity };
        t.acceleration = { ...this.acceleration };
        return t;
    }
}
