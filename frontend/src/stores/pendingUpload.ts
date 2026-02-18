/**
 * Simple module-level store to hold pending upload files across navigation.
 * File objects can't be serialized through React Router state, so we store
 * them here temporarily between Dashboard -> ProjectView navigation.
 */

const pendingFiles = new Map<number, File[]>();

export function setPendingUpload(projectId: number, files: File[]) {
  pendingFiles.set(projectId, files);
}

export function getPendingUpload(projectId: number): File[] | null {
  const files = pendingFiles.get(projectId) || null;
  if (files) pendingFiles.delete(projectId); // consume once
  return files;
}

export function hasPendingUpload(projectId: number): boolean {
  return pendingFiles.has(projectId);
}
