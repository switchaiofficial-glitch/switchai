/**
 * Server Health Monitor Service (Web Version)
 * 
 * Zero-latency intelligent server health detection with automatic fallback.
 * Uses cached health status with background refresh.
 */

// Interval constants
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds when healthy
const HEALTH_CHECK_INTERVAL_DOWN = 10000; // 10 seconds when down (faster recovery detection)
const HEALTH_CHECK_TIMEOUT = 15000; // 15 second timeout
const CONSECUTIVE_FAILURES_THRESHOLD = 2; // Require 2 consecutive failures before marking down
const CACHE_KEY_PREFIX = 'serverHealth:';

export enum ServerType {
    AI_SERVER = 'ai_server',
    OCR_SERVER = 'ocr_server',
}

export interface ServerHealth {
    isHealthy: boolean;
    lastChecked: number;
    lastHealthyAt: number;
    consecutiveFailures: number;
    error?: string;
}

interface ServerConfig {
    url: string;
    healthPath: string;
}

const SERVER_CONFIGS: Record<ServerType, ServerConfig> = {
    [ServerType.AI_SERVER]: {
        url: 'https://ai.collegebuzz.in',
        healthPath: '/health',
    },
    [ServerType.OCR_SERVER]: {
        url: 'https://ocr.collegebuzz.in',
        healthPath: '/health',
    },
};

class ServerHealthMonitor {
    private healthCache: Map<ServerType, ServerHealth> = new Map();
    private checkIntervals: Map<ServerType, any> = new Map();
    private listeners: Set<(serverType: ServerType, health: ServerHealth) => void> = new Set();
    private initialized = false;

    /**
     * Initialize the health monitor - loads cached state and starts background checks
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Load cached health status from localStorage
        this.loadCachedHealth();

        // Start background health checks for all servers
        for (const serverType of Object.values(ServerType)) {
            this.startHealthCheck(serverType);
        }

        this.initialized = true;
    }

    /**
     * Get current health status (zero latency - returns cached value)
     */
    getHealth(serverType: ServerType): ServerHealth {
        const cached = this.healthCache.get(serverType);
        if (cached) return cached;

        // Default to healthy until proven otherwise (optimistic)
        return {
            isHealthy: true,
            lastChecked: 0,
            lastHealthyAt: Date.now(),
            consecutiveFailures: 0,
        };
    }

    /**
     * Check if a server is currently healthy (zero latency)
     */
    isHealthy(serverType: ServerType): boolean {
        return this.getHealth(serverType).isHealthy;
    }

    /**
     * Get all server health statuses
     */
    getAllHealth(): Record<ServerType, ServerHealth> {
        const result: Record<ServerType, ServerHealth> = {} as any;
        for (const serverType of Object.values(ServerType)) {
            result[serverType] = this.getHealth(serverType);
        }
        return result;
    }

    /**
     * Force an immediate health check (async, doesn't block)
     */
    async forceCheck(serverType: ServerType): Promise<ServerHealth> {
        return this.performHealthCheck(serverType);
    }

    /**
     * Subscribe to health change events
     */
    subscribe(listener: (serverType: ServerType, health: ServerHealth) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Stop all health checks (cleanup)
     */
    cleanup(): void {
        for (const interval of this.checkIntervals.values()) {
            clearInterval(interval);
        }
        this.checkIntervals.clear();
        this.listeners.clear();
        this.initialized = false;
    }

    // ===== Private Methods =====

    private loadCachedHealth(): void {
        if (typeof localStorage === 'undefined') return;

        for (const serverType of Object.values(ServerType)) {
            try {
                const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${serverType}`);
                if (cached) {
                    const health: ServerHealth = JSON.parse(cached);
                    this.healthCache.set(serverType, health);
                }
            } catch (error) {
                console.warn(`[ServerHealth] Failed to load cached health for ${serverType}:`, error);
            }
        }
    }

    private saveCachedHealth(serverType: ServerType, health: ServerHealth): void {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem(`${CACHE_KEY_PREFIX}${serverType}`, JSON.stringify(health));
        } catch (error) {
            console.warn(`[ServerHealth] Failed to save cached health for ${serverType}:`, error);
        }
    }

    private startHealthCheck(serverType: ServerType): void {
        // Clear existing interval if any
        const existing = this.checkIntervals.get(serverType);
        if (existing) clearInterval(existing);

        // Perform immediate check
        this.performHealthCheck(serverType);

        // Schedule periodic checks
        const interval = setInterval(() => {
            this.performHealthCheck(serverType);
        }, this.getCheckInterval(serverType));

        this.checkIntervals.set(serverType, interval);
    }

    private getCheckInterval(serverType: ServerType): number {
        const health = this.getHealth(serverType);
        // Check more frequently when server is down to detect recovery faster
        return health.isHealthy ? HEALTH_CHECK_INTERVAL : HEALTH_CHECK_INTERVAL_DOWN;
    }

    private async performHealthCheck(serverType: ServerType): Promise<ServerHealth> {
        const config = SERVER_CONFIGS[serverType];
        const previousHealth = this.getHealth(serverType);
        const now = Date.now();

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

            const url = `${config.url}${config.healthPath}`;
            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeout);

            const isHealthy = response.ok;
            const newHealth: ServerHealth = {
                isHealthy,
                lastChecked: now,
                lastHealthyAt: isHealthy ? now : previousHealth.lastHealthyAt,
                consecutiveFailures: isHealthy ? 0 : previousHealth.consecutiveFailures + 1,
                error: isHealthy ? undefined : `HTTP ${response.status}`,
            };

            this.updateHealth(serverType, newHealth, previousHealth);
            return newHealth;

        } catch (error) {
            const newConsecutiveFailures = previousHealth.consecutiveFailures + 1;

            // Only mark as unhealthy after consecutive failures threshold
            const shouldMarkUnhealthy = newConsecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD;

            const newHealth: ServerHealth = {
                isHealthy: shouldMarkUnhealthy ? false : previousHealth.isHealthy,
                lastChecked: now,
                lastHealthyAt: previousHealth.lastHealthyAt,
                consecutiveFailures: newConsecutiveFailures,
                error: error instanceof Error ? error.message : 'Network error',
            };

            // Log transient failures without marking down
            if (!shouldMarkUnhealthy && newConsecutiveFailures > 0) {
                console.warn(`⚠️ [ServerHealth] ${serverType} check failed (${newConsecutiveFailures}/${CONSECUTIVE_FAILURES_THRESHOLD}): ${newHealth.error}`);
            }

            this.updateHealth(serverType, newHealth, previousHealth);
            return newHealth;
        }
    }

    private updateHealth(
        serverType: ServerType,
        newHealth: ServerHealth,
        previousHealth: ServerHealth
    ): void {
        // Update cache
        this.healthCache.set(serverType, newHealth);

        // Save to storage
        this.saveCachedHealth(serverType, newHealth);

        // Log status changes
        if (previousHealth.isHealthy !== newHealth.isHealthy) {
            if (newHealth.isHealthy) {
                console.log(`✅ [ServerHealth] ${serverType} recovered (was down for ${newHealth.consecutiveFailures} checks)`);
            } else {
                console.warn(`❌ [ServerHealth] ${serverType} is down: ${newHealth.error}`);
            }

            // Notify listeners
            this.notifyListeners(serverType, newHealth);

            // Restart interval with new frequency
            this.startHealthCheck(serverType);
        }
    }

    private notifyListeners(serverType: ServerType, health: ServerHealth): void {
        for (const listener of this.listeners) {
            try {
                listener(serverType, health);
            } catch (error) {
                console.error('[ServerHealth] Listener error:', error);
            }
        }
    }
}

// Singleton instance
const serverHealthMonitor = new ServerHealthMonitor();

// Auto-initialize on import (non-blocking)
if (typeof window !== 'undefined') {
    serverHealthMonitor.initialize().catch(err => {
        console.warn('[ServerHealth] Failed to initialize:', err);
    });
}

export default serverHealthMonitor;

// Convenience exports
export const isAIServerHealthy = () => serverHealthMonitor.isHealthy(ServerType.AI_SERVER);
export const isOCRServerHealthy = () => serverHealthMonitor.isHealthy(ServerType.OCR_SERVER);
export const getServerHealth = (type: ServerType) => serverHealthMonitor.getHealth(type);
export const forceHealthCheck = (type: ServerType) => serverHealthMonitor.forceCheck(type);
export const subscribeToHealthChanges = (listener: (serverType: ServerType, health: ServerHealth) => void) =>
    serverHealthMonitor.subscribe(listener);
