import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIGURED, fetchMe, toggleVote } from './api';
import type { Me } from './types';

export function useMe() {
  return useQuery<Me>({ queryKey: ['me'], queryFn: fetchMe, enabled: API_CONFIGURED, retry: 1 });
}

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => toggleVote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: ['skill'] });
    },
  });
}
