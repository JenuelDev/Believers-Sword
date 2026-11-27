import { apiRequest } from './http';

type Game = 'qa' | 'tf';
type SaveArgs = { groupId: number; correctCount: number; totalCount: number; passingScore: number };
type Request = typeof apiRequest;
type Round = { requestId: string; revision: string; token: string | null };
type LifeState = { lives: number; next_recovery_at: string | null };

/** Keep each round's revision and request ID until its save is confirmed. */
export function createGameBridge(request: Request = apiRequest) {
    const rounds = new Map<Game, Round>();
    let lifeRequest: { id: string; token: string | null } | null = null;
    let latestLives: { state: LifeState; token: string | null } | null = null;
    type Pictures = { levels: any[]; revision: string; image_base_url: string };
    let fpRound: { revision: string; token: string | null } | null = null;
    let fpLoading: { token: string | null; promise: Promise<Pictures> } | null = null;
    const solves = new Map<number, Round>();
    const token = () => localStorage.getItem('auth_token');
    const checkSession = (expected: string | null) => {
        if (!expected || expected !== token()) throw new Error('Your account changed. Reopen the game to continue.');
    };
    async function get<T>(path: string): Promise<T> {
        const expected = token();
        const result = await request<T>(path);
        checkSession(expected);
        return result;
    }
    async function questions(game: Game, group: number): Promise<any[]> {
        const expected = token();
        const result = await get<{ items: any[]; revision: string }>(`/games/${game}/groups/${group}/questions`);
        rounds.set(game, { requestId: crypto.randomUUID(), revision: result.revision, token: expected });
        const items = [...result.items];
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }
    async function save(game: Game, args: SaveArgs) {
        const round = rounds.get(game);
        if (!round) throw new Error('Reload this group before saving.');
        checkSession(round.token);
        const result = await request<{ newlyPassed: boolean }>(`/games/${game}/groups/${args.groupId}/progress`, {
            method: 'POST', body: JSON.stringify({ request_id: round.requestId, revision: round.revision,
                correct_count: args.correctCount, total_count: args.totalCount }),
        });
        checkSession(round.token);
        return result;
    }
    async function loadPictures(): Promise<Pictures> {
        const expected = token();
        if (fpLoading?.token === expected) return fpLoading.promise;
        const pending = get<Pictures>('/games/fp/levels').then((result) => {
            fpRound = { revision: result.revision, token: expected };
            return result;
        });
        fpLoading = { token: expected, promise: pending };
        try { return await pending; }
        finally { if (fpLoading?.promise === pending) fpLoading = null; }
    }
    async function lives() {
        const expected = token();
        const state = await get<LifeState>('/games/lives');
        latestLives = { state, token: expected };
        return state;
    }
    return {
        qaGetGroups: async () => (await get<{ groups: any[] }>('/games/qa/groups')).groups,
        qaGetQuestionsForGroup: (group: number) => questions('qa', group),
        qaGetAllGroupProgress: () => get<any[]>('/games/qa/progress'),
        qaSaveGroupProgress: (args: SaveArgs) => save('qa', args),
        tfGetGroups: async () => (await get<{ groups: any[] }>('/games/tf/groups')).groups,
        tfGetStatementsForGroup: (group: number) => questions('tf', group),
        tfGetAllGroupProgress: () => get<any[]>('/games/tf/progress'),
        tfSaveGroupProgress: (args: SaveArgs) => save('tf', args),
        gameGetLives: async () => (await lives()).lives,
        gameNextRecoveryAt: async () => {
            const state = latestLives?.token === token() ? latestLives.state : await lives();
            latestLives = null;
            return state.next_recovery_at;
        },
        gameLoseLife: async () => {
            if (!lifeRequest || lifeRequest.token !== token()) lifeRequest = { id: crypto.randomUUID(), token: token() };
            const pending = lifeRequest;
            checkSession(pending.token);
            const state = await request<LifeState>('/games/lives/lose', {
                method: 'POST', body: JSON.stringify({ request_id: pending.id }),
            });
            checkSession(pending.token);
            latestLives = { state, token: pending.token };
            lifeRequest = null;
            return state.lives;
        },
        gameRefillLives: async () => { throw new Error('Lives recover automatically.'); },
        gameResetProgress: async () => { throw new Error('Reset is available in desktop development builds.'); },
        fpGetLevels: async () => (await loadPictures()).levels,
        fpGetSolvedLevelIds: () => get<number[]>('/games/fp/progress'),
        fpGetImagesBasePath: async () => (await loadPictures()).image_base_url,
        fpMarkLevelSolved: async (level: number) => {
            const round = fpRound;
            if (!round) throw new Error('Reload this game before saving.');
            checkSession(round.token);
            let attempt = solves.get(level);
            if (!attempt || attempt.token !== round.token || attempt.revision !== round.revision) {
                attempt = { ...round, requestId: crypto.randomUUID() };
                solves.set(level, attempt);
            }
            await request(`/games/fp/levels/${level}/solve`, { method: 'POST',
                body: JSON.stringify({ request_id: attempt.requestId, revision: round.revision }) });
            checkSession(round.token);
        },
    };
}
