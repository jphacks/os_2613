import { createContext, useContext, type ReactNode, type ComponentProps } from 'react';
import { Modal, View } from 'react-native';
export type StudyTool = 'chapters' | 'display' | 'music' | null;
export const StudyToolsContext = createContext<{ active: StudyTool; select: (tool: StudyTool) => void; toolbar: ReactNode } | null>(null);
export function StudyToolPanel({ children, ...props }: ComponentProps<typeof Modal>) {
  const tools = useContext(StudyToolsContext);
  return <Modal {...props}><View style={{ flex: 1, paddingLeft: tools ? 76 : 0 }}>{children}</View>{tools && <View pointerEvents="box-none" style={{ position: 'absolute', left: 8, top: 54, bottom: 12, width: 60 }}>{tools.toolbar}</View>}</Modal>;
}
