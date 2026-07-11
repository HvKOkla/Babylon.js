/**
 * Input Manager - Handle keyboard, mouse, and gamepad input
 */

export interface KeyState {
    pressed: boolean;
    justPressed: boolean;
    justReleased: boolean;
}

export interface MouseState {
    x: number;
    y: number;
    dx: number;
    dy: number;
    leftPressed: boolean;
    rightPressed: boolean;
    wheelDelta: number;
}

export interface GamepadState {
    connected: boolean;
    leftStick: { x: number; y: number };
    rightStick: { x: number; y: number };
    buttons: boolean[];
    triggers: { left: number; right: number };
}

export class InputManager {
    private keys: Map<string, KeyState> = new Map();
    private mouse: MouseState = {
        x: 0,
        y: 0,
        dx: 0,
        dy: 0,
        leftPressed: false,
        rightPressed: false,
        wheelDelta: 0,
    };
    private gamepads: GamepadState[] = [];
    private canvas: HTMLCanvasElement | null = null;

    constructor(canvas?: HTMLCanvasElement) {
        this.canvas = canvas || null;
    }

    initialize(canvas?: HTMLCanvasElement): void {
        this.canvas = canvas || this.canvas;
        if (!this.canvas) {
            this.canvas = document.querySelector('canvas') as HTMLCanvasElement;
        }

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Mouse events
        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        }

        // Gamepad events
        window.addEventListener('gamepadconnected', (e) => this.handleGamepadConnected(e));
        window.addEventListener('gamepaddisconnected', (e) => this.handleGamepadDisconnected(e));
    }

    private handleKeyDown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();
        const existing = this.keys.get(key);
        
        if (!existing || !existing.pressed) {
            this.keys.set(key, {
                pressed: true,
                justPressed: true,
                justReleased: false,
            });
        }
    }

    private handleKeyUp(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();
        this.keys.set(key, {
            pressed: false,
            justPressed: false,
            justReleased: true,
        });
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;

        this.mouse.dx = newX - this.mouse.x;
        this.mouse.dy = newY - this.mouse.y;
        this.mouse.x = newX;
        this.mouse.y = newY;
    }

    private handleMouseDown(e: MouseEvent): void {
        if (e.button === 0) this.mouse.leftPressed = true;
        if (e.button === 2) this.mouse.rightPressed = true;
    }

    private handleMouseUp(e: MouseEvent): void {
        if (e.button === 0) this.mouse.leftPressed = false;
        if (e.button === 2) this.mouse.rightPressed = false;
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        this.mouse.wheelDelta = e.deltaY > 0 ? -1 : 1;
    }

    private handleGamepadConnected(e: GamepadEvent): void {
        console.log(`Gamepad connected: ${e.gamepad.id}`);
        this.gamepads[e.gamepad.index] = {
            connected: true,
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            buttons: Array(e.gamepad.buttons.length).fill(false),
            triggers: { left: 0, right: 0 },
        };
    }

    private handleGamepadDisconnected(e: GamepadEvent): void {
        console.log(`Gamepad disconnected: ${e.gamepad.id}`);
        if (this.gamepads[e.gamepad.index]) {
            this.gamepads[e.gamepad.index].connected = false;
        }
    }

    /**
     * Update input state (call once per frame)
     */
    update(): void {
        // Clear "just" states
        for (const keyState of this.keys.values()) {
            keyState.justPressed = false;
            keyState.justReleased = false;
        }

        this.mouse.wheelDelta = 0;

        // Update gamepads
        const gamepads = navigator.getGamepads?.();
        if (gamepads) {
            for (let i = 0; i < gamepads.length; i++) {
                const gp = gamepads[i];
                if (!gp) continue;

                if (!this.gamepads[i]) {
                    this.gamepads[i] = {
                        connected: true,
                        leftStick: { x: 0, y: 0 },
                        rightStick: { x: 0, y: 0 },
                        buttons: Array(gp.buttons.length).fill(false),
                        triggers: { left: 0, right: 0 },
                    };
                }

                const state = this.gamepads[i];
                state.connected = gp.connected;

                // Analog sticks
                state.leftStick = {
                    x: gp.axes[0] || 0,
                    y: gp.axes[1] || 0,
                };
                state.rightStick = {
                    x: gp.axes[2] || 0,
                    y: gp.axes[3] || 0,
                };

                // Buttons
                for (let j = 0; j < gp.buttons.length; j++) {
                    state.buttons[j] = gp.buttons[j].pressed;
                }

                // Triggers (LT = 6, RT = 7)
                state.triggers.left = gp.buttons[6]?.value || 0;
                state.triggers.right = gp.buttons[7]?.value || 0;
            }
        }
    }

    // Key queries
    isKeyPressed(key: string): boolean {
        const state = this.keys.get(key.toLowerCase());
        return state?.pressed || false;
    }

    isKeyJustPressed(key: string): boolean {
        const state = this.keys.get(key.toLowerCase());
        return state?.justPressed || false;
    }

    isKeyJustReleased(key: string): boolean {
        const state = this.keys.get(key.toLowerCase());
        return state?.justReleased || false;
    }

    // Mouse queries
    getMousePosition(): { x: number; y: number } {
        return { x: this.mouse.x, y: this.mouse.y };
    }

    getMouseDelta(): { x: number; y: number } {
        return { x: this.mouse.dx, y: this.mouse.dy };
    }

    isMouseButtonPressed(button: 'left' | 'right'): boolean {
        return button === 'left' ? this.mouse.leftPressed : this.mouse.rightPressed;
    }

    getMouseWheelDelta(): number {
        return this.mouse.wheelDelta;
    }

    // Gamepad queries
    getGamepadState(index: number = 0): GamepadState | null {
        return this.gamepads[index] || null;
    }

    isGamepadConnected(index: number = 0): boolean {
        return this.gamepads[index]?.connected || false;
    }

    getAllKeys(): Map<string, KeyState> {
        return new Map(this.keys);
    }
}
