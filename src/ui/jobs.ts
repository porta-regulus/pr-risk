// Engine jobs for the screens. A job runs in the engine worker when its key changes, after a
// short pause. A newer key, or leaving the screen, cancels the older job (SPEC.md Sec. 8.16).
import { useEffect, useState } from 'preact/hooks';
import { CancelledError, runJob, type ResultOf } from '../engine/client';
import type { EngineRequest } from '../engine/protocol';

export interface JobState<T> {
  readonly result?: T;
  // The key of the run that gave the result.
  readonly resultKey?: string;
  readonly running: boolean;
  readonly error?: string;
  readonly progress?: readonly [number, number];
}

export function useEngine<R extends EngineRequest>(key: string | undefined, request: () => R, delay = 300): JobState<ResultOf<R['kind']>> {
  const [state, setState] = useState<JobState<ResultOf<R['kind']>>>({
    running: false,
  });
  useEffect(() => {
    if (key === undefined) {
      setState((current) => ({
        ...(current.result === undefined ? {} : { result: current.result }),
        ...(current.resultKey === undefined ? {} : { resultKey: current.resultKey }),
        running: false,
      }));
      return undefined;
    }
    let job: ReturnType<typeof runJob<R>> | undefined;
    setState((current) => ({
      ...(current.result === undefined ? {} : { result: current.result }),
      ...(current.resultKey === undefined ? {} : { resultKey: current.resultKey }),
      running: true,
    }));
    const timer = setTimeout(() => {
      job = runJob(request(), (done, total) => {
        setState((current) => ({ ...current, progress: [done, total] }));
      });
      job.result.then(
        (result) => {
          setState({ result, resultKey: key, running: false });
        },
        (error: unknown) => {
          if (error instanceof CancelledError) return;
          setState({
            running: false,
            error: error instanceof Error ? error.message : String(error),
          });
        },
      );
    }, delay);
    return () => {
      clearTimeout(timer);
      job?.cancel();
    };
  }, [key]);
  return state;
}
