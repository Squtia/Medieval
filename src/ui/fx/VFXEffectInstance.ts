import * as THREE from 'three';

/**
 * 🌟 VFXEffectInstance
 * 獨立特效執行個體模型 (Per-Effect Isolated Instance)
 * 嚴格遵循 docs/VFX_ARCHITECTURE_EXECUTION_PLAN.md Phase 4 規範：
 * 每次特效播放擁有獨立的 root group 與生命週期時鐘，杜絕單一特效完成時清除其他並行特效。
 */
export interface VFXEffectInstance {
  id: string;
  root: THREE.Group;
  startTime: number;
  duration: number;
  updateAt?: (time: number) => void;
  update?: (delta: number) => boolean;
  dispose: () => void;
}

/**
 * 🛡️ VFXInstanceRegistry
 * 專門負責管理場景中所有並發實例的註冊表，包含上限保護、超額降級與隔離銷毀
 */
export class VFXInstanceRegistry {
  public static readonly MAX_ACTIVE_INSTANCES = 32;

  private instances = new Map<string, VFXEffectInstance>();

  /**
   * 註冊一個新的特效實例
   * 若超出最大上限，自動強制終止最舊的實例以防止顯存與繪圖呼叫爆炸 (降級策略)
   */
  public register(instance: VFXEffectInstance, scene?: THREE.Scene): void {
    if (this.instances.size >= VFXInstanceRegistry.MAX_ACTIVE_INSTANCES) {
      const oldestId = this.instances.keys().next().value;
      if (oldestId) {
        console.warn(`[VFXInstanceRegistry] Exceeded max instances (${VFXInstanceRegistry.MAX_ACTIVE_INSTANCES}), dropping oldest: ${oldestId}`);
        this.unregister(oldestId, scene);
      }
    }

    this.instances.set(instance.id, instance);
    if (scene && !scene.children.includes(instance.root)) {
      scene.add(instance.root);
    }
  }

  /**
   * 註銷並安全清理單一實例 (完全不影響其他實例)
   */
  public unregister(id: string, scene?: THREE.Scene): void {
    const inst = this.instances.get(id);
    if (!inst) return;

    this.instances.delete(id);

    try {
      if (scene && inst.root) {
        scene.remove(inst.root);
      }
      inst.dispose();
    } catch (e) {
      console.warn(`[VFXInstanceRegistry] Error disposing instance ${id}:`, e);
    }
  }

  public get(id: string): VFXEffectInstance | undefined {
    return this.instances.get(id);
  }

  public has(id: string): boolean {
    return this.instances.has(id);
  }

  public getActiveCount(): number {
    return this.instances.size;
  }

  public getAll(): VFXEffectInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 更新所有實例 (依 delta)
   */
  public updateAll(delta: number, scene?: THREE.Scene): void {
    const toRemove: string[] = [];
    this.instances.forEach((inst, id) => {
      if (inst.update) {
        const isDone = inst.update(delta);
        if (isDone) {
          toRemove.push(id);
        }
      }
    });

    for (const id of toRemove) {
      this.unregister(id, scene);
    }
  }

  /**
   * 清除並銷毀全部實例 (僅在強制重置時使用)
   */
  public clearAll(scene?: THREE.Scene): void {
    const all = Array.from(this.instances.values());
    this.instances.clear();

    for (const inst of all) {
      try {
        if (scene && inst.root) {
          scene.remove(inst.root);
        }
        inst.dispose();
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * 取得偵錯資訊
   */
  public getDebugInfo(): { activeCount: number; instanceIds: string[] } {
    return {
      activeCount: this.instances.size,
      instanceIds: Array.from(this.instances.keys())
    };
  }
}
