import { useState } from 'preact/hooks';
import { ContextScreen } from './ui/context';
import type { ScreenName } from './ui/editor';
import { IdentifyScreen } from './ui/identify';
import { PrioritizeScreen } from './ui/prioritize';
import { RespondScreen } from './ui/respond';
import { StartScreen } from './ui/start';

// Screens S6 and S7 follow in build tasks 6 and 7.
export function App() {
  const [screen, setScreen] = useState<ScreenName>('start');
  const [id, setId] = useState<string>();
  const navigate = (next: ScreenName): void => {
    setScreen(next);
  };
  if (id !== undefined && screen === 'context') return <ContextScreen id={id} onNavigate={navigate} />;
  if (id !== undefined && screen === 'identify') return <IdentifyScreen id={id} onNavigate={navigate} />;
  if (id !== undefined && screen === 'prioritize') return <PrioritizeScreen id={id} onNavigate={navigate} />;
  if (id !== undefined && screen === 'respond') return <RespondScreen id={id} onNavigate={navigate} />;
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
