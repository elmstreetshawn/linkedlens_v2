export function scoreHumanContent(content) {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (words.length < 10) {
        return {
            humanScore: 50,
            verdict: "⚠️ Content too short for reliable analysis",
            aiScore: 50
        };
    }
    
    // Start with baseline human assumption
    let score = 80;
    
    // Pattern #1: Suspect Sentence Structure - Robotic rhythm and uniformity
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const sentenceLengths = sentences.map(s => s.split(' ').length);
    const sentenceLengthVariance = sentenceLengths.length > 1 ? 
        sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgWordsPerSentence, 2), 0) / sentenceLengths.length : 0;
    
    // AI tends to write uniform 15-25 word sentences
    if (avgWordsPerSentence > 15) {
        if (avgWordsPerSentence < 25) {
            if (sentenceLengthVariance < 20) {
                score -= 10; // Very uniform sentence structure
            }
        }
    }
    if (avgWordsPerSentence > 30) score -= 8; // Overly long sentences
    
    // Pattern #2: AI Buzzwords and Formal Language (based on Shawn's table)
    const aiBuzzwords = /\b(utilize|leverage|implement|optimize|comprehensive|robust|seamless|innovative|cutting-edge|delve\s+into|facilitate|enable|streamline|enhance|harness|explore|unveil|drive|disrupt|synergy|solution|ecosystem|stakeholders|empower|pivot|deploy|iterate)\b/gi;
    const buzzwordMatches = (content.match(aiBuzzwords) || []).length;
    const buzzwordDensity = buzzwordMatches / Math.max(words.length / 100, 1);
    if (buzzwordDensity > 1) score -= Math.min(buzzwordDensity * 8, 20);
    
    // Pattern #3: Lack of Personal Touch - No PII or personal anecdotes
    const personalIndicators = /\b(I|me|my|we|us|our|you|your)\b/gi;
    const personalMatches = (content.match(personalIndicators) || []).length;
    const personalStories = /(my\s+\w+|I\s+(tried|learned|discovered|found|realized|experienced)|when\s+I|last\s+(week|month|year)|recently\s+I)/gi;
    const storyMatches = (content.match(personalStories) || []).length;
    
    // Check for manufactured personal stories (too convenient/on-topic)
    const manufacturedStories = /(\(yes[^)]*\)|came\s+from\s+a\s+personal\s+experience|made\s+me\s+think|pushed\s+me\s+to)/gi;
    const manufacturedMatches = (content.match(manufacturedStories) || []).length;
    
    if (personalMatches === 0) {
        if (storyMatches === 0) {
            score -= 15; // No personal connection
        }
    }
    if (personalMatches > 0) score += 5; // Reward personal language
    if (storyMatches > 0) {
        if (manufacturedMatches === 0) {
            score += 8; // Reward genuine personal anecdotes
        }
    }
    if (manufacturedMatches > 0) score -= 10; // Penalize manufactured stories
    
    // Pattern #4: The Overexplainer Loop - Repetitive explanations
    const overexplainerPatterns = /\b(helpful\s+.*helpful|useful\s+.*useful|important\s+.*important|essentially\s+.*essentially|basically\s+.*basically)\b/gi;
    const circularDefinitions = /\b(\w+)\s+.*\s+\1\b/gi; // Words that repeat in close proximity
    const overexplainerMatches = (content.match(overexplainerPatterns) || []).length;
    const circularMatches = (content.match(circularDefinitions) || []).length;
    
    if (overexplainerMatches > 0) score -= overexplainerMatches * 5;
    if (circularMatches > 2) score -= 10; // Circular definitions
    
    // Pattern #5: Formal Transition Word Addiction
    const formalTransitions = /\b(furthermore|moreover|additionally|however|therefore|consequently|subsequently|nevertheless|nonetheless|in\s+conclusion|as\s+previously\s+mentioned|it\s+should\s+be\s+(mentioned|noted)|it\s+is\s+important\s+to\s+note)\b/gi;
    const formalTransitionMatches = (content.match(formalTransitions) || []).length;
    const transitionDensity = formalTransitionMatches / Math.max(sentences.length, 1);
    
    if (transitionDensity > 0.2) score -= 12; // More than 20% of sentences have formal transitions
    if (formalTransitionMatches > 0) score -= formalTransitionMatches * 3;
    
    // Pattern #6: Stat Salad and Quote Soup - Generic statistics without sources
    const genericStats = /(studies\s+show|\d+%\s+of\s+(businesses|companies|people)|according\s+to\s+experts|research\s+(indicates|suggests|shows))/gi;
    const statMatches = (content.match(genericStats) || []).length;
    if (statMatches > 0) score -= statMatches * 6; // Unsourced statistics are red flags
    
    // Triplet Addiction - AI loves groups of three
    const triplets = /(\w+),\s*(\w+),?\s*and\s+(\w+)|(\w+),\s*(\w+),?\s*(\w+)(?!\s*and)/gi;
    const tripletMatches = (content.match(triplets) || []).length;
    const explicitNumbers = /(three\s+(types|ways|reasons|steps|things|methods|approaches)|(\d+)\s+different)/gi;
    const explicitNumberMatches = (content.match(explicitNumbers) || []).length;
    
    if (tripletMatches > 2) score -= tripletMatches * 4; // Heavy triplet usage
    if (explicitNumberMatches > 0) score -= explicitNumberMatches * 6; // Stating numbers explicitly
    
    // Em-dash and Ellipsis Abuse
    const emDashes = (content.match(/—/g) || []).length;
    const ellipses = (content.match(/\.{3,}/g) || []).length;
    const dashEllipsisTotal = emDashes + ellipses;
    
    if (dashEllipsisTotal > 2) score -= dashEllipsisTotal * 3;
    if (emDashes > 1 && ellipses > 1) score -= 8; // Using both suggests confusion
    
    // Parenthetical Asides (AI loves unnecessary clarification)
    const parentheticals = (content.match(/\([^)]*\)/g) || []).length;
    if (parentheticals > 2) score -= parentheticals * 2;
    
    // Exclamation Mark Clusters (AI gets "excited" artificially)
    const exclamationClusters = (content.match(/!{2,}/g) || []).length;
    if (exclamationClusters > 0) score -= exclamationClusters * 4;
    
    // "In fact" and similar connectors (AI overuses these)
    const factConnectors = /\b(in\s+fact|actually|indeed|certainly|clearly|obviously|undoubtedly|without\s+a\s+doubt)\b/gi;
    const factConnectorMatches = (content.match(factConnectors) || []).length;
    if (factConnectorMatches > 1) score -= factConnectorMatches * 3;
    
    // Human-like qualities (rewards)
    const contractions = /(n't|'re|'ve|'ll|'d|'s|'m|can't|won't|shouldn't|wouldn't|couldn't|haven't|hasn't|hadn't|isn't|aren't|wasn't|weren't|don't|doesn't|didn't)/gi;
    const contractionMatches = (content.match(contractions) || []).length;
    if (contractionMatches > 0) score += Math.min(contractionMatches * 2, 8);
    
    // Sentence starter diversity (humans vary more)
    const sentenceStarters = sentences.map(s => s.trim().split(' ')[0]?.toLowerCase()).filter(s => s);
    const uniqueStarters = new Set(sentenceStarters);
    const starterDiversity = sentenceStarters.length > 0 ? uniqueStarters.size / sentenceStarters.length : 0;
    if (starterDiversity > 0.7) score += 5;
    if (starterDiversity < 0.4) score -= 8;
    
    // Vocabulary diversity
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    const vocabularyDiversity = uniqueWords.size / words.length;
    if (vocabularyDiversity > 0.6) score += 5;
    if (vocabularyDiversity < 0.4) score -= 5;
    
    // Questions and fragments (humans use more)
    const questions = (content.match(/\?/g) || []).length;
    if (questions > 0) score += Math.min(questions * 2, 6);
    
    // Ensure score stays within bounds
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // Generate verdict
    let verdict = '';
    if (score >= 80) verdict = "✅ Reads like a human.";
    else if (score >= 65) verdict = "🟡 Mostly human-like, with some AI patterns.";
    else if (score >= 45) verdict = "⚠️ Contains multiple AI patterns.";
    else verdict = "❌ Strong AI signature detected.";
    
    return {
        humanScore: score,
        // The AI score is the inverse of the human score.
        aiScore: 100 - score,
        verdict,
    };
}