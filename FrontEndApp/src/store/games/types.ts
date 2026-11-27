export type GameType = 'qa' | 'tf' | 'fp';
export type GameState = 'idle' | 'playing' | 'answered' | 'gameOver' | 'completed';

export interface GroupProgress {
    group_id: number;
    is_completed: number;
    high_score_percentage: number;
    times_played: number;
    completed_at: string | null;
    updated_at: string;
}

export interface QAQuestion {
    id: number;
    group_id: number;
    question: string;
    options: string[];
    answer: number;
    proof: string;
    explanation: string | null;
}

export interface TFStatement {
    id: number;
    group_id: number;
    statement: string;
    answer: number; // 1 = True, 0 = False
    proof: string;
    explanation: string | null;
}

export interface FPLevel {
    id: number;
    level_order: number;
    word: string;
    image1: string;
    image2: string;
    image3: string;
    image4: string;
}

