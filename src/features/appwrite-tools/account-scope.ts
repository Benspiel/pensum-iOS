import { useCallback } from 'react';
import { useSession } from '../../account/session';
import { PensumError } from '../../contracts';

export function useAccountGuard() {
  const { scope } = useSession();

  return useCallback(() => {
    if (!scope?.isCurrent()) {
      throw new PensumError('unauthenticated', 'Die Sitzung ist abgelaufen. Melde dich erneut an.', 401);
    }
  }, [scope]);
}
