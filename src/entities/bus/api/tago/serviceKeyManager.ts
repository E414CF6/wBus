const KEY_COOLDOWN_MS = 20 * 1000;

interface KeyState {
    key: string;
    cooldownUntil: number;
}

class ServiceKeyManager {
    private keys: KeyState[] = [];
    private currentIndex = 0;

    constructor() {
        this.reloadKeys();
    }

    getKey(): { key: string; index: number } {
        if (this.keys.length === 0) {
            this.reloadKeys();
        }

        if (this.keys.length === 0) {
            throw new Error("[PublicAPI] DATA_GO_KR_SERVICE_KEY / DATA_GO_KR_SERVICE_KEYS is not set.");
        }

        const now = Date.now();
        for (let i = 0; i < this.keys.length; i++) {
            const idx = (this.currentIndex + i) % this.keys.length;
            const entry = this.keys[idx];
            if (now >= entry.cooldownUntil) {
                this.currentIndex = (idx + 1) % this.keys.length;
                return {key: entry.key, index: idx};
            }
        }

        let earliestIdx = 0;
        let minTime = Infinity;
        this.keys.forEach((entry, idx) => {
            if (entry.cooldownUntil < minTime) {
                minTime = entry.cooldownUntil;
                earliestIdx = idx;
            }
        });

        return {key: this.keys[earliestIdx].key, index: earliestIdx};
    }

    markCooldown(keyIndex: number) {
        if (this.keys[keyIndex]) {
            this.keys[keyIndex].cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
            console.warn(
                `[PublicAPI KeyManager] Service key #${keyIndex + 1} rate-limited or quota exceeded. Cooldown until ${new Date(this.keys[keyIndex].cooldownUntil).toISOString()}`
            );
        }
    }

    getMetrics() {
        const now = Date.now();
        return {
            totalKeys: this.keys.length,
            activeKeys: this.keys.filter((k) => now >= k.cooldownUntil).length,
            cooldownKeys: this.keys.filter((k) => now < k.cooldownUntil).length,
        };
    }

    private reloadKeys() {
        const rawKeys = process.env.DATA_GO_KR_SERVICE_KEYS || process.env.DATA_GO_KR_SERVICE_KEY || "";
        const parsed = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
        this.keys = parsed.map((key) => {
            let normalizedKey = key;
            try {
                normalizedKey = decodeURIComponent(key);
            } catch {
                // Keep raw key if decoding fails
            }
            return {key: normalizedKey, cooldownUntil: 0};
        });
    }
}

export const keyManager = new ServiceKeyManager();
