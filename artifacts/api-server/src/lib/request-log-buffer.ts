interface BufferedRequest {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip: string;
}

const MAX_ENTRIES = 200;
const buffer: BufferedRequest[] = [];

export function bufferRequest(req: BufferedRequest): void {
  buffer.push(req);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function getRequestLog(): BufferedRequest[] {
  return [...buffer];
}

export function clearRequestLog(): void {
  buffer.length = 0;
}
