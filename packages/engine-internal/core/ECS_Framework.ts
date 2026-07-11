/**
 * Entity-Component-System (ECS) Framework
 * Foundation for the game engine
 */

/**
 * Component - Data container attached to entities
 */
export abstract class Component {
    enabled: boolean = true;

    abstract onInit(): void;
    abstract onDestroy(): void;
}

/**
 * Entity - Container for components
 */
export class Entity {
    id: string;
    name: string;
    components: Map<any, Component> = new Map();
    parent: Entity | null = null;
    children: Entity[] = [];
    active: boolean = true;

    constructor(name: string = "Entity") {
        this.id = `entity_${Math.random().toString(36).substring(7)}`;
        this.name = name;
    }

    /**
     * Add component to entity
     */
    addComponent<T extends Component>(ComponentClass: new () => T): T {
        if (this.components.has(ComponentClass)) {
            return this.components.get(ComponentClass)!;
        }

        const component = new ComponentClass();
        this.components.set(ComponentClass, component);
        component.onInit();
        return component;
    }

    /**
     * Get component by type
     */
    getComponent<T extends Component>(ComponentClass: new () => T): T | null {
        return (this.components.get(ComponentClass) as T) || null;
    }

    /**
     * Remove component
     */
    removeComponent<T extends Component>(ComponentClass: new () => T): void {
        const component = this.components.get(ComponentClass);
        if (component) {
            component.onDestroy();
            this.components.delete(ComponentClass);
        }
    }

    /**
     * Add child entity
     */
    addChild(child: Entity): void {
        if (child.parent) {
            child.parent.removeChild(child);
        }
        child.parent = this;
        this.children.push(child);
    }

    /**
     * Remove child entity
     */
    removeChild(child: Entity): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    /**
     * Recursively update all components
     */
    update(deltaTime: number): void {
        if (!this.active) return;

        this.components.forEach((component) => {
            if (component.enabled && "onUpdate" in component) {
                (component as any).onUpdate(deltaTime);
            }
        });

        this.children.forEach((child) => child.update(deltaTime));
    }

    /**
     * Destroy entity and all children
     */
    destroy(): void {
        this.components.forEach((component) => component.onDestroy());
        this.components.clear();

        this.children.forEach((child) => child.destroy());
        this.children.length = 0;

        if (this.parent) {
            this.parent.removeChild(this);
        }
    }
}

/**
 * System - Logic that operates on components
 */
export abstract class System {
    entities: Entity[] = [];

    abstract onInit(): void;
    abstract onUpdate(deltaTime: number): void;
    abstract onDestroy(): void;

    /**
     * Check if entity matches system requirements
     */
    abstract matchesEntity(entity: Entity): boolean;

    /**
     * Add entity to system if it matches
     */
    addEntity(entity: Entity): void {
        if (this.matchesEntity(entity) && !this.entities.includes(entity)) {
            this.entities.push(entity);
        }
    }

    /**
     * Remove entity from system
     */
    removeEntity(entity: Entity): void {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }
}

/**
 * World - Container for entities and systems
 */
export class World {
    entities: Entity[] = [];
    systems: System[] = [];
    private entityIndex: Map<string, Entity> = new Map();

    /**
     * Register a system
     */
    addSystem(system: System): void {
        this.systems.push(system);
        system.onInit();

        // Add existing entities to system
        this.entities.forEach((entity) => {
            system.addEntity(entity);
            entity.children.forEach((child) => this.addEntityToSystems(child));
        });
    }

    /**
     * Create entity in world
     */
    createEntity(name: string = "Entity"): Entity {
        const entity = new Entity(name);
        this.addEntity(entity);
        return entity;
    }

    /**
     * Add existing entity to world
     */
    addEntity(entity: Entity): void {
        if (!this.entities.includes(entity)) {
            this.entities.push(entity);
            this.entityIndex.set(entity.id, entity);

            // Add to all matching systems
            this.addEntityToSystems(entity);
        }
    }

    /**
     * Get entity by ID
     */
    getEntity(id: string): Entity | null {
        return this.entityIndex.get(id) || null;
    }

    /**
     * Remove entity from world
     */
    removeEntity(entity: Entity): void {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
            this.entityIndex.delete(entity.id);

            // Remove from systems
            this.systems.forEach((system) => system.removeEntity(entity));
        }
    }

    /**
     * Update world
     */
    update(deltaTime: number): void {
        // Update systems
        this.systems.forEach((system) => system.onUpdate(deltaTime));

        // Update entities
        this.entities.forEach((entity) => entity.update(deltaTime));
    }

    /**
     * Clear world
     */
    clear(): void {
        // Destroy all systems
        this.systems.forEach((system) => system.onDestroy());
        this.systems.length = 0;

        // Destroy all entities
        this.entities.forEach((entity) => entity.destroy());
        this.entities.length = 0;
        this.entityIndex.clear();
    }

    private addEntityToSystems(entity: Entity): void {
        this.systems.forEach((system) => system.addEntity(entity));

        // Add children
        entity.children.forEach((child) => this.addEntityToSystems(child));
    }
}

// Example: Transform Component
export class Transform extends Component {
    position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    rotation: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    scale: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 };

    onInit(): void {
        // Initialize transform
    }

    onDestroy(): void {
        // Cleanup
    }

    setPosition(x: number, y: number, z: number): void {
        this.position = { x, y, z };
    }

    setRotation(x: number, y: number, z: number): void {
        this.rotation = { x, y, z };
    }

    setScale(x: number, y: number, z: number): void {
        this.scale = { x, y, z };
    }
}

// Example: Renderable Component
export class Renderable extends Component {
    mesh: any = null; // Babylon.js mesh

    onInit(): void {
        // Initialize renderable
    }

    onDestroy(): void {
        if (this.mesh) {
            this.mesh.dispose();
        }
    }
}

// Example: Physics Component
export class RigidBody extends Component {
    mass: number = 1;
    velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    isKinematic: boolean = false;

    onInit(): void {
        // Initialize physics body
    }

    onDestroy(): void {
        // Cleanup physics
    }

    applyForce(fx: number, fy: number, fz: number): void {
        // Apply force to body
    }
}
