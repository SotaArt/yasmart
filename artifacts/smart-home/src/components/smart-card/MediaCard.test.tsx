import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MediaCard } from "./MediaCard";
import type { Device } from "@/lib/yandex";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) }));

vi.mock("@workspace/api-client-react", () => ({
  useControlDevice: () => ({ mutateAsync: mocks.mutateAsync, mutate: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn(), invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

vi.mock("./premium", () => ({
  CardFrame: ({ top, bottom }: any) => (
    <div>
      {top}
      {bottom}
    </div>
  ),
  LuxButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  LuxBar: () => <div data-testid="lux-bar" />,
}));

function mediaDevice(playback: string): Device {
  return {
    id: "media-1",
    name: "Колонка",
    type: "devices.types.media_device",
    capabilities: [
      { type: "devices.capabilities.on_off", state: { instance: "on", value: true } },
      {
        type: "devices.capabilities.mode",
        parameters: { instance: "playback" },
        state: { instance: "playback", value: playback },
      },
      {
        type: "devices.capabilities.range",
        parameters: { instance: "volume" },
        state: { instance: "volume", value: 40 },
      },
    ],
  };
}

beforeEach(() => mocks.mutateAsync.mockClear());
afterEach(cleanup);

async function clickPlayPause(playback: string): Promise<unknown> {
  render(<MediaCard device={mediaDevice(playback)} token="tok" size="expanded" />);
  const buttons = screen.getAllByRole("button");
  fireEvent.click(buttons[1]);
  await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
  return mocks.mutateAsync.mock.calls[0][0].data.actions[0].state.value;
}

describe("MediaCard — управление воспроизведением", () => {
  it("на паузе отправляет play", async () => {
    expect(await clickPlayPause("pause")).toBe("play");
  });

  it("на stopped отправляет play", async () => {
    expect(await clickPlayPause("stop")).toBe("play");
  });

  it.fails(
    "HIGH-баг: при state 'play' кнопка должна отправлять pause, а не play (MediaCard.tsx:45,149)",
    async () => {
      expect(await clickPlayPause("play")).toBe("pause");
    }
  );
});
