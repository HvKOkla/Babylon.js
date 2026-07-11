/**
 * GPU Particle System - 1M+ particles simulated on GPU
 */

export interface Particle {
    position: [number, number, number];
    velocity: [number, number, number];
    lifetime: number;
    size: number;
}

export class GPUParticleSystem {
    private device: GPUDevice;
    private queue: GPUQueue;

    private particlesBuffer: GPUBuffer;
    private paramsBuffer: GPUBuffer;

    private computePipeline: GPUComputePipeline;
    private bindGroup: GPUBindGroup;

    private maxParticles: number;
    private aliveCount: number = 0;
    private emitIndex: number = 0;

    private gravity: number = -9.81;
    private damping: number = 0.98;
    private deltaTime: number = 0.016;

    constructor(device: GPUDevice, queue: GPUQueue, maxParticles: number = 1000000) {
        this.device = device;
        this.queue = queue;
        this.maxParticles = maxParticles;

        // Create buffers (position + velocity + lifetime + size = 32 bytes per particle)
        this.particlesBuffer = this.device.createBuffer({
            size: maxParticles * 32,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.paramsBuffer = this.device.createBuffer({
            size: 64,
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
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
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
                { binding: 0, resource: { buffer: this.particlesBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
            ],
        });

        console.log('✅ GPU Particle System initialized');
    }

    /**
     * Create particle compute shader (WGSL)
     */
    private createComputeShader(): string {
        return `
            struct Particle {
                position: vec3<f32>,
                lifetime: f32,
                velocity: vec3<f32>,
                size: f32,
            }

            struct ParticleParams {
                deltaTime: f32,
                gravity: f32,
                damping: f32,
                padding: f32,
                padding1: f32,
                padding2: f32,
                padding3: f32,
                padding4: f32,
            }

            @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
            @group(0) @binding(1) var<uniform> params: ParticleParams;

            @compute @workgroup_size(256)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let idx = global_id.x;
                let count = arrayLength(&particles);

                if (idx >= count) {
                    return;
                }

                var particle = particles[idx];

                // Skip dead particles
                if (particle.lifetime <= 0.0) {
                    return;
                }

                // Apply gravity
                particle.velocity.y += params.gravity * params.deltaTime;

                // Update position
                particle.position += particle.velocity * params.deltaTime;

                // Apply damping
                particle.velocity *= params.damping;

                // Update lifetime
                particle.lifetime -= params.deltaTime;

                // Store back
                particles[idx] = particle;
            }
        `;
    }

    /**
     * Emit particles
     */
    emit(position: [number, number, number], count: number, lifetime: number = 2.0, speed: number = 50): void {
        if (this.aliveCount + count > this.maxParticles) {
            console.warn(`Particle pool exhausted (${this.aliveCount} + ${count} > ${this.maxParticles})`);
            return;
        }

        const particleData: number[] = [];

        for (let i = 0; i < count; i++) {
            // Random direction
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = Math.random() * Math.PI * 2;
            const radius = Math.random() * speed;

            const vx = Math.sin(angle1) * Math.cos(angle2) * radius;
            const vy = Math.cos(angle1) * radius;
            const vz = Math.sin(angle1) * Math.sin(angle2) * radius;

            // Position with small randomness
            const px = position[0] + (Math.random() - 0.5) * 5;
            const py = position[1] + (Math.random() - 0.5) * 5;
            const pz = position[2] + (Math.random() - 0.5) * 5;

            const size = 0.5 + Math.random() * 1.0;

            particleData.push(
                px, py, pz, lifetime,
                vx, vy, vz, size
            );
        }

        // Write to GPU
        const offset = this.aliveCount * 32;
        this.queue.writeBuffer(
            this.particlesBuffer,
            offset,
            new Float32Array(particleData)
        );

        this.aliveCount += count;
    }

    /**
     * Update particle simulation
     */
    step(): void {
        if (this.aliveCount === 0) return;

        // Update params buffer
        const paramsData = new Float32Array([
            this.deltaTime,
            this.gravity,
            this.damping,
            0, 0, 0, 0, 0
        ]);

        this.queue.writeBuffer(this.paramsBuffer, 0, paramsData);

        // Dispatch compute shader
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.bindGroup);

        const workgroupCount = Math.ceil(this.aliveCount / 256);
        passEncoder.dispatchWorkgroups(workgroupCount);

        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Get particle count
     */
    getParticleCount(): number {
        return this.aliveCount;
    }

    /**
     * Get max particles
     */
    getMaxParticles(): number {
        return this.maxParticles;
    }

    /**
     * Reset particles
     */
    reset(): void {
        this.aliveCount = 0;
        this.emitIndex = 0;
    }
}
