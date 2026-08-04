import { MockHostelRepository } from "./mock-repository";
import type { HostelRepository } from "./types";

/**
 * Single place to swap the data source. Point this at an API-backed
 * implementation when the PostgreSQL backend is ready.
 */
export const hostelRepository: HostelRepository = new MockHostelRepository();

export * from "./types";
export { MockHostelRepository } from "./mock-repository";
