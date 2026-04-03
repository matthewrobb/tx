import type { StoragePort } from '../ports/storage.js';
import type { ProjectionPort } from '../ports/projection.js';
import type { DaemonRequest, DaemonResponse } from '../types/protocol.js';
export declare function handleNext(db: StoragePort, projection: ProjectionPort, req: Extract<DaemonRequest, {
    command: 'next';
}>): Promise<DaemonResponse>;
export declare function handleStatus(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'status';
}>): Promise<DaemonResponse>;
export declare function handleOpen(db: StoragePort, _projection: ProjectionPort, req: Extract<DaemonRequest, {
    command: 'open';
}>): Promise<DaemonResponse>;
export declare function handleClose(db: StoragePort, _projection: ProjectionPort, req: Extract<DaemonRequest, {
    command: 'close';
}>): Promise<DaemonResponse>;
export declare function handleWrite(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'write';
}>): Promise<DaemonResponse>;
export declare function handleRead(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'read';
}>): Promise<DaemonResponse>;
export declare function handleNote(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'note';
}>): Promise<DaemonResponse>;
export declare function handlePickup(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'pickup';
}>): Promise<DaemonResponse>;
export declare function handleHandoff(db: StoragePort, _req: Extract<DaemonRequest, {
    command: 'handoff';
}>): Promise<DaemonResponse>;
export declare function handleCheckpoint(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'checkpoint';
}>): Promise<DaemonResponse>;
export declare function handleCycleStart(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'cycle_start';
}>): Promise<DaemonResponse>;
export declare function handleCyclePull(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'cycle_pull';
}>): Promise<DaemonResponse>;
export declare function handleCycleClose(db: StoragePort, req: Extract<DaemonRequest, {
    command: 'cycle_close';
}>): Promise<DaemonResponse>;
//# sourceMappingURL=handlers.d.ts.map