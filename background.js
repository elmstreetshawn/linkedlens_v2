import { scoreHumanContent } from './detector.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkedLens installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { message, postId } = request;
  const tabId = sender.tab?.id;

  switch (message) {
    case "getPosts":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            function: scrapePosts,
          });
        }
      });
      break;

    case "ignorePost":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          // Forward the ignore command to the content script in the active tab
          chrome.tabs.sendMessage(tabs[0].id, { message: "ignorePost", postId: postId });
        }
      });
      break;

    case "postsExtracted":
      if (!tabId) return; // Exit if we don't have a tab ID

      // 1. Analyze each post using the imported detection algorithm
      const postsWithScores = request.data.map(post => {
        const analysis = scoreHumanContent(post.content);
        return { ...post, score: analysis.aiScore, verdict: analysis.verdict };
      });

      // A. Save the results to session storage, keyed by the tab ID
      const storageKey = `lastScanResults_${tabId}`;
      chrome.storage.session.set({ [storageKey]: postsWithScores });

      // 2. Send a message to the content script (injector.js) for each post to inject the UI
      postsWithScores.forEach(post => {
        chrome.tabs.sendMessage(tabId, {
          message: "injectAiScore",
          postId: post.id,
          score: post.score // The injector only needs the score
        }).catch(error => {
          // This error can happen if the content script is not ready or the tab is closed.
          if (!error.message.includes("Receiving end does not exist")) {
            console.error("[LinkedLens] Error injecting score:", error);
          }
        });
      });

      // 3. Send the analyzed data back to the popup for display
      chrome.runtime.sendMessage({ message: "postsAnalyzed", data: postsWithScores, tabId: tabId })
        .catch(error => {
          // This error is expected if the popup is closed after scanning. We can safely ignore it.
          if (!error.message.includes("Receiving end does not exist")) {
            console.error("[LinkedLens] Error sending analysis to popup:", error);
          }
        });
      break;
  }
});

function scrapePosts() {
  // LinkedIn post containers often have a 'data-urn' attribute starting with 'urn:li:activity:'
  const postElements = document.querySelectorAll('div[data-urn^="urn:li:activity:"]');

  const postsData = Array.from(postElements).map(post => {
    // Use the URN as a unique and stable ID for the post
    const id = post.getAttribute('data-urn');

    // --- Robust Author Scraping ---
    // LinkedIn's DOM is inconsistent. We try several selectors in order of reliability.
    const authorSelectors = [
      'span.feed-shared-actor__name > span[aria-hidden="true"]',   // Standard feed post author
      '.update-components-actor__name span[aria-hidden="true"]',   // Alternative actor name
      'a.update-components-actor__meta-link span[aria-hidden="true"]', // Author inside a link
      '.feed-shared-actor__name',                                  // Broader fallback for name container
      '.update-components-actor__name',                            // Broader fallback for name container
      'span.text-view-model > span[aria-hidden="true"]'            // Another common pattern
    ];
    let author = 'Unknown Author';
    for (const selector of authorSelectors) {
      const authorElement = post.querySelector(selector);
      if (authorElement && authorElement.innerText.trim()) {
        author = authorElement.innerText.trim().split('\n')[0]; // Get only the name, not subtitle
        break;
      }
    }

    // --- Robust Timestamp Scraping ---
    const timeSelectors = [
      '.update-components-actor__sub-description span[aria-hidden="true"]', // Primary selector
      'span.feed-shared-actor__sub-description'                           // Fallback
    ];
    let timestamp = 'Unknown Time';
    for (const selector of timeSelectors) {
      const timeElement = post.querySelector(selector);
      if (timeElement && timeElement.innerText.trim()) {
        timestamp = timeElement.innerText.trim().split('•')[0].trim(); // Clean up "Edited" or other text
        break;
      }
    }

    // --- More Specific Content Scraping ---
    const contentElement = post.querySelector('.update-components-text.feed-shared-update-v2__commentary, .update-components-text.update-components-update-v2__commentary');
    const content = contentElement ? contentElement.innerText.trim() : '';

    return { id, author, timestamp, content };
  }).filter(post => post.content); // Only include posts that have text content

  chrome.runtime.sendMessage({ message: "postsExtracted", data: postsData });
}