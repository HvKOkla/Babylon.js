/**
 * GPU Physics Engine - Compute shader-based physics simulation
 * Simulates gravity, collisions, and damping on GPU
 */

export interface PhysicsBody {
    index: number;
    position: [number, number, number];
    velocity: [number, number, number];
    mass: number;
    radius: number;
}

export class GPUPhysicsSystem {
    private device: GPUDevice;
    private queue: GPUQueue;

    private bodiesBuffer: GPUBuffer;
    private velocitiesBuffer: GPUBuffer;
    private paramsBuffer: GPUBuffer;

    private computePipeline: GPUComputePipeline;
    private bindGroup: GPUBindGroup;

    private bodies: PhysicsBody[] = [];
    private maxBodies: number;
    private activeBodyCount: number = 0;

    // Physics parameters
    private gravity: number = -9.81;
    private damping: number = 0.99;
    private deltaTime: number = 0.016; // 60 FPS

    constructor(device: GPUDevice, queue: GPUQueue, maxBodies: number = 1000) {
        this.device = device;
        this.queue = queue;
        this.maxBodies = maxBodies;

        // Create buffers
        this.bodiesBuffer = this.device.createBuffer({
            size: maxBodies * 16, // position (12) + mass (4)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.velocitiesBuffer = this.device.createBuffer({
            size: maxBodies * 16, // velocity (12) + radius (4)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.paramsBuffer = this.device.createBuffer({
            size: 64, // deltaTime, gravity, damping, friction, restitution + padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        // Create compute shader
        const computeShader = this.createComputeShader();
        const shaderModule = this.device.createShaderModule({ code: computeShader });

        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        // Create compute pipeline
        this.computePipeline = this.device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'main' },
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bodiesBuffer } },
                { binding: 1, resource: { buffer: this.velocitiesBuffer } },
                { binding: 2, resource: { buffer: this.paramsBuffer } },
            ],
        });

        console.log('✅ GPU Physics System initialized');
    }

    /**
     * Create physics compute shader (WGSL)
     */
    private createComputeShader(): string {
        return `
            struct Body {
                position: vec3<f32>,
                mass: f32,
            }

            struct Velocity {
                velocity: vec3<f32>,
                radius: f32,
            }

            struct PhysicsParams {
                deltaTime: f32,
                gravity: f32,
                damping: f32,
                friction: f32,
                restitution: f32,
                padding: f32,
                padding2: f32,
                padding3: f32,
            }

            @group(0) @binding(0) var<storage, read_write> bodies: array<Body>;
            @group(0) @binding(1) var<storage, read_write> velocities: array<Velocity>;
            @group(0) @binding(2) var<uniform> params: PhysicsParams;

            @compute @workgroup_size(256)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let idx = global_id.x;
                let body_count = arrayLength(&bodies);

                if (idx >= body_count) {
                    return;
                }

                var body = bodies[idx];
                var vel = velocities[idx];

                // Apply gravity
                if (body.mass > 0.0) {
                    vel.velocity.y += params.gravity * params.deltaTime;
                }

                // Update position
                body.position += vel.velocity * params.deltaTime;

                // Apply damping (air resistance)
                vel.velocity *= params.damping;

                // Boundary collision (walls)
                let bounds = 100.0;
                let restitution = params.restitution;

                // X bounds
                if (body.position.x - vel.radius < -bounds) {
                    body.position.x = -bounds + vel.radius;
                    vel.velocity.x *= -restitution;
                } else if (body.position.x + vel.radius > bounds) {
                    body.position.x = bounds - vel.radius;
                    vel.velocity.x *= -restitution;
                }

                // Y bounds
                if (body.position.y - vel.radius < -bounds) {
                    body.position.y = -bounds + vel.radius;
                    vel.velocity.y *= -restitution;
                } else if (body.position.y + vel.radius > bounds) {
                    body.position.y = bounds - vel.radius;
                    vel.velocity.y *= -restitution;
                }

                // Z bounds
                if (body.position.z - vel.radius < -bounds) {
                    body.position.z = -bounds + vel.radius;
                    vel.velocity.z *= -restitution;
                } else if (body.position.z + vel.radius > bounds) {
                    body.position.z = bounds - vel.radius;
                    vel.velocity.z *= -restitution;
                }

                // Store back
                bodies[idx] = body;
                velocities[idx] = vel;
            }
        `;
    }

    /**
     * Add physics body
     */
    addBody(position: [number, number, number], velocity: [number, number, number] = [0, 0, 0], mass: number = 1, radius: number = 0.5): PhysicsBody {
        if (this.activeBodyCount >= this.maxBodies) {
            console.warn('Physics body limit reached');
            return { index: -1, position, velocity, mass, radius };
        }

        const body: PhysicsBody = {
            index: this.activeBodyCount,
            position,
            velocity,
            mass,
            radius,
        };

        this.bodies.push(body);

        // Write to GPU buffers
        this.queue.writeBuffer(
            this.bodiesBuffer,
            this.activeBodyCount * 16,
            new Float32Array([position[0], position[1], position[2], mass])
        );

        this.queue.writeBuffer(
            this.velocitiesBuffer,
            this.activeBodyCount * 16,
            new Float32Array([velocity[0], velocity[1], velocity[2], radius])
        );

        this.activeBodyCount++;
        return body;
    }

    /**
     * Emit multiple bodies
     */
    emitBodies(count: number, position: [number, number, number], velocity: [number, number, number] = [0, 0, 0]): void {
        for (let i = 0; i < count; i++) {
            const randomVel: [number, number, number] = [
                velocity[0] + (Math.random() - 0.5) * 50,
                velocity[1] + (Math.random() - 0.5) * 50,
                velocity[2] + (Math.random() - 0.5) * 50,
            ];

            this.addBody(position, randomVel, 1, 0.5);
        }
    }

    /**
     * Update physics simulation
     */
    step(): void {
        // Update physics parameters buffer
        const paramsData = new Float32Array([
            this.deltaTime,
            this.gravity,
            this.damping,
            0, // friction (unused)
            0.8, // restitution
            0, 0, 0, // padding
        ]);

        this.queue.writeBuffer(this.paramsBuffer, 0, paramsData);

        // Dispatch compute shader
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.bindGroup);

        // Dispatch with 256 threads per workgroup
        const workgroupCount = Math.ceil(this.activeBodyCount / 256);
        passEncoder.dispatchWorkgroups(workgroupCount);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Get body positions (for rendering)
     */
    async getBodyPositions(): Promise<Float32Array> {
        const stagingBuffer = this.device.createBuffer({
            size: this.activeBodyCount * 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            mappedAtCreation: false,
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.bodiesBuffer, 0, stagingBuffer, 0, this.activeBodyCount * 16);
        this.device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(stagingBuffer.getMappedRange());
        const result = new Float32Array(data);
        stagingBuffer.unmap();

        return result;
    }

    /**
     * Set physics parameters
     */
    setGravity(g: number): void {
        this.gravity = g;
    }

    setDamping(d: number): void {
        this.damping = Math.max(0, Math.min(1, d));
    }

    setDeltaTime(dt: number): void {
        this.deltaTime = dt;
    }

    /**
     * Get stats
     */
    getStats(): { bodyCount: number; maxBodies: number } {
        return {
            bodyCount: this.activeBodyCount,
            maxBodies: this.maxBodies,
        };
    }
}
