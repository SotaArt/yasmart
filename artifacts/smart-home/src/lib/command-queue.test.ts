import { describe, it, expect } from "vitest";
import { CommandQueue } from "./command-queue";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("CommandQueue", () => {
  it("выполняет команды строго последовательно", async () => {
    const q = new CommandQueue();
    const order: string[] = [];

    const p1 = q.add(async () => {
      order.push("a-start");
      await delay(20);
      order.push("a-end");
      return 1;
    });
    const p2 = q.add(async () => {
      order.push("b-start");
      order.push("b-end");
      return 2;
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  it("ошибка одной команды не ломает очередь", async () => {
    const q = new CommandQueue();
    const bad = q.add(async () => {
      throw new Error("boom");
    });
    const good = q.add(async () => "ok");

    await expect(bad).rejects.toThrow("boom");
    await expect(good).resolves.toBe("ok");
  });

  it("отражает pending и isProcessing", async () => {
    const q = new CommandQueue();
    let release!: () => void;
    const first = q.add(() => new Promise<void>((r) => (release = () => r())));
    const second = q.add(async () => "second");

    expect(q.isProcessing).toBe(true);
    expect(q.pending).toBe(1);

    release();
    await first;
    await second;
    expect(q.pending).toBe(0);
    expect(q.isProcessing).toBe(false);
  });

  it("clear удаляет только ожидающие команды", async () => {
    const q = new CommandQueue();
    let release!: () => void;
    const first = q.add(() => new Promise<void>((r) => (release = () => r())));
    // вторая команда повиснет навсегда — не должна выполняться после clear
    q.add(async () => "never");

    expect(q.pending).toBe(1);
    q.clear();
    expect(q.pending).toBe(0);

    release();
    await first;
  });
});
