import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

/**
 * Custom hook to subscribe to WatermelonDB observables
 * Replaces the legacy @nozbe/with-observables HOC pattern
 *
 * @param observable - A WatermelonDB observable (from model.observe() or query.observe())
 * @param initialValue - Initial value while the observable loads
 * @returns The current value from the observable
 */
export function useObservable<T>(
  observable: Observable<T>,
  initialValue: T
): T {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    const subscription = observable.subscribe(setValue);
    return () => subscription.unsubscribe();
  }, [observable]);

  return value;
}

/**
 * Hook to subscribe to multiple observables at once
 * Useful for complex components that need multiple database subscriptions
 *
 * @param observables - Object with observable values
 * @param initialValues - Object with initial values matching the observables shape
 * @returns Object with current values from all observables
 */
export function useObservables<T extends Record<string, Observable<any>>>(
  observables: T,
  initialValues: { [K in keyof T]: T[K] extends Observable<infer U> ? U : never }
): { [K in keyof T]: T[K] extends Observable<infer U> ? U : never } {
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    const subscriptions = Object.entries(observables).map(([key, observable]) =>
      (observable as Observable<any>).subscribe((value) =>
        setValues((prev) => ({ ...prev, [key]: value }))
      )
    );

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [observables]);

  return values;
}
