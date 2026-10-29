import { useState } from 'preact/hooks';
import { ContextScreen } from './ui/context';
import type { ScreenName } from './ui/editor';
import { IdentifyScreen } from './ui/identify';
import { StartScreen } from './ui/start';

// Screens S4 to S7 follow in build tasks 5 to 7.
export function App() {
  const [screen, setScreen] = useState<ScreenName>('start');
  const [id, setId] = useState<string>();
  const navigate = (next: ScreenName): void => {
    setScreen(next);
  };
  if (id !== undefined && screen === 'context') return <ContextScreen id={id} onNavigate={navigate} />;
  if (id !== undefined && screen === 'identify') return <IdentifyScreen id={id} onNavigate={navigate} />;
  return (
    <StartScreen
      selectedId={id}
      onOpen={(documentId, next) => {
        setId(documentId);
        setScreen(next);
      }}
    />
  );
}
