import { isIP } from "node:net";
import type { Request } from "express";
export function clientAddress(req: Request) {
  const address = req.ip;
  return address && isIP(address)
    ? address
    : (req.socket.remoteAddress ?? "127.0.0.1");
}
