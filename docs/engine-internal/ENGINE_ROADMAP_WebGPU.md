# 🎮 BABYLON.JS CUSTOM ENGINE - ROADMAP WebGPU FIRST

## Contexte
- **Type:** Moteur de jeu 3D pour web (navigateur) - **WebGPU-native**
- **Équipe:** 1-5 devs (indie/startup)
- **Priorité:** Performance GPU + Productivité
- **Rendering:** WebGPU (future-proof) + WebGL2 fallback

---

## 🔥 PHASE 1: WebGPU FOUNDATION (Semaine 1-4)

### 1.1 WebGPU Rendering Engine
**Impact:** 3-5x perf vs WebGL2, compute shaders, better memory

```typescript
// WebGPU-native rendering engine
class WebGPUEngine {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private queue: GPUQueue;
  
  async init(canvas: HTMLCanvasElement) {
    const adapter = await navigator.gpu?.requestAdapter();
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu');
    this.queue = this.device.queue;
    
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });
  }
  
  // Render pass with WebGPU
  renderFrame(scene: Scene) {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store',
      }],
    });
    
    // Render entities
    scene.entities.forEach(entity => {
      this.renderEntity(renderPass, entity);
    });
    
    renderPass.end();
    this.queue.submit([commandEncoder.finish()]);
  }
}
```

**Features:**
- ✅ Native WebGPU renderer
- ✅ Compute shaders (physics, particles, culling)
- ✅ Direct GPU memory management
- ✅ Multi-threading via WebWorkers

**Effort:** 50-70h | **Priority:** 🔴 URGENT

---

### 1.2 WGSL Shader System
**Impact:** Modern shaders, compute capabilities, better performance

```typescript
// WebGPU Shading Language (WGSL) shader system
class ShaderCompiler {
  // PBR Shader in WGSL
  static readonly PBR_SHADER = `
    struct VertexInput {
      @location(0) position: vec3<f32>,
      @location(1) normal: vec3<f32>,
      @location(2) uv: vec2<f32>,
    }
    
    struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) normal: vec3<f32>,
      @location(1) uv: vec2<f32>,
      @location(2) worldPos: vec3<f32>,
    }
    
    @vertex
    fn vertex_main(input: VertexInput) -> VertexOutput {
      var output: VertexOutput;
      output.position = vec4<f32>(input.position, 1.0);
      output.normal = input.normal;
      output.uv = input.uv;
      output.worldPos = input.position;
      return output;
    }
    
    @fragment
    fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
      let albedo = vec3<f32>(0.8, 0.8, 0.8);
      let normal = normalize(input.normal);
      let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
      let diffuse = max(dot(normal, lightDir), 0.0);
      return vec4<f32>(albedo * diffuse, 1.0);
    }
  `;
  
  // Compute shader for GPU culling
  static readonly COMPUTE_CULLING = `
    @compute @workgroup_size(256)
    fn culling_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let idx = global_id.x;
      // Frustum culling on GPU
      let mesh = meshes[idx];
      let visible = isInFrustum(mesh, camera.frustum);
      visibilityBuffer[idx] = select(0u, 1u, visible);
    }
  `;
}
```

**Features:**
- ✅ WGSL compiler + validation
- ✅ PBR rendering
- ✅ Compute shaders (physics, culling, particles)
- ✅ Shader hot-reload
- ✅ Dynamic shader generation

**Effort:** 40-60h | **Priority:** 🔴 URGENT

---

### 1.3 ECS Architecture (WebGPU-optimized)
**Impact:** Data-oriented design for GPU streaming

```typescript
// GPU-aware ECS with buffer management
class GPUEntity {
  meshComponent: GPUMesh;
  transformBuffer: GPUBuffer;
  materialBuffer: GPUBuffer;
  
  updateGPU(device: GPUDevice) {
    const transform = this.getComponent(Transform);
    const data = new Float32Array([
      ...transform.position,
      ...transform.rotation,
      ...transform.scale,
    ]);
    
    device.queue.writeBuffer(
      this.transformBuffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );
  }
}

// GPU buffer pool for optimization
class GPUBufferPool {
  private pools: Map<number, GPUBuffer[]> = new Map();
  
  acquire(device: GPUDevice, size: number, usage: GPUBufferUsageFlags): GPUBuffer {
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }
    
    let buffer = this.pools.get(size)?.pop();
    if (!buffer) {
      buffer = device.createBuffer({
        size,
        usage,
        mappedAtCreation: false,
      });
    }
    return buffer;
  }
  
  release(size: number, buffer: GPUBuffer) {
    this.pools.get(size)?.push(buffer);
  }
}
```

**Features:**
- ✅ GPU buffer management
- ✅ Efficient data streaming to GPU
- ✅ Buffer pooling
- ✅ Instancing support

**Effort:** 30-50h | **Priority:** 🔴 URGENT

---

### 1.4 Physics Engine (GPU-accelerated)
**Impact:** 5-10x faster physics with compute shaders

```typescript
// GPU Physics using Compute Shaders
class GPUPhysicsEngine {
  private computePipeline: GPUComputePipeline;
  private bodiesBuffer: GPUBuffer;
  private velocitiesBuffer: GPUBuffer;
  
  async init(device: GPUDevice, maxBodies: number) {
    // GPU Physics kernel in WGSL
    const computeShader = `
      @compute @workgroup_size(256)
      fn physics_step(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        let body = bodies[idx];
        
        // GPU-accelerated physics
        var velocity = velocities[idx];
        var acceleration = vec3<f32>(0.0, -9.81, 0.0); // Gravity
        
        velocity += acceleration * params.deltaTime;
        bodies[idx].position += velocity * params.deltaTime;
        
        velocities[idx] = velocity;
      }
    `;
    
    const shaderModule = device.createShaderModule({ code: computeShader });
    this.computePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'physics_step' },
    });
  }
  
  step(device: GPUDevice, deltaTime: number, numBodies: number) {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    
    passEncoder.setPipeline(this.computePipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numBodies / 256), 1, 1);
    passEncoder.end();
    
    device.queue.submit([commandEncoder.finish()]);
  }
}
```

**Features:**
- ✅ Compute shader physics
- ✅ 1000+ bodies at 60fps
- ✅ GPU collision detection
- ✅ GPU constraints solving

**Effort:** 40-60h | **Priority:** 🔴 URGENT

---

## 🎨 PHASE 2: GRAPHICS FEATURES (Semaine 5-8)

### 2.1 Advanced Lighting (WebGPU)
**Impact:** Deferred rendering, shadows, GI

```typescript
// Deferred Rendering with WebGPU
class DeferredRenderer {
  // G-Buffer (Geometry Buffer)
  private gBuffers: {
    position: GPUTexture,      // RGB: position, A: depth
    normal: GPUTexture,        // RGB: normal, A: roughness
    albedo: GPUTexture,        // RGB: color, A: metallic
    emission: GPUTexture,      // RGB: emissive, A: AO
  };
  
  // Render to G-Buffer
  renderGBuffer(device: GPUDevice, scene: Scene) {
    // 1. Geometry pass -> G-Buffers
    // 2. Lighting pass -> Light compute shader
    // 3. Composition -> Final image
  }
  
  // GPU Shadow Mapping with PCF
  renderShadows(device: GPUDevice) {
    // Shadow depth texture
    // PCF sampling in shader
    // Cascaded shadow maps for outdoor scenes
  }
}

// Screen-Space Ambient Occlusion (SSAO) - GPU only
class SSAO {
  private compute: GPUComputePipeline;
  
  compute(device: GPUDevice, depthTexture: GPUTexture): GPUTexture {
    const aoTexture = device.createTexture({
      size: [1920, 1080],
      format: 'r8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    // GPU SSAO computation
    // Results in 1-2ms on modern GPU
    return aoTexture;
  }
}
```

**Features:**
- ✅ Deferred rendering (100+ lights)
- ✅ Real-time shadows (PCF + CSM)
- ✅ SSAO (Screen-Space Ambient Occlusion)
- ✅ GPU light culling
- ✅ HDR + Tone mapping

**Effort:** 50-70h | **Priority:** 🟠 HAUTE

---

### 2.2 Particle System (GPU-driven)
**Impact:** 1M+ particles at 60fps

```typescript
// GPU Particle System
class GPUParticleSystem {
  private particleBuffer: GPUBuffer;
  private velocityBuffer: GPUBuffer;
  private computePipeline: GPUComputePipeline;
  private renderPipeline: GPURenderPipeline;
  
  async init(device: GPUDevice, maxParticles: number) {
    const computeShader = `
      struct Particle {
        position: vec3<f32>,
        lifetime: f32,
        velocity: vec3<f32>,
        size: f32,
      }
      
      @compute @workgroup_size(256)
      fn particle_update(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        var particle = particles[idx];
        
        if (particle.lifetime <= 0.0) {
          return; // Dead particle
        }
        
        // Update position
        particle.position += particle.velocity * params.deltaTime;
        particle.lifetime -= params.deltaTime;
        
        // Apply forces (gravity, wind, etc)
        particle.velocity += vec3<f32>(0.0, -9.81, 0.0) * params.deltaTime;
        
        particles[idx] = particle;
      }
    `;
    
    // Create compute pipeline
    this.computePipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: computeShader }) },
    });
  }
  
  update(device: GPUDevice, deltaTime: number, aliveCount: number) {
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    
    passEncoder.setPipeline(this.computePipeline);
    passEncoder.dispatchWorkgroups(Math.ceil(aliveCount / 256), 1, 1);
    passEncoder.end();
    
    device.queue.submit([commandEncoder.finish()]);
  }
  
  // Render particles with instancing
  render(renderPass: GPURenderPassEncoder) {
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(4, this.aliveCount); // Quad instancing
  }
}
```

**Features:**
- ✅ 1M+ particles at 60fps
- ✅ GPU-driven simulation
- ✅ Collision detection
- ✅ Complex forces (vortex, wind, turbulence)
- ✅ LOD for distant particles

**Effort:** 35-50h | **Priority:** 🟠 HAUTE

---

### 2.3 Real-time Path Tracing (Optional, for future)
**Impact:** Photorealistic rendering with compute shaders

```typescript
// Real-time Path Tracing (WebGPU compute)
class PathTracer {
  private computePipeline: GPUComputePipeline;
  private outputTexture: GPUTexture;
  
  // Compute shader: Ray tracing kernel
  private rayTracingShader = `
    @compute @workgroup_size(8, 8)
    fn ray_trace(@builtin(global_invocation_id) pixel: vec3<u32>) {
      let uv = vec2<f32>(pixel.xy) / vec2<f32>(textureDimensions(outputTexture));
      let ray = generateRay(camera, uv);
      
      var color = vec3<f32>(0.0);
      var throughput = vec3<f32>(1.0);
      
      for (var bounce = 0; bounce < MAX_BOUNCES; bounce++) {
        let hit = traceRay(ray, scene);
        if (!hit.valid) {
          color += throughput * sampleSkybox(ray.direction);
          break;
        }
        
        // Direct lighting
        color += throughput * sampleLighting(hit);
        
        // Bounce ray
        ray = generateBounceRay(hit);
        throughput *= hit.albedo;
      }
      
      textureStore(outputTexture, pixel.xy, vec4<f32>(color, 1.0));
    }
  `;
}
```

**Features:**
- ✅ Real-time ray tracing
- ✅ Global illumination
- ✅ Photorealistic materials
- ✅ Denoise post-processing

**Effort:** 60-80h | **Priority:** 🟡 MOYENNE (future)

---

## 🎮 PHASE 3: GAMEPLAY SYSTEMS (Semaine 9-12)

### 3.1 Input System (Multi-device)
**Impact:** Responsive input handling

```typescript
// Multi-device input manager
class InputManager {
  private keyboard: Map<string, boolean> = new Map();
  private mouse = { x: 0, y: 0, buttons: 0 };
  private gamepad: Gamepad | null = null;
  private touch: { id: number; x: number; y: number }[] = [];
  
  init() {
    // Keyboard
    window.addEventListener('keydown', (e) => this.keyboard.set(e.code, true));
    window.addEventListener('keyup', (e) => this.keyboard.set(e.code, false));
    
    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => this.mouse.buttons |= (1 << e.button));
    window.addEventListener('mouseup', (e) => this.mouse.buttons &= ~(1 << e.button));
    
    // Touch
    window.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    window.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    
    // Gamepad
    window.addEventListener('gamepadconnected', (e) => this.gamepad = e.gamepad);
  }
  
  isKeyPressed(code: string): boolean {
    return this.keyboard.get(code) ?? false;
  }
  
  getMouseDelta(): { x: number; y: number } {
    return { x: this.mouse.x - this.prevMouse.x, y: this.mouse.y - this.prevMouse.y };
  }
  
  getGamepadInput(): GamepadInput {
    return {
      leftStick: { x: this.gamepad.axes[0], y: this.gamepad.axes[1] },
      rightStick: { x: this.gamepad.axes[2], y: this.gamepad.axes[3] },
      buttons: this.gamepad.buttons.map(b => b.pressed),
    };
  }
}
```

**Effort:** 20-30h | **Priority:** 🟠 HAUTE

---

### 3.2 Audio System (3D Spatial)
**Impact:** Immersive audio

```typescript
// 3D Spatial Audio System
class AudioSystem {
  private audioContext: AudioContext;
  private listener: PannerNode;
  private sounds: Map<string, AudioSource> = new Map();
  
  async init() {
    this.audioContext = new AudioContext();
    this.listener = this.audioContext.createPanner();
    this.listener.connect(this.audioContext.destination);
  }
  
  play3D(soundId: string, position: Vector3, volume: number = 1.0, loop: boolean = false) {
    const source = this.audioContext.createPanner();
    source.setPosition(position.x, position.y, position.z);
    source.setRefDistance(20);
    source.setRolloffFactor(2);
    source.connect(this.listener);
    
    // Play audio
    const audio = this.sounds.get(soundId);
    if (audio) {
      const gain = this.audioContext.createGain();
      gain.gain.value = volume;
      gain.connect(source);
      audio.connect(gain);
    }
  }
  
  updateListenerPosition(position: Vector3) {
    this.listener.setPosition(position.x, position.y, position.z);
  }
}
```

**Effort:** 15-25h | **Priority:** 🟠 HAUTE

---

### 3.3 Save/Load + Cloud Sync
**Impact:** Progression persistante

```typescript
// Cloud-aware save system
class SaveSystem {
  async save(sceneName: string, data: GameState) {
    // Local save
    const serialized = this.serialize(data);
    localStorage.setItem(sceneName, JSON.stringify(serialized));
    
    // Cloud save (if authenticated)
    if (this.isAuthenticated()) {
      await this.syncToCloud(sceneName, serialized);
    }
  }
  
  async syncToCloud(sceneName: string, data: any) {
    await fetch('/api/saves', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: JSON.stringify({ scene: sceneName, data }),
    });
  }
}
```

**Effort:** 20-30h | **Priority:** 🟠 HAUTE

---

## 📊 COMPARISON: WebGPU vs WebGL2

| Feature | WebGL2 | WebGPU |
|---------|--------|--------|
| **Physics** | ~100 bodies | ~5000 bodies (GPU) |
| **Particles** | ~100k | ~1M+ |
| **Lighting** | Forward (10-20 lights) | Deferred (100+ lights) |
| **Shadows** | Basic | PCF + Cascaded |
| **Shaders** | GLSL (verbose) | WGSL (concise) |
| **Compute** | ❌ No | ✅ Yes (game-changer) |
| **Memory** | Copies | Direct streaming |
| **Validation** | Runtime errors | Compile-time checks |
| **Future** | Legacy | Standard (2026+) |

---

## 🎯 ROADMAP - WebGPU FIRST

### Semaine 1-4: WebGPU Engine Foundation
- ✅ WebGPU rendering engine (canvas context, device init)
- ✅ WGSL shader compiler + validator
- ✅ GPU buffer management + pooling
- ✅ GPU physics (compute shaders)
- **Result:** Playable demo (Pong with physics)

### Semaine 5-8: Graphics Features
- ✅ Deferred lighting + shadows
- ✅ GPU particle system
- ✅ Input system (multi-device)
- ✅ Audio system (3D spatial)
- **Result:** Polished visual game

### Semaine 9-12: Optimization & Tools
- ✅ Performance profiler (GPU metrics)
- ✅ Scene editor (WebGPU viewport)
- ✅ Shader hot-reload
- ✅ Save/load + cloud sync
- **Result:** Production tools

### Semaine 13-16: Advanced Features
- ✅ AI system + navigation
- ✅ Procedural generation
- ✅ Multiplayer networking
- ✅ Optional: Path tracing
- **Result:** Full-featured engine

---

## 📈 PERFORMANCE TARGETS

| Metric | WebGL2 | WebGPU | Gain |
|--------|--------|--------|------|
| **Frame Time** | 16.6ms (60fps) | 4-8ms (120+fps) | 2-4x |
| **Physics Bodies** | ~200 | ~5000+ | 25x |
| **Particles** | ~100k | ~1M+ | 10x |
| **Lights** | ~20 | ~100+ | 5x |
| **Shadows** | 1 | 4 (CSM) | 4x |
| **Shader Compile** | 100-200ms | 10-20ms | 5-10x |

---

## ✅ Implementation Notes

### WebGPU Fallback
```typescript
class Engine {
  async init(canvas: HTMLCanvasElement) {
    if (navigator.gpu) {
      this.renderer = new WebGPURenderer();
    } else {
      this.renderer = new WebGL2Renderer(); // Fallback
    }
  }
}
```

### Browser Support
- ✅ Chrome 113+ (2023)
- ✅ Edge 113+ (2023)
- ⏳ Firefox (2024)
- ⏳ Safari (2024)
- 💚 **Fallback to WebGL2** for older browsers

### DevTools
- Chrome DevTools: GPU timeline + shader debugging
- Performance API: Accurate metrics
- Khronos Group WebGPU debugging tools

---

## 🚀 Quick Start - Week 1

```bash
# Setup
git clone https://github.com/HvKOkla/Babylon.js my-engine
cd my-engine && npm install

# Add WebGPU
npm install @webgpu/types

# Create WebGPU engine
cat > src/core/webgpu-engine.ts << 'EOF'
class WebGPUEngine {
  async init(canvas: HTMLCanvasElement) {
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu');
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });
  }
}
EOF

# Test WebGPU is working
npm run dev
```

---

## 💚 Benefits of WebGPU-First Architecture

1. **Performance:** 2-10x faster than WebGL2
2. **Compute:** Unlock GPU compute for physics/culling/particles
3. **Modern:** Built for 2026+ (no legacy baggage)
4. **Validation:** Compile-time shader checks
5. **Memory:** Direct GPU buffer control
6. **Future-proof:** Standard API (not vendor-specific)

**→ Better games, faster development, future-ready!**
