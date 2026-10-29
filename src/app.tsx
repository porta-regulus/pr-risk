import { useState } from 'preact/hooks';
import { ContextScreen } from './ui/context';
import { StartScreen } from './ui/start';

type Screen = { readonly name: 'start'; readonly id?: string } | { readonly name: 'context'; readonly id: string };

// Screens S3 to S7 follow in build tasks 5 to 7.
export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' });
  if (screen.name === 'context') {
    return (
      <ContextScreen
        id={screen.id}
        onBack={() => {
          setScreen({ name: 'start', id: screen.id });
        }}
      />
    );
  }
  return (
    <StartScreen
      selectedId={screen.id}
      onOpenContext={(id) => {
        setScreen({ name: 'context', id });
      }}
    />
  );
}
