/**
 * WebGPU Renderer - Advanced rendering pipeline with shaders
 */

import { WebGPUEngine } from './WebGPUEngine.js';

export interface Vertex {
    position: [number, number, number];
    color: [number, number, number];
}

export interface Mesh {
    vertices: Float32Array;
    indices: Uint32Array;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
}

export interface RenderObject {
    mesh: Mesh;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
}

/**
 * Advanced WebGPU Renderer
 */
export class Renderer {
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private format: GPUTextureFormat;
    private queue: GPUQueue;
    private canvas: HTMLCanvasElement;

    private renderPipeline: GPURenderPipeline | null = null;
    private bindGroupLayout: GPUBindGroupLayout | null = null;
    private pipelineLayout: GPUPipelineLayout | null = null;

    // Uniforms
    private uniformBuffer: GPUBuffer;
    private bindGroup: GPUBindGroup | null = null;

    // Shaders
    private vertexShaderModule: GPUShaderModule;
    private fragmentShaderModule: GPUShaderModule;

    private objects: RenderObject[] = [];

    constructor(engine: WebGPUEngine, device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat, queue: GPUQueue, canvas: HTMLCanvasElement) {
        this.device = device;
        this.context = context;
        this.format = format;
        this.queue = queue;
        this.canvas = canvas;

        // Create uniform buffer (4x4 matrix)
        this.uniformBuffer = this.device.createBuffer({
            size: 256, // Space for MVP matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        // Create shaders
        this.vertexShaderModule = this.createVertexShader();
        this.fragmentShaderModule = this.createFragmentShader();
    }

    /**
     * Create vertex shader (WGSL)
     */
    private createVertexShader(): GPUShaderModule {
        const code = `
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

        return this.device.createShaderModule({ code });
    }

    /**
     * Create fragment shader (WGSL)
     */
    private createFragmentShader(): GPUShaderModule {
        const code = `
            @fragment
            fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                return vec4<f32>(color, 1.0);
            }
        `;

        return this.device.createShaderModule({ code });
    }

    /**
     * Initialize renderer
     */
    async initialize(): Promise<void> {
        // Create bind group layout
        this.bindGroupLayout = this.device.createBindGroupLayout({
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
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
            ],
        });

        // Create pipeline layout
        this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });

        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: this.pipelineLayout,
            vertex: {
                module: this.vertexShaderModule,
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 24, // 3 floats (position) + 3 floats (color)
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },
                            { shaderLocation: 1, offset: 12, format: 'float32x3' },
                        ],
                    },
                ],
            },
            fragment: {
                module: this.fragmentShaderModule,
                entryPoint: 'main',
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: 'triangle-list',
                frontFace: 'ccw',
                cullMode: 'back',
            },
        });

        console.log('✅ Renderer initialized');
    }

    /**
     * Create mesh from vertices and indices
     */
    createMesh(vertices: Vertex[], indices: number[]): Mesh {
        const vertexArray = new Float32Array(vertices.length * 6);
        for (let i = 0; i < vertices.length; i++) {
            vertexArray[i * 6] = vertices[i].position[0];
            vertexArray[i * 6 + 1] = vertices[i].position[1];
            vertexArray[i * 6 + 2] = vertices[i].position[2];
            vertexArray[i * 6 + 3] = vertices[i].color[0];
            vertexArray[i * 6 + 4] = vertices[i].color[1];
            vertexArray[i * 6 + 5] = vertices[i].color[2];
        }

        const indexArray = new Uint32Array(indices);

        const vertexBuffer = this.device.createBuffer({
            size: vertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(vertexArray);
        vertexBuffer.unmap();

        const indexBuffer = this.device.createBuffer({
            size: indexArray.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Uint32Array(indexBuffer.getMappedRange()).set(indexArray);
        indexBuffer.unmap();

        return {
            vertices: vertexArray,
            indices: indexArray,
            vertexBuffer,
            indexBuffer,
            indexCount: indices.length,
        };
    }

    /**
     * Create a simple triangle
     */
    createTriangle(): Mesh {
        const vertices: Vertex[] = [
            { position: [0, 0.5, 0], color: [1, 0, 0] },
            { position: [-0.5, -0.5, 0], color: [0, 1, 0] },
            { position: [0.5, -0.5, 0], color: [0, 0, 1] },
        ];

        const indices = [0, 1, 2];

        return this.createMesh(vertices, indices);
    }

    /**
     * Create a quad (2 triangles)
     */
    createQuad(width: number = 1, height: number = 1, color: [number, number, number] = [1, 1, 1]): Mesh {
        const hw = width / 2;
        const hh = height / 2;

        const vertices: Vertex[] = [
            { position: [-hw, hh, 0], color },
            { position: [hw, hh, 0], color },
            { position: [hw, -hh, 0], color },
            { position: [-hw, -hh, 0], color },
        ];

        const indices = [0, 1, 2, 0, 2, 3];

        return this.createMesh(vertices, indices);
    }

    /**
     * Create a cube
     */
    createCube(size: number = 1, color: [number, number, number] = [1, 1, 1]): Mesh {
        const s = size / 2;

        const vertices: Vertex[] = [
            // Front face
            { position: [-s, s, s], color },
            { position: [s, s, s], color },
            { position: [s, -s, s], color },
            { position: [-s, -s, s], color },
            // Back face
            { position: [-s, s, -s], color },
            { position: [s, s, -s], color },
            { position: [s, -s, -s], color },
            { position: [-s, -s, -s], color },
        ];

        const indices = [
            // Front
            0, 1, 2, 0, 2, 3,
            // Back
            5, 4, 7, 5, 7, 6,
            // Top
            4, 5, 1, 4, 1, 0,
            // Bottom
            3, 2, 6, 3, 6, 7,
            // Right
            1, 5, 6, 1, 6, 2,
            // Left
            4, 0, 3, 4, 3, 7,
        ];

        return this.createMesh(vertices, indices);
    }

    /**
     * Add object to render queue
     */
    addObject(mesh: Mesh, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]): RenderObject {
        const obj: RenderObject = { mesh, position, rotation, scale };
        this.objects.push(obj);
        return obj;
    }

    /**
     * Render frame
     */
    async render(clearColor: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 1 }): Promise<void> {
        if (!this.renderPipeline || !this.bindGroup) {
            console.warn('Renderer not initialized');
            return;
        }

        const commandEncoder = this.device.createCommandEncoder();

        // Get canvas texture
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

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.bindGroup);

        // Render all objects
        for (const obj of this.objects) {
            renderPass.setVertexBuffer(0, obj.mesh.vertexBuffer);
            renderPass.setIndexBuffer(obj.mesh.indexBuffer, 'uint32');
            renderPass.drawIndexed(obj.mesh.indexCount);
        }

        renderPass.end();

        // Submit commands
        this.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Clear render objects
     */
    clear(): void {
        this.objects = [];
    }

    /**
     * Get render object count
     */
    getObjectCount(): number {
        return this.objects.length;
    }
}
