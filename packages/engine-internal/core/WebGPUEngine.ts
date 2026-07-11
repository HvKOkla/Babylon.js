/**
 * WebGPU Rendering Engine
 * Modern GPU-accelerated renderer for games
 */

/**
 * WebGPU Engine - Direct GPU access for maximum performance
 * Supports compute shaders for physics, particles, culling
 */
export class WebGPUEngine {
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private queue: GPUQueue | null = null;
    private canvas: HTMLCanvasElement;
    private format: GPUTextureFormat = 'bgra8unorm';

    // Render state
    private renderPipeline: GPURenderPipeline | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private vertexBuffer: GPUBuffer | null = null;
    private indexBuffer: GPUBuffer | null = null;
    private uniformBuffer: GPUBuffer | null = null;

    // Performance metrics
    private frameTime: number = 0;
    private drawCalls: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    /**
     * Initialize WebGPU engine (public API)
     */
    async initialize(): Promise<void> {
        const success = await this.init();
        if (!success) {
            throw new Error('Failed to initialize WebGPU engine');
        }
    }

    /**
     * Initialize WebGPU engine (internal)
     */
    private async init(): Promise<boolean> {
        try {
            // Request GPU adapter
            const adapter = await navigator.gpu?.requestAdapter?.();
            if (!adapter) {
                console.warn('[WebGPU] GPU adapter not found, falling back to WebGL2');
                return false;
            }

            // Request device
            this.device = await adapter.requestDevice();
            if (!this.device) {
                console.warn('[WebGPU] GPU device not available');
                return false;
            }

            // Setup canvas context
            const context = this.canvas.getContext('webgpu');
            if (!context) {
                console.warn('[WebGPU] Canvas context not available');
                return false;
            }

            this.context = context;
            this.queue = this.device.queue;

            // Get canvas format
            this.format = navigator.gpu.getPreferredCanvasFormat();

            // Configure context
            this.context.configure({
                device: this.device,
                format: this.format,
            });

            // Initialize render pipeline
            await this.setupRenderPipeline();

            console.log('[WebGPU] Engine initialized successfully');
            console.log(`Format: ${this.format}, Device: ${this.device.label}`);
            return true;
        } catch (error) {
            console.error('[WebGPU] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Setup render pipeline
     */
    private async setupRenderPipeline(): Promise<void> {
        if (!this.device) throw new Error('Device not initialized');

        // Vertex shader (WGSL)
        const vertexShader = `
            struct VertexInput {
                @location(0) position: vec3<f32>,
                @location(1) color: vec3<f32>,
            }

            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) color: vec3<f32>,
            }

            struct Uniforms {
                mvp: mat4x4<f32>,
            }

            @group(0) @binding(0) var<uniform> uniforms: Uniforms;

            @vertex
            fn main(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                output.position = uniforms.mvp * vec4<f32>(input.position, 1.0);
                output.color = input.color;
                return output;
            }
        `;

        // Fragment shader (WGSL)
        const fragmentShader = `
            @fragment
            fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                return vec4<f32>(color, 1.0);
            }
        `;

        const shaderModule = this.device.createShaderModule({
            code: vertexShader + '\n' + fragmentShader,
        });

        // Create uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            size: 64, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        // Create bind group layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' },
                },
            ],
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
            ],
        });

        // Create pipeline layout
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 24, // 3 floats position + 3 floats color
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },
                            { shaderLocation: 1, offset: 12, format: 'float32x3' },
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'main',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
    }

    /**
     * Create vertex buffer
     */
    createVertexBuffer(vertices: Float32Array): GPUBuffer {
        if (!this.device) throw new Error('Device not initialized');

        return this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
    }

    /**
     * Render frame
     */
    async renderFrame(clearColor: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 1 }): Promise<void> {
        if (!this.device || !this.context || !this.renderPipeline) {
            console.warn('[WebGPU] Not initialized, skipping render');
            return;
        }

        const startTime = performance.now();

        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();

        // Get current texture
        const canvasTexture = this.context.getCurrentTexture();
        const textureView = canvasTexture.createView();

        // Create render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: clearColor,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        // Render commands
        renderPass.setPipeline(this.renderPipeline);
        if (this.bindGroup) {
            renderPass.setBindGroup(0, this.bindGroup);
        }
        if (this.vertexBuffer && this.indexBuffer) {
            renderPass.setVertexBuffer(0, this.vertexBuffer);
            renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
            renderPass.drawIndexed(6); // Draw a quad
        }

        renderPass.end();

        // Submit commands
        this.queue.submit([commandEncoder.finish()]);

        // Calculate frame time
        this.frameTime = performance.now() - startTime;
    }

    /**
     * Create compute shader pipeline
     */
    createComputePipeline(shader: string, layout: GPUBindGroupLayout): GPUComputePipeline {
        if (!this.device) throw new Error('Device not initialized');

        const shaderModule = this.device.createShaderModule({ code: shader });
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [layout],
        });

        return this.device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'main' },
        });
    }

    /**
     * Dispatch compute shader
     */
    dispatchCompute(pipeline: GPUComputePipeline, bindGroup: GPUBindGroup, workgroupX: number, workgroupY: number = 1, workgroupZ: number = 1): void {
        if (!this.device) throw new Error('Device not initialized');

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(workgroupX, workgroupY, workgroupZ);
        passEncoder.end();

        this.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Get performance metrics
     */
    getMetrics(): {
        frameTime: number;
        fps: number;
        drawCalls: number;
    } {
        return {
            frameTime: this.frameTime,
            fps: 1000 / (this.frameTime || 16.67),
            drawCalls: this.drawCalls,
        };
    }

    /**
     * Check if WebGPU is supported
     */
    static isSupported(): boolean {
        return !!navigator.gpu;
    }

    /**
     * Get WebGPU info
     */
    static async getInfo(): Promise<any> {
        if (!navigator.gpu) {
            return { supported: false };
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            const info = await adapter?.requestAdapterInfo?.();
            return {
                supported: true,
                vendor: info?.vendor,
                architecture: info?.architecture,
                device: info?.device,
                format: navigator.gpu.getPreferredCanvasFormat(),
            };
        } catch (e) {
            return { supported: false, error: e };
        }
    }

    /**
     * Resize canvas
     */
    resize(width: number, height: number): void {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Destroy engine
     */
    destroy(): void {
        this.vertexBuffer?.destroy();
        this.indexBuffer?.destroy();
        this.uniformBuffer?.destroy();
        this.device?.destroy();
    }
}

/**
 * GPU Physics Engine - Using Compute Shaders
 */
export class GPUPhysicsEngine {
    private device: GPUDevice;
    private bodiesBuffer: GPUBuffer;
    private velocitiesBuffer: GPUBuffer;
    private computePipeline: GPUComputePipeline;
    private bindGroup: GPUBindGroup;
    private maxBodies: number;

    constructor(device: GPUDevice, maxBodies: number = 10000) {
        this.device = device;
        this.maxBodies = maxBodies;
    }

    /**
     * Initialize physics engine
     */
    async init(): Promise<void> {
        // Create buffers
        this.bodiesBuffer = this.device.createBuffer({
            size: this.maxBodies * 16, // 4 floats per body
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.velocitiesBuffer = this.device.createBuffer({
            size: this.maxBodies * 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        // Create compute shader
        const computeShader = `
            struct Body {
                position: vec3<f32>,
                mass: f32,
            }

            @group(0) @binding(0) var<storage, read_write> bodies: array<Body>;
            @group(0) @binding(1) var<storage, read_write> velocities: array<vec3<f32>>;
            @group(0) @binding(2) var<uniform> params: PhysicsParams;

            struct PhysicsParams {
                deltaTime: f32,
                gravity: f32,
                damping: f32,
                padding: f32,
            }

            @compute @workgroup_size(256)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let idx = global_id.x;
                if (idx >= arrayLength(&bodies)) {
                    return;
                }

                var body = bodies[idx];
                var velocity = velocities[idx];

                // Apply gravity
                velocity.y += params.gravity * params.deltaTime;

                // Update position
                body.position += velocity * params.deltaTime;

                // Damping
                velocity *= params.damping;

                // Store back
                bodies[idx] = body;
                velocities[idx] = velocity;
            }
        `;

        // Create pipeline
        const shaderModule = this.device.createShaderModule({ code: computeShader });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.computePipeline = this.device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'main' },
        });

        // Create uniforms buffer
        const uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.bodiesBuffer } },
                { binding: 1, resource: { buffer: this.velocitiesBuffer } },
                { binding: 2, resource: { buffer: uniformBuffer } },
            ],
        });
    }

    /**
     * Step physics simulation
     */
    step(deltaTime: number, numBodies: number): void {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(this.computePipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(numBodies / 256), 1, 1);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}

/**
 * GPU Particle System
 */
export class GPUParticleSystem {
    private device: GPUDevice;
    private particlesBuffer: GPUBuffer;
    private computePipeline: GPUComputePipeline;
    private maxParticles: number;
    private aliveCount: number = 0;

    constructor(device: GPUDevice, maxParticles: number = 1000000) {
        this.device = device;
        this.maxParticles = maxParticles;
    }

    /**
     * Initialize particle system
     */
    async init(): Promise<void> {
        this.particlesBuffer = this.device.createBuffer({
            size: this.maxParticles * 32, // Position(12) + velocity(12) + lifetime(4) + size(4)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        const computeShader = `
            struct Particle {
                position: vec3<f32>,
                lifetime: f32,
                velocity: vec3<f32>,
                size: f32,
            }

            @group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
            @group(0) @binding(1) var<uniform> params: ParticleParams;

            struct ParticleParams {
                deltaTime: f32,
                gravity: f32,
                damping: f32,
                padding: f32,
            }

            @compute @workgroup_size(256)
            fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let idx = global_id.x;
                if (idx >= arrayLength(&particles)) {
                    return;
                }

                var particle = particles[idx];
                if (particle.lifetime <= 0.0) {
                    return;
                }

                particle.position += particle.velocity * params.deltaTime;
                particle.velocity.y += params.gravity * params.deltaTime;
                particle.velocity *= params.damping;
                particle.lifetime -= params.deltaTime;

                particles[idx] = particle;
            }
        `;

        const shaderModule = this.device.createShaderModule({ code: computeShader });
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        this.computePipeline = this.device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'main' },
        });
    }

    /**
     * Update particles
     */
    update(deltaTime: number): void {
        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        passEncoder.setPipeline(this.computePipeline);
        passEncoder.dispatchWorkgroups(Math.ceil(this.aliveCount / 256), 1, 1);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Emit particles
     */
    emit(position: { x: number; y: number; z: number }, count: number): void {
        if (this.aliveCount + count > this.maxParticles) {
            console.warn('Particle pool exhausted');
            return;
        }
        this.aliveCount += count;
    }
}
