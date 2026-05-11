import {
  computeModuleProgress,
  uaWeightSeconds,
  DEFAULT_QUIZ_DURATION_SECONDS,
  DEFAULT_RESOURCE_DURATION_SECONDS,
  DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS,
} from '../src/shared/moduleProgress';

describe('moduleProgress', () => {
  describe('uaWeightSeconds', () => {
    it('utilise videoContent.durationSeconds pour une UA video', () => {
      expect(uaWeightSeconds({ type: 'video', videoDurationSeconds: 600 })).toBe(600);
    });

    it('utilise le fallback video si durationSeconds null', () => {
      expect(uaWeightSeconds({ type: 'video', videoDurationSeconds: null })).toBe(DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS);
    });

    it('utilise le fallback video si durationSeconds undefined', () => {
      expect(uaWeightSeconds({ type: 'video' })).toBe(DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS);
    });

    it('utilise le fallback video si durationSeconds=0 (donnee invalide)', () => {
      expect(uaWeightSeconds({ type: 'video', videoDurationSeconds: 0 })).toBe(DEFAULT_VIDEO_FALLBACK_DURATION_SECONDS);
    });

    it('utilise DEFAULT_QUIZ_DURATION_SECONDS pour une UA quiz', () => {
      expect(uaWeightSeconds({ type: 'quiz' })).toBe(DEFAULT_QUIZ_DURATION_SECONDS);
    });

    it('utilise DEFAULT_RESOURCE_DURATION_SECONDS pour une UA resource', () => {
      expect(uaWeightSeconds({ type: 'resource' })).toBe(DEFAULT_RESOURCE_DURATION_SECONDS);
    });
  });

  describe('computeModuleProgress', () => {
    it('module vide : progression 0%, statut not_started', () => {
      expect(computeModuleProgress([])).toEqual({
        status: 'not_started',
        progressPercent: 0,
        totalUAs: 0,
        completedUAs: 0,
      });
    });

    it('aucune UA terminee : not_started', () => {
      const r = computeModuleProgress([
        { status: 'not_started', type: 'video', videoDurationSeconds: 300 },
        { status: 'in_progress', type: 'quiz' },
      ]);
      expect(r.status).toBe('not_started');
      expect(r.progressPercent).toBe(0);
      expect(r.totalUAs).toBe(2);
      expect(r.completedUAs).toBe(0);
    });

    it('toutes les UAs terminees : completed, 100%', () => {
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: 300 },
        { status: 'completed', type: 'quiz' },
        { status: 'completed', type: 'resource' },
      ]);
      expect(r.status).toBe('completed');
      expect(r.progressPercent).toBe(100);
      expect(r.completedUAs).toBe(3);
    });

    it('au moins une UA terminee (pas toutes) : in_progress', () => {
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: 300 },
        { status: 'not_started', type: 'quiz' },
      ]);
      expect(r.status).toBe('in_progress');
    });

    // Cas demande par le user : ratio simple 50% vs pondere different
    it('3 UAs egales (3 quiz, 1 terminee) : 33% pondere == 33% ratio simple', () => {
      // Toutes du meme type → meme poids → pondere == ratio simple
      const r = computeModuleProgress([
        { status: 'completed', type: 'quiz' },
        { status: 'not_started', type: 'quiz' },
        { status: 'not_started', type: 'quiz' },
      ]);
      expect(r.progressPercent).toBe(33); // 120 / (120*3) = 33.33 → 33
      expect(r.status).toBe('in_progress');
    });

    it('1 longue video (600s) terminee + 2 courtes quiz (120s) non : ~71% pondere (ratio simple = 33%)', () => {
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: 600 },
        { status: 'not_started', type: 'quiz' },
        { status: 'not_started', type: 'quiz' },
      ]);
      // weight: 600 + 120 + 120 = 840 ; completedWeight = 600 ; 600/840 = 71.43 → 71
      expect(r.progressPercent).toBe(71);
      expect(r.status).toBe('in_progress');
      // Ratio simple aurait donne 33% (1/3) — c'est la difference majeure vs V0
    });

    it('miroir : 2 courtes terminees + 1 longue non = ratio simple 67% mais pondere ~29%', () => {
      const r = computeModuleProgress([
        { status: 'not_started', type: 'video', videoDurationSeconds: 600 },
        { status: 'completed', type: 'quiz' },
        { status: 'completed', type: 'quiz' },
      ]);
      // weight: 600 + 120 + 120 = 840 ; completedWeight = 240 ; 240/840 = 28.57 → 29
      expect(r.progressPercent).toBe(29);
      expect(r.status).toBe('in_progress');
    });

    it('fallback video sans durationSeconds : poids 60s', () => {
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: null },
        { status: 'not_started', type: 'video', videoDurationSeconds: null },
      ]);
      // weight: 60 + 60 = 120 ; completedWeight = 60 ; 60/120 = 50%
      expect(r.progressPercent).toBe(50);
    });

    it('arrondi standard (Math.round)', () => {
      // 1 video 100s terminee + 1 quiz 200s non → 100 / 300 = 33.33 → 33
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: 100 },
        { status: 'not_started', type: 'video', videoDurationSeconds: 200 },
      ]);
      expect(r.progressPercent).toBe(33);
    });

    it('status binaire reste independant des poids', () => {
      // Une seule UA tres lourde terminee + une legere non
      const r = computeModuleProgress([
        { status: 'completed', type: 'video', videoDurationSeconds: 100000 },
        { status: 'not_started', type: 'resource' },
      ]);
      // Progression ~100% mais on n'a PAS encore tout fait → in_progress
      expect(r.status).toBe('in_progress');
      expect(r.progressPercent).toBe(100); // 100000 / 100060 = 99.94 → 100
    });
  });
});
