import { useCallback, useEffect, useState } from 'react';
import { fetchSkill, fetchSkills } from '../api/client';
import type { SkillDetail, SkillInfo } from '../api/types';

export function useSkills() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSkills();
      setSkills(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSkill = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSkill(name);
      setSelectedSkill(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  return { skills, selectedSkill, loading, error, loadSkill, setSelectedSkill };
}
