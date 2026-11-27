export interface OnboardingStep {
    id: string;
    label: string;
    title: string;
    description: string;
    features: string[];
    tip: string;
}

export function onboardingSteps(desktop: boolean): OnboardingStep[] {
    return [
        {
            id: 'reading', label: 'Read', title: 'Make room for the Word',
            description: 'Welcome to Believers Sword. Find a passage, choose a translation, and settle into your daily reading.',
            features: ['Use the book and chapter navigator to open a passage.', 'Search for a word or phrase across the Bible.', 'Select a verse to open its study actions.'],
            tip: 'This short tour introduces the tools. Your Bible and settings stay as they are.',
        },
        {
            id: 'study', label: 'Save', title: 'Keep what speaks to you',
            description: 'Build a study space around the passages you want to remember.',
            features: ['Bookmark verses so you can return to them.', 'Highlight meaningful passages in your preferred colors.', 'Attach clip notes to verses and write longer notes while you study.'],
            tip: 'Use the reader side panels to revisit bookmarks, highlights and clip notes.',
        },
        {
            id: 'references', label: 'Connect', title: 'Let Scripture connect Scripture',
            description: 'Cross-reference cards show related passages with their text, right inside the reader.',
            features: ['Select a verse and open Cross References in the bottom panel.', 'Read the related passages without opening every reference.', 'Scroll through large lists as more cards load.'],
            tip: "Supported Bible versions also provide Strong's numbers for exploring original-language words.",
        },
        {
            id: 'compare', label: 'Compare', title: 'Read translations together',
            description: 'Add reading panels to compare the same passage across translations.',
            features: ['Desktop and web support up to six Bible reading panels.', 'Choose a Bible version for each panel.', 'Resize your reading area to suit your study session.'],
            tip: 'On mobile, Split View supports two reading panes, side by side or top and bottom.',
        },
        {
            id: 'listen', label: 'Listen', title: 'Listen with Verse Reader',
            description: 'Have Scripture read aloud while you follow the passage.',
            features: ['Use the reader playback controls to start or pause.', 'Choose an available voice and adjust reading speed.', desktop ? 'Desktop also offers optional Piper voices alongside system voices.' : 'Web uses the voices provided by your browser and operating system.'],
            tip: 'Voice and language availability depends on your device. Additional voice downloads may need a connection.',
        },
        {
            id: 'appearance', label: 'Personalize', title: 'Make reading comfortable',
            description: 'Shape the reader around your eyes, your screen and your routine.',
            features: ['Adjust the Bible font and text size from the reader toolbar.', 'Choose your theme and accent color in Settings.', 'Arrange the reader panels to give your passage more space.'],
            tip: 'Appearance preferences can be changed any time. Try a comfortable size before a longer reading session.',
        },
        {
            id: 'versions', label: 'Library', title: desktop ? 'Build an offline Bible library' : 'Explore the Bible library',
            description: desktop ? 'Download additional Bible translations or import compatible Bible modules for local reading.' : 'Choose from the online Bible catalog in your browser.',
            features: [desktop ? 'Downloaded Bible versions remain available offline.' : 'Web Bible reading requires an internet connection.', desktop ? 'Manage downloaded and imported versions in Settings > Bible.' : 'For local downloads and offline Bible reading, use the mobile or desktop app.', 'Deuterocanonical books are optional. Enable them in General settings when your Bible version includes them.'],
            tip: 'Enabling optional books does not add missing text to a translation. Choose a version that contains those books.',
        },
        {
            id: 'growth', label: 'Begin', title: 'Grow a daily rhythm',
            description: 'Beyond the reader, find tools for devotion, prayer and continued learning.',
            features: ['Follow Daily Devotional for a guided moment with Scripture.', 'Keep a prayer list and record what you are praying for.', desktop ? 'Visit Grow for study resources, or explore the Bible games.' : 'Visit Grow to explore study resources.'],
            tip: 'You can reopen this walkthrough any time from Help > App tour.',
        },
    ];
}
