type Command = {
  id: string;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
};

/**
 * Command Queue — ensures sequential execution of API requests.
 * Prevents race conditions and ensures commands are processed in order.
 */
export class CommandQueue {
  private queue: Command[] = [];
  private processing = false;

  /**
   * Add a command to the queue and return a promise that resolves when it completes.
   */
  async add<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cmd: Command = {
        id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        execute: execute as () => Promise<any>,
        resolve: (value: any) => resolve(value as T),
        reject,
      };
      this.queue.push(cmd);
      this.processNext();
    });
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const cmd = this.queue.shift()!;
      try {
        const result = await cmd.execute();
        cmd.resolve(result);
      } catch (error) {
        cmd.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Get the number of pending commands.
   */
  get pending(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is currently processing.
   */
  get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear all pending commands (does not affect in-flight).
   */
  clear() {
    this.queue = [];
  }
}

/**
 * Global command queue singleton for device control.
 */
export const deviceCommandQueue = new CommandQueue();
