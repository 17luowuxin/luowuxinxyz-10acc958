import type { LocalBackupPackage } from './localDataStore';

const rescueTables = new Set(['characters', 'chat_messages', 'user_stickers', 'character_stickers', 'character_memories', 'world_books', 'world_book_entries']);

export function selectRescueBackup(backup: LocalBackupPackage): LocalBackupPackage {
  return { ...backup, tables: Object.fromEntries(Object.entries(backup.tables).filter(([table]) => rescueTables.has(table))) };
}

export async function deliverRescueBackup(file: File): Promise<void> {
  if (window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '本机资料备份' });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}