import type { ReactNode } from 'react';
export function DesktopReaderPopover({ children }: { visible: boolean; label: string; onClose: () => void; children: ReactNode }) { return <>{children}</>; }
