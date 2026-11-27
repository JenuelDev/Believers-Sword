export const ALL_SERMON_TOPICS = '';

/** All replaces specific topics; selecting a topic replaces All. */
export function normalizeTopicSelection(values: string[] | null, previous: readonly string[]): string[] {
    const unique = [...new Set(values ?? [])];
    if (unique.includes(ALL_SERMON_TOPICS) && !previous.includes(ALL_SERMON_TOPICS)) {
        return [ALL_SERMON_TOPICS];
    }
    return unique.filter((topic) => topic !== ALL_SERMON_TOPICS);
}

/** PostgREST overlap matches any selected topic, with quoted array members. */
export function sermonTopicQuery(topics: readonly string[]): string | null {
    const values = [...new Set(topics.filter((topic) => topic !== ALL_SERMON_TOPICS))];
    if (!values.length) return null;
    const quoted = values.map((topic) => `"${topic.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    return `ov.{${quoted.join(',')}}`;
}
