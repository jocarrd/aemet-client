import type { Transport } from "../transport.js";

export abstract class Resource {
  protected readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }
}
